from fastapi import APIRouter, Depends, HTTPException, Request, Body
from typing import Optional, List, Dict, Any
import logging
import json
import os
from datetime import datetime, timedelta

# Import your models and utilities
from app.models.subscription import (
    create_subscription, get_subscription, get_user_subscription, 
    get_organization_subscription, update_subscription, cancel_subscription,
    create_payment_method, get_payment_methods, get_default_payment_method,
    delete_payment_method, log_subscription_event, create_invoice,
    get_subscription_invoices, update_invoice, check_subscription_status,
    get_subscription_details, migrate_to_free_tier, migrate_all_users_to_free_tier,
    SubscriptionCreate, PaymentMethodCreate, SubscriptionResponse, PaymentMethodResponse,
    SubscriptionType, SubscriptionStatus, PaymentProvider
)
from app.utils.auth_middleware import get_user_from_token
from app.db import get_db_connection

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# Enable/disable subscriptions with feature flag
ENABLE_SUBSCRIPTION_FEATURES = os.getenv("ENABLE_SUBSCRIPTION_FEATURES", "false").lower() == "true"

# Configuration for free tier
FREE_TIER_DAYS = int(os.getenv("FREE_TIER_DAYS", "90"))  # Default 90-day free tier

# Fallback function for when subscriptions are disabled
async def subscription_disabled():
    """Handler for when subscription features are disabled"""
    return {
        "enabled": False,
        "message": "Subscription features are currently disabled"
    }

# Helper function to check if subscriptions are enabled
def check_subscriptions_enabled():
    """Check if subscription features are enabled"""
    if not ENABLE_SUBSCRIPTION_FEATURES:
        raise HTTPException(
            status_code=503,
            detail="Subscription features are currently disabled"
        )

@router.get("/status")
async def subscription_status(user = Depends(get_user_from_token)):
    """
    Get the current user's subscription status
    
    Returns subscription details if active, or info about available plans if not
    """
    if not ENABLE_SUBSCRIPTION_FEATURES:
        return await subscription_disabled()
        
    try:
        user_id = user.get('user_id')
        organization_id = user.get('organization_id')
        
        # Check if the user is part of an organization as a client
        # (in this case, they're covered by the organization's subscription)
        is_client = False
        if 'account_type' in user and user['account_type'] == 'client':
            # Get the organization ID for this client
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT organization_id FROM organization_clients
                        WHERE client_id = %s
                    """, (user_id,))
                    
                    org_result = cur.fetchone()
                    if org_result:
                        organization_id = org_result[0]
                        is_client = True
            finally:
                if conn:
                    conn.close()
        
        # Get subscription details
        subscription = None
        
        if organization_id:
            # For organization members or clients, check the organization's subscription
            subscription = get_subscription_details(organization_id=organization_id)
        elif user_id:
            # For individual users, check their personal subscription
            subscription = get_subscription_details(user_id=user_id)
        
        if subscription:
            # Format the response
            result = {
                "has_subscription": True,
                "subscription_type": subscription['subscription_type'],
                "status": subscription['status'],
                "is_active": subscription['is_active'],
                "is_free_tier": subscription['subscription_type'] == 'free'
            }
            
            # Add expiration details if available
            if subscription.get('trial_end'):
                result["expires_at"] = subscription['trial_end'].isoformat()
                result["days_remaining"] = subscription.get('trial_days_remaining', 0)
            elif subscription.get('current_period_end'):
                result["renews_at"] = subscription['current_period_end'].isoformat()
                result["days_remaining"] = subscription.get('days_remaining', 0)
            
            # Add payment details if available
            if subscription.get('payment_display'):
                result["payment_method"] = subscription['payment_display']
            
            # Add organization context for clients
            if is_client:
                result["provided_by_organization"] = True
            
            return result
        else:
            # No subscription found
            return {
                "has_subscription": False,
                "available_plans": [
                    {
                        "type": "individual",
                        "name": "Individual Plan",
                        "price": 7.99,
                        "currency": "USD",
                        "interval": "month",
                        "features": [
                            "Unlimited meal planning",
                            "Shopping list generation",
                            "Recipe saving",
                            "Grocery store integration"
                        ]
                    },
                    {
                        "type": "organization",
                        "name": "Organization Plan",
                        "price": 49.99,
                        "currency": "USD",
                        "interval": "month",
                        "features": [
                            "Everything in Individual",
                            "Client management",
                            "Menu sharing with clients",
                            "Organization dashboard",
                            "Bulk meal planning"
                        ]
                    }
                ]
            }
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error checking subscription status"
        )

@router.post("/migrate-to-free-tier")
async def migrate_user_to_free_tier(
    user_id: Optional[int] = Body(None),
    organization_id: Optional[int] = Body(None),
    days_until_expiration: Optional[int] = Body(FREE_TIER_DAYS),
    set_expiration: Optional[bool] = Body(True),
    user = Depends(get_user_from_token)
):
    """
    Migrate a specific user or organization to the free tier
    
    This endpoint requires administrative privileges or self-migration
    """
    if not ENABLE_SUBSCRIPTION_FEATURES:
        return await subscription_disabled()
        
    # Check if this is an admin request or self-migration
    is_admin = user.get('is_admin', False)
    is_self = user_id == user.get('user_id') or organization_id == user.get('organization_id')
    
    if not (is_admin or is_self):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to migrate other users"
        )
    
    # If no ID provided, use the current user's ID
    if not user_id and not organization_id:
        user_id = user.get('user_id')
        
    # Validate that exactly one ID is provided
    if (user_id is None and organization_id is None) or (user_id is not None and organization_id is not None):
        raise HTTPException(
            status_code=400,
            detail="Provide either user_id or organization_id, but not both"
        )
    
    try:
        result = migrate_to_free_tier(
            user_id=user_id,
            organization_id=organization_id,
            set_beta_expiration=set_expiration,
            days_until_expiration=days_until_expiration
        )
        
        if result:
            return {
                "success": True,
                "subscription_id": result,
                "message": "Successfully migrated to free tier",
                "expiration_date": (datetime.now() + timedelta(days=days_until_expiration)).isoformat() if set_expiration else None
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to migrate to free tier"
            )
    except Exception as e:
        logger.error(f"Error migrating to free tier: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error migrating to free tier: {str(e)}"
        )

@router.post("/migrate-all-users")
async def migrate_all_users(
    days_until_expiration: Optional[int] = Body(FREE_TIER_DAYS),
    user = Depends(get_user_from_token)
):
    """
    Migrate all existing users to the free tier
    
    This endpoint requires administrative privileges
    """
    if not ENABLE_SUBSCRIPTION_FEATURES:
        return await subscription_disabled()
        
    # Check if this is an admin request
    is_admin = user.get('is_admin', False)
    
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to migrate all users"
        )
    
    try:
        migrated_count = migrate_all_users_to_free_tier(days_until_expiration=days_until_expiration)
        
        return {
            "success": True,
            "migrated_count": migrated_count,
            "message": f"Successfully migrated {migrated_count} users/organizations to free tier",
            "expiration_date": (datetime.now() + timedelta(days=days_until_expiration)).isoformat()
        }
    except Exception as e:
        logger.error(f"Error migrating all users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error migrating all users: {str(e)}"
        )

# Additional endpoints for Stripe and PayPal will be implemented next
# These placeholder endpoints will be expanded with the actual integration code

@router.post("/create-checkout")
async def create_checkout_session(
    subscription_type: SubscriptionType,
    payment_provider: Optional[PaymentProvider] = Body(PaymentProvider.stripe),
    user = Depends(get_user_from_token)
):
    """
    Create a checkout session for a new subscription
    
    This is a placeholder endpoint that will be implemented with actual payment integration
    """
    check_subscriptions_enabled()
    
    return {
        "success": True,
        "message": "This is a placeholder for creating a checkout session",
        "subscription_type": subscription_type,
        "payment_provider": payment_provider
    }

@router.post("/cancel")
async def cancel_user_subscription(
    cancel_at_period_end: bool = Body(True),
    user = Depends(get_user_from_token)
):
    """
    Cancel the current user's subscription
    
    This is a placeholder endpoint that will be implemented with actual payment integration
    """
    check_subscriptions_enabled()
    
    return {
        "success": True,
        "message": "This is a placeholder for canceling a subscription",
        "cancel_at_period_end": cancel_at_period_end
    }

@router.get("/invoices")
async def get_user_invoices(user = Depends(get_user_from_token)):
    """
    Get the current user's invoices
    
    This is a placeholder endpoint that will be implemented with actual payment integration
    """
    check_subscriptions_enabled()
    
    return {
        "success": True,
        "message": "This is a placeholder for retrieving invoices",
        "invoices": []
    }

@router.post("/update-payment-method")
async def update_user_payment_method(
    payment_method: PaymentMethodCreate,
    user = Depends(get_user_from_token)
):
    """
    Update the current user's payment method
    
    This is a placeholder endpoint that will be implemented with actual payment integration
    """
    check_subscriptions_enabled()
    
    return {
        "success": True,
        "message": "This is a placeholder for updating payment method",
        "payment_method": payment_method.dict()
    }