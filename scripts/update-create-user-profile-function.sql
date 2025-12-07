-- Update create_user_profile function to include meta_event_name
-- This function is called when a user profile is created via Supabase Auth

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
    RAISE EXCEPTION 'Invalid plan name: %. Must be one of: free, basic, premium, enterprise', user_plan;
  END;

  -- Insert user profile with meta_event_name set to null
  -- It will be set to 'Lead' when email is entered via sendAuthCode
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
      WHEN 'free' THEN 10
      WHEN 'basic' THEN 50
      WHEN 'premium' THEN 200
      WHEN 'enterprise' THEN 1000
      ELSE 10
    END,
    0,
    0,
    0,
    true,
    NULL, -- Will be set to 'Lead' when email is entered via sendAuthCode
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO anon;

