# Debugging CompleteRegistration Not Being Sent

## Issue
CompleteRegistration event is not being sent after OTP confirmation.

## Debugging Steps

### 1. Check if Lead Event Was Set
Verify that `meta_event_name = 'Lead'` was set when email was entered:

```sql
SELECT id, email, meta_event_name, total_generations, created_at
FROM user_profiles
WHERE email = 'your-test-email@example.com';
```

Expected: `meta_event_name = 'Lead'` for new users

### 2. Check Backend Logs
After confirming OTP, check backend logs for:
- `CompleteRegistration endpoint called: email=..., userId=...`
- `CompleteRegistration check for ...: meta_event_name='...', isFirstSignIn: ...`
- `Sending CompleteRegistration event for ...` (if sent)
- `Skipping CompleteRegistration event for ...` (if skipped)

### 3. Check Frontend Console
After confirming OTP, check browser console for:
- `CompleteRegistration event result: {sent: true/false, isFirstSignIn: true/false}`
- Any error messages

### 4. Common Issues

#### Issue 1: meta_event_name is NULL
**Cause:** Lead event wasn't set when email was entered
**Fix:** Check if `/send-code` endpoint is being called and setting Lead

#### Issue 2: meta_event_name is already 'CompleteRegistration'
**Cause:** Event was already sent (user logged in before)
**Fix:** This is expected behavior - event won't be sent again

#### Issue 3: User profile doesn't exist
**Cause:** Profile wasn't created when email was entered
**Fix:** Check if Supabase `signInWithOtp` is creating the user profile

#### Issue 4: Endpoint not being called
**Cause:** Frontend fetch is failing silently
**Fix:** Check network tab in browser dev tools for the request

### 5. Manual Test Query
Check the user's state in database:

```sql
SELECT 
  id,
  email,
  meta_event_name,
  total_generations,
  created_at,
  updated_at
FROM user_profiles
WHERE email = 'your-test-email@example.com';
```

### 6. Test the Endpoint Directly
You can test the endpoint directly with curl:

```bash
curl -X POST http://localhost:8000/api/v1/auth/complete-registration \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-here",
    "email": "test@example.com"
  }'
```

Check the response and backend logs.

