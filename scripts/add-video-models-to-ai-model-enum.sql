-- Add video model types to the ai_model enum
-- Run this in your Supabase SQL editor or database console
-- 
-- IMPORTANT NOTES:
-- 1. These commands CANNOT be run inside a transaction block
-- 2. Run each ALTER TYPE command separately if you encounter errors
-- 3. Supabase uses PostgreSQL 15+, so IF NOT EXISTS is supported
-- 4. If you get "already exists" errors, the values are already added (safe to ignore)

-- First, check current enum values
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'ai_model'
GROUP BY t.typname;

-- Add 'video_veo3_fast' to the ai_model enum
-- This will error if the value already exists, which is safe to ignore
ALTER TYPE ai_model ADD VALUE IF NOT EXISTS 'video_veo3_fast';

-- Add 'video_minimax_director' to the ai_model enum
-- This will error if the value already exists, which is safe to ignore
ALTER TYPE ai_model ADD VALUE IF NOT EXISTS 'video_minimax_director';

-- Verify the new values were added
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'ai_model'
GROUP BY t.typname;

-- If IF NOT EXISTS doesn't work (older PostgreSQL), use this approach:
-- First check if values exist, then add them manually:
-- 
-- Check if video_veo3_fast exists:
-- SELECT EXISTS (
--   SELECT 1 FROM pg_enum 
--   WHERE enumlabel = 'video_veo3_fast' 
--   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ai_model')
-- );
-- 
-- If false, run: ALTER TYPE ai_model ADD VALUE 'video_veo3_fast';
-- 
-- Check if video_minimax_director exists:
-- SELECT EXISTS (
--   SELECT 1 FROM pg_enum 
--   WHERE enumlabel = 'video_minimax_director' 
--   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ai_model')
-- );
-- 
-- If false, run: ALTER TYPE ai_model ADD VALUE 'video_minimax_director';

