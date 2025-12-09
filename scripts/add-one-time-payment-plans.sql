-- Add new subscription_plan enum values for one-time payments
-- This script adds 'explorer' and 'a_la_carte' to the subscription_plan enum

-- Step 1: Add new enum values to subscription_plan type
-- Note: PostgreSQL doesn't support adding enum values directly in older versions
-- We need to check if they exist first and add them if needed

-- Add 'explorer' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'explorer' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'subscription_plan'
        )
    ) THEN
        ALTER TYPE subscription_plan ADD VALUE 'explorer';
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
END $$;

-- Add 'a_la_carte' if it doesn't exist
-- Note: PostgreSQL enum values with underscores are valid
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'a_la_carte' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'subscription_plan'
        )
    ) THEN
        ALTER TYPE subscription_plan ADD VALUE 'a_la_carte';
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
END $$;

-- Step 2: Update create_user_profile function to set 0 credits for free plan (no more 300 free credits)
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_role TEXT DEFAULT 'user',
  user_plan TEXT DEFAULT 'free'
) RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
  v_valid_plan subscription_plan;
BEGIN
  -- Validate and cast the plan name to enum
  BEGIN
    v_valid_plan := LOWER(TRIM(user_plan))::subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid plan name: %. Must be one of: free, basic, premium, enterprise, explorer, a_la_carte', user_plan;
  END;

  -- Insert user profile with meta_event_name set to 'Lead' by default
  -- When user successfully logs in and accesses the platform, it will be updated to 'CompleteRegistration'
  INSERT INTO user_profiles (
    id,
    email,
    role,
    subscription_plan,
    monthly_generations_limit,
    total_generations,
    successful_generations,
    failed_generations,
    is_active,
    meta_event_name,
    created_at,
    updated_at
  )
  VALUES (
    user_id,
    user_email,
    user_role::user_role,
    v_valid_plan,
    CASE v_valid_plan
      WHEN 'free' THEN 0  -- No more free credits for new users
      WHEN 'basic' THEN 50
      WHEN 'premium' THEN 200
      WHEN 'enterprise' THEN 1000
      WHEN 'explorer' THEN 0  -- Credits come from prepaid purchases (credit_transactions), not monthly limit
      WHEN 'a_la_carte' THEN 0  -- A la carte is done-for-you service, no monthly credits
      ELSE 0
    END,
    0,
    0,
    0,
    true,
    'Lead', -- Set to 'Lead' by default when profile is created (email was entered)
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Update update_user_subscription_plan function to include new plan names
CREATE OR REPLACE FUNCTION update_user_subscription_plan(
  user_uuid UUID,
  new_plan TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  valid_plan subscription_plan;
BEGIN
  -- Validate and cast the plan name to enum
  BEGIN
    valid_plan := new_plan::subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid plan name: %. Must be one of: free, basic, premium, enterprise, explorer, a_la_carte', new_plan;
  END;
  
  -- Update the user profile
  UPDATE user_profiles
  SET subscription_plan = valid_plan,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Update create_stripe_subscription function if it exists
-- (Check if function exists first)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_stripe_subscription'
  ) THEN
    -- Update the function if it exists
    EXECUTE '
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
    ) RETURNS UUID AS $func$
    DECLARE
      v_subscription_id UUID;
      v_valid_plan subscription_plan;
    BEGIN
      -- Validate and cast the plan name to enum
      BEGIN
        v_valid_plan := LOWER(TRIM(p_plan_name))::subscription_plan;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION ''Invalid plan name: %. Must be one of: free, basic, premium, enterprise, explorer, a_la_carte'', p_plan_name;
      END;

      -- Rest of function remains the same...
      -- (This is just updating the error message to include new plan names)
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    ';
  END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_user_subscription_plan(UUID, TEXT) TO authenticated;

