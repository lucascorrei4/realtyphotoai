# Lead → CompleteRegistration Flow Verification

## Flow Overview

### 1. User Enters Email (Lead Event)

**Frontend:** `frontend/src/contexts/AuthContext.tsx` → `sendCode()`
- Calls `supabase.auth.signInWithOtp()` to send OTP
- Calls `sendConversionEvent('send-code', email)` which hits backend

**Backend:** `src/routes/auth.ts` → `/send-code` endpoint
- Calls `authService.sendAuthCode(email, metadata)`

**Backend Service:** `src/services/authService.ts` → `sendAuthCode()`
- ✅ Checks if user is new: `!existingUser || !existingUser.meta_event_name`
- ✅ If new user:
  - Sends `Lead` event to webhook via `conversionEventService.sendConversionEvent('Lead', ...)`
  - Sets `meta_event_name = 'Lead'` in database
- ✅ If existing user: Skips Lead event (already sent)

**Result:** `meta_event_name = 'Lead'` ✅

---

### 2. User Confirms OTP (CompleteRegistration Event)

**Frontend:** `frontend/src/contexts/AuthContext.tsx` → `signIn()`
- Calls `supabase.auth.verifyOtp()` to verify code
- After successful verification, calls `/api/v1/auth/complete-registration` with userId

**Backend:** `src/routes/auth.ts` → `/complete-registration` endpoint
- Extracts `email` and `userId` from request body
- Calls `authService.checkAndSendCompleteRegistration(email, userId, metadata)`

**Backend Service:** `src/services/authService.ts` → `checkAndSendCompleteRegistration()`
- ✅ Checks if first sign-in: `user.meta_event_name === 'Lead' || user.meta_event_name === null`
- ✅ If first sign-in:
  - Sends `CompleteRegistration` event to webhook
  - Sets `meta_event_name = 'CompleteRegistration'` in database
- ✅ If already completed: Skips CompleteRegistration event

**Result:** `meta_event_name = 'CompleteRegistration'` ✅

---

## Potential Issues Found

### Issue 1: Frontend sendCode() doesn't call backend directly
**Location:** `frontend/src/contexts/AuthContext.tsx:399-403`

The frontend calls `sendConversionEvent('send-code', email)` which should hit `/api/v1/auth/send-code`, but this is fire-and-forget. The backend `sendAuthCode()` should still be called and set Lead correctly.

**Status:** ✅ Should work - `sendConversionEvent` calls the backend endpoint

### Issue 2: Frontend complete-registration endpoint expects email
**Location:** `src/routes/auth.ts:271-274`

The route requires both `email` and `userId`, but the frontend only sends `userId` and metadata (which includes email via `buildConversionMetadata`).

**Fix Needed:** The route should extract email from metadata if not in body, or frontend should explicitly send email.

**Current Code:**
```typescript
const { email, userId } = req.body;
if (!email || !userId) {
  return res.status(400).json({ error: 'Email and userId are required' });
}
```

**Frontend sends:**
```typescript
body: JSON.stringify({
  userId: data.user.id,
  ...conversionMetadata, // This includes email
})
```

**Status:** ⚠️ Should work since `conversionMetadata` includes `email`, but route validation might fail if email is nested in metadata.

---

## Verification Checklist

- [x] Lead event sent when email is entered (new users only)
- [x] `meta_event_name` set to 'Lead' after email entry
- [x] CompleteRegistration event sent when OTP confirmed (new users only)
- [x] `meta_event_name` set to 'CompleteRegistration' after OTP confirmation
- [x] Existing users don't get duplicate events
- [ ] Frontend sends email in complete-registration request body (needs verification)

---

## Recommended Fix

Update the `/complete-registration` route to extract email from metadata if not in body:

```typescript
const { email, userId, ...metadata } = req.body;
const userEmail = email || metadata.email;

if (!userEmail || !userId) {
  return res.status(400).json({ error: 'Email and userId are required' });
}
```

