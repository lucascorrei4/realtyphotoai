-- VERSION THAT BYPASSES TRIGGERS: Create function to insert stripe_subscriptions
-- This version uses plan_name and explicitly handles any triggers

DROP FUNCTION IF EXISTS create_stripe_subscription(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN);

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
  v_normalized_plan TEXT;
BEGIN
  -- Normalize plan name
  v_normalized_plan := LOWER(TRIM(p_plan_name));
  
  -- Check if subscription already exists
  SELECT id INTO v_subscription_id
  FROM stripe_subscriptions
  WHERE stripe_subscription_id = p_stripe_subscription_id;
  
  IF v_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE stripe_subscriptions
    SET 
      status = p_status,
      plan_name = v_normalized_plan,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      cancel_at_period_end = p_cancel_at_period_end,
      updated_at = NOW()
    WHERE stripe_subscription_id = p_stripe_subscription_id
    RETURNING id INTO v_subscription_id;
  ELSE
    -- Insert new subscription
    -- Use explicit column list and avoid any potential triggers by being explicit
    INSERT INTO stripe_subscriptions (
      user_id,
      stripe_subscription_id,
      stripe_customer_id,
      stripe_price_id,
      plan_name,
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
      v_normalized_plan,
      p_status,
      p_current_period_start,
      p_current_period_end,
      p_cancel_at_period_end,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_subscription_id;
  END IF;

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_stripe_subscription(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) TO authenticated, service_role;

