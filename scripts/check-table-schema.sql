-- Check stripe_subscriptions table schema
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

-- Check if subscription_plan column exists and its type
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'stripe_subscriptions'
  AND (column_name LIKE '%plan%' OR column_name LIKE '%subscription%');

-- Check all enum types
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('subscription_plan', 'ai_model')
GROUP BY t.typname;

-- Check user_profiles subscription_plan column
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
  AND column_name = 'subscription_plan';

