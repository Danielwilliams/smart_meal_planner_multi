"""
Debug endpoints for subscription functionality.
Only enable these in development or when troubleshooting!
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import JSONResponse
import logging
import json
from typing import Optional, Dict, Any
from datetime import datetime

from app.utils.auth_middleware import get_user_from_token
from app.db import get_db_connection, get_db_cursor

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/debug/subscriptions", tags=["debug"])

@router.get("/webhook-events")
async def get_webhook_events(
    limit: int = 20,
    user = Depends(get_user_from_token)
):
    """
    Get recent webhook events
    
    This is a debug endpoint to verify webhook processing
    """
    # Check if user is admin
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT * FROM subscription_events
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            
            events = cur.fetchall()
            return {"success": True, "events": events}
    except Exception as e:
        logger.error(f"Error fetching webhook events: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/manual-webhook")
async def process_manual_webhook(
    request: Request,
    webhook_type: str = Body(...),
    user = Depends(get_user_from_token)
):
    """
    Manually process a webhook event for testing
    
    This simulates receiving a webhook from Stripe
    """
    # Check if user is admin
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get the request body
        body = await request.json()
        logger.info(f"Processing manual webhook: {webhook_type}")
        logger.info(f"Webhook data: {body}")
        
        # Create an event record
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                INSERT INTO subscription_events (
                    subscription_id, event_type, event_data, payment_provider, processed
                ) VALUES (
                    %s, %s, %s, %s, TRUE
                ) RETURNING id
            """, (
                body.get('subscription_id'),
                f"manual_{webhook_type}",
                json.dumps(body),
                'stripe'
            ))
            
            event_id = cur.fetchone()[0]
            
        return {
            "success": True,
            "message": f"Manual webhook processed: {webhook_type}",
            "event_id": event_id
        }
    except Exception as e:
        logger.error(f"Error processing manual webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/user-subscriptions")
async def get_user_subscriptions(
    user_id: Optional[int] = None,
    user = Depends(get_user_from_token)
):
    """
    Get subscriptions for a specific user or the current user
    
    This is a debug endpoint to verify subscription records
    """
    # Check if user is admin or getting their own info
    target_user_id = user_id or user.get('user_id')
    if not user.get('is_admin', False) and target_user_id != user.get('user_id'):
        raise HTTPException(status_code=403, detail="Admin access required to view other users")
    
    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Get subscription directly
            cur.execute("""
                SELECT * FROM subscriptions
                WHERE user_id = %s
            """, (target_user_id,))
            
            subscription = cur.fetchone()
            
            # Also check for organization subscriptions
            cur.execute("""
                SELECT o.id as org_id, o.name as org_name, s.* 
                FROM organizations o
                JOIN subscriptions s ON o.subscription_id = s.id
                JOIN organization_clients oc ON o.id = oc.organization_id
                WHERE oc.client_id = %s
            """, (target_user_id,))
            
            org_subscription = cur.fetchone()
            
            return {
                "success": True, 
                "user_id": target_user_id,
                "personal_subscription": subscription,
                "organization_subscription": org_subscription
            }
    except Exception as e:
        logger.error(f"Error fetching user subscriptions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/db-tables")
async def get_db_tables(user = Depends(get_user_from_token)):
    """
    Check if the subscription-related tables exist in the database
    
    This is a debug endpoint to verify database setup
    """
    # Check if user is admin
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Check if tables exist
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name IN ('subscriptions', 'subscription_events', 'invoices')
            """)
            
            tables = cur.fetchall()
            table_names = [t['table_name'] for t in tables]
            
            # Check table structure
            table_columns = {}
            for table in table_names:
                cur.execute(f"""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = %s
                """, (table,))
                
                columns = cur.fetchall()
                table_columns[table] = columns
            
            return {
                "success": True,
                "tables_exist": table_names,
                "missing_tables": [t for t in ['subscriptions', 'subscription_events', 'invoices'] if t not in table_names],
                "table_columns": table_columns
            }
    except Exception as e:
        logger.error(f"Error checking database tables: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.post("/create-tables")
async def create_subscription_tables(user = Depends(get_user_from_token)):
    """
    Create subscription-related tables if they don't exist
    
    This is a debug endpoint to set up the database
    """
    # Check if user is admin
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            # Create subscriptions table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    organization_id INTEGER,
                    subscription_type VARCHAR(50) NOT NULL,
                    payment_provider VARCHAR(50) NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'active',
                    monthly_amount DECIMAL(10, 2) NOT NULL,
                    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                    current_period_start TIMESTAMP WITH TIME ZONE,
                    current_period_end TIMESTAMP WITH TIME ZONE,
                    trial_start TIMESTAMP WITH TIME ZONE,
                    trial_end TIMESTAMP WITH TIME ZONE,
                    canceled_at TIMESTAMP WITH TIME ZONE,
                    cancel_at_period_end BOOLEAN DEFAULT FALSE,
                    stripe_customer_id VARCHAR(255),
                    stripe_subscription_id VARCHAR(255),
                    stripe_price_id VARCHAR(255),
                    stripe_status VARCHAR(50),
                    paypal_subscription_id VARCHAR(255),
                    paypal_plan_id VARCHAR(255),
                    paypal_status VARCHAR(50),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT subscriptions_user_or_org CHECK (
                        (user_id IS NOT NULL AND organization_id IS NULL) OR
                        (user_id IS NULL AND organization_id IS NOT NULL)
                    )
                )
            """)
            
            # Create subscription_events table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS subscription_events (
                    id SERIAL PRIMARY KEY,
                    subscription_id INTEGER NOT NULL,
                    event_type VARCHAR(100) NOT NULL,
                    event_data TEXT NOT NULL,
                    payment_provider VARCHAR(50) NOT NULL,
                    provider_event_id VARCHAR(255),
                    processed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT fk_subscription_events_subscription_id
                        FOREIGN KEY (subscription_id)
                        REFERENCES subscriptions(id)
                        ON DELETE CASCADE
                )
            """)
            
            # Create invoices table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS invoices (
                    id SERIAL PRIMARY KEY,
                    subscription_id INTEGER NOT NULL,
                    payment_provider VARCHAR(50) NOT NULL,
                    invoice_number VARCHAR(100) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    amount_due DECIMAL(10, 2) NOT NULL,
                    amount_paid DECIMAL(10, 2),
                    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                    period_start TIMESTAMP WITH TIME ZONE,
                    period_end TIMESTAMP WITH TIME ZONE,
                    due_date TIMESTAMP WITH TIME ZONE,
                    paid_at TIMESTAMP WITH TIME ZONE,
                    stripe_invoice_id VARCHAR(255),
                    paypal_invoice_id VARCHAR(255),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_invoices_subscription_id
                        FOREIGN KEY (subscription_id)
                        REFERENCES subscriptions(id)
                        ON DELETE CASCADE
                )
            """)
            
            # Add subscription_id column to user_profiles if it doesn't exist
            try:
                cur.execute("""
                    ALTER TABLE user_profiles 
                    ADD COLUMN IF NOT EXISTS subscription_id INTEGER,
                    ADD CONSTRAINT fk_user_profiles_subscription_id
                        FOREIGN KEY (subscription_id)
                        REFERENCES subscriptions(id)
                        ON DELETE SET NULL
                """)
            except Exception as e:
                logger.warning(f"Could not add subscription_id to user_profiles: {str(e)}")
            
            # Add subscription_id column to organizations if it doesn't exist
            try:
                cur.execute("""
                    ALTER TABLE organizations 
                    ADD COLUMN IF NOT EXISTS subscription_id INTEGER,
                    ADD CONSTRAINT fk_organizations_subscription_id
                        FOREIGN KEY (subscription_id)
                        REFERENCES subscriptions(id)
                        ON DELETE SET NULL
                """)
            except Exception as e:
                logger.warning(f"Could not add subscription_id to organizations: {str(e)}")
            
            return {
                "success": True,
                "message": "Subscription tables created successfully"
            }
    except Exception as e:
        logger.error(f"Error creating subscription tables: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")