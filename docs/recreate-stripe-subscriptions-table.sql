-- Recreate stripe_subscriptions table with correct schema
-- Run this AFTER dropping the existing table

-- Drop the table if it still exists (just in case)
DROP TABLE IF EXISTS stripe_subscriptions CASCADE;

-- Create the table with plan_name as TEXT (not enum)
CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,  -- Use TEXT, not enum
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key constraint
  CONSTRAINT stripe_subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES user_profiles(id) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_stripe_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX idx_stripe_subscriptions_stripe_subscription_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX idx_stripe_subscriptions_stripe_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX idx_stripe_subscriptions_status ON stripe_subscriptions(status);
CREATE INDEX idx_stripe_subscriptions_plan_name ON stripe_subscriptions(plan_name);

-- Create updated_at trigger (standard pattern)
CREATE OR REPLACE FUNCTION update_stripe_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stripe_subscriptions_updated_at
  BEFORE UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_subscriptions_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON stripe_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stripe_subscriptions TO service_role;

-- Enable RLS if needed (adjust based on your security requirements)
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON stripe_subscriptions
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- RLS Policy: Service role can do everything
CREATE POLICY "Service role has full access"
  ON stripe_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

