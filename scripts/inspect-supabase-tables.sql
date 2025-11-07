-- Inspect stripe_subscriptions table structure
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'stripe_subscriptions'
ORDER BY ordinal_position;

-- Check if there's a subscription_plan column (enum) vs plan_name (text)
SELECT 
  column_name,
  data_type,
  udt_name,
  CASE 
    WHEN udt_name = 'subscription_plan' THEN 'ENUM'
    WHEN data_type = 'text' THEN 'TEXT'
    ELSE data_type
  END as column_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'stripe_subscriptions'
  AND (column_name LIKE '%plan%' OR column_name LIKE '%subscription%')
ORDER BY column_name;

-- Check all columns in stripe_subscriptions
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'stripe_subscriptions';

-- Check user_profiles subscription_plan column
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
  AND column_name = 'subscription_plan';

-- Check plan_rules table structure
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'plan_rules'
ORDER BY ordinal_position;

