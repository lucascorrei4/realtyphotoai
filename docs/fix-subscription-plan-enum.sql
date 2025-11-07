-- SQL function to safely update subscription_plan enum
-- Run this in Supabase SQL Editor to create the function

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
    RAISE EXCEPTION 'Invalid plan name: %. Must be one of: free, basic, premium, enterprise, ultra', new_plan;
  END;
  
  -- Update the user profile
  UPDATE user_profiles
  SET subscription_plan = valid_plan,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_subscription_plan(UUID, TEXT) TO authenticated;

