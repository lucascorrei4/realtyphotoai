# Supabase Database Verification Checklist

## Step 1: Verify Plan Rules Table

Run this query in Supabase SQL Editor:

```sql
SELECT 
  plan_name,
  display_name,
  description,
  price_per_month,
  monthly_generations_limit,
  stripe_product_id,
  stripe_price_id,
  stripe_yearly_price_id,
  is_active,
  created_at,
  updated_at
FROM plan_rules
ORDER BY price_per_month ASC;
```

**Expected Results:**
- ✅ All plans should have `stripe_product_id` (not NULL)
- ✅ All plans should have `stripe_price_id` (not NULL)
- ✅ Plans should have proper `display_name` and `description`
- ✅ `is_active` should be `true` for all active plans

## Step 2: Verify Stripe Product/Price IDs

Check if Stripe IDs are properly set:

```sql
SELECT 
  plan_name,
  CASE 
    WHEN stripe_product_id IS NULL THEN '❌ Missing'
    ELSE '✅ ' || stripe_product_id
  END as product_status,
  CASE 
    WHEN stripe_price_id IS NULL THEN '❌ Missing'
    ELSE '✅ ' || stripe_price_id
  END as monthly_price_status,
  CASE 
    WHEN stripe_yearly_price_id IS NULL THEN '⚠️ Not Set'
    ELSE '✅ ' || stripe_yearly_price_id
  END as yearly_price_status
FROM plan_rules
WHERE is_active = true;
```

## Step 3: Verify User Subscriptions

Check if user subscriptions match their profiles:

```sql
SELECT 
  up.id,
  up.email,
  up.subscription_plan as user_plan,
  up.monthly_generations_limit,
  up.stripe_customer_id,
  ss.plan_name as subscription_plan_name,
  ss.status as subscription_status,
  ss.stripe_subscription_id,
  ss.current_period_end,
  CASE 
    WHEN up.subscription_plan != ss.plan_name THEN '⚠️ Plan Mismatch'
    WHEN ss.id IS NULL THEN '❌ No Subscription Record'
    WHEN up.stripe_customer_id IS NULL THEN '⚠️ No Stripe Customer ID'
    ELSE '✅ Match'
  END as status_check
FROM user_profiles up
LEFT JOIN stripe_subscriptions ss ON up.id = ss.user_id AND ss.status = 'active'
WHERE up.subscription_plan != 'free' OR ss.id IS NOT NULL
ORDER BY up.updated_at DESC;
```

## Step 4: Check Recent Webhook Events

Verify webhooks are being processed:

```sql
SELECT 
  stripe_event_id,
  event_type,
  processed,
  created_at,
  CASE 
    WHEN processed = false THEN '⚠️ Not Processed'
    ELSE '✅ Processed'
  END as status
FROM stripe_webhook_events
ORDER BY created_at DESC
LIMIT 50;
```

## Step 5: Verify Split Payment Configuration

Check environment variables are set (in your `.env` file):
- `STRIPE_PARTNER1_ACCOUNT_ID=acct_1SNyLrHFogG8IuIU`
- `STRIPE_PARTNER2_ACCOUNT_ID=acct_1SNyd1QZLhrenJkp`
- `STRIPE_AGENCY_ACCOUNT_ID=acct_1SGjNgHPF35oYxpn`

## Step 6: Check Subscription Statistics

```sql
-- Active subscriptions by plan
SELECT 
  plan_name,
  COUNT(*) as active_count,
  MIN(created_at) as first_subscription,
  MAX(created_at) as latest_subscription
FROM stripe_subscriptions
WHERE status = 'active'
GROUP BY plan_name
ORDER BY active_count DESC;

-- Subscription status breakdown
SELECT 
  status,
  COUNT(*) as count
FROM stripe_subscriptions
GROUP BY status
ORDER BY count DESC;
```

## Step 7: Verify Plan Names Match Enum

Check if all plan names in database match the enum type:

```sql
SELECT DISTINCT plan_name 
FROM plan_rules 
WHERE is_active = true
ORDER BY plan_name;

-- Should return: basic, enterprise, free, premium, ultra
```

## Common Issues to Check

1. **Missing Stripe Product/Price IDs**: If NULL, products need to be created in Stripe
2. **Plan Name Mismatch**: User profile plan doesn't match subscription plan
3. **Missing Stripe Customer ID**: User has subscription but no customer ID
4. **Unprocessed Webhooks**: Webhook events not being processed
5. **Enum Type Mismatch**: Plan name doesn't match `subscription_plan` enum values

## Quick Fix Queries

### Fix missing Stripe customer ID for users with subscriptions:
```sql
UPDATE user_profiles up
SET stripe_customer_id = ss.stripe_customer_id
FROM stripe_subscriptions ss
WHERE up.id = ss.user_id 
  AND up.stripe_customer_id IS NULL
  AND ss.stripe_customer_id IS NOT NULL;
```

### Sync user plan with subscription plan:
```sql
UPDATE user_profiles up
SET subscription_plan = ss.plan_name::subscription_plan
FROM stripe_subscriptions ss
WHERE up.id = ss.user_id 
  AND ss.status = 'active'
  AND up.subscription_plan != ss.plan_name;
```

