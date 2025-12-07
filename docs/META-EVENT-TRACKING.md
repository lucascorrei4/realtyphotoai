# Meta Event Tracking Implementation

## Overview

This implementation tracks Meta conversion events using a state-based approach with a `meta_event_name` field in the `user_profiles` table. This ensures reliable tracking of the Lead → CompleteRegistration conversion flow.

## Database Changes

### 1. Add `meta_event_name` Column

Run the SQL migration to add the column:

```sql
-- File: scripts/add-meta-event-name-to-user-profiles.sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS meta_event_name TEXT;

COMMENT ON COLUMN user_profiles.meta_event_name IS 'Tracks Meta conversion event state: Lead (email entered) or CompleteRegistration (OTP confirmed)';

CREATE INDEX IF NOT EXISTS idx_user_profiles_meta_event_name ON user_profiles(meta_event_name);
```

### 2. Update `create_user_profile` Function

Update the RPC function to include `meta_event_name`:

```sql
-- File: scripts/update-create-user-profile-function.sql
-- Run this in Supabase SQL Editor
```

## How It Works

### Flow

1. **User Enters Email** (`sendAuthCode`):
   - Backend checks if `meta_event_name` is null or not set
   - If new user, sends `Lead` event to N8N webhook
   - Sets `meta_event_name = 'Lead'` in database

2. **User Confirms OTP** (`verifyCode` or `checkAndSendCompleteRegistration`):
   - Backend checks if `meta_event_name === 'Lead'` or `null`
   - If true, sends `CompleteRegistration` event to N8N webhook
   - Updates `meta_event_name = 'CompleteRegistration'` in database

### State Values

- `null`: Profile created but email not yet entered (initial state)
- `'Lead'`: Email entered, Lead event sent, waiting for OTP confirmation
- `'CompleteRegistration'`: OTP confirmed, CompleteRegistration event sent

## Code Changes

### Backend

- **`src/services/authService.ts`**:
  - `sendAuthCode()`: Sets `meta_event_name = 'Lead'` and sends Lead event
  - `verifyCode()`: Checks `meta_event_name`, sends CompleteRegistration if needed
  - `checkAndSendCompleteRegistration()`: Same logic for Supabase OTP flow

- **`src/middleware/authMiddleware.ts`**:
  - Updated profile creation to include `meta_event_name: null`

### Frontend

- **`frontend/src/contexts/AuthContext.tsx`**:
  - Updated `User` interface to include `meta_event_name`
  - Calls `/complete-registration` endpoint after Supabase OTP verification

## Benefits

1. **Reliable State Tracking**: No time-based heuristics, uses explicit state
2. **Idempotent**: Won't send duplicate events (checks state before sending)
3. **Traceable**: Can see conversion state in database
4. **Debuggable**: Easy to check which users are at which stage

## Testing

1. **New User Signup**:
   - Enter email → Check `meta_event_name = 'Lead'` in database
   - Verify Lead event sent to webhook
   - Confirm OTP → Check `meta_event_name = 'CompleteRegistration'`
   - Verify CompleteRegistration event sent to webhook

2. **Existing User Login**:
   - Enter email → No Lead event (already sent)
   - Confirm OTP → No CompleteRegistration event (already sent)

## Migration Steps

1. Run `scripts/add-meta-event-name-to-user-profiles.sql` in Supabase SQL Editor
2. Run `scripts/update-create-user-profile-function.sql` in Supabase SQL Editor
3. Deploy backend code changes
4. Deploy frontend code changes
5. Test with a new user signup

## Notes

- The webhook is only invoked when `meta_event_name` transitions to `'CompleteRegistration'`
- Events are sent asynchronously (fire-and-forget) and won't block user flow
- All state transitions are logged for debugging

