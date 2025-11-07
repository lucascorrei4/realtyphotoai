# Fix Subscription Sync Issue

## Problem
The `stripe_subscriptions` table has a `plan_name` (TEXT) column, but there may be a trigger or constraint trying to set `subscription_plan` (enum). The direct insert is failing.

## Solution

**IMPORTANT:** First, drop any existing version of the function, then create the new one.

Run this SQL in Supabase SQL Editor:

```sql
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_stripe_subscription(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN);

-- Create new function that ONLY uses plan_name
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
BEGIN
  -- Insert subscription record using plan_name (TEXT column)
  INSERT INTO stripe_subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    stripe_price_id,
    plan_name,  -- Use TEXT column
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
    LOWER(TRIM(p_plan_name)),  -- Normalize plan name
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

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_stripe_subscription(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) TO authenticated, service_role;
```

## After Running the Function

1. Run the sync script again:
   ```bash
   npx ts-node scripts/sync-subscription-from-stripe.ts
   ```

2. Or use the "Sync Subscription from Stripe" button in Settings

The function will handle the insert properly using only the `plan_name` column.

