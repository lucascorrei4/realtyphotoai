-- This script adds 'smart_effects' to the model_type enum if it exists
-- If model_type is NOT an enum (just text/varchar), this script won't be needed

-- First, check if model_type is an enum
-- Run this query to see if it's an enum:
-- SELECT udt_name FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'generations' AND column_name = 'model_type';

-- If model_type is an enum type (e.g., 'ai_model'), add the new value:
-- ALTER TYPE ai_model ADD VALUE IF NOT EXISTS 'smart_effects';

-- If model_type is just text/varchar, no action needed - just insert 'smart_effects' directly

-- To check current enum values:
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN (
  SELECT udt_name FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'generations' 
    AND column_name = 'model_type'
    AND udt_name != 'text' 
    AND udt_name != 'character varying'
)
GROUP BY t.typname;

-- If you found an enum type, add smart_effects to it:
-- Example: ALTER TYPE ai_model ADD VALUE IF NOT EXISTS 'smart_effects';

