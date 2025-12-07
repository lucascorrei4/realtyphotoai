-- Create credit_transactions table to track prepaid credits from one-time payments
-- This table stores credit purchases and usage

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'purchase' | 'usage' | 'expiration'
  credits INTEGER NOT NULL, -- Positive for purchases, negative for usage
  balance_after INTEGER NOT NULL, -- Credit balance after this transaction
  description TEXT,
  stripe_session_id TEXT, -- Link to Stripe checkout session if from purchase
  stripe_payment_intent_id TEXT, -- Link to Stripe payment intent
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ, -- NULL for credits that never expire
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key constraint
  CONSTRAINT credit_transactions_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES user_profiles(id) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_session_id ON credit_transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON credit_transactions(user_id, transaction_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_credit_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credit_transactions_updated_at ON credit_transactions;
CREATE TRIGGER credit_transactions_updated_at
  BEFORE UPDATE ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_transactions_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON credit_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON credit_transactions TO service_role;

-- Function to get current credit balance for a user
CREATE OR REPLACE FUNCTION get_user_prepaid_credit_balance(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  total_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(credits), 0) INTO total_balance
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN COALESCE(total_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits from a purchase
CREATE OR REPLACE FUNCTION add_prepaid_credits(
  p_user_id TEXT,
  p_credits INTEGER,
  p_description TEXT,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
  transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT get_user_prepaid_credit_balance(p_user_id) INTO current_balance;
  
  -- Calculate new balance
  new_balance := current_balance + p_credits;
  
  -- Insert transaction
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    credits,
    balance_after,
    description,
    stripe_session_id,
    stripe_payment_intent_id,
    expires_at
  ) VALUES (
    p_user_id,
    'purchase',
    p_credits,
    new_balance,
    p_description,
    p_stripe_session_id,
    p_stripe_payment_intent_id,
    p_expires_at
  ) RETURNING id INTO transaction_id;
  
  RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

