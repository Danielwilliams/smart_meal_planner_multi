from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
import logging
import json
import os
from datetime import datetime, timedelta

# Import Stripe conditionally
try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    stripe = None
    STRIPE_AVAILABLE = False
    logging.warning("Stripe module not installed. Stripe integration will be disabled.")

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
from pydantic import BaseModel
from app.utils.auth_middleware import get_user_from_token
from app.db import get_db_connection, get_db_cursor
from psycopg2.extras import RealDictCursor

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# Enable/disable subscriptions with feature flag
ENABLE_SUBSCRIPTION_FEATURES = os.getenv("ENABLE_SUBSCRIPTION_FEATURES", "false").lower() == "true"

# Configuration for free tier
FREE_TIER_DAYS = int(os.getenv("FREE_TIER_DAYS", "90"))  # Default 90-day free tier

# Model for discount code validation
class DiscountCodeRequest(BaseModel):
    code: str
    subscription_type: str

# Fallback function for when subscriptions are disabled
async def subscription_disabled():
    """Handler for when subscription features are disabled"""
    return JSONResponse(
        content={
            "enabled": False,
            "message": "Subscription features are currently disabled"
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
    )

@router.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify routing works"""
    return {"message": "Subscriptions router is working", "enabled": ENABLE_SUBSCRIPTION_FEATURES}

@router.post("/test-free-subscription")
async def test_free_subscription(
    request: DiscountCodeRequest
):
    """Test endpoint to create free subscription directly"""
    try:
        logger.info(f"Testing free subscription creation with code: {request.code}")
        
        if not STRIPE_AVAILABLE or stripe is None:
            return {"error": "Stripe not available"}
            
        if not stripe.api_key:
            return {"error": "Stripe API key not configured"}
        
        # Test coupon retrieval
        try:
            promotion_codes = stripe.PromotionCode.list(
                code=request.code,
                active=True,
                limit=1
            )
            
            if promotion_codes.data:
                promo_code = promotion_codes.data[0]
                coupon = promo_code.coupon
                return {
                    "success": True,
                    "promotion_code_id": promo_code.id,
                    "coupon_id": coupon.id,
                    "percent_off": coupon.get('percent_off'),
                    "amount_off": coupon.get('amount_off'),
                    "is_100_percent": coupon.get('percent_off') == 100
                }
            else:
                return {"error": "Promotion code not found"}
                
        except Exception as e:
            return {"error": f"Error testing promotion code: {str(e)}"}
            
    except Exception as e:
        logger.error(f"Error in test endpoint: {str(e)}", exc_info=True)
        return {"error": f"Test failed: {str(e)}"}

@router.options("/validate-discount")
async def validate_discount_options():
    """Handle preflight CORS requests"""
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Max-Age": "86400"
        }
    )

@router.post("/validate-discount")
async def validate_discount_code(
    request: DiscountCodeRequest,
    user: Optional[Dict] = Depends(get_user_from_token)
):
    """
    Validate a discount code and return its details

    Args:
        request: Contains the discount code and subscription type

    Returns:
        Discount code details if valid, error message if not
    """
    logger.info(f"Validate discount endpoint called with code: {request.code}, subscription_type: {request.subscription_type}")
    logger.info(f"ENABLE_SUBSCRIPTION_FEATURES: {ENABLE_SUBSCRIPTION_FEATURES}, STRIPE_AVAILABLE: {STRIPE_AVAILABLE}")
    
    try:
        # First, check if subscriptions are enabled
        if not ENABLE_SUBSCRIPTION_FEATURES:
            return await subscription_disabled()

        # Check if Stripe is available
        if not STRIPE_AVAILABLE or stripe is None:
            logger.error("Stripe module is not available")
            return JSONResponse(
                status_code=503,
                content={"detail": "Payment integration is not available - Stripe not installed"},
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            )

        # Check if Stripe API key is configured
        if not stripe.api_key:
            logger.error("Stripe API key is not configured")
            return JSONResponse(
                status_code=503,
                content={"detail": "Payment integration is not available - API key not configured"},
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            )

        # Try to retrieve the coupon from Stripe
        discount_code = request.code
        logger.info(f"Validating discount code: {discount_code}")

        coupon = None
        promotion_code_obj = None
        
        # First, try to find it as a promotion code
        try:
            # List all promotion codes and find matching one
            promotion_codes = stripe.PromotionCode.list(
                code=discount_code,
                active=True,
                limit=1
            )
            
            if promotion_codes.data:
                promotion_code_obj = promotion_codes.data[0]
                # Get the associated coupon
                coupon = promotion_code_obj.coupon
                logger.info(f"Found promotion code: {discount_code}, coupon ID: {coupon.id}")
            else:
                logger.info(f"No promotion code found for: {discount_code}, trying as coupon ID")
        except Exception as promo_err:
            logger.warning(f"Error checking promotion codes: {str(promo_err)}")
        
        # If not found as promotion code, try as direct coupon ID
        if not coupon:
            try:
                coupon = stripe.Coupon.retrieve(discount_code)
                logger.info(f"Found coupon by ID: {discount_code}")
            except stripe.error.InvalidRequestError as e:
                logger.warning(f"Not a valid coupon ID either: {discount_code}, error: {str(e)}")
                
        # Check if we found a valid coupon
        if coupon and coupon.get('valid', True) and not coupon.get('deleted'):
            # Format response with coupon details
            response = {
                "valid": True,
                "code": discount_code,
                "description": coupon.get('name', 'Discount'),
            }

            # Add discount amount information
            if coupon.get('percent_off'):
                response["percent_off"] = coupon['percent_off']
                response["discount_type"] = "percentage"
            elif coupon.get('amount_off'):
                response["amount_off"] = coupon['amount_off'] / 100  # Convert from cents
                response["currency"] = coupon.get('currency', 'usd').upper()
                response["discount_type"] = "fixed"

            # Add duration information
            response["duration"] = coupon.get('duration', 'once')
            if response["duration"] == "repeating":
                response["duration_in_months"] = coupon.get('duration_in_months', 0)
                
            # Add any restrictions from promotion code
            if promotion_code_obj:
                if promotion_code_obj.get('max_redemptions'):
                    remaining = promotion_code_obj['max_redemptions'] - promotion_code_obj.get('times_redeemed', 0)
                    if remaining <= 0:
                        return {
                            "valid": False,
                            "message": "This promotion code has reached its redemption limit"
                        }
                    response["remaining_uses"] = remaining

            return JSONResponse(
                content=response,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            )
        else:
            # Coupon was deleted or is invalid
            return JSONResponse(
                content={
                    "valid": False,
                    "message": "Invalid or expired discount code"
                },
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            )
    except Exception as e:
        logger.error(f"Error validating discount code: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error validating discount code: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )

# Helper function to check if subscriptions are enabled
def check_subscriptions_enabled():
    """Check if subscription features are enabled"""
    if not ENABLE_SUBSCRIPTION_FEATURES:
        raise HTTPException(
            status_code=503,
            detail="Subscription features are currently disabled"
        )

@router.get("/status")
@router.post("/status")  # Also accept POST for backward compatibility with frontend
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
            from app.db import get_db_cursor
            with get_db_cursor() as (cur, conn):
                # Enable autocommit to prevent transaction blocking during menu generation
                conn.autocommit = True

                cur.execute("""
                    SELECT organization_id FROM organization_clients
                    WHERE client_id = %s
                """, (user_id,))

                org_result = cur.fetchone()
                if org_result:
                    organization_id = org_result[0]
                    is_client = True

        # Get subscription details
        subscription = None

        if organization_id:
            # For organization members or clients, check the organization's subscription
            subscription = get_subscription_details(organization_id=organization_id)
        elif user_id:
            # For individual users, check their personal subscription
            subscription = get_subscription_details(user_id=user_id)

        if subscription:
            # Create a DTO with default values for all required fields
            result = {
                "has_subscription": True,
                "subscription_type": subscription.get('subscription_type', 'free'),
                "status": subscription.get('status', 'unknown'),
                "is_active": subscription.get('is_active', False),
                "is_free_tier": subscription.get('subscription_type', 'free') == 'free',
                "currency": subscription.get('currency', 'usd'),
                "monthly_amount": float(subscription.get('monthly_amount', 0))
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

# Initialize Stripe configuration variables
STRIPE_INDIVIDUAL_PRICE_ID = ""
STRIPE_ORGANIZATION_PRICE_ID = ""
STRIPE_WEBHOOK_SECRET = ""

# Configure payment providers if enabled
if ENABLE_SUBSCRIPTION_FEATURES and STRIPE_AVAILABLE:
    # Configure Stripe
    if stripe is not None:
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
        STRIPE_INDIVIDUAL_PRICE_ID = os.getenv("STRIPE_INDIVIDUAL_PRICE_ID", "")
        STRIPE_ORGANIZATION_PRICE_ID = os.getenv("STRIPE_ORGANIZATION_PRICE_ID", "")
        STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

        # Log configuration
        logger.info(f"Stripe configured: API Key present: {bool(stripe.api_key)}")
        logger.info(f"Stripe Individual Price ID: {STRIPE_INDIVIDUAL_PRICE_ID}")
        logger.info(f"Stripe Organization Price ID: {STRIPE_ORGANIZATION_PRICE_ID}")
    
    # Configure PayPal
    try:
        import paypalrestsdk
        
        PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
        PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
        PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox")  # sandbox or live
        PAYPAL_WEBHOOK_ENDPOINT = os.getenv("PAYPAL_WEBHOOK_ENDPOINT", "")
        PAYPAL_WEBHOOK_ID = os.getenv("PAYPAL_WEBHOOK_ID", "")
        
        # Only configure if credentials are present
        if PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET:
            try:
                # Configure PayPal SDK
                paypalrestsdk.configure({
                    "mode": PAYPAL_MODE,
                    "client_id": PAYPAL_CLIENT_ID,
                    "client_secret": PAYPAL_CLIENT_SECRET
                })
                
                # Log configuration (with debug info)
                logger.info(f"PayPal configured: Client ID present: {bool(PAYPAL_CLIENT_ID)}")
                logger.info(f"PayPal Mode: '{PAYPAL_MODE}' (length: {len(PAYPAL_MODE)})")
                logger.info(f"PayPal Client ID starts with: {PAYPAL_CLIENT_ID[:10]}...")
                logger.info(f"PayPal Client Secret present: {bool(PAYPAL_CLIENT_SECRET)} (length: {len(PAYPAL_CLIENT_SECRET)})")
                logger.info(f"PayPal Webhook ID present: {bool(PAYPAL_WEBHOOK_ID)}")
            except Exception as config_error:
                logger.error(f"Error configuring PayPal SDK: {str(config_error)}")
                paypalrestsdk = None
        else:
            logger.warning("PayPal credentials not found. PayPal integration will be limited.")
        
    except ImportError:
        logger.warning("PayPal SDK not installed. PayPal integration will be disabled.")
        paypalrestsdk = None
        # Define PayPal variables as None when SDK is not available
        PAYPAL_CLIENT_ID = None
        PAYPAL_CLIENT_SECRET = None
        PAYPAL_MODE = None
        PAYPAL_WEBHOOK_ENDPOINT = None
        PAYPAL_WEBHOOK_ID = None
else:
    stripe = None
    paypalrestsdk = None
    # Define PayPal variables as None when subscriptions are disabled
    PAYPAL_CLIENT_ID = None
    PAYPAL_CLIENT_SECRET = None
    PAYPAL_MODE = None
    PAYPAL_WEBHOOK_ENDPOINT = None
    PAYPAL_WEBHOOK_ID = None

# Helper functions for payment providers
if ENABLE_SUBSCRIPTION_FEATURES and stripe:
    async def get_or_create_stripe_customer(user_id, organization_id=None):
            """
            Get or create a Stripe customer for a user or organization

            Args:
                user_id: The database ID of the user
                organization_id: The database ID of the organization (if applicable)

            Returns:
                Stripe customer ID
            """
            try:
                # Check if the customer already exists in our database
                with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                    if organization_id:
                        # Check organization subscription
                        cur.execute("""
                            SELECT stripe_customer_id FROM subscriptions
                            WHERE organization_id = %s
                        """, (organization_id,))
                    else:
                        # Check user subscription
                        cur.execute("""
                            SELECT stripe_customer_id FROM subscriptions
                            WHERE user_id = %s
                        """, (user_id,))

                    result = cur.fetchone()

                    if result and result[0]:
                        # Customer exists in our database, but verify it still exists in Stripe
                        existing_customer_id = result[0]
                        logger.info(f"Found existing Stripe customer in database: {existing_customer_id}")
                        
                        # Verify the customer still exists in Stripe
                        try:
                            stripe.Customer.retrieve(existing_customer_id)
                            logger.info(f"Verified customer exists in Stripe: {existing_customer_id}")
                            return existing_customer_id
                        except stripe.error.InvalidRequestError as e:
                            if "No such customer" in str(e):
                                logger.warning(f"Customer {existing_customer_id} no longer exists in Stripe, will create new one")
                                # Clear the old customer ID from database and continue to create new one
                                if organization_id:
                                    cur.execute("""
                                        UPDATE subscriptions
                                        SET stripe_customer_id = NULL
                                        WHERE organization_id = %s
                                    """, (organization_id,))
                                else:
                                    cur.execute("""
                                        UPDATE subscriptions
                                        SET stripe_customer_id = NULL
                                        WHERE user_id = %s
                                    """, (user_id,))
                                # Continue to create new customer below
                            else:
                                # Other Stripe error, re-raise it
                                raise

                    # No customer found, get user details to create one
                    if organization_id:
                        # Get organization details
                        cur.execute("""
                            SELECT o.name, u.email
                            FROM organizations o
                            JOIN user_profiles u ON o.owner_id = u.id
                            WHERE o.id = %s
                        """, (organization_id,))

                        org_data = cur.fetchone()
                        if not org_data:
                            raise HTTPException(
                                status_code=404,
                                detail="Organization not found"
                            )

                        name, email = org_data
                    else:
                        # Get user details
                        cur.execute("""
                            SELECT name, email FROM user_profiles
                            WHERE id = %s
                        """, (user_id,))

                        user_data = cur.fetchone()
                        if not user_data:
                            raise HTTPException(
                                status_code=404,
                                detail="User not found"
                            )

                        name, email = user_data

                # Create Stripe customer
                customer = stripe.Customer.create(
                    email=email,
                    name=name,
                    metadata={
                        "user_id": str(user_id),
                        "organization_id": str(organization_id) if organization_id else None
                    }
                )

                logger.info(f"Created new Stripe customer: {customer.id}")

                # Store the customer ID in our database
                with get_db_cursor(dict_cursor=False, autocommit=False) as (cur, conn):
                    # Check if a subscription already exists
                    if organization_id:
                        cur.execute("""
                            SELECT id FROM subscriptions
                            WHERE organization_id = %s
                        """, (organization_id,))
                    else:
                        cur.execute("""
                            SELECT id FROM subscriptions
                            WHERE user_id = %s
                        """, (user_id,))

                    sub_result = cur.fetchone()

                    if sub_result:
                        # Update existing subscription
                        sub_id = sub_result[0]
                        cur.execute("""
                            UPDATE subscriptions
                            SET stripe_customer_id = %s
                            WHERE id = %s
                        """, (customer.id, sub_id))
                    else:
                        # No subscription exists yet, will be created when checkout completes
                        pass

                    conn.commit()

                return customer.id

            except Exception as e:
                logger.error(f"Error creating Stripe customer: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create customer: {str(e)}"
                )
else:
    stripe = None

# Helper functions for PayPal
if ENABLE_SUBSCRIPTION_FEATURES and paypalrestsdk:
    async def create_paypal_subscription_plan(subscription_type, monthly_amount):
        """Create a PayPal subscription plan"""
        try:
            plan_name = f"{subscription_type.title()} Plan"
            plan_description = f"Monthly subscription for {subscription_type} users"
            
            billing_plan = paypalrestsdk.BillingPlan({
                "name": plan_name,
                "description": plan_description,
                "type": "INFINITE",
                "payment_definitions": [{
                    "name": "Regular payment definition",
                    "type": "REGULAR",
                    "frequency": "MONTH",
                    "frequency_interval": "1",
                    "amount": {
                        "value": str(monthly_amount),
                        "currency": "USD"
                    },
                    "cycles": "0"  # 0 means infinite
                }],
                "merchant_preferences": {
                    "setup_fee": {
                        "value": "0",
                        "currency": "USD"
                    },
                    "return_url": os.getenv("FRONTEND_URL", "http://localhost:3000") + "/subscription/success",
                    "cancel_url": os.getenv("FRONTEND_URL", "http://localhost:3000") + "/subscription/cancel",
                    "auto_bill_amount": "YES",
                    "initial_fail_amount_action": "CONTINUE",
                    "max_fail_attempts": "3"
                }
            })
            
            if billing_plan.create():
                logger.info(f"Created PayPal billing plan: {billing_plan.id}")
                
                # Activate the plan
                if billing_plan.activate():
                    logger.info(f"Activated PayPal billing plan: {billing_plan.id}")
                    return billing_plan.id
                else:
                    logger.error(f"Failed to activate PayPal billing plan: {billing_plan.error}")
                    return None
            else:
                logger.error(f"Failed to create PayPal billing plan: {billing_plan.error}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating PayPal subscription plan: {str(e)}", exc_info=True)
            return None
    
    async def create_paypal_subscription(plan_id, user_id, organization_id=None):
        """Create a PayPal subscription"""
        try:
            # Get user details for PayPal subscription
            with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                if organization_id:
                    cur.execute("""
                        SELECT o.name, u.email, u.name as user_name
                        FROM organizations o
                        JOIN user_profiles u ON o.owner_id = u.id
                        WHERE o.id = %s
                    """, (organization_id,))
                    org_data = cur.fetchone()
                    if not org_data:
                        raise HTTPException(status_code=404, detail="Organization not found")
                    name, email, user_name = org_data
                else:
                    cur.execute("""
                        SELECT name, email FROM user_profiles
                        WHERE id = %s
                    """, (user_id,))
                    user_data = cur.fetchone()
                    if not user_data:
                        raise HTTPException(status_code=404, detail="User not found")
                    name, email = user_data
            
            # Create billing agreement
            billing_agreement = paypalrestsdk.BillingAgreement({
                "name": f"Subscription Agreement - {name}",
                "description": "Monthly subscription agreement",
                "start_date": (datetime.now() + timedelta(minutes=1)).strftime('%Y-%m-%dT%H:%M:%SZ'),
                "plan": {
                    "id": plan_id
                },
                "payer": {
                    "payment_method": "paypal"
                }
            })
            
            if billing_agreement.create():
                # Find approval URL
                approval_url = None
                for link in billing_agreement.links:
                    if link.rel == "approval_url":
                        approval_url = link.href
                        break
                
                if approval_url:
                    logger.info(f"Created PayPal billing agreement: {billing_agreement.id}")
                    return {
                        "agreement_id": billing_agreement.id,
                        "approval_url": approval_url
                    }
                else:
                    logger.error("No approval URL found in PayPal billing agreement")
                    return None
            else:
                logger.error(f"Failed to create PayPal billing agreement: {billing_agreement.error}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating PayPal subscription: {str(e)}", exc_info=True)
            return None
else:
    paypalrestsdk = None

@router.post("/create-checkout")
async def create_checkout_session(
    request: Request,
    user = Depends(get_user_from_token)
):
    """
    Create a checkout session for a new subscription

    Returns a URL that the user can be redirected to for payment
    """
    # First, check if subscriptions are enabled at all
    if not ENABLE_SUBSCRIPTION_FEATURES:
        logger.error("Subscription features are disabled")
        return await subscription_disabled()

    # Verify the stripe module is imported correctly
    if 'stripe' not in globals() or stripe is None:
        logger.error("Stripe module is not properly imported")
        raise HTTPException(
            status_code=503,
            detail="Stripe integration is not available - module not loaded"
        )

    # Check if Stripe API key is configured
    if not hasattr(stripe, 'api_key') or not stripe.api_key:
        logger.error("Stripe API key is not configured")
        raise HTTPException(
            status_code=503,
            detail="Stripe integration is not available - API key not configured"
        )

    # Log environment variables for debugging
    logger.info(f"Environment config: ENABLE_SUBSCRIPTION_FEATURES={ENABLE_SUBSCRIPTION_FEATURES}, "
                f"Stripe API key exists: {bool(stripe.api_key)}, "
                f"Individual price ID exists: {bool(STRIPE_INDIVIDUAL_PRICE_ID)}, "
                f"Organization price ID exists: {bool(STRIPE_ORGANIZATION_PRICE_ID)}")

    try:
        # Parse request body manually for better debugging
        try:
            body = await request.json()
            logger.info(f"Raw request body: {body}")
        except Exception as e:
            logger.error(f"Failed to parse JSON body: {str(e)}")
            raise HTTPException(status_code=422, detail=f"Invalid JSON in request body: {str(e)}")
        
        # Validate that required fields exist
        if 'subscription_type' not in body:
            logger.error("Missing required field: subscription_type")
            raise HTTPException(status_code=422, detail="Missing required field: subscription_type")
        
        # Extract and validate subscription_type
        try:
            subscription_type_value = body.get('subscription_type', '')
            logger.info(f"Subscription type from request: '{subscription_type_value}'")
            
            # Check if value is valid for the enum
            valid_types = [t.value for t in SubscriptionType]
            if subscription_type_value not in valid_types:
                logger.error(f"Invalid subscription_type: '{subscription_type_value}', valid options are: {valid_types}")
                raise HTTPException(
                    status_code=422, 
                    detail=f"Invalid subscription_type: '{subscription_type_value}'. Valid options are: {valid_types}"
                )
            
            subscription_type = SubscriptionType(subscription_type_value)
        except ValueError as e:
            logger.error(f"Invalid subscription_type: '{body.get('subscription_type')}', valid options are: {[t.value for t in SubscriptionType]}")
            raise HTTPException(
                status_code=422, 
                detail=f"Invalid subscription_type: '{body.get('subscription_type')}'. Valid options are: {[t.value for t in SubscriptionType]}"
            )

        # Extract and validate payment_provider
        try:
            payment_provider_value = body.get('payment_provider', 'stripe')
            logger.info(f"Payment provider from request: '{payment_provider_value}'")
            
            # Check if value is valid for the enum
            valid_providers = [p.value for p in PaymentProvider]
            if payment_provider_value not in valid_providers:
                logger.error(f"Invalid payment_provider: '{payment_provider_value}', valid options are: {valid_providers}")
                raise HTTPException(
                    status_code=422, 
                    detail=f"Invalid payment_provider: '{payment_provider_value}'. Valid options are: {valid_providers}"
                )
                
            payment_provider = PaymentProvider(payment_provider_value)
        except ValueError as e:
            logger.error(f"Invalid payment_provider: '{body.get('payment_provider')}', valid options are: {[p.value for p in PaymentProvider]}")
            raise HTTPException(
                status_code=422, 
                detail=f"Invalid payment_provider: '{body.get('payment_provider')}'. Valid options are: {[p.value for p in PaymentProvider]}"
            )

        # Get optional URL parameters
        success_url = body.get('success_url')
        cancel_url = body.get('cancel_url')

        # Get discount code if provided
        discount_code = body.get('discount_code')

        # Log the received parameters for debugging
        logger.info(f"Creating checkout session with params: subscription_type={subscription_type}, "
                    f"payment_provider={payment_provider}, success_url={success_url}, cancel_url={cancel_url}, "
                    f"discount_code={discount_code}")

        # Determine which user or organization is subscribing
        user_id = user.get('user_id')
        if not user_id:
            logger.error("No user_id found in token")
            raise HTTPException(
                status_code=401,
                detail="Authentication required"
            )
            
        organization_id = None

        # If this is an organization admin, they might be subscribing for the organization
        if subscription_type == SubscriptionType.organization:
            # Check if the user is an organization admin
            try:
                with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                    cur.execute("""
                        SELECT id FROM organizations
                        WHERE owner_id = %s
                    """, (user_id,))

                    org_result = cur.fetchone()
                    if org_result:
                        organization_id = org_result[0]
                        logger.info(f"User {user_id} is owner of organization {organization_id}")
                    else:
                        logger.error(f"User {user_id} is not an organization owner")
                        raise HTTPException(
                            status_code=403,
                            detail="You must be an organization owner to purchase an organization subscription"
                        )
            except Exception as db_err:
                logger.error(f"Database error checking organization: {str(db_err)}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail="Error checking organization status"
                )

        # Handle different payment providers
        if payment_provider == PaymentProvider.stripe:
            # ========== STRIPE PAYMENT PROCESSING ==========
            logger.info("Processing Stripe payment")
            
            # Validate that we have the price IDs
            if subscription_type == SubscriptionType.individual and not STRIPE_INDIVIDUAL_PRICE_ID:
                logger.error(f"Individual subscription price not configured - "
                             f"subscription_type={subscription_type}, STRIPE_INDIVIDUAL_PRICE_ID is empty")
                raise HTTPException(
                    status_code=503,
                    detail="Individual subscription price not configured"
                )

            if subscription_type == SubscriptionType.organization and not STRIPE_ORGANIZATION_PRICE_ID:
                logger.error(f"Organization subscription price not configured - "
                             f"subscription_type={subscription_type}, STRIPE_ORGANIZATION_PRICE_ID is empty")
                raise HTTPException(
                    status_code=503,
                    detail="Organization subscription price not configured"
                )

            # Get or create Stripe customer
            try:
                customer_id = await get_or_create_stripe_customer(user_id, organization_id)
                logger.info(f"Got Stripe customer ID: {customer_id}")
                
                if not customer_id:
                    logger.error("Failed to get or create Stripe customer")
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to create customer record"
                    )
            except HTTPException:
                # Re-raise HTTPExceptions (they already have proper status codes)
                raise
            except Exception as customer_err:
                logger.error(f"Error getting/creating Stripe customer: {str(customer_err)}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Error creating customer: {str(customer_err)}"
                )

            # Determine the price ID based on subscription type
            price_id = STRIPE_INDIVIDUAL_PRICE_ID if subscription_type == SubscriptionType.individual else STRIPE_ORGANIZATION_PRICE_ID
            logger.info(f"Using price ID: {price_id}")

            # Validate that the price ID is in the correct format (should start with 'price_')
            if not price_id.startswith('price_'):
                logger.error(f"Invalid price ID format: {price_id}. Price IDs should start with 'price_', not 'prod_'")
                raise HTTPException(
                    status_code=500,
                    detail="Invalid price ID configuration. Please contact support."
                )

            # Set default URLs if not provided
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            success_url = success_url or f"{frontend_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = cancel_url or f"{frontend_url}/subscription/cancel"
            logger.info(f"Using success_url: {success_url}, cancel_url: {cancel_url}")

            # Create metadata to track the subscription
            metadata = {
                "user_id": str(user_id),
                "subscription_type": subscription_type.value,
                "created_at": datetime.now().isoformat()
            }

            if organization_id:
                metadata["organization_id"] = str(organization_id)

            try:
                # Create checkout session
                logger.info("Calling stripe.checkout.Session.create...")

                # Prepare checkout session parameters
                checkout_params = {
                    "customer": customer_id,
                    "payment_method_types": ["card"],
                    "line_items": [{
                        "price": price_id,
                        "quantity": 1
                    }],
                    "mode": "subscription",
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                    "metadata": metadata
                }

                # If discount code provided, validate and apply it
                is_free_coupon = False
                if discount_code:
                    try:
                        logger.info(f"Applying discount code to checkout: {discount_code}")
                        
                        # First, try to find it as a promotion code
                        promotion_code_found = False
                        coupon_obj = None
                        
                        try:
                            # List all promotion codes and find matching one
                            promotion_codes = stripe.PromotionCode.list(
                                code=discount_code,
                                active=True,
                                limit=1
                            )
                            
                            if promotion_codes.data:
                                promotion_code_obj = promotion_codes.data[0]
                                coupon_obj = promotion_code_obj.coupon
                                # For promotion codes, use the promotion_code parameter
                                checkout_params["discounts"] = [{"promotion_code": promotion_code_obj.id}]
                                logger.info(f"Applied promotion code: {discount_code} (ID: {promotion_code_obj.id})")
                                promotion_code_found = True
                            else:
                                logger.info(f"No promotion code found for: {discount_code}, trying as coupon ID")
                        except Exception as promo_err:
                            logger.warning(f"Error checking promotion codes: {str(promo_err)}")
                        
                        # If not found as promotion code, try as direct coupon ID
                        if not promotion_code_found:
                            try:
                                coupon_obj = stripe.Coupon.retrieve(discount_code)
                                if coupon_obj and not coupon_obj.get('deleted'):
                                    # For direct coupon IDs, use the coupon parameter
                                    checkout_params["discounts"] = [{"coupon": discount_code}]
                                    logger.info(f"Applied coupon ID: {discount_code}")
                                else:
                                    logger.warning(f"Coupon not found or deleted: {discount_code}")
                            except stripe.error.InvalidRequestError as e:
                                logger.warning(f"Invalid coupon code: {discount_code}, error: {str(e)}")
                        
                        # Check if this is a 100% off coupon
                        if coupon_obj:
                            logger.info(f"Analyzing coupon: {coupon_obj.id}, percent_off: {coupon_obj.get('percent_off')}, amount_off: {coupon_obj.get('amount_off')}")
                            if coupon_obj.get('percent_off') == 100:
                                logger.info(f"100% off coupon detected: {discount_code}")
                                is_free_coupon = True
                            elif coupon_obj.get('amount_off'):
                                # For amount_off coupons, we'd need to compare with the price
                                # For simplicity, let's assume any large amount_off is also free
                                # You may need to adjust this logic based on your pricing
                                amount_off_dollars = coupon_obj.get('amount_off') / 100  # Convert from cents
                                logger.info(f"Amount off coupon: ${amount_off_dollars}")
                                # If amount off is >= $50 (assuming this covers your highest plan), treat as free
                                if amount_off_dollars >= 50:
                                    is_free_coupon = True
                            else:
                                logger.info(f"Coupon {discount_code} is not a free coupon")
                        else:
                            logger.warning(f"No coupon object found for {discount_code}")
                        
                        logger.info(f"Final is_free_coupon determination: {is_free_coupon}")
                                
                    except Exception as coupon_err:
                        logger.error(f"Error applying discount: {str(coupon_err)}", exc_info=True)
                        # Continue without the discount rather than failing

                # Handle free coupons differently - create subscription directly
                if is_free_coupon:
                    logger.info("Creating free subscription directly (bypassing checkout)")
                    logger.info(f"Free coupon detected - subscription_type: {subscription_type}, user_id: {user_id}, org_id: {organization_id}")
                    try:
                        # Create the subscription directly with the discount
                        subscription_params = {
                            "customer": customer_id,
                            "items": [{"price": price_id}],
                            "metadata": metadata
                        }
                        
                        # Apply the discount to the subscription
                        if "discounts" in checkout_params:
                            subscription_params["discounts"] = checkout_params["discounts"]
                        
                        # Create the subscription
                        subscription = stripe.Subscription.create(**subscription_params)
                        
                        logger.info(f"Created free subscription: {subscription.id}")
                        
                        # Record the subscription in our database
                        try:
                            subscription_data = SubscriptionCreate(
                                user_id=user_id if not organization_id else None,
                                organization_id=organization_id,
                                subscription_type=subscription_type,
                                stripe_subscription_id=subscription.id,
                                stripe_customer_id=customer_id,
                                status=SubscriptionStatus.active,
                                current_period_start=datetime.fromtimestamp(subscription.current_period_start),
                                current_period_end=datetime.fromtimestamp(subscription.current_period_end),
                                payment_provider=PaymentProvider.stripe
                            )
                            
                            create_subscription(subscription_data)
                            logger.info(f"Recorded free subscription in database for user_id={user_id}, org_id={organization_id}")
                            
                        except Exception as db_err:
                            logger.error(f"Error recording subscription in database: {str(db_err)}", exc_info=True)
                            # Don't fail the whole process, subscription is created in Stripe
                        
                        # Return success URL directly since no checkout is needed
                        return {
                            "success": True,
                            "checkout_url": success_url,  # Redirect directly to success page
                            "subscription_id": subscription.id,
                            "is_free_subscription": True
                        }
                        
                    except stripe.error.StripeError as free_stripe_err:
                        logger.error(f"Stripe error creating free subscription: {str(free_stripe_err)}", exc_info=True)
                        logger.error(f"Stripe error type: {type(free_stripe_err).__name__}")
                        logger.error(f"Stripe error details: {free_stripe_err.user_message if hasattr(free_stripe_err, 'user_message') else 'No user message'}")
                        # Fall back to regular checkout if direct subscription creation fails
                        logger.warning("Falling back to regular checkout flow due to Stripe error")
                        is_free_coupon = False
                    except Exception as general_err:
                        logger.error(f"General error creating free subscription: {str(general_err)}", exc_info=True)
                        logger.warning("Falling back to regular checkout flow due to general error")
                        is_free_coupon = False
                
                # Create regular checkout session for paid subscriptions
                if not is_free_coupon:
                    # Create the checkout session
                    checkout_session = stripe.checkout.Session.create(**checkout_params)

                    # Log the checkout session creation
                    logger.info(f"Created Stripe checkout session: {checkout_session.id}")

                    return {
                        "success": True,
                        "checkout_url": checkout_session.url,
                        "session_id": checkout_session.id
                    }
            except stripe.error.StripeError as stripe_err:
                # Handle Stripe-specific errors
                logger.error(f"Stripe error creating checkout session: {str(stripe_err)}", exc_info=True)
                error_msg = str(stripe_err)
                
                # Provide more specific error messages based on the type of Stripe error
                if isinstance(stripe_err, stripe.error.CardError):
                    # Card errors are the most common and customer-facing
                    status_code = 400
                    detail = f"Card error: {error_msg}"
                elif isinstance(stripe_err, stripe.error.InvalidRequestError):
                    # Invalid parameters were supplied to Stripe's API
                    status_code = 400
                    detail = f"Invalid request to payment processor: {error_msg}"
                elif isinstance(stripe_err, stripe.error.AuthenticationError):
                    # Authentication failed (e.g. invalid API key)
                    status_code = 503
                    detail = "Payment processor authentication failed"
                elif isinstance(stripe_err, stripe.error.APIConnectionError):
                    # Network communication with Stripe failed
                    status_code = 503
                    detail = "Could not connect to payment processor"
                elif isinstance(stripe_err, stripe.error.RateLimitError):
                    # Too many requests hit the Stripe API too quickly
                    status_code = 429
                    detail = "Payment processor rate limit exceeded, please try again later"
                else:
                    # Handle all other Stripe errors generically
                    status_code = 500
                    detail = f"Payment processor error: {error_msg}"
                    
                raise HTTPException(
                    status_code=status_code,
                    detail=detail
                )
            except Exception as e:
                logger.error(f"Unexpected error creating checkout session: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create checkout session: {str(e)}"
                )
        
        elif payment_provider == PaymentProvider.paypal:
            # ========== PAYPAL PAYMENT PROCESSING ==========
            logger.info("Processing PayPal payment")
            
            if not paypalrestsdk:
                logger.error("PayPal SDK is not available")
                raise HTTPException(
                    status_code=503,
                    detail="PayPal integration is not available"
                )
            
            if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
                logger.error("PayPal credentials not configured")
                raise HTTPException(
                    status_code=503,
                    detail="PayPal integration is not configured"
                )
            
            try:
                # Determine monthly amount based on subscription type
                monthly_amount = 7.99 if subscription_type == SubscriptionType.individual else 49.99
                
                # Create or get PayPal subscription plan
                plan_id = await create_paypal_subscription_plan(subscription_type.value, monthly_amount)
                if not plan_id:
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to create PayPal subscription plan"
                    )
                
                # Create PayPal subscription
                subscription_result = await create_paypal_subscription(plan_id, user_id, organization_id)
                if not subscription_result:
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to create PayPal subscription"
                    )
                
                # Store the PayPal plan ID and agreement ID in our database for future reference
                with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                    # Check if subscription already exists
                    if organization_id:
                        cur.execute("""
                            SELECT id FROM subscriptions WHERE organization_id = %s
                        """, (organization_id,))
                    else:
                        cur.execute("""
                            SELECT id FROM subscriptions WHERE user_id = %s
                        """, (user_id,))
                    
                    existing = cur.fetchone()
                    
                    if existing:
                        # Update existing subscription with PayPal details
                        cur.execute("""
                            UPDATE subscriptions
                            SET paypal_plan_id = %s, updated_at = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (plan_id, existing[0]))
                    else:
                        # Create new subscription record with pending status (will be activated when PayPal webhook confirms)
                        from app.models.subscription import create_subscription
                        create_subscription(
                            user_id=user_id,
                            organization_id=organization_id,
                            subscription_type=subscription_type.value,
                            payment_provider="paypal",
                            monthly_amount=monthly_amount,
                            paypal_plan_id=plan_id,
                            status='pending'  # Don't activate until PayPal confirms payment
                        )
                
                return {
                    "success": True,
                    "checkout_url": subscription_result["approval_url"],
                    "agreement_id": subscription_result["agreement_id"],
                    "plan_id": plan_id
                }
                
            except Exception as paypal_err:
                logger.error(f"PayPal error creating subscription: {str(paypal_err)}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"PayPal error: {str(paypal_err)}"
                )
        
        else:
            # Unsupported payment provider
            logger.error(f"Unsupported payment provider: {payment_provider}")
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported payment provider: {payment_provider}"
            )

    except HTTPException:
        # Re-raise HTTPExceptions to preserve their status code and detail
        raise
    except Exception as e:
        logger.error(f"Unhandled error in checkout endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Server error: {str(e)}"
        )

@router.post("/webhooks/stripe")
async def stripe_webhook_handler(request: Request):
    """
    Handle Stripe webhook events for subscription lifecycle
    """
    logger.info("🔔 Received Stripe webhook - processing...")
    logger.info(f"Request headers: {dict(request.headers)}")

    if not ENABLE_SUBSCRIPTION_FEATURES or not stripe:
        logger.error("❌ Stripe integration is not available - check ENABLE_SUBSCRIPTION_FEATURES and stripe module")
        return JSONResponse(
            status_code=503,
            content={"detail": "Stripe integration is not available"}
        )

    # Get the webhook signature from the request headers
    signature = request.headers.get("stripe-signature")
    if not signature:
        logger.error("❌ Missing Stripe signature in webhook request")
        return JSONResponse(
            status_code=400,
            content={"detail": "Missing Stripe signature"}
        )

    # Get the webhook secret
    webhook_secret = STRIPE_WEBHOOK_SECRET
    logger.info(f"🔑 Webhook secret exists: {bool(webhook_secret)}")
    if not webhook_secret:
        logger.error("❌ Stripe webhook secret not configured - check STRIPE_WEBHOOK_SECRET env variable")
        return JSONResponse(
            status_code=500,
            content={"detail": "Webhook not configured"}
        )

    # Get the request body
    try:
        payload = await request.body()
        logger.info(f"📦 Webhook payload received (first 100 chars): {payload[:100]}")

        # Verify the event using the signature and secret
        try:
            logger.info(f"🔒 Attempting to verify webhook signature...")
            event = stripe.Webhook.construct_event(
                payload, signature, webhook_secret
            )
            logger.info(f"✅ Webhook signature verified successfully!")
        except ValueError as e:
            # Invalid payload
            logger.error(f"❌ Invalid webhook payload: {str(e)}")
            # Log the full payload for debugging
            logger.error(f"Full payload: {payload}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid payload"}
            )
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            logger.error(f"❌ Invalid webhook signature: {str(e)}")
            logger.error(f"Provided signature: {signature}")
            logger.error(f"Used webhook secret (first 4 chars): {webhook_secret[:4]}***")
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid signature"}
            )

        # Extract event data
        event_id = event.id
        event_type = event.type
        event_data = event.data.object

        logger.info(f"🎯 Received Stripe webhook event: {event_type} ({event_id})")
        logger.info(f"📅 Event timestamp: {datetime.now().isoformat()}")

        # First log event to database regardless of type
        try:
            # Record the event in our database for audit/debugging
            with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                # Try to find associated subscription
                sub_id = None
                if hasattr(event_data, 'subscription'):
                    # Try to look up by stripe_subscription_id
                    cur.execute("""
                        SELECT id FROM subscriptions
                        WHERE stripe_subscription_id = %s
                    """, (event_data.subscription,))
                    result = cur.fetchone()
                    if result:
                        sub_id = result[0]

                # If no subscription found but customer exists, try by customer
                if not sub_id and hasattr(event_data, 'customer'):
                    cur.execute("""
                        SELECT id FROM subscriptions
                        WHERE stripe_customer_id = %s
                    """, (event_data.customer,))
                    result = cur.fetchone()
                    if result:
                        sub_id = result[0]

                # Log the event regardless of whether we have a subscription ID
                # Use a placeholder ID of -1 if we don't have a real one yet
                cur.execute("""
                    INSERT INTO subscription_events (
                        subscription_id, event_type, event_data, payment_provider,
                        provider_event_id, processed, processed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    sub_id or -1,  # Use -1 as placeholder if no subscription yet
                    event_type,
                    str(event_data),
                    'stripe',
                    event_id,
                    False,  # Mark as unprocessed initially
                    None    # Initially no processed time
                ))
                webhook_event_id = cur.fetchone()[0]
                logger.info(f"📝 Recorded webhook event in database with ID: {webhook_event_id}")
        except Exception as e:
            logger.error(f"❌ Failed to log webhook event to database: {str(e)}", exc_info=True)
            # Continue processing even if logging fails

        # Handle different event types
        if event_type == "checkout.session.completed":
            # A checkout session has completed successfully
            await handle_checkout_completed(event_data)
        elif event_type == "customer.subscription.created":
            # A subscription has been created
            await handle_subscription_created(event_data)
        elif event_type == "customer.subscription.updated":
            # A subscription has been updated
            await handle_subscription_updated(event_data)
        elif event_type == "customer.subscription.deleted":
            # A subscription has been cancelled
            await handle_subscription_deleted(event_data)
        elif event_type == "invoice.paid":
            # An invoice has been paid
            await handle_invoice_paid(event_data)
        elif event_type == "invoice.payment_failed":
            # An invoice payment has failed
            await handle_invoice_payment_failed(event_data)
        else:
            # Other events - just log them
            logger.info(f"Unhandled Stripe event type: {event_type}")

        # Always mark the webhook as processed and return success, even if we didn't handle it
        # This prevents Stripe from retrying and potentially creating duplicate records
        try:
            with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                # Check if processed_at column exists
                try:
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.columns
                            WHERE table_name = 'subscription_events'
                            AND column_name = 'processed_at'
                        )
                    """)
                    has_processed_at = cur.fetchone()[0]
                except Exception:
                    has_processed_at = False

                # Update the event as processed if we recorded it earlier
                if 'webhook_event_id' in locals():
                    try:
                        if has_processed_at:
                            cur.execute("""
                                UPDATE subscription_events
                                SET processed = TRUE, processed_at = CURRENT_TIMESTAMP
                                WHERE id = %s
                            """, (webhook_event_id,))
                        else:
                            # Fallback if processed_at column doesn't exist
                            cur.execute("""
                                UPDATE subscription_events
                                SET processed = TRUE
                                WHERE id = %s
                            """, (webhook_event_id,))
                        logger.info(f"✅ Marked webhook event {webhook_event_id} as processed")
                    except Exception as update_error:
                        # Don't let update errors prevent processing
                        logger.error(f"❌ Error marking webhook as processed: {str(update_error)}")
                        # Try simpler update as last resort
                        try:
                            cur.execute("""
                                UPDATE subscription_events
                                SET processed = TRUE
                                WHERE id = %s
                            """, (webhook_event_id,))
                            logger.info(f"✅ Marked webhook event {webhook_event_id} as processed (simple update)")
                        except Exception as final_error:
                            logger.error(f"❌ Final error marking webhook as processed: {str(final_error)}")
        except Exception as e:
            logger.error(f"❌ Failed to mark webhook as processed: {str(e)}")

        # Return a success response
        logger.info("🎉 Webhook processing completed successfully")
        return JSONResponse(
            status_code=200,
            content={"detail": "Webhook processed successfully"}
        )
    except Exception as e:
        logger.error(f"❌ Error processing Stripe webhook: {str(e)}", exc_info=True)

        # Try to log the error to the database for debugging
        try:
            with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                cur.execute("""
                    INSERT INTO subscription_events (
                        subscription_id, event_type, event_data, payment_provider,
                        processed, processed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    -1,  # Unknown subscription
                    "webhook_error",
                    str(e),
                    'stripe',
                    False,
                    None  # Initially no processed time
                ))
        except Exception as log_error:
            logger.error(f"❌ Failed to log webhook error: {str(log_error)}")

        return JSONResponse(
            status_code=500,
            content={"detail": f"Error processing webhook: {str(e)}"}
        )

# Helper functions for handling Stripe webhook events
async def handle_checkout_completed(event_data):
    """Handle checkout.session.completed event"""
    try:
        logger.info(f"🛒 Processing checkout.session.completed: {event_data.id}")
        logger.info(f"⚠️ First, check if subscription tables exist...")

        # Check if subscription tables exist
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            try:
                # Check if subscriptions table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = 'subscriptions'
                    )
                """)
                subscriptions_table_exists = cur.fetchone()[0]

                # Check if subscription_events table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = 'subscription_events'
                    )
                """)
                events_table_exists = cur.fetchone()[0]

                logger.info(f"📊 Database tables check - subscriptions: {subscriptions_table_exists}, events: {events_table_exists}")

                # If tables don't exist, create them
                if not subscriptions_table_exists:
                    logger.warning("⚠️ Subscriptions table does not exist - creating it now")
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
                    logger.info("✅ Created subscriptions table")

                if not events_table_exists:
                    logger.warning("⚠️ Subscription_events table does not exist - creating it now")
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS subscription_events (
                            id SERIAL PRIMARY KEY,
                            subscription_id INTEGER,
                            event_type VARCHAR(100) NOT NULL,
                            event_data TEXT NOT NULL,
                            payment_provider VARCHAR(50) NOT NULL,
                            provider_event_id VARCHAR(255),
                            processed BOOLEAN DEFAULT FALSE,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            processed_at TIMESTAMP WITH TIME ZONE
                        )
                    """)
                    logger.info("✅ Created subscription_events table")

                # Also ensure invoices table exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS invoices (
                        id SERIAL PRIMARY KEY,
                        subscription_id INTEGER,
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
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Add subscription_id column to user_profiles if it doesn't exist
                try:
                    cur.execute("""
                        ALTER TABLE user_profiles
                        ADD COLUMN IF NOT EXISTS subscription_id INTEGER
                    """)
                except Exception as e:
                    logger.warning(f"⚠️ Could not add subscription_id to user_profiles: {str(e)}")

                # Add subscription_id column to organizations if it doesn't exist
                try:
                    cur.execute("""
                        ALTER TABLE organizations
                        ADD COLUMN IF NOT EXISTS subscription_id INTEGER
                    """)
                except Exception as e:
                    logger.warning(f"⚠️ Could not add subscription_id to organizations: {str(e)}")

            except Exception as e:
                logger.error(f"❌ Error checking/creating subscription tables: {str(e)}")
                # Continue anyway - we'll attempt to process the event

        logger.info(f"🔄 Now processing checkout.session.completed: {event_data.id}")

        # Extract metadata
        metadata = event_data.get("metadata", {})
        user_id = int(metadata.get("user_id")) if metadata.get("user_id") else None
        organization_id = int(metadata.get("organization_id")) if metadata.get("organization_id") else None
        subscription_type = metadata.get("subscription_type")

        if not user_id and not organization_id:
            logger.error("Missing user_id or organization_id in checkout metadata")
            return

        # Get subscription ID from the session
        subscription_id = event_data.get("subscription")
        if not subscription_id:
            logger.error("No subscription ID in checkout session")
            return

        # Get subscription details from Stripe
        stripe_subscription = stripe.Subscription.retrieve(subscription_id)

        # Extract subscription data
        stripe_status = stripe_subscription.status
        current_period_start = datetime.fromtimestamp(stripe_subscription.current_period_start)
        current_period_end = datetime.fromtimestamp(stripe_subscription.current_period_end)
        cancel_at_period_end = stripe_subscription.cancel_at_period_end

        # Get the price ID and amount
        price_id = None
        monthly_amount = 0.0

        # Handle different structures of stripe_subscription
        if hasattr(stripe_subscription, 'items') and hasattr(stripe_subscription.items, 'data'):
            # Normal structure
            if stripe_subscription.items.data:
                price = stripe_subscription.items.data[0].price
                price_id = price.id
                monthly_amount = price.unit_amount / 100.0  # Convert from cents to dollars
        elif hasattr(stripe_subscription, 'plan'):
            # Simplified structure or different API version
            price_id = stripe_subscription.plan.id
            monthly_amount = stripe_subscription.plan.amount / 100.0

        # Get the customer ID
        customer_id = stripe_subscription.customer

        # Create or update subscription in our database
        from app.models.subscription import create_subscription, update_subscription, log_subscription_event

        # Check if a subscription already exists
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            if organization_id:
                cur.execute("""
                    SELECT id FROM subscriptions
                    WHERE organization_id = %s
                """, (organization_id,))
            else:
                cur.execute("""
                    SELECT id FROM subscriptions
                    WHERE user_id = %s
                """, (user_id,))

            result = cur.fetchone()

            if result:
                # Update existing subscription
                subscription_db_id = result[0]
                update_subscription(
                    subscription_id=subscription_db_id,
                    status="active",
                    current_period_start=current_period_start,
                    current_period_end=current_period_end,
                    cancel_at_period_end=cancel_at_period_end,
                    stripe_status=stripe_status,
                    stripe_subscription_id=subscription_id,
                    stripe_price_id=price_id
                )
                logger.info(f"Updated existing subscription: {subscription_db_id}")
            else:
                # Create new subscription
                subscription_db_id = create_subscription(
                    user_id=user_id,
                    organization_id=organization_id,
                    subscription_type=subscription_type or ("individual" if user_id else "organization"),
                    payment_provider="stripe",
                    monthly_amount=monthly_amount,
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=subscription_id,
                    stripe_price_id=price_id
                )
                logger.info(f"Created new subscription: {subscription_db_id}")

            # Log the event
            if subscription_db_id:
                log_subscription_event(
                    subscription_id=subscription_db_id,
                    event_type="checkout_completed",
                    event_data=event_data,
                    payment_provider="stripe",
                    provider_event_id=event_data.id,
                    processed=True,
                    processed_at=datetime.now()
                )

    except Exception as e:
        logger.error(f"Error handling checkout completed: {str(e)}", exc_info=True)

async def handle_subscription_created(event_data):
    """Handle customer.subscription.created event"""
    try:
        logger.info(f"🔔 Processing subscription.created: {event_data.id}")
        subscription_db_id = None

        # This event is usually handled by checkout.session.completed,
        # but we can use it as a backup in case the checkout event is missed

        # Get customer ID and find the associated user/organization
        customer_id = event_data.get("customer")
        if not customer_id:
            logger.error("❌ No customer ID in subscription event")
            return

        # Try to find the subscription in our database by stripe_subscription_id
        try:
            with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                # Check if tables exist first
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = 'subscriptions'
                    )
                """)
                if not cur.fetchone()[0]:
                    logger.error("❌ Subscriptions table does not exist! Creating it now.")
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
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        )
                    """)

                # Now try to find the subscription
                cur.execute("""
                    SELECT id, user_id, organization_id FROM subscriptions
                    WHERE stripe_subscription_id = %s
                """, (event_data.id,))

                result = cur.fetchone()

                if result:
                    # Subscription already exists, just log the event
                    subscription_db_id = result[0]
                    user_id = result[1]
                    organization_id = result[2]
                    logger.info(f"✅ Subscription {event_data.id} already exists: {subscription_db_id}")
                else:
                    # Try to find the user or organization by customer ID
                    cur.execute("""
                        SELECT id, user_id, organization_id FROM subscriptions
                        WHERE stripe_customer_id = %s
                    """, (customer_id,))

                    result = cur.fetchone()

                    if result:
                        # Found a subscription with this customer ID
                        subscription_db_id = result[0]
                        user_id = result[1]
                        organization_id = result[2]

                        # Update the subscription with the new subscription ID
                        cur.execute("""
                            UPDATE subscriptions
                            SET stripe_subscription_id = %s,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = %s
                            RETURNING id
                        """, (event_data.id, subscription_db_id))

                        logger.info(f"✅ Updated subscription {subscription_db_id} with new subscription ID: {event_data.id}")
                    else:
                        # We couldn't find a subscription, try to find the customer in Stripe
                        try:
                            stripe_customer = stripe.Customer.retrieve(customer_id)
                            customer_metadata = stripe_customer.get("metadata", {})

                            user_id = int(customer_metadata.get("user_id")) if customer_metadata.get("user_id") else None
                            organization_id = int(customer_metadata.get("organization_id")) if customer_metadata.get("organization_id") else None

                            if user_id or organization_id:
                                # We found the user/organization, create a new subscription
                                logger.info(f"🆕 Creating new subscription from metadata: user_id={user_id}, org_id={organization_id}")

                                # Default values in case we can't extract them
                                stripe_status = 'active'
                                current_period_start = datetime.now()
                                current_period_end = current_period_start + timedelta(days=30)
                                cancel_at_period_end = False
                                monthly_amount = 7.99
                                price_id = None

                                # Try to extract subscription data if attributes exist
                                try:
                                    if hasattr(event_data, 'status'):
                                        stripe_status = event_data.status

                                    if hasattr(event_data, 'current_period_start'):
                                        current_period_start = datetime.fromtimestamp(event_data.current_period_start)

                                    if hasattr(event_data, 'current_period_end'):
                                        current_period_end = datetime.fromtimestamp(event_data.current_period_end)

                                    if hasattr(event_data, 'cancel_at_period_end'):
                                        cancel_at_period_end = event_data.cancel_at_period_end

                                    # Get the price ID and amount - check for different structures
                                    if hasattr(event_data, 'items') and hasattr(event_data.items, 'data') and event_data.items.data:
                                        price = event_data.items.data[0].price
                                        price_id = price.id
                                        monthly_amount = price.unit_amount / 100.0  # Convert from cents to dollars
                                    elif hasattr(event_data, 'plan'):
                                        price_id = event_data.plan.id
                                        monthly_amount = event_data.plan.amount / 100.0
                                except Exception as attr_err:
                                    logger.warning(f"⚠️ Error extracting subscription attributes: {str(attr_err)}")
                                    # Continue with default values

                                # Create subscription directly with SQL
                                cur.execute("""
                                    INSERT INTO subscriptions (
                                        user_id, organization_id, subscription_type, payment_provider,
                                        monthly_amount, currency, status, stripe_customer_id,
                                        stripe_subscription_id, stripe_price_id, current_period_start,
                                        current_period_end, cancel_at_period_end, stripe_status
                                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                    RETURNING id
                                """, (
                                    user_id,
                                    organization_id,
                                    "individual" if user_id else "organization",
                                    "stripe",
                                    monthly_amount,
                                    "usd",
                                    "active",
                                    customer_id,
                                    event_data.id,
                                    price_id,
                                    current_period_start,
                                    current_period_end,
                                    cancel_at_period_end,
                                    stripe_status
                                ))

                                subscription_db_id = cur.fetchone()[0]
                                logger.info(f"✅ Created new subscription: {subscription_db_id}")

                                # Update user_profiles or organizations table with subscription_id
                                if user_id:
                                    cur.execute("""
                                        UPDATE user_profiles
                                        SET subscription_id = %s
                                        WHERE id = %s
                                    """, (subscription_db_id, user_id))
                                    logger.info(f"✅ Updated user {user_id} with subscription {subscription_db_id}")
                                elif organization_id:
                                    cur.execute("""
                                        UPDATE organizations
                                        SET subscription_id = %s
                                        WHERE id = %s
                                    """, (subscription_db_id, organization_id))
                                    logger.info(f"✅ Updated organization {organization_id} with subscription {subscription_db_id}")
                            else:
                                logger.error(f"❌ Could not find user/organization for customer: {customer_id}")
                        except Exception as customer_err:
                            logger.error(f"❌ Error retrieving customer {customer_id}: {str(customer_err)}")

                # Log the event in our database
                if subscription_db_id:
                    cur.execute("""
                        INSERT INTO subscription_events (
                            subscription_id, event_type, event_data, payment_provider, provider_event_id, processed, processed_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        subscription_db_id,
                        "subscription_created",
                        str(event_data),
                        "stripe",
                        event_data.id,
                        True,
                        datetime.now()  # Mark as processed immediately
                    ))
                    logger.info(f"📝 Logged subscription_created event for subscription {subscription_db_id}")
        except Exception as db_err:
            logger.error(f"❌ Database error in subscription_created handler: {str(db_err)}", exc_info=True)

    except Exception as e:
        logger.error(f"Error handling subscription created: {str(e)}", exc_info=True)

async def handle_subscription_updated(event_data):
    """Handle customer.subscription.updated event"""
    try:
        logger.info(f"🔄 Processing subscription.updated: {event_data.id}")

        # Find the subscription in our database
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            # Check if table exists first
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'subscriptions'
                )
            """)
            if not cur.fetchone()[0]:
                logger.error("❌ Subscriptions table does not exist for subscription update!")
                return

            cur.execute("""
                SELECT id FROM subscriptions
                WHERE stripe_subscription_id = %s
            """, (event_data.id,))

            result = cur.fetchone()

            if not result:
                logger.error(f"❌ Subscription {event_data.id} not found in database for update")
                return

            subscription_id = result[0]
            logger.info(f"✅ Found subscription in database: {subscription_id}")

            # Default values in case we can't extract from event data
            update_fields = []
            params = []

            # Extract updated subscription data - safely check if attributes exist
            if hasattr(event_data, 'status'):
                update_fields.append("status = %s, stripe_status = %s")
                params.extend([event_data.status, event_data.status])
                logger.info(f"📊 Status: {event_data.status}")

            # Safely check for period details
            try:
                if hasattr(event_data, 'current_period_start'):
                    update_fields.append("current_period_start = %s")
                    current_period_start = datetime.fromtimestamp(event_data.current_period_start)
                    params.append(current_period_start)
                    logger.info(f"📊 Period start: {current_period_start}")
            except (AttributeError, TypeError) as e:
                logger.warning(f"⚠️ Could not extract current_period_start: {e}")

            try:
                if hasattr(event_data, 'current_period_end'):
                    update_fields.append("current_period_end = %s")
                    current_period_end = datetime.fromtimestamp(event_data.current_period_end)
                    params.append(current_period_end)
                    logger.info(f"📊 Period end: {current_period_end}")
            except (AttributeError, TypeError) as e:
                logger.warning(f"⚠️ Could not extract current_period_end: {e}")

            try:
                if hasattr(event_data, 'cancel_at_period_end'):
                    update_fields.append("cancel_at_period_end = %s")
                    params.append(event_data.cancel_at_period_end)
                    logger.info(f"📊 Cancel at period end: {event_data.cancel_at_period_end}")
            except (AttributeError, TypeError) as e:
                logger.warning(f"⚠️ Could not extract cancel_at_period_end: {e}")

            # Check for cancellation
            try:
                if hasattr(event_data, 'canceled_at') and event_data.canceled_at:
                    update_fields.append("canceled_at = %s")
                    canceled_at = datetime.fromtimestamp(event_data.canceled_at)
                    params.append(canceled_at)
                    logger.info(f"📊 Canceled at: {canceled_at}")
            except (AttributeError, TypeError) as e:
                logger.warning(f"⚠️ Could not extract canceled_at: {e}")

            # Update subscription in our database directly
            if update_fields:
                # Add the updated_at timestamp
                update_fields.append("updated_at = CURRENT_TIMESTAMP")

                # Add the subscription_id parameter at the end
                params.append(subscription_id)

                # Build the SQL query
                query = f"""
                    UPDATE subscriptions
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id
                """

                # Execute the update
                cur.execute(query, params)

                # Check if the update was successful
                updated_id = cur.fetchone()
                if updated_id:
                    logger.info(f"✅ Updated subscription {subscription_id} successfully")
                else:
                    logger.error(f"❌ Failed to update subscription {subscription_id}")
            else:
                logger.info(f"ℹ️ No fields to update for subscription {subscription_id}")

            # Log the event in our database
            cur.execute("""
                INSERT INTO subscription_events (
                    subscription_id, event_type, event_data, payment_provider, provider_event_id, processed, processed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                subscription_id,
                "subscription_updated",
                str(event_data),
                "stripe",
                event_data.id,
                True,
                datetime.now()  # Mark as processed immediately
            ))

            event_id = cur.fetchone()[0]
            logger.info(f"📝 Logged subscription_updated event with ID: {event_id}")

    except Exception as e:
        logger.error(f"Error handling subscription updated: {str(e)}", exc_info=True)

async def handle_subscription_deleted(event_data):
    """Handle customer.subscription.deleted event"""
    try:
        logger.info(f"Processing subscription.deleted: {event_data.id}")

        # Find the subscription in our database
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT id FROM subscriptions
                WHERE stripe_subscription_id = %s
            """, (event_data.id,))

            result = cur.fetchone()

            if not result:
                logger.error(f"Subscription {event_data.id} not found in database")
                return

            subscription_id = result[0]

            # Update subscription in our database
            from app.models.subscription import update_subscription
            update_subscription(
                subscription_id=subscription_id,
                status="canceled",
                canceled_at=datetime.now(),
                stripe_status="canceled"
            )
            logger.info(f"Marked subscription {subscription_id} as canceled")

            # Log the event
            from app.models.subscription import log_subscription_event
            log_subscription_event(
                subscription_id=subscription_id,
                event_type="subscription_deleted",
                event_data=event_data,
                payment_provider="stripe",
                provider_event_id=event_data.id,
                processed=True,
                processed_at=datetime.now()
            )

    except Exception as e:
        logger.error(f"Error handling subscription deleted: {str(e)}", exc_info=True)

async def handle_invoice_paid(event_data):
    """Handle invoice.paid event"""
    try:
        logger.info(f"Processing invoice.paid: {event_data.id}")

        # Get the subscription ID from the invoice
        subscription_id = event_data.get("subscription")
        if not subscription_id:
            logger.error("No subscription ID in invoice")
            return

        # Find the subscription in our database
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT id FROM subscriptions
                WHERE stripe_subscription_id = %s
            """, (subscription_id,))

            result = cur.fetchone()

            if not result:
                logger.error(f"Subscription {subscription_id} not found in database")
                return

            db_subscription_id = result[0]

            # Create an invoice record
            from app.models.subscription import create_invoice

            # Extract invoice data
            amount_due = event_data.amount_due / 100.0  # Convert from cents to dollars
            amount_paid = event_data.amount_paid / 100.0  # Convert from cents to dollars
            currency = event_data.currency
            status = event_data.status

            # Get period dates
            period_start = datetime.fromtimestamp(event_data.period_start)
            period_end = datetime.fromtimestamp(event_data.period_end)

            # Create invoice
            invoice_id = create_invoice(
                subscription_id=db_subscription_id,
                payment_provider="stripe",
                status=status,
                amount_due=amount_due,
                amount_paid=amount_paid,
                currency=currency,
                period_start=period_start,
                period_end=period_end,
                paid_at=datetime.now(),
                stripe_invoice_id=event_data.id
            )
            logger.info(f"Created invoice record: {invoice_id}")

            # Log the event
            from app.models.subscription import log_subscription_event
            log_subscription_event(
                subscription_id=db_subscription_id,
                event_type="invoice_paid",
                event_data=event_data,
                payment_provider="stripe",
                provider_event_id=event_data.id,
                processed=True,
                processed_at=datetime.now()
            )

    except Exception as e:
        logger.error(f"Error handling invoice paid: {str(e)}", exc_info=True)

async def handle_invoice_payment_failed(event_data):
    """Handle invoice.payment_failed event"""
    try:
        logger.info(f"Processing invoice.payment_failed: {event_data.id}")

        # Get the subscription ID from the invoice
        subscription_id = event_data.get("subscription")
        if not subscription_id:
            logger.error("No subscription ID in invoice")
            return

        # Find the subscription in our database
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT id FROM subscriptions
                WHERE stripe_subscription_id = %s
            """, (subscription_id,))

            result = cur.fetchone()

            if not result:
                logger.error(f"Subscription {subscription_id} not found in database")
                return

            db_subscription_id = result[0]

            # Create an invoice record
            from app.models.subscription import create_invoice

            # Extract invoice data
            amount_due = event_data.amount_due / 100.0  # Convert from cents to dollars
            amount_paid = event_data.amount_paid / 100.0  # Convert from cents to dollars
            currency = event_data.currency
            status = "unpaid"

            # Get period dates
            period_start = datetime.fromtimestamp(event_data.period_start)
            period_end = datetime.fromtimestamp(event_data.period_end)

            # Create invoice
            invoice_id = create_invoice(
                subscription_id=db_subscription_id,
                payment_provider="stripe",
                status=status,
                amount_due=amount_due,
                amount_paid=amount_paid,
                currency=currency,
                period_start=period_start,
                period_end=period_end,
                stripe_invoice_id=event_data.id
            )
            logger.info(f"Created failed invoice record: {invoice_id}")

            # Update subscription status
            from app.models.subscription import update_subscription
            update_subscription(
                subscription_id=db_subscription_id,
                status="past_due",
                stripe_status="past_due"
            )
            logger.info(f"Updated subscription {db_subscription_id} status to past_due")

            # Log the event
            from app.models.subscription import log_subscription_event
            log_subscription_event(
                subscription_id=db_subscription_id,
                event_type="invoice_payment_failed",
                event_data=event_data,
                payment_provider="stripe",
                provider_event_id=event_data.id,
                processed=True,
                processed_at=datetime.now()
            )

    except Exception as e:
        logger.error(f"Error handling invoice payment failed: {str(e)}", exc_info=True)

@router.post("/webhooks/paypal")
async def paypal_webhook_handler(request: Request):
    """
    Handle PayPal webhook events for subscription lifecycle
    """
    logger.info("🔔 Received PayPal webhook - processing...")
    
    if not ENABLE_SUBSCRIPTION_FEATURES or not paypalrestsdk:
        logger.error("❌ PayPal integration is not available")
        return JSONResponse(
            status_code=503,
            content={"detail": "PayPal integration is not available"}
        )
    
    try:
        # Get the webhook data
        payload = await request.body()
        headers = dict(request.headers)
        
        logger.info(f"📦 PayPal webhook payload received")
        logger.info(f"📋 Headers: {headers}")
        
        # Parse the JSON payload
        import json
        webhook_data = json.loads(payload.decode('utf-8'))
        
        event_type = webhook_data.get('event_type')
        resource = webhook_data.get('resource', {})
        
        logger.info(f"🎯 Received PayPal webhook event: {event_type}")
        
        # Handle different PayPal event types
        if event_type == "BILLING.SUBSCRIPTION.ACTIVATED":
            await handle_paypal_subscription_activated(resource)
        elif event_type == "BILLING.SUBSCRIPTION.CANCELLED":
            await handle_paypal_subscription_cancelled(resource)
        elif event_type == "BILLING.SUBSCRIPTION.SUSPENDED":
            await handle_paypal_subscription_suspended(resource)
        elif event_type == "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED":
            await handle_paypal_payment_completed(resource)
        elif event_type == "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
            await handle_paypal_payment_failed(resource)
        else:
            logger.info(f"Unhandled PayPal event type: {event_type}")
        
        # Log the event to database
        try:
            with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
                cur.execute("""
                    INSERT INTO subscription_events (
                        subscription_id, event_type, event_data, payment_provider,
                        provider_event_id, processed, processed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    -1,  # We'll update this when we process the event
                    event_type,
                    json.dumps(webhook_data),
                    'paypal',
                    webhook_data.get('id', ''),
                    True,
                    datetime.now()
                ))
        except Exception as log_err:
            logger.error(f"❌ Failed to log PayPal webhook event: {str(log_err)}")
        
        logger.info("🎉 PayPal webhook processing completed successfully")
        return JSONResponse(
            status_code=200,
            content={"detail": "PayPal webhook processed successfully"}
        )
        
    except Exception as e:
        logger.error(f"❌ Error processing PayPal webhook: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error processing PayPal webhook: {str(e)}"}
        )

# PayPal webhook event handlers
async def handle_paypal_subscription_activated(resource):
    """Handle PayPal subscription activation - ONLY store the subscription ID, don't activate yet"""
    try:
        subscription_id = resource.get('id')
        plan_id = resource.get('plan_id')
        
        logger.info(f"🟡 PayPal billing agreement created (not yet paid): {subscription_id}")
        
        # Find the subscription in our database by plan_id and store the PayPal subscription ID
        # BUT DO NOT ACTIVATE - wait for first payment confirmation
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT id FROM subscriptions
                WHERE paypal_plan_id = %s AND paypal_subscription_id IS NULL
                ORDER BY created_at DESC LIMIT 1
            """, (plan_id,))
            
            result = cur.fetchone()
            if result:
                db_subscription_id = result[0]
                
                # Only store the PayPal subscription ID, keep status as 'pending'
                cur.execute("""
                    UPDATE subscriptions
                    SET paypal_subscription_id = %s,
                        paypal_status = 'CREATED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (subscription_id, db_subscription_id))
                
                logger.info(f"📝 Stored PayPal subscription ID {subscription_id} for subscription {db_subscription_id} (still pending payment)")
            else:
                logger.warning(f"⚠️ Could not find subscription for PayPal plan {plan_id}")
                
    except Exception as e:
        logger.error(f"❌ Error handling PayPal subscription activation: {str(e)}", exc_info=True)

async def handle_paypal_subscription_cancelled(resource):
    """Handle PayPal subscription cancellation"""
    try:
        subscription_id = resource.get('id')
        
        logger.info(f"🔴 PayPal subscription cancelled: {subscription_id}")
        
        # Find and cancel the subscription in our database
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                UPDATE subscriptions
                SET status = 'canceled',
                    paypal_status = 'CANCELLED',
                    canceled_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE paypal_subscription_id = %s
                RETURNING id
            """, (subscription_id,))
            
            result = cur.fetchone()
            if result:
                logger.info(f"✅ Cancelled subscription {result[0]}")
            else:
                logger.warning(f"⚠️ Could not find subscription for PayPal subscription {subscription_id}")
                
    except Exception as e:
        logger.error(f"❌ Error handling PayPal subscription cancellation: {str(e)}", exc_info=True)

async def handle_paypal_subscription_suspended(resource):
    """Handle PayPal subscription suspension"""
    try:
        subscription_id = resource.get('id')
        
        logger.info(f"⏸️ PayPal subscription suspended: {subscription_id}")
        
        # Update subscription status in our database
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                UPDATE subscriptions
                SET status = 'past_due',
                    paypal_status = 'SUSPENDED',
                    updated_at = CURRENT_TIMESTAMP
                WHERE paypal_subscription_id = %s
                RETURNING id
            """, (subscription_id,))
            
            result = cur.fetchone()
            if result:
                logger.info(f"✅ Suspended subscription {result[0]}")
            else:
                logger.warning(f"⚠️ Could not find subscription for PayPal subscription {subscription_id}")
                
    except Exception as e:
        logger.error(f"❌ Error handling PayPal subscription suspension: {str(e)}", exc_info=True)

async def handle_paypal_payment_completed(resource):
    """Handle PayPal subscription payment completion"""
    try:
        subscription_id = resource.get('billing_agreement_id') or resource.get('subscription_id')
        amount = resource.get('amount', {})
        
        logger.info(f"💰 PayPal payment completed for subscription: {subscription_id}")
        
        # Record payment in our database
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            # Find the subscription
            cur.execute("""
                SELECT id, status FROM subscriptions
                WHERE paypal_subscription_id = %s
            """, (subscription_id,))
            
            result = cur.fetchone()
            if result:
                db_subscription_id, current_status = result
                
                # If this is the first payment (subscription is still pending), activate it
                if current_status == 'pending':
                    cur.execute("""
                        UPDATE subscriptions
                        SET status = 'active',
                            paypal_status = 'ACTIVE',
                            current_period_start = CURRENT_TIMESTAMP,
                            current_period_end = CURRENT_TIMESTAMP + INTERVAL '1 month',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (db_subscription_id,))
                    
                    logger.info(f"🎉 ACTIVATED PayPal subscription {db_subscription_id} after first payment confirmation!")
                
                # Create invoice record for the payment
                from app.models.subscription import create_invoice
                create_invoice(
                    subscription_id=db_subscription_id,
                    payment_provider="paypal",
                    status="paid",
                    amount_due=float(amount.get('value', 0)),
                    amount_paid=float(amount.get('value', 0)),
                    currency=amount.get('currency', 'USD'),
                    paid_at=datetime.now(),
                    paypal_invoice_id=resource.get('id')
                )
                
                logger.info(f"✅ Recorded payment for subscription {db_subscription_id}")
            else:
                logger.warning(f"⚠️ Could not find subscription for PayPal subscription {subscription_id}")
                
    except Exception as e:
        logger.error(f"❌ Error handling PayPal payment completion: {str(e)}", exc_info=True)

async def handle_paypal_payment_failed(resource):
    """Handle PayPal subscription payment failure"""
    try:
        subscription_id = resource.get('billing_agreement_id') or resource.get('subscription_id')
        
        logger.info(f"❌ PayPal payment failed for subscription: {subscription_id}")
        
        # Update subscription status
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                UPDATE subscriptions
                SET status = 'past_due',
                    paypal_status = 'PAST_DUE',
                    updated_at = CURRENT_TIMESTAMP
                WHERE paypal_subscription_id = %s
                RETURNING id
            """, (subscription_id,))
            
            result = cur.fetchone()
            if result:
                logger.info(f"✅ Marked subscription {result[0]} as past due")
            else:
                logger.warning(f"⚠️ Could not find subscription for PayPal subscription {subscription_id}")
                
    except Exception as e:
        logger.error(f"❌ Error handling PayPal payment failure: {str(e)}", exc_info=True)

@router.post("/cancel")
async def cancel_user_subscription(
    request: Request,
    user = Depends(get_user_from_token)
):
    """
    Cancel the current user's subscription
    """
    check_subscriptions_enabled()

    user_id = user.get('user_id')

    # Parse the request body to get cancel_at_period_end
    try:
        body = await request.json()
        cancel_at_period_end = body.get('cancel_at_period_end', True)
        logger.info(f"Cancel subscription request: cancel_at_period_end={cancel_at_period_end}")
    except Exception as e:
        logger.error(f"Error parsing request body: {str(e)}")
        cancel_at_period_end = True  # Default to canceling at period end

    try:
        # Find the user's subscription
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT id, stripe_subscription_id, paypal_subscription_id, payment_provider
                FROM subscriptions
                WHERE user_id = %s AND status = 'active'
            """, (user_id,))

            result = cur.fetchone()

            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="No active subscription found"
                )

            subscription_id, stripe_subscription_id, paypal_subscription_id, payment_provider = result

            # Handle cancellation based on payment provider
            if payment_provider == 'stripe':
                if not stripe:
                    raise HTTPException(
                        status_code=503,
                        detail="Stripe integration is not available"
                    )

                if not stripe_subscription_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Missing Stripe subscription ID"
                    )

                # Cancel the subscription in Stripe
                try:
                    stripe_subscription = stripe.Subscription.modify(
                        stripe_subscription_id,
                        cancel_at_period_end=cancel_at_period_end
                    )

                    # Update our database
                    from app.models.subscription import cancel_subscription
                    cancel_subscription(subscription_id, cancel_at_period_end=cancel_at_period_end)

                    if cancel_at_period_end:
                        message = "Your subscription will be canceled at the end of the billing period"
                    else:
                        message = "Your subscription has been canceled immediately"

                    return {
                        "success": True,
                        "message": message,
                        "cancel_at_period_end": cancel_at_period_end
                    }
                
                except stripe.error.InvalidRequestError as invalid_err:
                    # Handle case where customer or subscription no longer exists in Stripe
                    if "No such customer" in str(invalid_err) or "No such subscription" in str(invalid_err):
                        logger.warning(f"Stripe resource no longer exists, updating database status: {str(invalid_err)}")
                        
                        # Update our database to reflect that the subscription is already canceled
                        from app.models.subscription import cancel_subscription
                        cancel_subscription(subscription_id, cancel_at_period_end=False)
                        
                        # Also clear the stripe references
                        cur.execute("""
                            UPDATE subscriptions 
                            SET stripe_customer_id = NULL, stripe_subscription_id = NULL, status = 'canceled'
                            WHERE id = %s
                        """, (subscription_id,))
                        
                        return {
                            "success": True,
                            "message": "Your subscription has been canceled (was already canceled in Stripe)",
                            "cancel_at_period_end": False
                        }
                    else:
                        logger.error(f"Stripe invalid request error: {str(invalid_err)}")
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid request to payment processor: {str(invalid_err)}"
                        )
                except stripe.error.StripeError as stripe_err:
                    logger.error(f"Stripe error canceling subscription: {str(stripe_err)}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Error canceling subscription: {str(stripe_err)}"
                    )

            elif payment_provider == 'paypal':
                if not paypalrestsdk:
                    raise HTTPException(
                        status_code=503,
                        detail="PayPal integration is not available"
                    )

                # Check if we have paypal_subscription_id, if not try to find it
                if not paypal_subscription_id:
                    logger.info(f"No PayPal subscription ID found for subscription {subscription_id}, checking for billing agreement...")
                    
                    # For new PayPal subscriptions, we might only have the plan info
                    # In this case, we'll cancel the subscription in our database only
                    # since the user might be canceling before PayPal webhook activation
                    logger.warning(f"PayPal subscription ID not found for subscription {subscription_id}")
                    
                    # Update our database to mark as canceled
                    from app.models.subscription import cancel_subscription
                    cancel_subscription(subscription_id, cancel_at_period_end=False)
                    
                    return {
                        "success": True,
                        "message": "Your subscription has been canceled locally (PayPal billing agreement was not yet active)",
                        "cancel_at_period_end": False
                    }

                # Cancel the subscription in PayPal
                try:
                    # PayPal uses billing agreements for subscriptions
                    billing_agreement = paypalrestsdk.BillingAgreement.find(paypal_subscription_id)
                    
                    if billing_agreement:
                        # Cancel the billing agreement
                        cancel_note = {
                            "note": "Subscription canceled by user request"
                        }
                        
                        if billing_agreement.cancel(cancel_note):
                            # Update our database
                            from app.models.subscription import cancel_subscription
                            cancel_subscription(subscription_id, cancel_at_period_end=False)  # PayPal cancels immediately
                            
                            return {
                                "success": True,
                                "message": "Your PayPal subscription has been canceled immediately",
                                "cancel_at_period_end": False
                            }
                        else:
                            logger.error(f"Failed to cancel PayPal billing agreement: {billing_agreement.error}")
                            raise HTTPException(
                                status_code=500,
                                detail="Failed to cancel PayPal subscription"
                            )
                    else:
                        logger.warning(f"PayPal billing agreement not found: {paypal_subscription_id}")
                        # Update our database anyway since it's not found in PayPal
                        from app.models.subscription import cancel_subscription
                        cancel_subscription(subscription_id, cancel_at_period_end=False)
                        
                        return {
                            "success": True,
                            "message": "Your subscription has been canceled (was already canceled in PayPal)",
                            "cancel_at_period_end": False
                        }
                        
                except Exception as paypal_err:
                    logger.error(f"PayPal error canceling subscription: {str(paypal_err)}")
                    # If there's an error with PayPal, still cancel in our database
                    from app.models.subscription import cancel_subscription
                    cancel_subscription(subscription_id, cancel_at_period_end=False)
                    
                    return {
                        "success": True,
                        "message": "Your subscription has been canceled locally (PayPal error occurred)",
                        "cancel_at_period_end": False
                    }
            
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cancellation not supported for {payment_provider} subscriptions"
                )

    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error canceling subscription: {str(e)}"
        )

@router.post("/admin/migrate-existing-free-users")
async def migrate_existing_free_users(user = Depends(get_user_from_token)):
    """
    Admin endpoint to migrate existing users without subscriptions to permanent free tier
    This gives them grandfathered access while new users get trials
    """
    check_subscriptions_enabled()
    
    try:
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            # Find users created before today who don't have subscriptions
            cur.execute("""
                SELECT id, account_type, email, created_at 
                FROM user_profiles 
                WHERE subscription_id IS NULL 
                AND verified = TRUE
                AND created_at < CURRENT_DATE  -- Only users created before today
            """)
            
            users_without_subscriptions = cur.fetchall()
            
            # Find organizations without subscriptions
            cur.execute("""
                SELECT o.id, o.name, u.email, o.created_at
                FROM organizations o
                JOIN user_profiles u ON o.owner_id = u.id
                WHERE o.subscription_id IS NULL
                AND o.created_at < CURRENT_DATE  -- Only orgs created before today
            """)
            
            orgs_without_subscriptions = cur.fetchall()
            
            migrated_count = 0
            
            # Migrate users to permanent free tier (no expiration)
            for user in users_without_subscriptions:
                user_id, account_type, email, created_at = user
                
                # Don't migrate organization account holders (they'll be handled via org migration)
                if account_type == 'organization':
                    continue
                    
                # Create permanent free tier subscription
                from app.models.subscription import migrate_to_free_tier
                result = migrate_to_free_tier(
                    user_id=user_id, 
                    set_beta_expiration=False  # No expiration = permanent free
                )
                if result:
                    migrated_count += 1
                    logger.info(f"Migrated user {email} (ID: {user_id}) to permanent free tier")
            
            # Migrate organizations to permanent free tier
            for org in orgs_without_subscriptions:
                org_id, org_name, owner_email, created_at = org
                
                from app.models.subscription import migrate_to_free_tier
                result = migrate_to_free_tier(
                    organization_id=org_id,
                    set_beta_expiration=False  # No expiration = permanent free
                )
                if result:
                    migrated_count += 1
                    logger.info(f"Migrated organization {org_name} (ID: {org_id}) to permanent free tier")
            
            return {
                "success": True,
                "message": f"Migrated {migrated_count} users/organizations to permanent free tier",
                "migrated_users": len(users_without_subscriptions),
                "migrated_organizations": len(orgs_without_subscriptions),
                "total_migrated": migrated_count
            }
                
    except Exception as e:
        logger.error(f"Error migrating existing free users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error migrating existing free users: {str(e)}"
        )

@router.post("/admin/fix-paypal-subscriptions")
async def fix_paypal_subscriptions(user = Depends(get_user_from_token)):
    """
    Admin endpoint to fix PayPal subscriptions that were incorrectly activated
    This should be called once after deploying the fix
    """
    check_subscriptions_enabled()
    
    try:
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cur, conn):
            # Find PayPal subscriptions that are active but have no payment confirmation
            cur.execute("""
                SELECT s.id, s.paypal_subscription_id 
                FROM subscriptions s
                LEFT JOIN invoices i ON s.id = i.subscription_id AND i.payment_provider = 'paypal'
                WHERE s.payment_provider = 'paypal' 
                AND s.status = 'active'
                AND i.id IS NULL  -- No invoices means no payments confirmed
            """)
            
            problematic_subscriptions = cur.fetchall()
            
            if problematic_subscriptions:
                # Mark them as pending
                subscription_ids = [row[0] for row in problematic_subscriptions]
                cur.execute("""
                    UPDATE subscriptions 
                    SET status = 'pending', paypal_status = 'CREATED'
                    WHERE id = ANY(%s)
                """, (subscription_ids,))
                
                logger.info(f"Fixed {len(problematic_subscriptions)} PayPal subscriptions that were incorrectly activated")
                
                return {
                    "success": True,
                    "message": f"Fixed {len(problematic_subscriptions)} PayPal subscriptions",
                    "fixed_subscriptions": subscription_ids
                }
            else:
                return {
                    "success": True,
                    "message": "No PayPal subscriptions needed fixing",
                    "fixed_subscriptions": []
                }
                
    except Exception as e:
        logger.error(f"Error fixing PayPal subscriptions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error fixing PayPal subscriptions: {str(e)}"
        )

@router.get("/test-status-cases")
async def test_invoice_status_cases(user = Depends(get_user_from_token)):
    """
    Test endpoint that returns invoices with various status values to test frontend handling
    """
    if not ENABLE_SUBSCRIPTION_FEATURES:
        return await subscription_disabled()

    # Create test invoices with various status values
    test_invoices = [
        {
            "id": 1,
            "subscription_id": 1,
            "payment_provider": "stripe",
            "invoice_number": "INV-TEST-001",
            "status": "paid",
            "amount_due": 7.99,
            "amount_paid": 7.99,
            "currency": "usd",
            "period_start": datetime.now() - timedelta(days=30),
            "period_end": datetime.now(),
            "due_date": datetime.now() - timedelta(days=15),
            "paid_at": datetime.now() - timedelta(days=15),
            "stripe_invoice_id": "in_test_001",
            "created_at": datetime.now() - timedelta(days=30),
            "updated_at": datetime.now() - timedelta(days=15)
        },
        {
            "id": 2,
            "subscription_id": 1,
            "payment_provider": "stripe",
            "invoice_number": "INV-TEST-002",
            "status": None,  # Test null status
            "amount_due": 7.99,
            "amount_paid": 0,
            "currency": "usd",
            "period_start": datetime.now() - timedelta(days=60),
            "period_end": datetime.now() - timedelta(days=30),
            "due_date": datetime.now() - timedelta(days=45),
            "paid_at": None,
            "stripe_invoice_id": "in_test_002",
            "created_at": datetime.now() - timedelta(days=60),
            "updated_at": datetime.now() - timedelta(days=60)
        },
        {
            "id": 3,
            "subscription_id": 1,
            "payment_provider": "stripe",
            "invoice_number": "INV-TEST-003",
            "status": "unpaid",
            "amount_due": 7.99,
            "amount_paid": 0,
            "currency": None,  # Test null currency
            "period_start": datetime.now() - timedelta(days=90),
            "period_end": datetime.now() - timedelta(days=60),
            "due_date": datetime.now() - timedelta(days=75),
            "paid_at": None,
            "stripe_invoice_id": "in_test_003",
            "created_at": datetime.now() - timedelta(days=90),
            "updated_at": datetime.now() - timedelta(days=90)
        }
    ]

    # Convert datetime objects to ISO format strings for JSON serialization
    for invoice in test_invoices:
        for key, value in invoice.items():
            if isinstance(value, datetime):
                invoice[key] = value.isoformat()

    return {
        "success": True,
        "invoices": test_invoices
    }

@router.get("/invoices")
@router.post("/invoices")  # Support both GET and POST for backward compatibility
async def get_user_invoices(user = Depends(get_user_from_token)):
    """
    Get the current user's invoices from Stripe

    This endpoint supports both GET and POST methods for backward compatibility
    """
    if not ENABLE_SUBSCRIPTION_FEATURES:
        return await subscription_disabled()

    if not stripe:
        raise HTTPException(
            status_code=503,
            detail="Stripe integration is not available"
        )

    user_id = user.get('user_id')
    organization_id = user.get('organization_id')
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Default response if no invoices found or error
    default_response = []

    try:
        # Get the user's stripe customer ID
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Check if user is part of an organization as a client
            if user.get('account_type') == 'client':
                cur.execute("""
                    SELECT organization_id FROM organization_clients
                    WHERE client_id = %s
                """, (user_id,))
                org_result = cur.fetchone()
                if org_result:
                    organization_id = org_result['organization_id']

            # Get stripe customer ID based on subscription
            if organization_id:
                # For organization members or clients
                cur.execute("""
                    SELECT stripe_customer_id, stripe_subscription_id FROM subscriptions
                    WHERE organization_id = %s AND status = 'active'
                    ORDER BY created_at DESC LIMIT 1
                """, (organization_id,))
            else:
                # For individual users
                cur.execute("""
                    SELECT stripe_customer_id, stripe_subscription_id FROM subscriptions
                    WHERE user_id = %s AND status = 'active'
                    ORDER BY created_at DESC LIMIT 1
                """, (user_id,))

            result = cur.fetchone()
            if not result:
                return default_response

            stripe_customer_id = result['stripe_customer_id']
            stripe_subscription_id = result['stripe_subscription_id']

        if not stripe_customer_id:
            return default_response

        # Fetch invoices from Stripe
        try:
            # Get all invoices for this customer
            invoices_response = stripe.Invoice.list(
                customer=stripe_customer_id,
                limit=50  # Limit to most recent 50 invoices
            )
            
            # Convert Stripe invoice objects to our expected format
            formatted_invoices = []
            for stripe_invoice in invoices_response.data:
                # Extract the invoice data we need
                invoice_data = {
                    'id': stripe_invoice.id,
                    'amount_due': stripe_invoice.amount_due,
                    'amount_paid': stripe_invoice.amount_paid,
                    'currency': stripe_invoice.currency,
                    'status': stripe_invoice.status,
                    'created': stripe_invoice.created,
                    'period_start': stripe_invoice.period_start if hasattr(stripe_invoice, 'period_start') else None,
                    'period_end': stripe_invoice.period_end if hasattr(stripe_invoice, 'period_end') else None,
                    'hosted_invoice_url': stripe_invoice.hosted_invoice_url,
                    'invoice_pdf': stripe_invoice.invoice_pdf,
                    'number': stripe_invoice.number,
                    'subscription': stripe_invoice.subscription
                }
                
                # Only include invoices that belong to the current subscription if we have one
                if not stripe_subscription_id or stripe_invoice.subscription == stripe_subscription_id:
                    formatted_invoices.append(invoice_data)

            logger.info(f"Successfully fetched {len(formatted_invoices)} invoices from Stripe")
            return formatted_invoices

        except stripe.error.InvalidRequestError as invalid_err:
            # Handle case where customer no longer exists in Stripe
            if "No such customer" in str(invalid_err):
                logger.warning(f"Customer {stripe_customer_id} no longer exists in Stripe, clearing database reference")
                # Clear the stripe_customer_id in our database
                with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
                    if organization_id:
                        cur.execute("""
                            UPDATE subscriptions 
                            SET stripe_customer_id = NULL, status = 'inactive'
                            WHERE organization_id = %s
                        """, (organization_id,))
                    else:
                        cur.execute("""
                            UPDATE subscriptions 
                            SET stripe_customer_id = NULL, status = 'inactive'
                            WHERE user_id = %s
                        """, (user_id,))
                return default_response
            else:
                logger.error(f"Stripe invalid request error: {str(invalid_err)}")
                return default_response
        except stripe.error.StripeError as stripe_err:
            logger.error(f"Stripe error fetching invoices: {str(stripe_err)}")
            return default_response

    except Exception as e:
        logger.error(f"Error fetching invoices: {str(e)}", exc_info=True)
        return default_response

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

# User Management endpoints added to subscriptions router since it works
@router.get("/user-management/admin/permissions")
async def admin_permissions(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """Get admin user management permissions"""
    if current_user.get('account_type') != 'admin':
        return {
            "can_pause_users": False,
            "can_delete_users": False,
            "can_restore_users": False,
            "can_view_all_users": False,
            "can_manage_org_users": False,
            "is_system_admin": False
        }
    
    return {
        "can_pause_users": True,
        "can_delete_users": True,
        "can_restore_users": True,
        "can_view_all_users": True,
        "can_manage_org_users": True,
        "is_system_admin": True
    }

@router.get("/user-management/org/permissions")
async def org_permissions(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """Get organization user management permissions"""
    account_type = current_user.get('account_type')
    
    # Organization accounts can manage their users
    if account_type == 'organization':
        return {
            "can_pause_users": True,
            "can_delete_users": True,
            "can_restore_users": True,
            "can_view_all_users": False,
            "can_manage_org_users": True,
            "is_system_admin": False
        }
    
    # No permissions for other account types
    return {
        "can_pause_users": False,
        "can_delete_users": False,
        "can_restore_users": False,
        "can_view_all_users": False,
        "can_manage_org_users": False,
        "is_system_admin": False
    }

@router.get("/user-management/admin/users")
async def list_all_users(
    limit: int = 25,
    offset: int = 0,
    search_query: str = None,
    role: str = None,
    is_active: bool = None,
    is_paused: bool = None,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """List all users (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Build query conditions
            conditions = []
            params = []
            
            if search_query:
                conditions.append("(up.name ILIKE %s OR up.email ILIKE %s)")
                params.extend([f"%{search_query}%", f"%{search_query}%"])
            
            if role:
                conditions.append("up.account_type = %s")
                params.append(role)
            
            if is_active is not None:
                conditions.append("up.is_active = %s")
                params.append(is_active)
            
            if is_paused is not None:
                if is_paused:
                    conditions.append("up.paused_at IS NOT NULL")
                else:
                    conditions.append("up.paused_at IS NULL")
            
            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            
            # Get total count
            count_query = f"""
                SELECT COUNT(*) 
                FROM user_profiles up
                LEFT JOIN organizations o ON up.organization_id = o.id
                {where_clause}
            """
            cur.execute(count_query, params)
            total_count = cur.fetchone()['count']
            
            # Get users with pagination
            query = f"""
                SELECT 
                    up.id,
                    up.name,
                    up.email,
                    up.account_type as role,
                    up.is_active,
                    up.paused_at,
                    up.pause_reason,
                    up.created_at,
                    o.name as organization_name
                FROM user_profiles up
                LEFT JOIN organizations o ON up.organization_id = o.id
                {where_clause}
                ORDER BY up.created_at DESC
                LIMIT %s OFFSET %s
            """
            params.extend([limit, offset])
            cur.execute(query, params)
            users = cur.fetchall()
            
            return {
                "users": [dict(user) for user in users],
                "total_count": total_count
            }
    
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching users")

@router.get("/user-management/org/users")
async def list_org_users(
    limit: int = 25,
    offset: int = 0,
    search_query: str = None,
    role: str = None,
    is_active: bool = None,
    is_paused: bool = None,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """List organization users (organization owners only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Build query conditions
            conditions = ["oc.organization_id = %s"]
            params = [org_id]
            
            if search_query:
                conditions.append("(up.name ILIKE %s OR up.email ILIKE %s)")
                params.extend([f"%{search_query}%", f"%{search_query}%"])
            
            if role:
                conditions.append("oc.role = %s")
                params.append(role)
            
            if is_active is not None:
                conditions.append("up.is_active = %s")
                params.append(is_active)
            
            if is_paused is not None:
                if is_paused:
                    conditions.append("up.paused_at IS NOT NULL")
                else:
                    conditions.append("up.paused_at IS NULL")
            
            where_clause = "WHERE " + " AND ".join(conditions)
            
            # Get total count
            count_query = f"""
                SELECT COUNT(*) 
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                {where_clause}
            """
            cur.execute(count_query, params)
            total_count = cur.fetchone()['count']
            
            # Get users with pagination
            query = f"""
                SELECT 
                    up.id,
                    up.name,
                    up.email,
                    oc.role,
                    up.is_active,
                    up.paused_at,
                    up.pause_reason,
                    up.created_at,
                    o.name as organization_name
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                JOIN organizations o ON oc.organization_id = o.id
                {where_clause}
                ORDER BY up.created_at DESC
                LIMIT %s OFFSET %s
            """
            params.extend([limit, offset])
            cur.execute(query, params)
            users = cur.fetchall()
            
            return {
                "users": [dict(user) for user in users],
                "total_count": total_count
            }
    
    except Exception as e:
        logger.error(f"Error listing organization users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching organization users")

@router.post("/user-management/admin/users/{user_id}/pause")
async def pause_user_admin(
    user_id: int,
    request_body: dict = Body(...),
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Pause a user (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    reason = request_body.get('reason')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NOW(), 
                    paused_by = %s, 
                    pause_reason = %s
                WHERE id = %s AND is_active = TRUE
                RETURNING id, name, email
            """, (current_user['user_id'], reason, user_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found or already inactive")
            
            # Log action if table exists
            try:
                cur.execute("""
                    INSERT INTO user_management_logs 
                    (user_id, action, performed_by, reason, performed_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (user_id, 'paused', current_user['user_id'], reason))
            except Exception as log_error:
                logger.warning(f"Could not log action: {log_error}")
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been paused"}
    
    except Exception as e:
        logger.error(f"Error pausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error pausing user")

@router.post("/user-management/org/users/{user_id}/pause")
async def pause_user_org(
    user_id: int,
    request_body: dict = Body(...),
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Pause a user (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    reason = request_body.get('reason')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT up.id, up.name, up.email
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE up.id = %s AND oc.organization_id = %s AND up.is_active = TRUE
            """, (user_id, org_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NOW(), 
                    paused_by = %s, 
                    pause_reason = %s
                WHERE id = %s
            """, (current_user['user_id'], reason, user_id))
            
            # Log action if table exists
            try:
                cur.execute("""
                    INSERT INTO user_management_logs 
                    (user_id, action, performed_by, reason, performed_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (user_id, 'paused', current_user['user_id'], reason))
            except Exception as log_error:
                logger.warning(f"Could not log action: {log_error}")
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been paused"}
    
    except Exception as e:
        logger.error(f"Error pausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error pausing user")

@router.post("/user-management/admin/users/{user_id}/unpause")
async def unpause_user_admin(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Unpause a user (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NULL, 
                    paused_by = NULL, 
                    pause_reason = NULL
                WHERE id = %s AND is_active = TRUE
                RETURNING id, name, email
            """, (user_id,))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found or inactive")
            
            # Log action if table exists
            try:
                cur.execute("""
                    INSERT INTO user_management_logs 
                    (user_id, action, performed_by, performed_at)
                    VALUES (%s, %s, %s, NOW())
                """, (user_id, 'unpaused', current_user['user_id']))
            except Exception as log_error:
                logger.warning(f"Could not log action: {log_error}")
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been unpaused"}
    
    except Exception as e:
        logger.error(f"Error unpausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error unpausing user")

@router.post("/user-management/org/users/{user_id}/unpause")
async def unpause_user_org(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Unpause a user (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT up.id, up.name, up.email
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE up.id = %s AND oc.organization_id = %s AND up.is_active = TRUE
            """, (user_id, org_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NULL, 
                    paused_by = NULL, 
                    pause_reason = NULL
                WHERE id = %s
            """, (user_id,))
            
            # Log action if table exists
            try:
                cur.execute("""
                    INSERT INTO user_management_logs 
                    (user_id, action, performed_by, performed_at)
                    VALUES (%s, %s, %s, NOW())
                """, (user_id, 'unpaused', current_user['user_id']))
            except Exception as log_error:
                logger.warning(f"Could not log action: {log_error}")
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been unpaused"}
    
    except Exception as e:
        logger.error(f"Error unpausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error unpausing user")

@router.delete("/user-management/admin/users/{user_id}")
async def delete_user_admin(
    user_id: int,
    request_body: dict = Body(...),
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Soft delete a user (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    reason = request_body.get('reason')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET is_active = FALSE, 
                    deleted_at = NOW(), 
                    deleted_by = %s
                WHERE id = %s AND is_active = TRUE
                RETURNING id, name, email
            """, (current_user['user_id'], user_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found or already deleted")
            
            # Log action if table exists
            try:
                cur.execute("""
                    INSERT INTO user_management_logs 
                    (user_id, action, performed_by, reason, performed_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (user_id, 'deleted', current_user['user_id'], reason))
            except Exception as log_error:
                logger.warning(f"Could not log action: {log_error}")
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been deleted"}
    
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting user")

@router.delete("/user-management/org/users/{user_id}")
async def delete_user_org(
    user_id: int,
    request_body: dict = Body(...),
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Soft delete a user (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    reason = request_body.get('reason')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT up.id, up.name, up.email
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE up.id = %s AND oc.organization_id = %s AND up.is_active = TRUE
            """, (user_id, org_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET is_active = FALSE, 
                    deleted_at = NOW(), 
                    deleted_by = %s
                WHERE id = %s
            """, (current_user['user_id'], user_id))
            
            # Log action if table exists
            try:
                cur.execute("""
                    INSERT INTO user_management_logs 
                    (user_id, action, performed_by, reason, performed_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (user_id, 'deleted', current_user['user_id'], reason))
            except Exception as log_error:
                logger.warning(f"Could not log action: {log_error}")
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been deleted"}
    
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting user")

@router.get("/user-management/admin/users/{user_id}/logs")
async def get_user_logs_admin(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Get user management logs (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            cur.execute("""
                SELECT 
                    uml.id,
                    uml.action,
                    uml.reason,
                    uml.performed_at,
                    up.name as performed_by
                FROM user_management_logs uml
                JOIN user_profiles up ON uml.performed_by = up.id
                WHERE uml.user_id = %s
                ORDER BY uml.performed_at DESC
            """, (user_id,))
            
            logs = cur.fetchall()
            return [dict(log) for log in logs]
    
    except Exception as e:
        logger.error(f"Error fetching user logs: {str(e)}")
        # Return empty logs if table doesn't exist
        return []

@router.get("/user-management/org/users/{user_id}/logs")
async def get_user_logs_org(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Get user management logs (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT 1
                FROM organization_clients oc
                WHERE oc.client_id = %s AND oc.organization_id = %s
            """, (user_id, org_id))
            
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            cur.execute("""
                SELECT 
                    uml.id,
                    uml.action,
                    uml.reason,
                    uml.performed_at,
                    up.name as performed_by
                FROM user_management_logs uml
                JOIN user_profiles up ON uml.performed_by = up.id
                WHERE uml.user_id = %s
                ORDER BY uml.performed_at DESC
            """, (user_id,))
            
            logs = cur.fetchall()
            return [dict(log) for log in logs]
    
    except Exception as e:
        logger.error(f"Error fetching user logs: {str(e)}")
        # Return empty logs if table doesn't exist
        return []