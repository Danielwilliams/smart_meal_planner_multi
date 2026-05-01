-- Add processed_at column to subscription_events table
ALTER TABLE subscription_events
ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;

-- If you also need to add other missing columns mentioned in the code:

-- Add stripe_status column to subscriptions table (if needed)
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_status VARCHAR(50);

-- Add updated_at column to subscriptions table (if needed)
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at column to invoices table (if needed)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;