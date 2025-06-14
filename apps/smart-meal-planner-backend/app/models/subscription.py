from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Enum definitions for subscription fields
class SubscriptionType(str, Enum):
    free = "free"          # Free tier for beta testers
    individual = "individual"
    organization = "organization"

class SubscriptionStatus(str, Enum):
    active = "active"
    canceled = "canceled"
    past_due = "past_due"
    unpaid = "unpaid"
    trialing = "trialing"

class PaymentProvider(str, Enum):
    stripe = "stripe"
    paypal = "paypal"

# Pydantic models for request validation
class SubscriptionCreate(BaseModel):
    subscription_type: SubscriptionType
    payment_provider: PaymentProvider
    monthly_amount: float
    currency: str = "USD"
    trial_days: Optional[int] = None

class PaymentMethodCreate(BaseModel):
    payment_provider: PaymentProvider
    payment_type: str  # 'card', 'bank_account', 'paypal'
    is_default: bool = True
    # Card details (for display purposes only)
    last_four: Optional[str] = None
    brand: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    # Provider-specific fields
    stripe_payment_method_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    paypal_billing_agreement_id: Optional[str] = None

class SubscriptionResponse(BaseModel):
    id: int
    subscription_type: SubscriptionType
    status: SubscriptionStatus
    payment_provider: PaymentProvider
    monthly_amount: float
    currency: str
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    trial_end: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class PaymentMethodResponse(BaseModel):
    id: int
    payment_provider: PaymentProvider
    payment_type: str
    last_four: Optional[str] = None
    brand: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    is_default: bool
    created_at: datetime

# Import necessary modules from your project
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from app.db import get_db_connection

# Set up logging
logger = logging.getLogger(__name__)

# Database functions for subscriptions

def create_subscription(user_id=None, organization_id=None, subscription_type=None,
                       payment_provider=None, monthly_amount=None, currency="USD",
                       stripe_customer_id=None, stripe_subscription_id=None, stripe_price_id=None,
                       paypal_subscription_id=None, paypal_plan_id=None, is_beta_tester=False, status='active'):
    """Create a new subscription for a user or organization"""
    conn = None
    try:
        logger.info(f"Creating subscription: user_id={user_id}, org_id={organization_id}, type={subscription_type}")

        # Handle free tier for beta testers
        if is_beta_tester:
            subscription_type = 'free'
            payment_provider = 'none'  # No payment provider for free tier
            monthly_amount = 0.00      # Zero cost for free tier

        # Validate required fields (allowing exceptions for free tier)
        if subscription_type == 'free':
            if not user_id and not organization_id:
                logger.error("Missing user_id or organization_id for free subscription")
                return None
        else:
            # For paid tiers, need payment info
            if not subscription_type or not payment_provider or monthly_amount is None:
                logger.error("Missing required fields for subscription creation")
                return None

            # Validate payment provider for paid subscriptions
            if payment_provider not in ('stripe', 'paypal'):
                logger.error(f"Invalid payment provider: {payment_provider}")
                return None

        # Validate subscription type
        if subscription_type not in ('free', 'individual', 'organization'):
            logger.error(f"Invalid subscription type: {subscription_type}")
            return None
            
        # Validate that either user_id or organization_id is provided, but not both
        if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
            logger.error(f"Either user_id or organization_id must be provided, but not both")
            return None
        
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if subscription already exists
            if user_id:
                cur.execute("""
                    SELECT id FROM subscriptions WHERE user_id = %s
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT id FROM subscriptions WHERE organization_id = %s
                """, (organization_id,))
                
            existing = cur.fetchone()
            
            if existing:
                logger.warning(f"Subscription already exists for user/org: {existing['id']}")
                return existing['id']
            
            # Create new subscription
            cur.execute("""
                INSERT INTO subscriptions (
                    user_id, organization_id, subscription_type, payment_provider, 
                    monthly_amount, currency, stripe_customer_id, stripe_subscription_id, 
                    stripe_price_id, paypal_subscription_id, paypal_plan_id, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                user_id, organization_id, subscription_type, payment_provider, 
                monthly_amount, currency, stripe_customer_id, stripe_subscription_id, 
                stripe_price_id, paypal_subscription_id, paypal_plan_id, status
            ))
            
            subscription_id = cur.fetchone()['id']
            
            # Update user_profiles or organizations table with subscription_id
            if user_id:
                cur.execute("""
                    UPDATE user_profiles 
                    SET subscription_id = %s
                    WHERE id = %s
                """, (subscription_id, user_id))
            else:
                cur.execute("""
                    UPDATE organizations 
                    SET subscription_id = %s
                    WHERE id = %s
                """, (subscription_id, organization_id))
            
            conn.commit()
            logger.info(f"Successfully created subscription with ID: {subscription_id}")
            return subscription_id
    except Exception as e:
        logger.error(f"Error creating subscription: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_subscription(subscription_id):
    """Get subscription details by ID"""
    conn = None
    try:
        logger.info(f"Getting subscription by ID: {subscription_id}")
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM subscriptions
                WHERE id = %s
            """, (subscription_id,))
            
            result = cur.fetchone()
            logger.info(f"Found subscription: {result is not None}")
            return result
    except Exception as e:
        logger.error(f"Error getting subscription by ID: {str(e)}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()

def get_user_subscription(user_id):
    """Get subscription for a user"""
    conn = None
    try:
        logger.info(f"Getting subscription for user: {user_id}")
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT s.* FROM subscriptions s
                JOIN user_profiles u ON s.id = u.subscription_id
                WHERE u.id = %s
            """, (user_id,))
            
            result = cur.fetchone()
            logger.info(f"Found subscription for user: {result is not None}")
            return result
    except Exception as e:
        logger.error(f"Error getting user subscription: {str(e)}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()

def get_organization_subscription(organization_id):
    """Get subscription for an organization"""
    conn = None
    try:
        logger.info(f"Getting subscription for organization: {organization_id}")
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT s.* FROM subscriptions s
                JOIN organizations o ON s.id = o.subscription_id
                WHERE o.id = %s
            """, (organization_id,))
            
            result = cur.fetchone()
            logger.info(f"Found subscription for organization: {result is not None}")
            return result
    except Exception as e:
        logger.error(f"Error getting organization subscription: {str(e)}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()

def update_subscription(subscription_id, status=None, current_period_start=None, 
                       current_period_end=None, cancel_at_period_end=None, 
                       canceled_at=None, stripe_status=None, paypal_status=None):
    """Update subscription details"""
    conn = None
    try:
        logger.info(f"Updating subscription: {subscription_id}")
        conn = get_db_connection()
        with conn.cursor() as cur:
            update_fields = []
            params = []
            
            if status is not None:
                update_fields.append("status = %s")
                params.append(status)
                
            if current_period_start is not None:
                update_fields.append("current_period_start = %s")
                params.append(current_period_start)
                
            if current_period_end is not None:
                update_fields.append("current_period_end = %s")
                params.append(current_period_end)
                
            if cancel_at_period_end is not None:
                update_fields.append("cancel_at_period_end = %s")
                params.append(cancel_at_period_end)
                
            if canceled_at is not None:
                update_fields.append("canceled_at = %s")
                params.append(canceled_at)
                
            if stripe_status is not None:
                update_fields.append("stripe_status = %s")
                params.append(stripe_status)
                
            if paypal_status is not None:
                update_fields.append("paypal_status = %s")
                params.append(paypal_status)
                
            # Add updated_at timestamp
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            
            if not update_fields:
                logger.warning("No fields to update for subscription")
                return False
                
            query = f"""
                UPDATE subscriptions
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id
            """
            
            params.append(subscription_id)
            cur.execute(query, params)
            
            result = cur.fetchone()
            conn.commit()
            
            success = result is not None
            logger.info(f"Subscription update success: {success}")
            return success
    except Exception as e:
        logger.error(f"Error updating subscription: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def cancel_subscription(subscription_id, cancel_at_period_end=True):
    """Cancel a subscription"""
    conn = None
    try:
        logger.info(f"Canceling subscription: {subscription_id}")
        conn = get_db_connection()
        with conn.cursor() as cur:
            if cancel_at_period_end:
                # Mark subscription to cancel at the end of the period
                cur.execute("""
                    UPDATE subscriptions
                    SET cancel_at_period_end = TRUE,
                        canceled_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (subscription_id,))
            else:
                # Cancel subscription immediately
                cur.execute("""
                    UPDATE subscriptions
                    SET status = 'canceled',
                        canceled_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (subscription_id,))
                
            result = cur.fetchone()
            conn.commit()
            
            success = result is not None
            logger.info(f"Subscription cancellation success: {success}")
            return success
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def create_payment_method(user_id=None, organization_id=None, payment_provider=None, 
                        payment_type=None, last_four=None, brand=None, exp_month=None, 
                        exp_year=None, is_default=True, stripe_payment_method_id=None, 
                        stripe_customer_id=None, paypal_billing_agreement_id=None):
    """Create a new payment method for a user or organization"""
    conn = None
    try:
        logger.info(f"Creating payment method: user_id={user_id}, org_id={organization_id}")
        
        if not payment_provider or not payment_type:
            logger.error("Missing required fields for payment method creation")
            return None
            
        # Validate payment provider
        if payment_provider not in ('stripe', 'paypal'):
            logger.error(f"Invalid payment provider: {payment_provider}")
            return None
            
        # Validate that either user_id or organization_id is provided, but not both
        if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
            logger.error(f"Either user_id or organization_id must be provided, but not both")
            return None
            
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # If this is the default payment method, set all other payment methods as non-default
            if is_default:
                if user_id:
                    cur.execute("""
                        UPDATE payment_methods
                        SET is_default = FALSE
                        WHERE user_id = %s
                    """, (user_id,))
                else:
                    cur.execute("""
                        UPDATE payment_methods
                        SET is_default = FALSE
                        WHERE organization_id = %s
                    """, (organization_id,))
                    
            # Create new payment method
            cur.execute("""
                INSERT INTO payment_methods (
                    user_id, organization_id, payment_provider, payment_type,
                    last_four, brand, exp_month, exp_year, is_default,
                    stripe_payment_method_id, stripe_customer_id, paypal_billing_agreement_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                user_id, organization_id, payment_provider, payment_type,
                last_four, brand, exp_month, exp_year, is_default,
                stripe_payment_method_id, stripe_customer_id, paypal_billing_agreement_id
            ))
            
            payment_method_id = cur.fetchone()['id']
            conn.commit()
            
            logger.info(f"Successfully created payment method with ID: {payment_method_id}")
            return payment_method_id
    except Exception as e:
        logger.error(f"Error creating payment method: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_payment_methods(user_id=None, organization_id=None):
    """Get all payment methods for a user or organization"""
    conn = None
    try:
        logger.info(f"Getting payment methods: user_id={user_id}, org_id={organization_id}")
        
        # Validate that either user_id or organization_id is provided, but not both
        if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
            logger.error(f"Either user_id or organization_id must be provided, but not both")
            return []
            
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id:
                cur.execute("""
                    SELECT * FROM payment_methods
                    WHERE user_id = %s AND is_active = TRUE
                    ORDER BY is_default DESC, created_at DESC
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT * FROM payment_methods
                    WHERE organization_id = %s AND is_active = TRUE
                    ORDER BY is_default DESC, created_at DESC
                """, (organization_id,))
                
            results = cur.fetchall()
            logger.info(f"Found {len(results)} payment methods")
            return results
    except Exception as e:
        logger.error(f"Error getting payment methods: {str(e)}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

def get_default_payment_method(user_id=None, organization_id=None):
    """Get the default payment method for a user or organization"""
    conn = None
    try:
        logger.info(f"Getting default payment method: user_id={user_id}, org_id={organization_id}")
        
        # Validate that either user_id or organization_id is provided, but not both
        if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
            logger.error(f"Either user_id or organization_id must be provided, but not both")
            return None
            
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id:
                cur.execute("""
                    SELECT * FROM payment_methods
                    WHERE user_id = %s AND is_default = TRUE AND is_active = TRUE
                    LIMIT 1
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT * FROM payment_methods
                    WHERE organization_id = %s AND is_default = TRUE AND is_active = TRUE
                    LIMIT 1
                """, (organization_id,))
                
            result = cur.fetchone()
            logger.info(f"Found default payment method: {result is not None}")
            return result
    except Exception as e:
        logger.error(f"Error getting default payment method: {str(e)}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()

def delete_payment_method(payment_method_id):
    """Soft delete a payment method"""
    conn = None
    try:
        logger.info(f"Deleting payment method: {payment_method_id}")
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Check if this is the default payment method
            cur.execute("""
                SELECT is_default, user_id, organization_id FROM payment_methods
                WHERE id = %s
            """, (payment_method_id,))
            
            result = cur.fetchone()
            if not result:
                logger.warning(f"Payment method not found: {payment_method_id}")
                return False
                
            is_default, user_id, organization_id = result
            
            # Mark as inactive (soft delete)
            cur.execute("""
                UPDATE payment_methods
                SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING id
            """, (payment_method_id,))
            
            deleted = cur.fetchone() is not None
            
            # If this was the default payment method, set a new default
            if deleted and is_default:
                if user_id:
                    cur.execute("""
                        UPDATE payment_methods
                        SET is_default = TRUE
                        WHERE user_id = %s AND is_active = TRUE
                        ORDER BY created_at DESC
                        LIMIT 1
                    """, (user_id,))
                elif organization_id:
                    cur.execute("""
                        UPDATE payment_methods
                        SET is_default = TRUE
                        WHERE organization_id = %s AND is_active = TRUE
                        ORDER BY created_at DESC
                        LIMIT 1
                    """, (organization_id,))
            
            conn.commit()
            logger.info(f"Payment method deletion success: {deleted}")
            return deleted
    except Exception as e:
        logger.error(f"Error deleting payment method: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def log_subscription_event(subscription_id, event_type, event_data, payment_provider, provider_event_id=None, processed=False, processed_at=None):
    """Log a subscription event"""
    conn = None
    try:
        logger.info(f"Logging subscription event: subscription={subscription_id}, type={event_type}")

        # Convert event_data to JSON if it's a dict
        import json
        event_data_json = json.dumps(event_data) if isinstance(event_data, dict) else event_data

        conn = get_db_connection()
        with conn.cursor() as cur:
            # Try to insert with processed_at column
            try:
                cur.execute("""
                    INSERT INTO subscription_events (
                        subscription_id, event_type, event_data, payment_provider, provider_event_id, processed, processed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    subscription_id, event_type, event_data_json, payment_provider, provider_event_id, processed, processed_at
                ))

                event_id = cur.fetchone()[0]
                conn.commit()

                logger.info(f"Successfully logged subscription event with ID: {event_id}")
                return event_id
            except Exception as column_error:
                # If it fails due to missing processed_at column, try without it
                logger.warning(f"Failed to insert with processed_at: {str(column_error)}. Trying without it.")
                conn.rollback()  # Need to rollback before trying again

                cur.execute("""
                    INSERT INTO subscription_events (
                        subscription_id, event_type, event_data, payment_provider, provider_event_id, processed
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    subscription_id, event_type, event_data_json, payment_provider, provider_event_id, processed
                ))

                event_id = cur.fetchone()[0]
                conn.commit()

                logger.info(f"Successfully logged subscription event with ID: {event_id} (without processed_at)")
                return event_id
    except Exception as e:
        logger.error(f"Error logging subscription event: {str(e)}", exc_info=True)
        if conn:
            try:
                conn.rollback()
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {str(rollback_error)}")
        return None
    finally:
        if conn:
            try:
                conn.close()
            except Exception as close_error:
                logger.error(f"Error closing connection: {str(close_error)}")
                # Still need to proceed with the function

def create_invoice(subscription_id, payment_provider, status, amount_due, amount_paid=None,
                 currency="USD", period_start=None, period_end=None, due_date=None,
                 paid_at=None, stripe_invoice_id=None, paypal_invoice_id=None):
    """Create a new invoice record"""
    conn = None
    try:
        logger.info(f"Creating invoice: subscription={subscription_id}, provider={payment_provider}")
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Generate invoice number
            cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM invoices")
            next_id = cur.fetchone()[0]
            invoice_number = f"INV-{next_id:06d}"
            
            cur.execute("""
                INSERT INTO invoices (
                    subscription_id, payment_provider, invoice_number, status, 
                    amount_due, amount_paid, currency, period_start, period_end, 
                    due_date, paid_at, stripe_invoice_id, paypal_invoice_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                subscription_id, payment_provider, invoice_number, status,
                amount_due, amount_paid, currency, period_start, period_end,
                due_date, paid_at, stripe_invoice_id, paypal_invoice_id
            ))
            
            invoice_id = cur.fetchone()[0]
            conn.commit()
            
            logger.info(f"Successfully created invoice with ID: {invoice_id}")
            return invoice_id
    except Exception as e:
        logger.error(f"Error creating invoice: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_subscription_invoices(subscription_id):
    """Get all invoices for a subscription"""
    conn = None
    try:
        logger.info(f"Getting invoices for subscription: {subscription_id}")
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM invoices
                WHERE subscription_id = %s
                ORDER BY created_at DESC
            """, (subscription_id,))
            
            results = cur.fetchall()
            logger.info(f"Found {len(results)} invoices")
            return results
    except Exception as e:
        logger.error(f"Error getting subscription invoices: {str(e)}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

def update_invoice(invoice_id, status=None, amount_paid=None, paid_at=None):
    """Update invoice details"""
    conn = None
    try:
        logger.info(f"Updating invoice: {invoice_id}")
        conn = get_db_connection()
        with conn.cursor() as cur:
            update_fields = []
            params = []
            
            if status is not None:
                update_fields.append("status = %s")
                params.append(status)
                
            if amount_paid is not None:
                update_fields.append("amount_paid = %s")
                params.append(amount_paid)
                
            if paid_at is not None:
                update_fields.append("paid_at = %s")
                params.append(paid_at)
                
            # Add updated_at timestamp
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            
            if not update_fields:
                logger.warning("No fields to update for invoice")
                return False
                
            query = f"""
                UPDATE invoices
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id
            """
            
            params.append(invoice_id)
            cur.execute(query, params)
            
            result = cur.fetchone()
            conn.commit()
            
            success = result is not None
            logger.info(f"Invoice update success: {success}")
            return success
    except Exception as e:
        logger.error(f"Error updating invoice: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def migrate_to_free_tier(user_id=None, organization_id=None, set_beta_expiration=True, days_until_expiration=90):
    """
    Migrate an existing user or organization to the free tier (for beta testers)

    Args:
        user_id: ID of the user to migrate
        organization_id: ID of the organization to migrate
        set_beta_expiration: Whether to set an expiration date for the beta period
        days_until_expiration: Number of days until the beta period expires

    Returns:
        Subscription ID if successful, None otherwise
    """
    conn = None
    try:
        logger.info(f"Migrating to free tier: user_id={user_id}, org_id={organization_id}")

        # Validate that either user_id or organization_id is provided, but not both
        if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
            logger.error(f"Either user_id or organization_id must be provided, but not both")
            return None

        # Calculate beta expiration date if needed
        import datetime
        current_date = datetime.datetime.now(datetime.timezone.utc)

        if set_beta_expiration:
            expiration_date = current_date + datetime.timedelta(days=days_until_expiration)
        else:
            expiration_date = None

        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if subscription already exists
            if user_id:
                cur.execute("""
                    SELECT id FROM subscriptions WHERE user_id = %s
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT id FROM subscriptions WHERE organization_id = %s
                """, (organization_id,))

            existing = cur.fetchone()

            if existing:
                # Update existing subscription to free tier
                cur.execute("""
                    UPDATE subscriptions
                    SET subscription_type = 'free',
                        payment_provider = 'none',
                        monthly_amount = 0.00,
                        status = 'active',
                        current_period_start = %s,
                        current_period_end = %s,
                        trial_start = %s,
                        trial_end = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (current_date, expiration_date, current_date, expiration_date, existing['id']))

                subscription_id = cur.fetchone()['id']
                logger.info(f"Updated existing subscription to free tier: {subscription_id}")
            else:
                # Create new free tier subscription
                cur.execute("""
                    INSERT INTO subscriptions (
                        user_id, organization_id, subscription_type, payment_provider,
                        monthly_amount, currency, status, current_period_start,
                        current_period_end, trial_start, trial_end
                    ) VALUES (%s, %s, 'free', 'none', 0.00, 'USD', 'active', %s, %s, %s, %s)
                    RETURNING id
                """, (
                    user_id, organization_id, current_date, expiration_date,
                    current_date, expiration_date
                ))

                subscription_id = cur.fetchone()['id']
                logger.info(f"Created new free tier subscription: {subscription_id}")

                # Update user_profiles or organizations table with subscription_id
                if user_id:
                    cur.execute("""
                        UPDATE user_profiles
                        SET subscription_id = %s
                        WHERE id = %s
                    """, (subscription_id, user_id))
                else:
                    cur.execute("""
                        UPDATE organizations
                        SET subscription_id = %s
                        WHERE id = %s
                    """, (subscription_id, organization_id))

            # Create subscription event for tracking
            event_data = {
                "event": "migrated_to_free_tier",
                "beta_tester": True,
                "expiration_date": expiration_date.isoformat() if expiration_date else None,
                "migration_date": current_date.isoformat()
            }

            # Log the event in a way that's safe even if processed_at column doesn't exist yet
            try:
                cur.execute("""
                    INSERT INTO subscription_events (
                        subscription_id, event_type, event_data, payment_provider, processed, processed_at
                    ) VALUES (%s, 'migrated_to_free_tier', %s, 'none', TRUE, CURRENT_TIMESTAMP)
                """, (subscription_id, json.dumps(event_data)))
            except Exception as e:
                logger.warning(f"Could not insert event with processed_at, trying fallback: {str(e)}")
                # Fallback if processed_at column doesn't exist
                cur.execute("""
                    INSERT INTO subscription_events (
                        subscription_id, event_type, event_data, payment_provider, processed
                    ) VALUES (%s, 'migrated_to_free_tier', %s, 'none', TRUE)
                """, (subscription_id, json.dumps(event_data)))

            conn.commit()
            return subscription_id

    except Exception as e:
        logger.error(f"Error migrating to free tier: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def migrate_all_users_to_free_tier(days_until_expiration=90):
    """
    Migrate all existing users without subscriptions to the free tier

    Args:
        days_until_expiration: Number of days until the beta period expires

    Returns:
        Number of users migrated
    """
    conn = None
    try:
        logger.info(f"Migrating all existing users to free tier")

        conn = get_db_connection()
        with conn.cursor() as cur:
            # Get all users without subscriptions
            cur.execute("""
                SELECT id FROM user_profiles
                WHERE subscription_id IS NULL
            """)

            users = cur.fetchall()
            migrated_count = 0

            # Migrate each user
            for user in users:
                user_id = user[0]
                result = migrate_to_free_tier(user_id=user_id, days_until_expiration=days_until_expiration)
                if result:
                    migrated_count += 1

            # Get all organizations without subscriptions
            cur.execute("""
                SELECT id FROM organizations
                WHERE subscription_id IS NULL
            """)

            organizations = cur.fetchall()

            # Migrate each organization
            for org in organizations:
                org_id = org[0]
                result = migrate_to_free_tier(organization_id=org_id, days_until_expiration=days_until_expiration)
                if result:
                    migrated_count += 1

            logger.info(f"Successfully migrated {migrated_count} users/organizations to free tier")
            return migrated_count

    except Exception as e:
        logger.error(f"Error migrating all users to free tier: {str(e)}", exc_info=True)
        return 0
    finally:
        if conn:
            conn.close()

def check_user_subscription_access(user_id, account_type=None, organization_id=None, include_free_tier=True):
    """
    Check if a user has subscription access considering organizational hierarchies
    
    For client accounts: Check their organization's subscription
    For organization accounts: Check their own subscription
    For individual accounts: Check their own subscription
    
    Args:
        user_id: ID of the user to check
        account_type: Type of account ('client', 'organization', 'individual')
        organization_id: Organization ID (if known)
        include_free_tier: Whether to consider free tier as active
        
    Returns:
        Boolean indicating if the user has subscription access
    """
    conn = None
    try:
        logger.info(f"Checking user subscription access: user_id={user_id}, account_type={account_type}, org_id={organization_id}")
        
        # For client accounts, check their organization's subscription
        if account_type == 'client':
            if organization_id:
                # Use the provided organization_id
                return check_subscription_status(organization_id=organization_id, include_free_tier=include_free_tier)
            else:
                # Look up the client's organization
                conn = get_db_connection()
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT oc.organization_id 
                        FROM organization_clients oc 
                        WHERE oc.client_id = %s AND oc.status = 'active'
                        LIMIT 1
                    """, (user_id,))
                    result = cur.fetchone()
                    
                    if result:
                        client_org_id = result[0]
                        logger.info(f"Found organization {client_org_id} for client {user_id}")
                        return check_subscription_status(organization_id=client_org_id, include_free_tier=include_free_tier)
                    else:
                        logger.warning(f"No organization found for client {user_id}")
                        return False
        
        # For organization and individual accounts, check their own subscription
        else:
            return check_subscription_status(user_id=user_id, include_free_tier=include_free_tier)
            
    except Exception as e:
        logger.error(f"Error checking user subscription access: {str(e)}", exc_info=True)
        return False
    finally:
        if conn:
            conn.close()

def check_subscription_status(user_id=None, organization_id=None, include_free_tier=True):
    """
    Check if a user or organization has an active subscription

    Args:
        user_id: ID of the user to check
        organization_id: ID of the organization to check
        include_free_tier: Whether to consider free tier as an active subscription

    Returns:
        Boolean indicating if the user/org has an active subscription
    """
    conn = None
    try:
        logger.info(f"Checking subscription status: user_id={user_id}, org_id={organization_id}")

        # Validate that either user_id or organization_id is provided, but not both
        if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
            logger.error(f"Either user_id or organization_id must be provided, but not both")
            return False

        conn = get_db_connection()
        with conn.cursor() as cur:
            if user_id:
                cur.execute("""
                    SELECT s.status, s.current_period_end, s.trial_end, s.subscription_type
                    FROM subscriptions s
                    JOIN user_profiles u ON s.id = u.subscription_id
                    WHERE u.id = %s
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT s.status, s.current_period_end, s.trial_end, s.subscription_type
                    FROM subscriptions s
                    JOIN organizations o ON s.id = o.subscription_id
                    WHERE o.id = %s
                """, (organization_id,))

            result = cur.fetchone()

            if not result:
                logger.warning("No subscription found")
                return False

            status, current_period_end, trial_end, subscription_type = result

            # Special handling for free tier
            if subscription_type == 'free':
                if include_free_tier:
                    # For free tier, check if it's still active (either indefinite or within trial period)
                    if status == 'active':
                        if trial_end is None:
                            # Indefinite free tier
                            logger.info("Free tier with no expiration - active")
                            return True
                        else:
                            # Free tier with expiration
                            import datetime
                            now = datetime.datetime.now(datetime.timezone.utc)
                            is_valid = now < trial_end
                            logger.info(f"Free tier with expiration - active: {is_valid}")
                            return is_valid
                else:
                    # If we're not including free tier, it doesn't count as an active subscription
                    logger.info("Free tier not included in check - inactive")
                    return False

            # Regular subscription checks for paid tiers
            # Check if status is active or trialing
            is_active = status in ('active', 'trialing')

            # Check if within trial period
            import datetime
            now = datetime.datetime.now(datetime.timezone.utc)
            is_in_trial = trial_end is not None and now < trial_end

            # Check if within current period
            is_in_period = current_period_end is not None and now < current_period_end

            # Overall status
            has_active_subscription = is_active and (is_in_trial or is_in_period)
            logger.info(f"Active subscription status: {has_active_subscription}")

            return has_active_subscription
    except Exception as e:
        logger.error(f"Error checking subscription status: {str(e)}", exc_info=True)
        return False
    finally:
        if conn:
            conn.close()

def get_subscription_details(user_id=None, organization_id=None):
    """Get detailed subscription information for a user or organization"""
    conn = None
    try:
        logger.info(f"Getting subscription details: user_id={user_id}, org_id={organization_id}")

        # Validate that either user_id or organization_id is provided, but not both
        if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
            logger.error(f"Either user_id or organization_id must be provided, but not both")
            return None

        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id:
                cur.execute("""
                    SELECT s.*, pm.last_four, pm.brand, pm.exp_month, pm.exp_year, pm.payment_type
                    FROM subscriptions s
                    JOIN user_profiles u ON s.id = u.subscription_id
                    LEFT JOIN payment_methods pm ON (pm.user_id = u.id AND pm.is_default = TRUE AND pm.is_active = TRUE)
                    WHERE u.id = %s
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT s.*, pm.last_four, pm.brand, pm.exp_month, pm.exp_year, pm.payment_type
                    FROM subscriptions s
                    JOIN organizations o ON s.id = o.subscription_id
                    LEFT JOIN payment_methods pm ON (pm.organization_id = o.id AND pm.is_default = TRUE AND pm.is_active = TRUE)
                    WHERE o.id = %s
                """, (organization_id,))

            result = cur.fetchone()
            logger.info(f"Found subscription details: {result is not None}")

            if result:
                # Create a dictionary with defaults for all possible null fields
                safe_result = dict(result)

                # Provide defaults for critical fields that must not be null
                if safe_result.get('subscription_type') is None:
                    safe_result['subscription_type'] = 'free'

                if safe_result.get('status') is None:
                    safe_result['status'] = 'unknown'

                if safe_result.get('currency') is None:
                    safe_result['currency'] = 'usd'

                if safe_result.get('monthly_amount') is None:
                    safe_result['monthly_amount'] = 0.0

                # Add formatted dates and calculated fields for frontend
                import datetime

                # Calculate days remaining in current period
                now = datetime.datetime.now(datetime.timezone.utc)
                if safe_result.get('current_period_end'):
                    days_remaining = (safe_result['current_period_end'] - now).days
                    safe_result['days_remaining'] = max(0, days_remaining)
                else:
                    safe_result['days_remaining'] = 0

                # Calculate days remaining in trial
                if safe_result.get('trial_end'):
                    trial_days_remaining = (safe_result['trial_end'] - now).days
                    safe_result['trial_days_remaining'] = max(0, trial_days_remaining)
                else:
                    safe_result['trial_days_remaining'] = 0

                # Check if subscription is active
                safe_result['is_active'] = check_subscription_status(user_id, organization_id)

                # Format payment method for display with null checks
                if safe_result.get('last_four'):
                    if safe_result.get('payment_type') == 'card':
                        brand = safe_result.get('brand', 'Card')
                        safe_result['payment_display'] = f"{brand} •••• {safe_result['last_four']}"
                    elif safe_result.get('payment_type') == 'paypal':
                        safe_result['payment_display'] = "PayPal"
                    else:
                        payment_type = safe_result.get('payment_type', 'Payment')
                        safe_result['payment_display'] = f"{payment_type} •••• {safe_result['last_four']}"
                else:
                    safe_result['payment_display'] = None

                return safe_result
            else:
                # No result found
                return None
    except Exception as e:
        logger.error(f"Error getting subscription details: {str(e)}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()