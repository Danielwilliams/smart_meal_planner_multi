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

# Configure Stripe if enabled
if ENABLE_SUBSCRIPTION_FEATURES:
    try:
        import stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
        STRIPE_INDIVIDUAL_PRICE_ID = os.getenv("STRIPE_INDIVIDUAL_PRICE_ID", "")
        STRIPE_ORGANIZATION_PRICE_ID = os.getenv("STRIPE_ORGANIZATION_PRICE_ID", "")
        STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

        # Log configuration
        logger.info(f"Stripe configured: API Key present: {bool(stripe.api_key)}")
        logger.info(f"Stripe Individual Price ID: {STRIPE_INDIVIDUAL_PRICE_ID}")
        logger.info(f"Stripe Organization Price ID: {STRIPE_ORGANIZATION_PRICE_ID}")

        # Helper functions for Stripe
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
                conn = get_db_connection()
                try:
                    with conn.cursor() as cur:
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
                            # Customer exists, return the ID
                            logger.info(f"Found existing Stripe customer: {result[0]}")
                            return result[0]

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
                finally:
                    conn.close()

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
                conn = get_db_connection()
                try:
                    with conn.cursor() as cur:
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
                finally:
                    conn.close()

                return customer.id

            except Exception as e:
                logger.error(f"Error creating Stripe customer: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create customer: {str(e)}"
                )
    except ImportError:
        logger.warning("Stripe module not installed. Stripe integration will be disabled.")
        stripe = None
else:
    stripe = None

@router.post("/create-checkout")
async def create_checkout_session(
    subscription_type: SubscriptionType,
    payment_provider: Optional[PaymentProvider] = Body(PaymentProvider.stripe),
    success_url: Optional[str] = Body(None),
    cancel_url: Optional[str] = Body(None),
    user = Depends(get_user_from_token)
):
    """
    Create a checkout session for a new subscription

    Returns a URL that the user can be redirected to for payment
    """
    check_subscriptions_enabled()

    if payment_provider == PaymentProvider.stripe:
        # Check if Stripe is configured
        if not stripe or not stripe.api_key:
            raise HTTPException(
                status_code=503,
                detail="Stripe integration is not available"
            )

        # Validate that we have the price IDs
        if subscription_type == SubscriptionType.individual and not STRIPE_INDIVIDUAL_PRICE_ID:
            raise HTTPException(
                status_code=503,
                detail="Individual subscription price not configured"
            )

        if subscription_type == SubscriptionType.organization and not STRIPE_ORGANIZATION_PRICE_ID:
            raise HTTPException(
                status_code=503,
                detail="Organization subscription price not configured"
            )

        # Determine which user or organization is subscribing
        user_id = user.get('user_id')
        organization_id = None

        # If this is an organization admin, they might be subscribing for the organization
        if subscription_type == SubscriptionType.organization:
            # Check if the user is an organization admin
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id FROM organizations
                        WHERE owner_id = %s
                    """, (user_id,))

                    org_result = cur.fetchone()
                    if org_result:
                        organization_id = org_result[0]
                    else:
                        raise HTTPException(
                            status_code=403,
                            detail="You must be an organization owner to purchase an organization subscription"
                        )
            finally:
                if conn:
                    conn.close()

        # Get or create Stripe customer
        customer_id = await get_or_create_stripe_customer(user_id, organization_id)

        # Determine the price ID based on subscription type
        price_id = STRIPE_INDIVIDUAL_PRICE_ID if subscription_type == SubscriptionType.individual else STRIPE_ORGANIZATION_PRICE_ID

        # Set default URLs if not provided
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        success_url = success_url or f"{frontend_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = cancel_url or f"{frontend_url}/subscription/cancel"

        # Create metadata to track the subscription
        metadata = {
            "user_id": str(user_id),
            "subscription_type": subscription_type,
            "created_at": datetime.now().isoformat()
        }

        if organization_id:
            metadata["organization_id"] = str(organization_id)

        try:
            # Create checkout session
            checkout_session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{
                    "price": price_id,
                    "quantity": 1
                }],
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata
            )

            # Log the checkout session creation
            logger.info(f"Created Stripe checkout session: {checkout_session.id}")

            return {
                "success": True,
                "checkout_url": checkout_session.url,
                "session_id": checkout_session.id
            }
        except Exception as e:
            logger.error(f"Error creating Stripe checkout session: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create checkout session: {str(e)}"
            )
    else:
        # PayPal implementation will go here
        raise HTTPException(
            status_code=501,
            detail=f"Payment provider {payment_provider} not implemented yet"
        )

@router.post("/webhooks/stripe")
async def stripe_webhook_handler(request: Request):
    """
    Handle Stripe webhook events for subscription lifecycle
    """
    if not ENABLE_SUBSCRIPTION_FEATURES or not stripe:
        return JSONResponse(
            status_code=503,
            content={"detail": "Stripe integration is not available"}
        )

    # Get the webhook signature from the request headers
    signature = request.headers.get("stripe-signature")
    if not signature:
        return JSONResponse(
            status_code=400,
            content={"detail": "Missing Stripe signature"}
        )

    # Get the webhook secret
    webhook_secret = STRIPE_WEBHOOK_SECRET
    if not webhook_secret:
        logger.error("Stripe webhook secret not configured")
        return JSONResponse(
            status_code=500,
            content={"detail": "Webhook not configured"}
        )

    # Get the request body
    try:
        payload = await request.body()

        # Verify the event using the signature and secret
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, webhook_secret
            )
        except ValueError as e:
            # Invalid payload
            logger.error(f"Invalid webhook payload: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid payload"}
            )
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            logger.error(f"Invalid webhook signature: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid signature"}
            )

        # Extract event data
        event_id = event.id
        event_type = event.type
        event_data = event.data.object

        logger.info(f"Received Stripe webhook event: {event_type} ({event_id})")

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

        # Return a success response
        return JSONResponse(
            status_code=200,
            content={"detail": "Webhook processed successfully"}
        )
    except Exception as e:
        logger.error(f"Error processing Stripe webhook: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error processing webhook: {str(e)}"}
        )

# Helper functions for handling Stripe webhook events
async def handle_checkout_completed(event_data):
    """Handle checkout.session.completed event"""
    try:
        logger.info(f"Processing checkout.session.completed: {event_data.id}")

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

        if stripe_subscription.items.data:
            price = stripe_subscription.items.data[0].price
            price_id = price.id
            monthly_amount = price.unit_amount / 100.0  # Convert from cents to dollars

        # Get the customer ID
        customer_id = stripe_subscription.customer

        # Create or update subscription in our database
        from app.models.subscription import create_subscription, update_subscription, log_subscription_event

        # Check if a subscription already exists
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
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
                        provider_event_id=event_data.id
                    )
        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error handling checkout completed: {str(e)}", exc_info=True)

async def handle_subscription_created(event_data):
    """Handle customer.subscription.created event"""
    try:
        logger.info(f"Processing subscription.created: {event_data.id}")

        # This event is usually handled by checkout.session.completed,
        # but we can use it as a backup in case the checkout event is missed

        # Get customer ID and find the associated user/organization
        customer_id = event_data.get("customer")
        if not customer_id:
            logger.error("No customer ID in subscription event")
            return

        # Try to find the subscription in our database by stripe_subscription_id
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, user_id, organization_id FROM subscriptions
                    WHERE stripe_subscription_id = %s
                """, (event_data.id,))

                result = cur.fetchone()

                if result:
                    # Subscription already exists, just log the event
                    subscription_id, user_id, organization_id = result
                    logger.info(f"Subscription {event_data.id} already exists: {subscription_id}")
                else:
                    # Try to find the user or organization by customer ID
                    cur.execute("""
                        SELECT id, user_id, organization_id FROM subscriptions
                        WHERE stripe_customer_id = %s
                    """, (customer_id,))

                    result = cur.fetchone()

                    if result:
                        # Found a subscription with this customer ID
                        subscription_id, user_id, organization_id = result

                        # Update the subscription with the new subscription ID
                        from app.models.subscription import update_subscription
                        update_subscription(
                            subscription_id=subscription_id,
                            stripe_subscription_id=event_data.id
                        )
                        logger.info(f"Updated subscription {subscription_id} with new subscription ID: {event_data.id}")
                    else:
                        # We couldn't find a subscription, try to find the customer in Stripe
                        try:
                            stripe_customer = stripe.Customer.retrieve(customer_id)
                            customer_metadata = stripe_customer.get("metadata", {})

                            user_id = int(customer_metadata.get("user_id")) if customer_metadata.get("user_id") else None
                            organization_id = int(customer_metadata.get("organization_id")) if customer_metadata.get("organization_id") else None

                            if user_id or organization_id:
                                # We found the user/organization, create a new subscription
                                logger.info(f"Creating new subscription from metadata: user_id={user_id}, org_id={organization_id}")

                                # Extract subscription data
                                stripe_status = event_data.status
                                current_period_start = datetime.fromtimestamp(event_data.current_period_start)
                                current_period_end = datetime.fromtimestamp(event_data.current_period_end)
                                cancel_at_period_end = event_data.cancel_at_period_end

                                # Get the price ID and amount
                                price_id = None
                                monthly_amount = 0.0

                                if event_data.items.data:
                                    price = event_data.items.data[0].price
                                    price_id = price.id
                                    monthly_amount = price.unit_amount / 100.0  # Convert from cents to dollars

                                # Create subscription
                                from app.models.subscription import create_subscription
                                subscription_id = create_subscription(
                                    user_id=user_id,
                                    organization_id=organization_id,
                                    subscription_type=("individual" if user_id else "organization"),
                                    payment_provider="stripe",
                                    monthly_amount=monthly_amount,
                                    stripe_customer_id=customer_id,
                                    stripe_subscription_id=event_data.id,
                                    stripe_price_id=price_id
                                )
                                logger.info(f"Created new subscription from event: {subscription_id}")
                            else:
                                logger.error(f"Could not find user/organization for customer: {customer_id}")
                        except Exception as customer_err:
                            logger.error(f"Error retrieving customer {customer_id}: {str(customer_err)}")
        finally:
            conn.close()

        # Log the event in our database
        if subscription_id:
            from app.models.subscription import log_subscription_event
            log_subscription_event(
                subscription_id=subscription_id,
                event_type="subscription_created",
                event_data=event_data,
                payment_provider="stripe",
                provider_event_id=event_data.id
            )

    except Exception as e:
        logger.error(f"Error handling subscription created: {str(e)}", exc_info=True)

async def handle_subscription_updated(event_data):
    """Handle customer.subscription.updated event"""
    try:
        logger.info(f"Processing subscription.updated: {event_data.id}")

        # Find the subscription in our database
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id FROM subscriptions
                    WHERE stripe_subscription_id = %s
                """, (event_data.id,))

                result = cur.fetchone()

                if not result:
                    logger.error(f"Subscription {event_data.id} not found in database")
                    return

                subscription_id = result[0]

                # Extract updated subscription data
                stripe_status = event_data.status
                current_period_start = datetime.fromtimestamp(event_data.current_period_start)
                current_period_end = datetime.fromtimestamp(event_data.current_period_end)
                cancel_at_period_end = event_data.cancel_at_period_end

                # Check for cancellation
                canceled_at = None
                if event_data.canceled_at:
                    canceled_at = datetime.fromtimestamp(event_data.canceled_at)

                # Update subscription in our database
                from app.models.subscription import update_subscription
                update_subscription(
                    subscription_id=subscription_id,
                    status=stripe_status,
                    current_period_start=current_period_start,
                    current_period_end=current_period_end,
                    cancel_at_period_end=cancel_at_period_end,
                    canceled_at=canceled_at,
                    stripe_status=stripe_status
                )
                logger.info(f"Updated subscription {subscription_id} with new status: {stripe_status}")

                # Log the event
                from app.models.subscription import log_subscription_event
                log_subscription_event(
                    subscription_id=subscription_id,
                    event_type="subscription_updated",
                    event_data=event_data,
                    payment_provider="stripe",
                    provider_event_id=event_data.id
                )
        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error handling subscription updated: {str(e)}", exc_info=True)

async def handle_subscription_deleted(event_data):
    """Handle customer.subscription.deleted event"""
    try:
        logger.info(f"Processing subscription.deleted: {event_data.id}")

        # Find the subscription in our database
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
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
                    provider_event_id=event_data.id
                )
        finally:
            conn.close()

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
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
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
                    provider_event_id=event_data.id
                )
        finally:
            conn.close()

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
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
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
                    provider_event_id=event_data.id
                )
        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error handling invoice payment failed: {str(e)}", exc_info=True)

@router.post("/cancel")
async def cancel_user_subscription(
    cancel_at_period_end: bool = Body(True),
    user = Depends(get_user_from_token)
):
    """
    Cancel the current user's subscription
    """
    check_subscriptions_enabled()

    if not stripe:
        raise HTTPException(
            status_code=503,
            detail="Stripe integration is not available"
        )

    user_id = user.get('user_id')

    try:
        # Find the user's subscription
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, stripe_subscription_id, payment_provider
                    FROM subscriptions
                    WHERE user_id = %s AND status = 'active'
                """, (user_id,))

                result = cur.fetchone()

                if not result:
                    raise HTTPException(
                        status_code=404,
                        detail="No active subscription found"
                    )

                subscription_id, stripe_subscription_id, payment_provider = result

                # Check if this is a Stripe subscription
                if payment_provider != 'stripe':
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cancellation not supported for {payment_provider} subscriptions"
                    )

                if not stripe_subscription_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Missing Stripe subscription ID"
                    )

                # Cancel the subscription in Stripe
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
        finally:
            conn.close()

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling subscription: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Error canceling subscription: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error canceling subscription: {str(e)}"
        )

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