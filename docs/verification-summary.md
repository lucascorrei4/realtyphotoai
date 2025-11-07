# Payment & Database Verification Summary

## ✅ Split Payment Verification

The split payment calculation has been verified and is working correctly:

### Split Configuration:
- **Partner 1**: 46% of net amount (after Stripe fees)
- **Partner 2**: 46% of net amount (after Stripe fees)  
- **Agency**: 8% of net amount (after Stripe fees)
- **Platform**: Keeps Stripe fees (2.9% + $0.30)

### Example: $49.90 Subscription
```
Gross: $49.90
Stripe Fees: $1.75 (2.9% + $0.30)
Net: $48.15

Distribution:
  Partner 1: $22.15 (46% of net)
  Partner 2: $22.15 (46% of net)
  Agency: $3.85 (8% of net)
  Platform: $1.75 (fees)

Total: $49.90 ✅
```

**All plan prices tested and verified** - totals match exactly.

## 📋 Supabase Verification Checklist

### 1. Check Plan Rules
Run in Supabase SQL Editor:
```sql
SELECT plan_name, display_name, price_per_month, 
       stripe_product_id, stripe_price_id, is_active
FROM plan_rules
WHERE is_active = true
ORDER BY price_per_month;
```

**Verify:**
- ✅ All plans have `stripe_product_id` (not NULL)
- ✅ All plans have `stripe_price_id` (not NULL)
- ✅ Plan names match: `free`, `basic`, `premium`, `enterprise`, `ultra`

### 2. Check User Subscriptions
```sql
SELECT up.email, up.subscription_plan, 
       ss.plan_name, ss.status, ss.stripe_subscription_id
FROM user_profiles up
LEFT JOIN stripe_subscriptions ss ON up.id = ss.user_id AND ss.status = 'active'
WHERE up.subscription_plan != 'free' OR ss.id IS NOT NULL;
```

**Verify:**
- ✅ User `subscription_plan` matches subscription `plan_name`
- ✅ All active subscriptions have `stripe_subscription_id`
- ✅ Users with subscriptions have `stripe_customer_id`

### 3. Check Webhook Processing
```sql
SELECT event_type, processed, created_at
FROM stripe_webhook_events
ORDER BY created_at DESC
LIMIT 20;
```

**Verify:**
- ✅ Recent `checkout.session.completed` events are processed
- ✅ Recent `invoice.payment_succeeded` events are processed
- ✅ Recent `customer.subscription.created` events are processed

### 4. Verify Split Payment Account IDs

Check your `.env` file has:
```
STRIPE_PARTNER1_ACCOUNT_ID=acct_1SNyLrHFogG8IuIU
STRIPE_PARTNER2_ACCOUNT_ID=acct_1SNyd1QZLhrenJkp
STRIPE_AGENCY_ACCOUNT_ID=acct_1SGjNgHPF35oYxpn
```

## 🔍 How to Verify Split Payment Worked

1. **Check Backend Logs**: Look for log entry:
   ```
   Processed split payment for subscription {id}: {
     grossAmount: 49.90,
     partner1: 22.15,
     partner2: 22.15,
     agency: 3.85,
     platformAmount: 1.75,
     stripeFees: 1.75
   }
   ```

2. **Check Stripe Dashboard**: 
   - Go to Transfers section
   - Look for transfers to connected accounts:
     - Partner 1 account: ~$22.15
     - Partner 2 account: ~$22.15
     - Agency account: ~$3.85

3. **Check Webhook Events**:
   - `invoice.payment_succeeded` should trigger `processSplitPayment`
   - Check logs for any errors in split payment processing

## 📊 Quick Database Health Check

Run this comprehensive query:

```sql
-- Complete health check
SELECT 
  'Plans' as check_type,
  COUNT(*) FILTER (WHERE stripe_product_id IS NULL) as issues,
  'Missing product IDs' as description
FROM plan_rules
WHERE is_active = true

UNION ALL

SELECT 
  'Subscriptions',
  COUNT(*) FILTER (WHERE status = 'active' AND plan_name IS NULL),
  'Active subscriptions without plan name'
FROM stripe_subscriptions

UNION ALL

SELECT 
  'User Plans',
  COUNT(*) FILTER (WHERE up.subscription_plan != ss.plan_name),
  'User plan mismatch with subscription'
FROM user_profiles up
LEFT JOIN stripe_subscriptions ss ON up.id = ss.user_id AND ss.status = 'active'
WHERE up.subscription_plan != 'free' OR ss.id IS NOT NULL;
```

## 🛠️ Files Created for Verification

1. **`scripts/verify-split-payment.ts`** - Run to verify split calculations
2. **`scripts/verify-database-state.sql`** - SQL queries for Supabase
3. **`docs/split-payment-verification.md`** - Detailed split payment docs
4. **`docs/supabase-verification-checklist.md`** - Complete verification guide

## ✅ Next Steps

1. Run the SQL queries in Supabase to verify database state
2. Check backend logs for split payment processing
3. Verify Stripe Dashboard shows transfers to connected accounts
4. Test a new subscription purchase to verify end-to-end flow

