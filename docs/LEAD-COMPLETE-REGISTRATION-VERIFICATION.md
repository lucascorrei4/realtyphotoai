# Lead → CompleteRegistration Implementation Verification

## ✅ Implementation Summary

The implementation correctly tracks Meta conversion events using a state-based approach with `meta_event_name` field.

---

## Flow Verification

### 1. **User Enters Email → Lead Event** ✅

**Frontend Flow:**
```
User enters email → sendCode() → supabase.auth.signInWithOtp() → sendConversionEvent('send-code', email)
```

**Backend Flow:**
```
POST /api/v1/auth/send-code → authService.sendAuthCode()
  → Checks: !existingUser || !existingUser.meta_event_name
  → If new: Sends Lead event + Sets meta_event_name = 'Lead'
```

**Database State:** `meta_event_name = 'Lead'` ✅

---

### 2. **User Confirms OTP → CompleteRegistration Event** ✅

**Frontend Flow:**
```
User enters OTP → signIn() → supabase.auth.verifyOtp() → POST /api/v1/auth/complete-registration
```

**Backend Flow:**
```
POST /api/v1/auth/complete-registration → authService.checkAndSendCompleteRegistration()
  → Checks: meta_event_name === 'Lead' || meta_event_name === null
  → If first sign-in: Sends CompleteRegistration event + Sets meta_event_name = 'CompleteRegistration'
```

**Database State:** `meta_event_name = 'CompleteRegistration'` ✅

---

## Code Verification

### ✅ Backend Service (`src/services/authService.ts`)

1. **`sendAuthCode()`** - Line 38-119
   - ✅ Checks if new user: `!existingUser || !existingUser.meta_event_name`
   - ✅ Sends Lead event for new users
   - ✅ Sets `meta_event_name = 'Lead'` in database
   - ✅ Skips Lead event for existing users

2. **`verifyCode()`** - Line 124-220
   - ✅ Checks if first sign-in: `meta_event_name === 'Lead' || meta_event_name === null`
   - ✅ Sends CompleteRegistration event for first sign-in
   - ✅ Sets `meta_event_name = 'CompleteRegistration'` in database
   - ✅ Skips CompleteRegistration for existing users

3. **`checkAndSendCompleteRegistration()`** - Line 343-401
   - ✅ Same logic as `verifyCode()` for Supabase OTP flow
   - ✅ Checks `meta_event_name === 'Lead' || meta_event_name === null`
   - ✅ Sends CompleteRegistration and updates state

### ✅ Backend Routes (`src/routes/auth.ts`)

1. **`/send-code`** - Line 133-148
   - ✅ Calls `authService.sendAuthCode()` with metadata
   - ✅ Handles Lead event sending

2. **`/complete-registration`** - Line 269-289
   - ✅ Fixed: Extracts email from body or metadata
   - ✅ Calls `authService.checkAndSendCompleteRegistration()`
   - ✅ Handles CompleteRegistration event sending

### ✅ Frontend (`frontend/src/contexts/AuthContext.tsx`)

1. **`sendCode()`** - Line 364-410
   - ✅ Calls `supabase.auth.signInWithOtp()`
   - ✅ Calls `sendConversionEvent('send-code', email)` → Backend `/send-code`

2. **`signIn()`** - Line 412-560
   - ✅ Calls `supabase.auth.verifyOtp()`
   - ✅ After success, calls `/api/v1/auth/complete-registration` with userId and metadata
   - ✅ Metadata includes email via `buildConversionMetadata(email, userId)`

---

## Edge Cases Handled

### ✅ New User (Profile doesn't exist)
- Lead event sent when email entered
- `meta_event_name` set to 'Lead' when profile is created or updated
- CompleteRegistration sent when OTP confirmed

### ✅ Existing User (Already has meta_event_name)
- Lead event skipped (already sent)
- CompleteRegistration skipped (already sent)

### ✅ User with NULL meta_event_name
- Treated as new user for Lead event
- Treated as first sign-in for CompleteRegistration

### ✅ Profile Created Before Lead Event
- If profile exists but `meta_event_name` is null, Lead event is sent and field is updated

---

## Potential Issues & Fixes

### ✅ Fixed: Email in complete-registration endpoint
**Issue:** Route expected email in body, but frontend sends it in metadata.

**Fix Applied:** Updated route to extract email from body or metadata:
```typescript
const { email, userId, ...metadata } = req.body;
const userEmail = email || metadata.email;
```

---

## Testing Checklist

- [ ] New user signup: Email entered → `meta_event_name = 'Lead'` → Lead event sent
- [ ] New user signup: OTP confirmed → `meta_event_name = 'CompleteRegistration'` → CompleteRegistration event sent
- [ ] Existing user login: Email entered → No Lead event (already sent)
- [ ] Existing user login: OTP confirmed → No CompleteRegistration event (already sent)
- [ ] Backfill script: Users with generations → `meta_event_name = 'CompleteRegistration'`
- [ ] Backfill script: Users without generations → `meta_event_name = 'Lead'`

---

## Database Schema

```sql
ALTER TABLE user_profiles
ADD COLUMN meta_event_name TEXT;

-- Values:
-- NULL: Initial state (profile created, email not entered yet)
-- 'Lead': Email entered, Lead event sent, waiting for OTP confirmation
-- 'CompleteRegistration': OTP confirmed, CompleteRegistration event sent
```

---

## Summary

✅ **Implementation is correct:**
1. Lead event sent when email is entered (new users only)
2. `meta_event_name` set to 'Lead' after email entry
3. CompleteRegistration event sent when OTP confirmed (new users only)
4. `meta_event_name` set to 'CompleteRegistration' after OTP confirmation
5. Existing users don't get duplicate events
6. State-based tracking ensures reliability

The implementation follows the correct flow: **Lead → CompleteRegistration** for new users only.

