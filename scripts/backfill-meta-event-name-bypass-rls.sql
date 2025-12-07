-- Backfill meta_event_name - Bypass RLS version
-- Use this if the regular script doesn't work due to RLS policies
-- Run this as the postgres role

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
  END IF;
END $$;

-- Step 2: Temporarily disable RLS for the update (if enabled)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 3: Perform updates
UPDATE user_profiles
SET 
  meta_event_name = 'CompleteRegistration',
  updated_at = NOW()
WHERE total_generations > 0
  AND (meta_event_name IS NULL OR meta_event_name != 'CompleteRegistration');

UPDATE user_profiles
SET 
  meta_event_name = 'Lead',
  updated_at = NOW()
WHERE total_generations = 0
  AND meta_event_name IS NULL;

-- Step 4: Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify results
SELECT 
  meta_event_name,
  COUNT(*) as user_count,
  SUM(total_generations) as total_generations_sum
FROM user_profiles
GROUP BY meta_event_name
ORDER BY meta_event_name;

-- Check for NULLs
SELECT 
  COUNT(*) as remaining_nulls
FROM user_profiles
WHERE meta_event_name IS NULL;

