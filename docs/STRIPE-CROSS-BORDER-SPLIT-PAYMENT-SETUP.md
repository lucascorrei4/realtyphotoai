# Stripe Cross-Border Split Payment Setup Guide

## Overview

This guide explains how to set up automatic split payments between:
- **US Platform** (Main Account - 46%)
- **BR Partner 1** (Connected Account - 46%)
- **BR Partner 2** (Connected Account - 8%)

## Architecture: Separate Charges & Transfers

We use **Separate Charges & Transfers** which allows:
- Single charge on US platform (normal subscription)
- Multiple transfers to connected accounts after payment
- Automatic processing via webhooks

## ⚠️ CRITICAL PREREQUISITE: Account Types

### ⚠️ Account Types Must Be Express or Custom (NOT Standard)

**CRITICAL**: Standard accounts **CANNOT** receive platform-initiated transfers!

Your current account types:
- **Partner 1**: Standard ❌ (MUST upgrade to Express/Custom)
- **Partner 2**: Standard ❌ (MUST upgrade to Express/Custom)
- **Agency**: Standard ❌ (MUST upgrade to Express/Custom)

**Why This Matters**:
- The Separate Charges & Transfers approach requires Express or Custom accounts
- Standard accounts can only receive funds through their own payout schedules
- Platform-initiated transfers will fail for Standard accounts

**Action Required**: 
- See `docs/STANDARD-ACCOUNTS-LIMITATION.md` for detailed upgrade instructions
- Run `npx ts-node scripts/verify-account-types.ts` to verify account types
- Contact partners to upgrade their accounts before proceeding

## Prerequisites Checklist

### 1. ✅ Verify Connected Account Types (REQUIRED FIRST)

All partner accounts must be **Express** or **Custom** (NOT Standard).

- **Partner 1 Account**: `acct_1SNyLrHFogG8IuIU` - Must be Express/Custom ⚠️
- **Partner 2 Account**: `acct_1SNyd1QZLhrenJkp` - Must be Express/Custom ⚠️
- **Agency Account**: `acct_1SGjNgHPF35oYxpn` - Must be Express/Custom ⚠️
- **Check**: Stripe Dashboard → Connect → Accounts → Account Type
- **Verify**: Run `npx ts-node scripts/verify-account-types.ts`

### 2. Enable Cross-border Payouts on US Platform

**Required**: The US platform must have Cross-border Payouts enabled to send funds to BR accounts.

- **How to enable**: Contact Stripe Support or enable via Dashboard
- **Link**: https://stripe.com/docs/connect/cross-border-payouts
- **Status**: ❌ **MUST BE ENABLED** (Currently likely disabled - this is why transfers fail)
- **Note**: This is secondary to account type upgrade - transfers will fail for Standard accounts even if enabled

### 3. Verify Transfer Capabilities

Each BR account must have:
- ✅ **Transfers capability enabled**
- ✅ **Local payout setup completed** (bank account verified)
- ✅ **Account verified** (KYC completed)

### 4. Currency Setup

- **Charge Currency**: USD (default)
- **Transfer Currency**: USD (can be converted to BRL during payout)
- **Payouts**: Follow BR rules/minimums for BRL bank transfers

## Implementation Flow

### Step 1: Subscription Charge

```
Customer subscribes → Stripe creates subscription → Invoice created → Customer pays
```

### Step 2: Webhook Processing

On `invoice.payment_succeeded`:

1. **Calculate splits** (after Stripe fees):
   - Partner 1 (BR): 46% of net amount
   - Partner 2 (BR): 8% of net amount
   - Platform (US): 46% + Stripe fees (remains in main account)

2. **Create transfers**:
   ```typescript
   POST /v1/transfers
   {
     amount: partner1Amount, // in cents
     currency: 'usd',
     destination: 'acct_1SNyLrHFogG8IuIU', // BR Partner 1
     metadata: { subscription_id, invoice_id }
   }

   POST /v1/transfers
   {
     amount: partner2Amount, // in cents
     currency: 'usd',
     destination: 'acct_1SNyd1QZLhrenJkp', // BR Partner 2
     metadata: { subscription_id, invoice_id }
   }
   ```

3. **Store ledger** (for refunds/reversals):
   ```sql
   INSERT INTO transfer_ledger (
     invoice_id,
     subscription_id,
     transfer_1_id,
     transfer_2_id,
     partner1_amount,
     partner2_amount,
     platform_amount
   )
   ```

### Step 3: Handle Refunds/Disputes

On refund/dispute:
1. Retrieve ledger entry for the invoice
2. Create transfer reversals:
   ```typescript
   POST /v1/transfers/{transfer_id}/reversals
   {
     amount: proRataAmount, // Proportional reversal
     metadata: { refund_id, invoice_id }
   }
   ```

## Current Implementation

### Code Location

- **Webhook Handler**: `src/routes/webhooks.ts` → `handlePaymentSucceeded()`
- **Split Payment Service**: `src/services/stripeCheckoutService.ts` → `processSplitPayment()`

### Error Handling

The code handles region restrictions gracefully:
- If Cross-border Payouts not enabled → Logs warning, continues
- If account not Express/Custom → Logs error, continues
- If transfer fails → Logs error with details, continues with other transfers

### Idempotency

- Each transfer uses invoice_id in metadata for idempotency
- Check for existing transfers before creating new ones
- Store transfer IDs in ledger for tracking

## Testing

### Test Flow

1. Create test subscription
2. Trigger `invoice.payment_succeeded` webhook
3. Check Stripe Dashboard → Transfers:
   - ✅ Transfer to Partner 1 account
   - ✅ Transfer to Partner 2 account
4. Check database → `transfer_ledger` table:
   - ✅ Ledger entry created
   - ✅ Transfer IDs stored

### Debugging

If transfers fail:
1. **Check Cross-border Payouts status**:
   - Stripe Dashboard → Settings → Connect → Cross-border Payouts
   - Status should be "Enabled"

2. **Check account types**:
   ```bash
   curl https://api.stripe.com/v1/accounts/acct_1SNyLrHFogG8IuIU \
     -u sk_test_...:
   ```
   Look for `type: "express"` or `type: "custom"`

3. **Check transfer capability**:
   ```bash
   curl https://api.stripe.com/v1/accounts/acct_1SNyLrHFogG8IuIU/capabilities \
     -u sk_test_...:
   ```
   Look for `transfers: { requested: true, status: "active" }`

## Fallback Options

If Cross-border Payouts cannot be enabled:

### Option A: Two-Platform Architecture
- US platform for US customers
- BR platform for BR customers
- Route customers to appropriate Checkout

### Option B: Manual Processing
- Platform keeps all funds
- Manual payouts via Stripe Dashboard
- Requires manual reconciliation

## Support

- **Stripe Support**: https://support.stripe.com
- **Cross-border Payouts Docs**: https://stripe.com/docs/connect/cross-border-payouts
- **Separate Charges & Transfers**: https://stripe.com/docs/connect/separate-charges-and-transfers

