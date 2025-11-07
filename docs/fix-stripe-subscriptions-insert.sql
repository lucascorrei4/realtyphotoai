-- Fix for stripe_subscriptions table insert
-- This script creates a function to safely insert subscription records with enum handling

-- First, check the actual table schema:
-- Run this in Supabase SQL Editor to see the table structure:
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'stripe_subscriptions'
ORDER BY ordinal_position;

-- Option 1: If the table has a 'subscription_plan' enum column (not 'plan_name')
-- Create a function to handle the insert:
CREATE OR REPLACE FUNCTION create_stripe_subscription(
  p_user_id UUID,
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_price_id TEXT,
  p_plan_name TEXT,
  p_status TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_plan_enum subscription_plan;
BEGIN
  -- Cast plan name to enum
  BEGIN
    v_plan_enum := LOWER(TRIM(p_plan_name))::subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid plan name: %. Must be one of: free, basic, premium, enterprise, ultra', p_plan_name;
  END;
  
  -- Insert subscription record
  INSERT INTO stripe_subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    stripe_price_id,
    subscription_plan,  -- Use enum column if it exists
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_stripe_price_id,
    v_plan_enum,
    p_status,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (stripe_subscription_id) 
  DO UPDATE SET
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_stripe_subscription(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) TO authenticated;

-- Option 2: If the table has 'plan_name' as TEXT (not enum)
-- Then the current code should work, but you might need to ensure the column exists:
-- ALTER TABLE stripe_subscriptions ADD COLUMN IF NOT EXISTS plan_name TEXT;

-- Option 3: If the table has both columns, you can use either:
-- - subscription_plan (enum) - use the function above
-- - plan_name (text) - use direct insert

