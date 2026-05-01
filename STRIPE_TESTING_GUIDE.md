# Stripe Testing Guide for Smart Meal Planner

This guide will help you test the Stripe subscription integration in your Smart Meal Planner application.

## Prerequisites

1. Install the Stripe CLI: [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
2. Set up a Stripe account and get your test API keys from the Stripe Dashboard
3. Make sure your backend server is running

## Environment Setup

1. Copy the sample environment files to the actual environment files:

```bash
# For backend
cp apps/smart-meal-planner-backend/.env.stripe-sample apps/smart-meal-planner-backend/.env

# For frontend
cp apps/smart-meal-planner-web/.env.stripe-sample apps/smart-meal-planner-web/.env
```

2. Edit the files to include your actual test API keys and product IDs from your Stripe Dashboard

## Testing Webhook Integration

1. Run the webhook forwarding script:

```bash
./test-stripe-webhook.sh
```

2. This will start the Stripe CLI and forward webhook events to your local server
3. Take note of the webhook signing secret displayed by the Stripe CLI and update your `.env` file

## Testing Subscription Events

1. In a new terminal, run the event trigger script:

```bash
./trigger-test-events.sh
```

2. Select the event type you want to test from the menu
3. Check your server logs to see how the event was processed

## Testing with Test Credit Cards

When testing the checkout flow in your application, use the following test credit card numbers:

- **Basic successful payment**: 4242 4242 4242 4242
- **3D Secure authentication**: 4000 0027 6000 3184
- **Failed payment**: 4000 0000 0000 0341

Use any future expiration date (e.g., 12/34) and any 3-digit CVC code.

## Testing Subscription Lifecycle

To test different stages of the subscription lifecycle:

1. Create a subscription using the test credit card
2. Use the Stripe Dashboard to manually update the subscription status
3. Or use the Stripe CLI to trigger specific events

## Testing Free Tier and Beta Testers

To test the free tier functionality:

1. Set `ENABLE_SUBSCRIPTION_FEATURES=true` in your environment
2. Create a new user account
3. Use the API to migrate the user to the free tier:

```
POST /api/subscriptions/migrate-to-free-tier
```

4. Verify that the user has access to the appropriate features

## Common Testing Scenarios

1. **New subscription signup**: Complete the checkout flow using a test card
2. **Subscription renewal**: Test automatic renewal by triggering `invoice.paid` events
3. **Failed payment**: Test payment failure handling with the failed test card
4. **Cancellation**: Test subscription cancellation flow
5. **Upgrade/downgrade**: Test changing between subscription tiers

## Important Notes

- All test API keys begin with `sk_test_` and `pk_test_`
- Don't use real card details for testing (this violates Stripe's terms of service)
- The Stripe Dashboard provides a complete view of test mode data
- Remember to switch to live mode and keys when deploying to production