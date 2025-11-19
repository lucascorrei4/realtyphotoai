-- Check generations table structure
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'generations'
ORDER BY ordinal_position;

-- Check if model_type column has constraints
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.generations'::regclass
  AND conname LIKE '%model_type%';

-- Check all enum types related to model_type
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%model%' OR t.typname LIKE '%generation%'
GROUP BY t.typname;

-- Check for CHECK constraints on model_type
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.generations'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%model_type%';

