-- Backfill meta_event_name based on user activity
-- This script includes comprehensive diagnostics and handles RLS policies

-- Step 1: Ensure the column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'meta_event_name'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN meta_event_name TEXT;
    
    CREATE INDEX IF NOT EXISTS idx_user_profiles_meta_event_name ON user_profiles(meta_event_name);
    
    RAISE NOTICE 'Added meta_event_name column to user_profiles';
  ELSE
    RAISE NOTICE 'meta_event_name column already exists';
  END IF;
END $$;

-- Step 2: Diagnostic - Show current state
SELECT 
  'DIAGNOSTIC: Current state' as info,
  COUNT(*) as total_users,
  COUNT(CASE WHEN meta_event_name IS NULL THEN 1 END) as null_values,
  COUNT(CASE WHEN meta_event_name = 'Lead' THEN 1 END) as lead_count,
  COUNT(CASE WHEN meta_event_name = 'CompleteRegistration' THEN 1 END) as complete_count,
  COUNT(CASE WHEN total_generations > 0 THEN 1 END) as users_with_generations,
  COUNT(CASE WHEN total_generations = 0 THEN 1 END) as users_without_generations
FROM user_profiles;

-- Step 3: Show what will be updated (preview)
SELECT 
  'PREVIEW: Will update to CompleteRegistration' as action,
  COUNT(*) as count
FROM user_profiles
WHERE total_generations > 0
  AND (meta_event_name IS NULL OR meta_event_name != 'CompleteRegistration');

SELECT 
  'PREVIEW: Will update to Lead' as action,
  COUNT(*) as count
FROM user_profiles
WHERE total_generations = 0
  AND meta_event_name IS NULL;

-- Step 4: Show sample rows that will be updated
SELECT 
  'SAMPLE: Users to update to CompleteRegistration' as sample_type,
  id,
  email,
  total_generations,
  meta_event_name as current_value
FROM user_profiles
WHERE total_generations > 0
  AND (meta_event_name IS NULL OR meta_event_name != 'CompleteRegistration')
LIMIT 5;

SELECT 
  'SAMPLE: Users to update to Lead' as sample_type,
  id,
  email,
  total_generations,
  meta_event_name as current_value
FROM user_profiles
WHERE total_generations = 0
  AND meta_event_name IS NULL
LIMIT 5;

-- Step 5: Perform updates (run as postgres role to bypass RLS if needed)
-- Update to CompleteRegistration
UPDATE user_profiles
SET 
  meta_event_name = 'CompleteRegistration',
  updated_at = NOW()
WHERE total_generations > 0
  AND (meta_event_name IS NULL OR meta_event_name != 'CompleteRegistration');

-- Log the update count
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % users to CompleteRegistration', updated_count;
END $$;

-- Update to Lead
UPDATE user_profiles
SET 
  meta_event_name = 'Lead',
  updated_at = NOW()
WHERE total_generations = 0
  AND meta_event_name IS NULL;

-- Log the update count
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % users to Lead', updated_count;
END $$;

-- Step 6: Verify the updates
SELECT 
  'AFTER UPDATE: Final state' as info,
  meta_event_name,
  COUNT(*) as user_count,
  SUM(total_generations) as total_generations_sum,
  MIN(total_generations) as min_generations,
  MAX(total_generations) as max_generations
FROM user_profiles
GROUP BY meta_event_name
ORDER BY meta_event_name;

-- Step 7: Check for any remaining NULL values
SELECT 
  'REMAINING NULL VALUES' as check_type,
  COUNT(*) as count
FROM user_profiles
WHERE meta_event_name IS NULL;

-- Step 8: Show sample of updated rows
SELECT 
  'SAMPLE: Recently updated rows' as sample_type,
  id,
  email,
  total_generations,
  meta_event_name,
  updated_at
FROM user_profiles
ORDER BY updated_at DESC
LIMIT 10;
