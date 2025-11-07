-- First, check for triggers on stripe_subscriptions table
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'stripe_subscriptions';

-- Check for constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'stripe_subscriptions'::regclass;

-- Check table columns
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

-- If there's a trigger trying to set subscription_plan, we may need to:
-- 1. Drop the trigger temporarily
-- 2. Or update the trigger to handle plan_name correctly
-- 3. Or ensure subscription_plan is set correctly in the function

-- Example: If you find a trigger, you might need to drop it:
-- DROP TRIGGER IF EXISTS trigger_name ON stripe_subscriptions;

