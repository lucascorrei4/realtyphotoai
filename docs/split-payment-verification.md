# Split Payment Verification Guide

## Split Payment Configuration

Current split percentages:
- **Partner 1**: 46% of net amount (after Stripe fees)
- **Partner 2**: 46% of net amount (after Stripe fees)
- **Agency**: 8% of net amount (after Stripe fees)
- **Platform**: Keeps Stripe fees (2.9% + $0.30)

**Total**: 100% of net amount + Stripe fees = 100% of gross amount

## How It Works

1. **Payment Received**: Customer pays $X.XX
2. **Stripe Fees Deducted**: 2.9% + $0.30
3. **Net Amount Calculated**: Gross - Stripe Fees
4. **Split Distribution**: Net amount split among partners (46%, 46%, 8%)
5. **Platform Keeps**: Stripe fees to cover platform costs

## Example Calculation: $49.90 Subscription

```
Gross Amount: $49.90 (4,990 cents)

Stripe Fees:
  - 2.9% of $49.90 = $1.45
  - Fixed fee = $0.30
  - Total Fees = $1.75 (175 cents)

Net Amount: $48.15 (4,815 cents)

Split Distribution:
  - Partner 1 (46%): $22.15 (2,215 cents)
  - Partner 2 (46%): $22.15 (2,215 cents)
  - Agency (8%): $3.85 (385 cents)
  - Platform (fees): $1.75 (175 cents)

Total: $49.90 ✅
```

## Verification Steps

### 1. Check Split Payment Logic

Run the verification script:
```bash
npx ts-node scripts/verify-split-payment.ts
```

### 2. Check Database State

Run the SQL queries in `scripts/verify-database-state.sql` in Supabase SQL Editor:

**Key Checks:**
- ✅ All plans have `stripe_product_id` and `stripe_price_id`
- ✅ User profiles match subscription records
- ✅ Active subscriptions are properly linked
- ✅ Webhook events are being processed

### 3. Verify Stripe Configuration

Check `.env` file has:
```
STRIPE_PARTNER1_ACCOUNT_ID=acct_1SNyLrHFogG8IuIU
STRIPE_PARTNER2_ACCOUNT_ID=acct_1SNyd1QZLhrenJkp
STRIPE_AGENCY_ACCOUNT_ID=acct_1SGjNgHPF35oYxpn
```

### 4. Test Split Payment Flow

1. Create a test subscription
2. Check webhook logs for `invoice.payment_succeeded`
3. Verify `processSplitPayment` is called
4. Check Stripe Dashboard for transfers to connected accounts

## Database Verification Queries

See `scripts/verify-database-state.sql` for complete queries.

**Quick Check:**
```sql
-- Check if plans have Stripe IDs
SELECT plan_name, stripe_product_id, stripe_price_id 
FROM plan_rules 
WHERE is_active = true;

-- Check subscription status
SELECT plan_name, status, COUNT(*) 
FROM stripe_subscriptions 
GROUP BY plan_name, status;

-- Check user plan alignment
SELECT 
  up.subscription_plan as user_plan,
  ss.plan_name as subscription_plan,
  COUNT(*) as count
FROM user_profiles up
LEFT JOIN stripe_subscriptions ss ON up.id = ss.user_id AND ss.status = 'active'
WHERE up.subscription_plan != 'free'
GROUP BY up.subscription_plan, ss.plan_name;
```

## Split Payment Percentages

Based on current configuration:
- Partner 1: **46%** of net (after Stripe fees)
- Partner 2: **46%** of net (after Stripe fees)
- Agency: **8%** of net (after Stripe fees)
- Platform: **Stripe fees** (varies by amount, ~3.5% for $49.90)

**Note**: Partners share the cost of Stripe fees since splits are calculated from net amount.

