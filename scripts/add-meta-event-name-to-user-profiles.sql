-- Add meta_event_name column to user_profiles table
-- This tracks the Meta conversion event state: 'Lead' when email is entered, 'CompleteRegistration' when OTP is confirmed

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS meta_event_name TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN user_profiles.meta_event_name IS 'Tracks Meta conversion event state: Lead (email entered) or CompleteRegistration (OTP confirmed)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_meta_event_name ON user_profiles(meta_event_name);

