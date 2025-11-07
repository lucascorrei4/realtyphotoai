-- Create function to insert stripe_subscriptions with proper enum handling
-- This function handles the subscription_plan enum column correctly

CREATE OR REPLACE FUNCTION create_stripe_subscription(
  p_user_id TEXT,
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
  v_valid_plan subscription_plan;
BEGIN
  -- Validate and cast the plan name to enum
  BEGIN
    v_valid_plan := LOWER(TRIM(p_plan_name))::subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid plan name: %. Must be one of: free, basic, premium, enterprise, ultra', p_plan_name;
  END;

  -- Insert subscription record
  -- Try with subscription_plan first, fallback to plan_name if column doesn't exist
  BEGIN
    INSERT INTO stripe_subscriptions (
      user_id,
      stripe_subscription_id,
      stripe_customer_id,
      stripe_price_id,
      subscription_plan,  -- Try enum column first
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
      v_valid_plan,  -- Insert the cast enum value
      p_status,
      p_current_period_start,
      p_current_period_end,
      p_cancel_at_period_end,
      NOW(),
      NOW()
    )
    ON CONFLICT (stripe_subscription_id) DO UPDATE SET
      status = EXCLUDED.status,
      subscription_plan = EXCLUDED.subscription_plan,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = NOW()
    RETURNING id INTO v_subscription_id;
  EXCEPTION WHEN undefined_column THEN
    -- Column doesn't exist, try with plan_name instead
    INSERT INTO stripe_subscriptions (
      user_id,
      stripe_subscription_id,
      stripe_customer_id,
      stripe_price_id,
      plan_name,  -- Use text column
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
      p_plan_name,  -- Use text value
      p_status,
      p_current_period_start,
      p_current_period_end,
      p_cancel_at_period_end,
      NOW(),
      NOW()
    )
    ON CONFLICT (stripe_subscription_id) DO UPDATE SET
      status = EXCLUDED.status,
      plan_name = EXCLUDED.plan_name,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = NOW()
    RETURNING id INTO v_subscription_id;
  END;

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_stripe_subscription(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) TO authenticated, service_role;

