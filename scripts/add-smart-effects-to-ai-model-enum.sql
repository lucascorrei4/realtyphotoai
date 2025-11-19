-- Add 'smart_effects' to the ai_model enum type
-- Run this in your Supabase SQL editor or database console

-- First, check current enum values
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'ai_model'
GROUP BY t.typname;

-- Add 'smart_effects' to the ai_model enum
-- Note: In PostgreSQL, you can only ADD new enum values, not remove them easily
-- This command will add 'smart_effects' if it doesn't already exist
ALTER TYPE ai_model ADD VALUE IF NOT EXISTS 'smart_effects';

-- Verify the new value was added
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'ai_model'
GROUP BY t.typname;

