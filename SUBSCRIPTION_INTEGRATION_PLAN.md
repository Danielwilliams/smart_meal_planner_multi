# Smart Meal Planner - Subscription Integration Plan

## Overview
This document outlines the comprehensive integration plan for implementing Stripe and PayPal subscription models for the Smart Meal Planner application. The system will support two subscription tiers:
- **Individual User Subscription**: $7.99/month
- **Organization Subscription**: $49.99/month

## Current Application Architecture Analysis

### Existing Database Schema
Based on the current schema, the application already supports:
- Multi-tenant architecture with `user_profiles`, `organizations`, and `organization_clients` tables
- Account types: `individual`, `client`, `organization` (stored in `user_profiles.account_type`)
- Organization ownership and client management structures
- User authentication and session management

### Current Payment Infrastructure
- No existing subscription or payment tables detected
- Need to add subscription management tables
- Current cart and order tables exist but are for grocery purchases

## Database Schema Changes Required

### New Tables to Create

#### 1. `subscriptions` table
```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id),
    organization_id INTEGER REFERENCES organizations(id),
    subscription_type VARCHAR(20) NOT NULL CHECK (subscription_type IN ('individual', 'organization')),
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
    payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN ('stripe', 'paypal')),
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
);
```

#### 2. `payment_methods` table
```sql
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
);
```

#### 3. `subscription_events` table
```sql
CREATE TABLE subscription_events (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES subscriptions(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    payment_provider VARCHAR(20) NOT NULL,
    provider_event_id VARCHAR(255),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. `invoices` table
```sql
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
);
```

## Environment Variables Required

### Stripe Configuration
```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (created in Stripe Dashboard)
STRIPE_INDIVIDUAL_PRICE_ID=price_...
STRIPE_ORGANIZATION_PRICE_ID=price_...

# Stripe Customer Portal
STRIPE_CUSTOMER_PORTAL_URL=https://billing.stripe.com/p/login/...
```

### PayPal Configuration
```bash
# PayPal API Credentials
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_MODE=sandbox # or live

# PayPal Plan IDs (created via API)
PAYPAL_INDIVIDUAL_PLAN_ID=P-...
PAYPAL_ORGANIZATION_PLAN_ID=P-...

# PayPal Webhook ID
PAYPAL_WEBHOOK_ID=your_webhook_id
```

### Application URLs
```bash
# Domain configuration
FRONTEND_URL=http://localhost:3000 # or production URL
BACKEND_URL=http://localhost:8000 # or production URL

# Subscription redirect URLs
SUBSCRIPTION_SUCCESS_URL=${FRONTEND_URL}/subscription/success
SUBSCRIPTION_CANCEL_URL=${FRONTEND_URL}/subscription/cancel
```

## Backend Implementation

### 1. Install Required Dependencies

#### Python (FastAPI Backend)
```bash
pip install stripe==7.7.0
pip install paypalrestsdk==1.13.3
pip install python-multipart
```

### 2. New API Routers

#### `app/routers/subscriptions.py`
```python
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
import stripe
import paypalrestsdk
from ..models.subscription import Subscription, PaymentMethod, SubscriptionEvent, Invoice
from ..utils.auth_middleware import get_current_user
from ..db import get_db
import os

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Configure PayPal
paypalrestsdk.configure({
    "mode": os.getenv("PAYPAL_MODE", "sandbox"),
    "client_id": os.getenv("PAYPAL_CLIENT_ID"),
    "client_secret": os.getenv("PAYPAL_CLIENT_SECRET")
})

@router.post("/create-stripe-checkout")
async def create_stripe_checkout(
    subscription_type: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create Stripe checkout session for subscription"""
    pass

@router.post("/create-paypal-subscription")
async def create_paypal_subscription(
    subscription_type: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create PayPal subscription"""
    pass

@router.get("/status")
async def get_subscription_status(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's subscription status"""
    pass

@router.post("/cancel")
async def cancel_subscription(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel user's subscription"""
    pass

@router.post("/update-payment-method")
async def update_payment_method(
    payment_method_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update subscription payment method"""
    pass
```

#### `app/routers/webhooks.py`
```python
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session
import stripe
import json
import os
from ..db import get_db
from ..models.subscription import Subscription, SubscriptionEvent

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

@router.post("/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle specific events
    if event['type'] == 'checkout.session.completed':
        # Handle successful subscription creation
        pass
    elif event['type'] == 'invoice.paid':
        # Handle successful payment
        pass
    elif event['type'] == 'invoice.payment_failed':
        # Handle failed payment
        pass
    elif event['type'] == 'customer.subscription.updated':
        # Handle subscription changes
        pass
    elif event['type'] == 'customer.subscription.deleted':
        # Handle subscription cancellation
        pass
    
    return {"status": "success"}

@router.post("/paypal")
async def paypal_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle PayPal webhook events"""
    # Verify PayPal webhook signature
    # Process PayPal subscription events
    pass
```

### 3. Database Models

#### `app/models/subscription.py`
```python
from sqlalchemy import Column, Integer, String, Decimal, Boolean, DateTime, Text, CheckConstraint, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db import Base

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    subscription_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    
    # Stripe fields
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    stripe_price_id = Column(String(255))
    stripe_status = Column(String(50))
    
    # PayPal fields
    paypal_subscription_id = Column(String(255))
    paypal_plan_id = Column(String(255))
    paypal_status = Column(String(50))
    
    # Common fields
    payment_provider = Column(String(20), nullable=False)
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    billing_cycle_anchor = Column(DateTime(timezone=True))
    monthly_amount = Column(Decimal(10, 2), nullable=False)
    currency = Column(String(3), default="USD")
    
    # Trial and cancellation
    trial_start = Column(DateTime(timezone=True))
    trial_end = Column(DateTime(timezone=True))
    cancel_at_period_end = Column(Boolean, default=False)
    canceled_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="subscription")
    organization = relationship("Organization", back_populates="subscription")
    events = relationship("SubscriptionEvent", back_populates="subscription")
    invoices = relationship("Invoice", back_populates="subscription")
    
    __table_args__ = (
        CheckConstraint(subscription_type.in_(['individual', 'organization'])),
        CheckConstraint(status.in_(['active', 'canceled', 'past_due', 'unpaid', 'trialing'])),
        CheckConstraint(payment_provider.in_(['stripe', 'paypal'])),
        UniqueConstraint('user_id', name='unique_user_subscription'),
        UniqueConstraint('organization_id', name='unique_organization_subscription'),
        CheckConstraint(
            '(user_id IS NOT NULL AND organization_id IS NULL) OR (user_id IS NULL AND organization_id IS NOT NULL)',
            name='check_subscription_owner'
        )
    )

class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    # ... similar structure to subscription table

class SubscriptionEvent(Base):
    __tablename__ = "subscription_events"
    # ... event logging structure

class Invoice(Base):
    __tablename__ = "invoices"
    # ... invoice tracking structure
```

## Frontend Implementation

### 1. Install Required Dependencies

#### React Frontend
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
npm install @paypal/react-paypal-js
```

### 2. New Components

#### `src/components/SubscriptionPlan.jsx`
```jsx
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import apiService from '../services/apiService';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const SubscriptionPlan = ({ planType, userType }) => {
    const [loading, setLoading] = useState(false);
    const [paymentProvider, setPaymentProvider] = useState('stripe');
    
    const planDetails = {
        individual: {
            name: 'Individual Plan',
            price: 7.99,
            features: [
                'Unlimited meal planning',
                'Shopping list generation',
                'Recipe saving',
                'Grocery store integration'
            ]
        },
        organization: {
            name: 'Organization Plan',
            price: 49.99,
            features: [
                'Everything in Individual',
                'Client management',
                'Menu sharing with clients',
                'Organization dashboard',
                'Bulk meal planning'
            ]
        }
    };
    
    const handleStripeSubscribe = async () => {
        setLoading(true);
        try {
            const response = await apiService.post('/subscriptions/create-stripe-checkout', {
                subscription_type: planType
            });
            
            const stripe = await stripePromise;
            await stripe.redirectToCheckout({
                sessionId: response.data.session_id
            });
        } catch (error) {
            console.error('Stripe subscription error:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handlePayPalSubscribe = async (data, actions) => {
        try {
            const response = await apiService.post('/subscriptions/create-paypal-subscription', {
                subscription_type: planType,
                subscription_id: data.subscriptionID
            });
            return response.data;
        } catch (error) {
            console.error('PayPal subscription error:', error);
        }
    };
    
    return (
        <div className="subscription-plan">
            <h3>{planDetails[planType].name}</h3>
            <div className="price">${planDetails[planType].price}/month</div>
            
            <ul className="features">
                {planDetails[planType].features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                ))}
            </ul>
            
            <div className="payment-options">
                <div className="payment-provider-selector">
                    <label>
                        <input
                            type="radio"
                            value="stripe"
                            checked={paymentProvider === 'stripe'}
                            onChange={(e) => setPaymentProvider(e.target.value)}
                        />
                        Credit Card (Stripe)
                    </label>
                    <label>
                        <input
                            type="radio"
                            value="paypal"
                            checked={paymentProvider === 'paypal'}
                            onChange={(e) => setPaymentProvider(e.target.value)}
                        />
                        PayPal
                    </label>
                </div>
                
                {paymentProvider === 'stripe' && (
                    <button
                        onClick={handleStripeSubscribe}
                        disabled={loading}
                        className="subscribe-button stripe"
                    >
                        {loading ? 'Processing...' : 'Subscribe with Stripe'}
                    </button>
                )}
                
                {paymentProvider === 'paypal' && (
                    <PayPalScriptProvider options={{
                        "client-id": process.env.REACT_APP_PAYPAL_CLIENT_ID,
                        vault: true,
                        intent: "subscription"
                    }}>
                        <PayPalButtons
                            style={{ layout: 'horizontal' }}
                            createSubscription={(data, actions) => {
                                return actions.subscription.create({
                                    plan_id: planType === 'individual' 
                                        ? process.env.REACT_APP_PAYPAL_INDIVIDUAL_PLAN_ID
                                        : process.env.REACT_APP_PAYPAL_ORGANIZATION_PLAN_ID
                                });
                            }}
                            onApprove={handlePayPalSubscribe}
                        />
                    </PayPalScriptProvider>
                )}
            </div>
        </div>
    );
};

export default SubscriptionPlan;
```

#### `src/pages/SubscriptionPage.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import SubscriptionPlan from '../components/SubscriptionPlan';
import apiService from '../services/apiService';

const SubscriptionPage = () => {
    const { user } = useAuth();
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchSubscriptionStatus();
    }, []);
    
    const fetchSubscriptionStatus = async () => {
        try {
            const response = await apiService.get('/subscriptions/status');
            setCurrentSubscription(response.data);
        } catch (error) {
            console.error('Error fetching subscription:', error);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) return <div>Loading...</div>;
    
    if (currentSubscription?.status === 'active') {
        return (
            <div className="subscription-page">
                <h2>Current Subscription</h2>
                <div className="current-subscription">
                    <p>Plan: {currentSubscription.subscription_type}</p>
                    <p>Status: {currentSubscription.status}</p>
                    <p>Next billing: {new Date(currentSubscription.current_period_end).toLocaleDateString()}</p>
                    <p>Amount: ${currentSubscription.monthly_amount}/month</p>
                    
                    <button 
                        onClick={() => {/* Handle cancellation */}}
                        className="cancel-button"
                    >
                        Cancel Subscription
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="subscription-page">
            <h2>Choose Your Plan</h2>
            <div className="subscription-plans">
                <SubscriptionPlan 
                    planType="individual" 
                    userType={user?.account_type}
                />
                {user?.account_type === 'organization' && (
                    <SubscriptionPlan 
                        planType="organization" 
                        userType={user?.account_type}
                    />
                )}
            </div>
        </div>
    );
};

export default SubscriptionPage;
```

### 3. Environment Variables for Frontend

#### `.env` file
```bash
# Stripe
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...

# PayPal
REACT_APP_PAYPAL_CLIENT_ID=your_client_id
REACT_APP_PAYPAL_INDIVIDUAL_PLAN_ID=P-...
REACT_APP_PAYPAL_ORGANIZATION_PLAN_ID=P-...

# API URLs
REACT_APP_API_BASE_URL=http://localhost:8000/api
```

## Integration Steps

### Phase 1: Database Setup (Week 1)
1. **Create migration scripts** for new subscription tables
2. **Update existing models** to include subscription relationships
3. **Add subscription status fields** to user_profiles and organizations tables
4. **Create indexes** for performance optimization
5. **Test database schema** with sample data

### Phase 2: Backend API Development (Week 2-3)
1. **Implement subscription router** with all CRUD operations
2. **Create webhook handlers** for both Stripe and PayPal
3. **Add subscription middleware** to protect premium features
4. **Implement payment method management**
5. **Create subscription status checking utilities**
6. **Add comprehensive error handling and logging**

### Phase 3: Frontend Implementation (Week 3-4)
1. **Create subscription components** and pages
2. **Integrate Stripe Elements** for payment collection
3. **Implement PayPal subscription buttons**
4. **Add subscription status displays** throughout the app
5. **Create billing management interface**
6. **Implement feature gating** based on subscription status

### Phase 4: Stripe Setup (Week 4)
1. **Create Stripe account** and configure webhooks
2. **Set up products and prices** in Stripe Dashboard
3. **Configure customer portal** for self-service billing
4. **Test webhook delivery** and event handling
5. **Set up production environment** configuration

### Phase 5: PayPal Setup (Week 4)
1. **Create PayPal developer account**
2. **Set up subscription plans** via PayPal API
3. **Configure PayPal webhooks**
4. **Test PayPal subscription flow**
5. **Verify fund movement** in sandbox

### Phase 6: Feature Gating Implementation (Week 5)
1. **Add subscription checks** to protected routes
2. **Implement usage limits** for free users
3. **Create upgrade prompts** throughout the application
4. **Add subscription-required middleware** to API endpoints
5. **Test all subscription workflows**

### Phase 7: Testing & Deployment (Week 6)
1. **Comprehensive testing** of both payment providers
2. **Load testing** subscription workflows
3. **Security audit** of payment handling
4. **Performance optimization**
5. **Production deployment** and monitoring setup

## Security Considerations

### Payment Security
- **Never store credit card information** - use Stripe/PayPal tokens only
- **Validate webhook signatures** to ensure legitimate requests
- **Use HTTPS everywhere** for payment-related endpoints
- **Implement proper CORS** policies for payment pages
- **Log all subscription events** for audit trails

### Data Protection
- **Encrypt sensitive subscription data** at rest
- **Implement proper access controls** for subscription management
- **Audit trail logging** for all subscription changes
- **Compliance with PCI DSS** requirements (handled by Stripe/PayPal)

### API Security
- **Rate limiting** on subscription endpoints
- **Authentication required** for all subscription operations
- **Input validation** and sanitization
- **SQL injection prevention** in subscription queries

## Monitoring & Analytics

### Key Metrics to Track
- **Monthly Recurring Revenue (MRR)**
- **Churn rate** by subscription type
- **Payment failure rates** by provider
- **Subscription conversion rates**
- **Customer lifetime value**

### Alerting Setup
- **Failed payment notifications**
- **Webhook delivery failures**
- **Subscription cancellation alerts**
- **Revenue threshold monitoring**

### Dashboard Requirements
- **Real-time subscription metrics**
- **Payment provider comparison**
- **Revenue forecasting**
- **Customer subscription analytics**

## Migration Strategy

### For Existing Users
1. **Grandfather existing users** with extended free trial
2. **Email notification campaign** about subscription launch
3. **Gradual feature gating** with grace period
4. **Migration incentives** (discounts, extended trials)

### Data Migration
1. **Backup existing user data**
2. **Create default subscription records** for existing users
3. **Set appropriate trial periods**
4. **Maintain backward compatibility** during transition

## Cost Considerations

### Stripe Fees
- **2.9% + $0.30** per successful card charge
- **0.5%** additional for international cards
- **$0.25** per invoice sent

### PayPal Fees
- **2.9% + $0.30** for domestic transactions
- **Variable rates** for international transactions
- **No monthly fees** for standard accounts

### Infrastructure Costs
- **Additional database storage** for subscription data
- **Webhook processing** compute costs
- **Customer support** tools for billing issues

## Success Criteria

### Technical Goals
- **99.9% uptime** for subscription services
- **< 2 second response time** for subscription status checks
- **Zero payment data breaches**
- **95% webhook delivery success rate**

### Business Goals
- **20% conversion rate** from free to paid users
- **< 5% monthly churn rate**
- **Average customer lifetime** of 12+ months
- **Payment failure rate** < 2%

## Future Enhancements

### Advanced Features
- **Annual subscription discounts**
- **Team/family plans** for organizations
- **Usage-based billing** for large organizations
- **Gift subscriptions**
- **Promo codes and discounts**

### Integration Improvements
- **Apple Pay/Google Pay** support
- **Bank account (ACH)** payment options
- **Cryptocurrency** payment support
- **International payment methods**

This comprehensive plan provides a roadmap for implementing a robust subscription system that supports both individual users and organizations while maintaining security, scalability, and user experience standards.

## Implementation Todo List

### Database Setup (Completed)
- [x] Create subscriptions table
- [x] Create payment_methods table
- [x] Create subscription_events table
- [x] Create invoices table
- [x] Create indexes for performance
- [x] Add subscription reference to user_profiles

### Backend Model Implementation (Completed)
- [x] Create subscription.py model with database functions
- [x] Add free tier support for beta testers
- [x] Implement subscription status checking
- [x] Add migration functions for existing users
- [x] Create subscriptions router with basic endpoints

### Environment Variables Setup
- [ ] Set up environment variables in Railway
  - [ ] Add core application variables (FRONTEND_URL, BACKEND_URL)
  - [ ] Add JWT variables (JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION)
  - [ ] Add feature flag variables (ENABLE_SUBSCRIPTION_FEATURES)

### Stripe Integration
- [ ] Create Stripe account or use existing account
- [ ] Configure Stripe API keys in Railway
  - [ ] Add STRIPE_SECRET_KEY
  - [ ] Add STRIPE_PUBLISHABLE_KEY
  - [ ] Add STRIPE_WEBHOOK_SECRET
- [ ] Create products and prices in Stripe Dashboard
  - [ ] Individual Plan ($7.99/month)
  - [ ] Organization Plan ($49.99/month)
- [ ] Add Stripe price IDs to environment variables
  - [ ] Add STRIPE_INDIVIDUAL_PRICE_ID
  - [ ] Add STRIPE_ORGANIZATION_PRICE_ID
- [ ] Set up Stripe webhook endpoint
  - [ ] Configure webhook URL in Stripe Dashboard
  - [ ] Subscribe to relevant events (checkout.session.completed, invoice.paid, etc.)
  - [ ] Test webhook delivery

### PayPal Integration
- [ ] Create PayPal Developer account or use existing account
- [ ] Configure PayPal API credentials in Railway
  - [ ] Add PAYPAL_CLIENT_ID
  - [ ] Add PAYPAL_CLIENT_SECRET
  - [ ] Add PAYPAL_MODE (sandbox for testing)
- [ ] Create subscription plans via PayPal API
  - [ ] Individual Plan ($7.99/month)
  - [ ] Organization Plan ($49.99/month)
- [ ] Add PayPal plan IDs to environment variables
  - [ ] Add PAYPAL_INDIVIDUAL_PLAN_ID
  - [ ] Add PAYPAL_ORGANIZATION_PLAN_ID
- [ ] Set up PayPal webhook
  - [ ] Configure webhook URL in PayPal Developer Dashboard
  - [ ] Subscribe to relevant events
  - [ ] Add PAYPAL_WEBHOOK_ID to environment variables
  - [ ] Test webhook delivery

### Backend Implementation
- [ ] Create subscription models
  - [ ] Implement Subscription model with ORM
  - [ ] Implement PaymentMethod model with ORM
  - [ ] Implement SubscriptionEvent model with ORM
  - [ ] Implement Invoice model with ORM
- [ ] Create subscription router
  - [ ] Implement create-stripe-checkout endpoint
  - [ ] Implement create-paypal-subscription endpoint
  - [ ] Implement get-subscription-status endpoint
  - [ ] Implement cancel-subscription endpoint
  - [ ] Implement update-payment-method endpoint
- [ ] Create webhook handlers
  - [ ] Implement Stripe webhook handler
  - [ ] Implement PayPal webhook handler
- [ ] Create subscription middleware
  - [ ] Implement feature checking based on subscription status
  - [ ] Make middleware non-blocking during testing
- [ ] Add error handling and logging
  - [ ] Create detailed logging for subscription events
  - [ ] Implement graceful error handling for payment failures

### Frontend Implementation
- [ ] Install required dependencies
  - [ ] @stripe/stripe-js and @stripe/react-stripe-js
  - [ ] @paypal/react-paypal-js
- [ ] Create subscription components
  - [ ] Implement SubscriptionPlan component
  - [ ] Implement PaymentMethodForm component
- [ ] Create subscription pages
  - [ ] Implement SubscriptionPage
  - [ ] Implement SubscriptionSuccessPage
  - [ ] Implement SubscriptionCancelPage
  - [ ] Implement BillingManagementPage
- [ ] Update environment variables
  - [ ] Add frontend environment variables (REACT_APP_*)
- [ ] Integrate with backend API
  - [ ] Implement apiService methods for subscriptions
  - [ ] Add subscription status checks to relevant components

### Testing
- [ ] Create test Stripe accounts
- [ ] Create test PayPal accounts
- [ ] Test subscription creation flows
  - [ ] Test individual subscription with Stripe
  - [ ] Test organization subscription with Stripe
  - [ ] Test individual subscription with PayPal
  - [ ] Test organization subscription with PayPal
- [ ] Test webhook processing
  - [ ] Test Stripe webhooks with test events
  - [ ] Test PayPal webhooks with test events
- [ ] Test subscription cancellation
- [ ] Test subscription updates
- [ ] Test payment method updates

### Production Preparation
- [ ] Switch from test/sandbox to live environment
  - [ ] Update Stripe keys to production
  - [ ] Update PayPal mode to live
  - [ ] Update webhook URLs to production endpoints
- [ ] Final security review
  - [ ] Check for any exposed secrets
  - [ ] Verify proper authorization checks
  - [ ] Ensure proper error handling
- [ ] Documentation
  - [ ] Create user documentation for subscription management
  - [ ] Create internal documentation for subscription system

### Launch
- [ ] Create migration strategy for existing users
- [ ] Plan grace period for free users
- [ ] Prepare announcement for subscription launch
- [ ] Schedule phased rollout
- [ ] Create monitoring dashboard for subscription metrics