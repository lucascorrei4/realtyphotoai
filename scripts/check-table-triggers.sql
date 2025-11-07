-- Check for triggers on stripe_subscriptions table
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'stripe_subscriptions';

-- Check table constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'stripe_subscriptions'::regclass;

-- Check actual columns
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'stripe_subscriptions'
ORDER BY ordinal_position;

