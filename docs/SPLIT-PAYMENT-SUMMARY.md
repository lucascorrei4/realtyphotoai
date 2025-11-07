# Split Payment Implementation Summary

## ✅ Current Approach: Separate Charges & Transfers

We're using **Separate Charges & Transfers** which is the Stripe-recommended pattern for multi-recipient splits.

### Architecture

1. **Charge happens on US platform** (normal subscription)
2. **On `invoice.payment_succeeded` webhook**: Create transfers to BR connected accounts
3. **Platform keeps**: Partner 1 share (46%) + Stripe fees
4. **Transfers to BR accounts**: Partner 2 (46%) + Agency (8%)

### Code Flow

```
Subscription Created
  ↓
Invoice Created → Webhook: invoice.created (logged only)
  ↓
Customer Pays → Invoice Paid
  ↓
Webhook: invoice.payment_succeeded
  ↓
processSplitPayment()
  ├─ Calculate splits (after Stripe fees)
  ├─ Create transfer to Partner 2 (BR)
  ├─ Create transfer to Agency (BR)
  └─ Log results (Partner 1 stays in main account)
```

### Key Files

- **Webhook Handler**: `src/routes/webhooks.ts` → `handlePaymentSucceeded()`
- **Split Payment Service**: `src/services/stripeCheckoutService.ts` → `processSplitPayment()`
- **Transfer Creation**: `src/services/stripeCheckoutService.ts` → `createTransfer()`

## ⚠️ CRITICAL REQUIREMENTS

### ⚠️ 1. Account Types MUST Be Express or Custom (NOT Standard)

**BLOCKING ISSUE**: Your partner accounts are currently **Standard** type, which **CANNOT** receive platform-initiated transfers!

- ❌ Partner 1: `acct_1SNyLrHFogG8IuIU` - **Standard** (MUST upgrade)
- ❌ Partner 2: `acct_1SNyd1QZLhrenJkp` - **Standard** (MUST upgrade)
- ❌ Agency: `acct_1SGjNgHPF35oYxpn` - **Standard** (MUST upgrade)

**Why This Blocks Split Payments**:
- Standard accounts cannot receive transfers from the platform
- Separate Charges & Transfers requires Express or Custom accounts
- Current implementation will fail until accounts are upgraded

**Action Required**:
1. Contact partners to upgrade accounts to Express or Custom
2. See `docs/STANDARD-ACCOUNTS-LIMITATION.md` for detailed instructions
3. Run `npx ts-node scripts/verify-account-types.ts` to verify after upgrade

**Documentation**: 
- Account Types: https://stripe.com/docs/connect/account-types
- Express Accounts: https://stripe.com/docs/connect/express-accounts
- Custom Accounts: https://stripe.com/docs/connect/custom-accounts

### 2. Enable Cross-border Payouts

**Status**: ❌ **REQUIRED** (likely not enabled - this is why transfers fail)

**How to enable**:
- Contact Stripe Support
- Or enable via Dashboard: Settings → Connect → Cross-border Payouts

**Documentation**: https://stripe.com/docs/connect/cross-border-payouts

**Note**: This requirement is secondary to account type upgrade. Even with Cross-border Payouts enabled, transfers will fail for Standard accounts.

### 3. Verify Transfer Capabilities

Each BR account must have:
- ✅ Transfers capability enabled
- ✅ Local payout setup completed (bank account verified)
- ✅ Account verified (KYC completed)

## 📊 Split Calculation

For a $49.90 payment:

```
Gross Amount: $49.90
Stripe Fees: $1.75 (2.9% + $0.30)
Net Amount: $48.15

Split of Net Amount:
- Partner 1 (46%): $22.15 → Stays in main account ✅
- Partner 2 (46%): $22.15 → Transfer to BR account ⚠️
- Agency (8%): $3.85 → Transfer to BR account ⚠️
- Platform (fees): $1.75 → Stays in main account ✅
```

## 🔧 Error Handling

The code gracefully handles errors:

- **Region restriction** → Logs warning, continues (doesn't fail webhook)
- **Account type invalid** → Logs error, continues
- **Transfer fails** → Logs error with details, continues

**Logs show**:
- ✅ Successful transfers with transfer IDs
- ⚠️ Failed transfers with error codes and solutions
- 📊 Summary of all transfers (success/failure counts)

## 🚀 Next Steps

1. **Enable Cross-border Payouts** (contact Stripe Support)
2. **Verify account types** (must be Express/Custom)
3. **Test with a new subscription**
4. **Check Stripe Dashboard → Transfers** to verify transfers were created
5. **Check logs** for transfer IDs and any errors

## 📝 Notes

- **Partner 1 is the main account** - no transfer needed (funds remain)
- **Partner 2 and Agency** require transfers to BR accounts
- **If Cross-border Payouts not enabled**: Transfers will fail with region restriction errors
- **Partial failures are OK**: Webhook still succeeds, failed transfers can be retried manually

## 🔍 Debugging

If transfers fail, check:

1. **Cross-border Payouts status**: Dashboard → Settings → Connect
2. **Account types**: Dashboard → Connect → Accounts → Account Type
3. **Transfer capabilities**: API call to check capabilities
4. **Logs**: Look for error codes and solution suggestions

## 📚 Documentation

- **Setup Guide**: `docs/STRIPE-CROSS-BORDER-SPLIT-PAYMENT-SETUP.md`
- **Stripe Docs**: https://stripe.com/docs/connect/separate-charges-and-transfers
- **Cross-border Payouts**: https://stripe.com/docs/connect/cross-border-payouts

