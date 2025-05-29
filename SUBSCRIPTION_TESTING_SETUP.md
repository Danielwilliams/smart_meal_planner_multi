# Subscription Testing Setup Guide

This guide provides a step-by-step process for setting up and testing the Stripe subscription integration for the Smart Meal Planner application.

## Prerequisites

Before you begin testing, make sure you have the following installed:

- Python 3.8 or higher
- PostgreSQL database
- Stripe CLI (for webhook testing)
- Node.js and npm (for running the frontend)

## Backend Setup

### 1. Install Python Dependencies

```bash
cd apps/smart-meal-planner-backend
pip install -r requirements.txt

# Install additional required packages for subscription functionality
pip install stripe==7.7.0
pip install python-dotenv
pip install python-multipart
```

### 2. Database Configuration

Ensure your PostgreSQL database is running and properly configured in your environment variables:

```bash
# Example database configuration
DATABASE_URL=postgresql://username:password@localhost:5432/smart_meal_planner
```

### 3. Stripe Configuration

Set up your Stripe test environment variables:

```bash
# Copy the sample environment file
cp .env.stripe-sample .env

# Edit the .env file with your actual Stripe test API keys
# Make sure to replace the placeholder values with your actual test keys
```

Edit the `.env` file to include:

```
# Stripe Configuration for Testing
STRIPE_SECRET_KEY=sk_test_your_test_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs for your test subscription products
STRIPE_INDIVIDUAL_PRICE_ID=price_your_individual_price_id
STRIPE_ORGANIZATION_PRICE_ID=price_your_organization_price_id

# Enable subscription features
ENABLE_SUBSCRIPTION_FEATURES=true

# Free tier settings
FREE_TIER_BETA_EXPIRATION_DAYS=90
```

### 4. Database Migration

If the subscription tables don't exist in your database yet, you'll need to create them. The subscription system requires the following tables:

- `subscriptions`
- `payment_methods`
- `subscription_events`
- `invoices`

You can create these tables manually using the SQL definitions from the `SUBSCRIPTION_INTEGRATION_PLAN.md` file, or create a new migration file:

```bash
# Create a new migration file
cd apps/smart-meal-planner-backend/app/migrations/versions
```

Create a new file named `011_create_subscription_tables.py` with the following content:

```python
"""
Migration: Create subscription-related tables
"""
import logging
from psycopg2.extras import RealDictCursor
from app.db import get_db_connection

logger = logging.getLogger(__name__)

def run_migration():
    """Create subscription-related tables"""
    conn = None
    try:
        logger.info("Starting migration: Create subscription tables")
        
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if subscriptions table already exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'subscriptions'
                )
            """)
            table_exists = cur.fetchone()['exists']
            
            if not table_exists:
                logger.info("Creating subscriptions table")
                
                # Create subscriptions table
                cur.execute("""
                    CREATE TABLE subscriptions (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES user_profiles(id),
                        organization_id INTEGER REFERENCES organizations(id),
                        subscription_type VARCHAR(20) NOT NULL CHECK (subscription_type IN ('free', 'individual', 'organization')),
                        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
                        
                        -- Stripe fields
                        stripe_customer_id VARCHAR(255),
                        stripe_subscription_id VARCHAR(255),
                        stripe_price_id VARCHAR(255),
                        stripe_status VARCHAR(50),
                        
                        -- PayPal fields  
                        paypal_subscription_id VARCHAR(255),
                        paypal_plan_id VARCHAR(255),
                        paypal_status VARCHAR(50),
                        
                        -- Common fields
                        payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN ('stripe', 'paypal', 'none')),
                        current_period_start TIMESTAMP WITH TIME ZONE,
                        current_period_end TIMESTAMP WITH TIME ZONE,
                        billing_cycle_anchor TIMESTAMP WITH TIME ZONE,
                        monthly_amount DECIMAL(10, 2) NOT NULL,
                        currency VARCHAR(3) DEFAULT 'USD',
                        
                        -- Trial and cancellation
                        trial_start TIMESTAMP WITH TIME ZONE,
                        trial_end TIMESTAMP WITH TIME ZONE,
                        cancel_at_period_end BOOLEAN DEFAULT FALSE,
                        canceled_at TIMESTAMP WITH TIME ZONE,
                        beta_expiration_date TIMESTAMP WITH TIME ZONE,
                        is_beta_tester BOOLEAN DEFAULT FALSE,
                        
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        
                        -- Ensure one subscription per user/organization
                        CONSTRAINT unique_user_subscription UNIQUE (user_id),
                        CONSTRAINT unique_organization_subscription UNIQUE (organization_id),
                        
                        -- Either user_id or organization_id should be set, but not both
                        CONSTRAINT check_subscription_owner CHECK (
                            (user_id IS NOT NULL AND organization_id IS NULL) OR 
                            (user_id IS NULL AND organization_id IS NOT NULL)
                        )
                    )
                """)
                
                # Create payment_methods table
                logger.info("Creating payment_methods table")
                cur.execute("""
                    CREATE TABLE payment_methods (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES user_profiles(id),
                        organization_id INTEGER REFERENCES organizations(id),
                        
                        -- Stripe fields
                        stripe_payment_method_id VARCHAR(255),
                        stripe_customer_id VARCHAR(255),
                        
                        -- PayPal fields
                        paypal_billing_agreement_id VARCHAR(255),
                        
                        payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN ('stripe', 'paypal')),
                        payment_type VARCHAR(50), -- 'card', 'bank_account', 'paypal', etc.
                        
                        -- Card details (for display purposes only - never store sensitive data)
                        last_four VARCHAR(4),
                        brand VARCHAR(20), -- 'visa', 'mastercard', etc.
                        exp_month INTEGER,
                        exp_year INTEGER,
                        
                        is_default BOOLEAN DEFAULT FALSE,
                        is_active BOOLEAN DEFAULT TRUE,
                        
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        
                        -- Either user_id or organization_id should be set
                        CONSTRAINT check_payment_method_owner CHECK (
                            (user_id IS NOT NULL AND organization_id IS NULL) OR 
                            (user_id IS NULL AND organization_id IS NOT NULL)
                        )
                    )
                """)
                
                # Create subscription_events table
                logger.info("Creating subscription_events table")
                cur.execute("""
                    CREATE TABLE subscription_events (
                        id SERIAL PRIMARY KEY,
                        subscription_id INTEGER REFERENCES subscriptions(id),
                        event_type VARCHAR(100) NOT NULL,
                        event_data JSONB,
                        payment_provider VARCHAR(20) NOT NULL,
                        provider_event_id VARCHAR(255),
                        processed BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create invoices table
                logger.info("Creating invoices table")
                cur.execute("""
                    CREATE TABLE invoices (
                        id SERIAL PRIMARY KEY,
                        subscription_id INTEGER REFERENCES subscriptions(id),
                        
                        -- Stripe fields
                        stripe_invoice_id VARCHAR(255),
                        
                        -- PayPal fields  
                        paypal_invoice_id VARCHAR(255),
                        
                        payment_provider VARCHAR(20) NOT NULL,
                        invoice_number VARCHAR(100),
                        status VARCHAR(50) NOT NULL, -- 'draft', 'open', 'paid', 'void', 'uncollectible'
                        amount_due DECIMAL(10, 2),
                        amount_paid DECIMAL(10, 2),
                        currency VARCHAR(3) DEFAULT 'USD',
                        
                        period_start TIMESTAMP WITH TIME ZONE,
                        period_end TIMESTAMP WITH TIME ZONE,
                        due_date TIMESTAMP WITH TIME ZONE,
                        paid_at TIMESTAMP WITH TIME ZONE,
                        
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                logger.info("Subscription tables created successfully")
            else:
                logger.info("Subscriptions table already exists, skipping creation")
            
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Error creating subscription tables: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def rollback_migration():
    """Drop subscription-related tables"""
    conn = None
    try:
        logger.info("Rolling back migration: Drop subscription tables")
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS invoices CASCADE")
            cur.execute("DROP TABLE IF EXISTS subscription_events CASCADE")
            cur.execute("DROP TABLE IF EXISTS payment_methods CASCADE")
            cur.execute("DROP TABLE IF EXISTS subscriptions CASCADE")
            
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Error dropping subscription tables: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()
```

Then run the migration:

```bash
# Trigger migration
cd apps/smart-meal-planner-backend
python trigger_migration.py
```

## Frontend Setup

### 1. Install Frontend Dependencies

```bash
cd apps/smart-meal-planner-web
npm install

# Install additional required packages for subscription functionality
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2. Configure Frontend Environment

```bash
# Copy the sample environment file
cp .env.stripe-sample .env

# Edit the .env file with your actual Stripe publishable key
# Make sure to replace the placeholder values with your actual test keys
```

Edit the `.env` file to include:

```
# Stripe Configuration for Testing
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key_here

# Set this to the URL where your backend API is running
REACT_APP_API_BASE_URL=http://localhost:8000

# Feature flags
REACT_APP_ENABLE_SUBSCRIPTION_FEATURES=true
```

## Stripe Setup

### 1. Create Products and Price IDs in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Create two products:
   - Individual Subscription ($7.99/month)
   - Organization Subscription ($49.99/month)
3. For each product, create a recurring price:
   - Set billing period to monthly
   - Set the appropriate price ($7.99 or $49.99)
   - Set the currency to USD
4. Take note of the Price IDs (they start with `price_`) for both products
5. Update your backend `.env` file with these Price IDs

### 2. Set Up Webhook Endpoint in Stripe Dashboard

1. Go to [Stripe Dashboard Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL (when testing locally, you'll use the Stripe CLI to forward events)
4. Subscribe to the following events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Take note of the Signing Secret (starts with `whsec_`)
6. Update your backend `.env` file with this Webhook Secret

## Testing the Integration

### 1. Start the Backend Server

```bash
cd apps/smart-meal-planner-backend
uvicorn app.main:app --reload --port 8000
```

### 2. Start the Frontend Server

```bash
cd apps/smart-meal-planner-web
npm start
```

### 3. Set Up Webhook Forwarding with Stripe CLI

In a new terminal window:

```bash
# Start webhook forwarding
./test-stripe-webhook.sh

# Note: This will show a webhook signing secret. Copy it and update your .env file if needed.
```

### 4. Test the Stripe Integration

Run the test script to verify basic functionality:

```bash
cd apps/smart-meal-planner-backend
python test_stripe_integration.py
```

### 5. Test the Complete Subscription Flow

1. Open the application in your browser (typically http://localhost:3000)
2. Log in with a test account
3. Navigate to the Subscription page
4. Select a subscription plan
5. Complete the checkout process using a test card:
   - Use card number: 4242 4242 4242 4242
   - Use any future expiration date (e.g., 12/34)
   - Use any 3-digit CVC code (e.g., 123)
   - Use any billing address

### 6. Test Webhook Events

Use the event trigger script to simulate various subscription lifecycle events:

```bash
# Trigger test events
./trigger-test-events.sh
```

## Troubleshooting

### Common Issues and Solutions

1. **Webhook Events Not Being Processed**
   - Check that the webhook signing secret is correctly set in your `.env` file
   - Ensure the Stripe CLI is running and forwarding events
   - Check server logs for any errors in the webhook handler

2. **Checkout Session Creation Fails**
   - Verify that your Stripe API keys are correct
   - Ensure the price IDs in your `.env` file match those in your Stripe Dashboard
   - Check server logs for detailed error messages

3. **Database Migration Issues**
   - Check that your database connection is working
   - Verify you have the necessary permissions to create tables
   - Look for errors in the migration logs

4. **Frontend Not Connecting to Backend**
   - Ensure the `REACT_APP_API_BASE_URL` is correctly set in your frontend `.env` file
   - Check for CORS issues in the browser console
   - Verify the backend server is running and accessible

## Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Testing Documentation](https://stripe.com/docs/testing)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://reactjs.org/docs/getting-started.html)