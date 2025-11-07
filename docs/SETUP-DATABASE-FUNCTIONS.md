# Database Functions Setup

## Required SQL Functions

To fix the subscription sync issue, you need to run these SQL functions in your Supabase SQL Editor.

### 1. Update User Subscription Plan Function

Run this in Supabase SQL Editor:

```sql
-- File: docs/fix-subscription-plan-enum.sql
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

GRANT EXECUTE ON FUNCTION update_user_subscription_plan(UUID, TEXT) TO authenticated;
```

### 2. Create Stripe Subscription Function

Run this in Supabase SQL Editor:

```sql
-- File: docs/create-stripe-subscription-function.sql
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
  INSERT INTO stripe_subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    stripe_price_id,
    subscription_plan,  -- Use enum column
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

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_stripe_subscription(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) TO authenticated, service_role;
```

## How to Run

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste each function above
5. Click **Run** for each one
6. Verify they were created successfully

## Verification

After running the functions, you can verify they exist:

```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_user_subscription_plan', 'create_stripe_subscription');
```

You should see both functions listed.

## Next Steps

After creating the functions:
1. Try the "Sync Subscription from Stripe" button in Settings
2. Or run: `npx ts-node scripts/sync-subscription-from-stripe.ts`

