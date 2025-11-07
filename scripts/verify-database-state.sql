-- Verification queries to check database state
-- Run these in Supabase SQL Editor

-- 1. Check all plans in plan_rules table
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

-- 2. Check Stripe products and prices match
SELECT 
  pr.plan_name,
  pr.display_name,
  pr.price_per_month,
  pr.stripe_product_id,
  pr.stripe_price_id,
  pr.stripe_yearly_price_id,
  CASE 
    WHEN pr.stripe_product_id IS NULL THEN '❌ Missing Product ID'
    ELSE '✅ Has Product ID'
  END as product_status,
  CASE 
    WHEN pr.stripe_price_id IS NULL THEN '❌ Missing Monthly Price ID'
    ELSE '✅ Has Monthly Price ID'
  END as monthly_price_status,
  CASE 
    WHEN pr.stripe_yearly_price_id IS NULL THEN '⚠️ No Yearly Price ID'
    ELSE '✅ Has Yearly Price ID'
  END as yearly_price_status
FROM plan_rules pr
WHERE pr.is_active = true
ORDER BY pr.price_per_month ASC;

-- 3. Check active subscriptions
SELECT 
  ss.id,
  ss.user_id,
  ss.stripe_subscription_id,
  ss.plan_name,
  ss.status,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  up.email,
  up.subscription_plan as user_plan,
  ss.created_at
FROM stripe_subscriptions ss
LEFT JOIN user_profiles up ON ss.user_id = up.id
WHERE ss.status = 'active'
ORDER BY ss.created_at DESC;

-- 4. Check user profiles with subscriptions
SELECT 
  up.id,
  up.email,
  up.subscription_plan,
  up.monthly_generations_limit,
  up.stripe_customer_id,
  ss.stripe_subscription_id,
  ss.plan_name as subscription_plan_name,
  ss.status as subscription_status,
  CASE 
    WHEN up.subscription_plan != ss.plan_name THEN '⚠️ Plan Mismatch'
    WHEN ss.id IS NULL THEN '❌ No Subscription Record'
    ELSE '✅ Match'
  END as status_check
FROM user_profiles up
LEFT JOIN stripe_subscriptions ss ON up.id = ss.user_id AND ss.status = 'active'
WHERE up.subscription_plan != 'free'
ORDER BY up.updated_at DESC;

-- 5. Check recent webhook events
SELECT 
  stripe_event_id,
  event_type,
  processed,
  created_at
FROM stripe_webhook_events
ORDER BY created_at DESC
LIMIT 20;

-- 6. Summary statistics
SELECT 
  COUNT(*) FILTER (WHERE subscription_plan = 'free') as free_users,
  COUNT(*) FILTER (WHERE subscription_plan = 'basic') as basic_users,
  COUNT(*) FILTER (WHERE subscription_plan = 'premium') as premium_users,
  COUNT(*) FILTER (WHERE subscription_plan = 'enterprise') as enterprise_users,
  COUNT(*) FILTER (WHERE subscription_plan = 'ultra') as ultra_users,
  COUNT(*) FILTER (WHERE stripe_customer_id IS NOT NULL) as users_with_stripe_id,
  COUNT(*) as total_users
FROM user_profiles
WHERE is_active = true;

-- 7. Check subscription status distribution
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM stripe_subscriptions
GROUP BY status
ORDER BY count DESC;

