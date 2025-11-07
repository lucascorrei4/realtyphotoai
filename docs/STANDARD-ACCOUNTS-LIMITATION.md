# ⚠️ CRITICAL: Standard Accounts Limitation

## The Problem

**Standard accounts CANNOT receive platform-initiated transfers.**

Your partner accounts are **Standard** type:
- Partner 1: Standard account
- Partner 2: Standard account  
- Agency: Standard account

This means the current **Separate Charges & Transfers** implementation **will NOT work** for these accounts.

## Why This Matters

Our current `processSplitPayment()` function attempts to create transfers using:
```typescript
await this.stripe.transfers.create({
  amount: amount,
  currency: 'usd',
  destination: destinationAccountId, // This will FAIL for Standard accounts
  // ...
});
```

**Stripe will reject these transfers** for Standard accounts with an error like:
```
"Account type must be Express or Custom to receive transfers"
```

## Solutions

### ✅ Option 1: Upgrade to Express or Custom Accounts (RECOMMENDED)

**Best Solution**: Upgrade partner accounts from Standard to Express or Custom.

#### Benefits:
- ✅ Platform can initiate transfers automatically
- ✅ Full automatic split payment flow works
- ✅ Cross-border payouts work (with Cross-border Payouts enabled)
- ✅ No manual intervention needed

#### How to Upgrade:

1. **Contact each partner** to upgrade their account:
   - Partner 1: `acct_1SNyLrHFogG8IuIU`
   - Partner 2: `acct_1SNyd1QZLhrenJkp`
   - Agency: `acct_1SGjNgHPF35oYxpn`

2. **Partners need to**:
   - Go to their Stripe Dashboard
   - Complete Express/Custom account onboarding
   - Provide additional business information
   - Add bank account details

3. **Platform needs to**:
   - Update account IDs if they change
   - Verify accounts are Express/Custom type
   - Enable Cross-border Payouts (if not already enabled)

#### Account Type Requirements:
- **Express**: Simplified onboarding, platform can collect requirements
- **Custom**: Full control, platform is responsible for all onboarding

### ⚠️ Option 2: Destination Charges (Limited)

**Works for ONE recipient only** - not suitable for 3-way split.

This approach routes payments directly to a connected account at charge time:
```typescript
// Only ONE destination per charge
await stripe.checkout.sessions.create({
  payment_intent_data: {
    transfer_data: {
      destination: partnerAccountId, // Only ONE account
    },
  },
});
```

**Limitations**:
- ❌ Only supports ONE destination per charge
- ❌ Can't split to multiple accounts automatically
- ❌ Requires creating separate charges for each partner (complex)

### ⚠️ Option 3: Manual Reconciliation

**Not automatic** - requires manual processing.

**Flow**:
1. All funds collect in platform account
2. Platform manually creates transfers (won't work for Standard)
3. Platform manually processes payouts via Stripe Dashboard
4. Partners receive funds through their own payout schedules

**Limitations**:
- ❌ Not automatic
- ❌ Requires manual work every billing cycle
- ❌ Still can't use transfers for Standard accounts
- ❌ No automated split payment

### ❌ Option 4: Two-Platform Architecture

**Complex and not recommended** for this use case.

**Flow**:
- US platform for US customers
- BR platform for BR customers
- Route customers to appropriate platform

**Limitations**:
- ❌ Complex architecture
- ❌ Higher operational overhead
- ❌ Doesn't solve the Standard account issue

## Recommended Path Forward

### Immediate Action Required:

1. **Contact Partners**: Request they upgrade to Express or Custom accounts
   - Explain: "To receive automatic split payments, your Stripe account needs to be upgraded from Standard to Express/Custom."
   - Provide: Links to Stripe's Express/Custom onboarding documentation
   - Timeline: Coordinate upgrade timing

2. **Update Account IDs**: Once upgraded, verify the account IDs remain the same or update `.env`:
   ```env
   STRIPE_PARTNER1_ACCOUNT_ID=acct_xxx
   STRIPE_PARTNER2_ACCOUNT_ID=acct_xxx
   STRIPE_AGENCY_ACCOUNT_ID=acct_xxx
   ```

3. **Verify Account Types**: Use Stripe API to confirm:
   ```typescript
   const account = await stripe.accounts.retrieve(accountId);
   console.log(account.type); // Should be 'express' or 'custom'
   ```

4. **Test Transfers**: Once upgraded, test transfers:
   ```bash
   # Create a test transfer
   curl https://api.stripe.com/v1/transfers \
     -u sk_test_...: \
     -d amount=1000 \
     -d currency=usd \
     -d destination=acct_xxx
   ```

## Current Implementation Status

**Code Status**: ✅ Implemented and ready
**Account Type**: ❌ Standard (blocking issue)
**Next Step**: ⚠️ Upgrade accounts to Express/Custom

## Documentation References

- **Account Types**: https://stripe.com/docs/connect/account-types
- **Upgrading to Express**: https://stripe.com/docs/connect/express-accounts
- **Upgrading to Custom**: https://stripe.com/docs/connect/custom-accounts
- **Transfers to Connected Accounts**: https://stripe.com/docs/connect/separate-charges-and-transfers

## Testing After Upgrade

Once accounts are upgraded:

1. **Verify Account Types**:
   ```bash
   # Check account type
   npx ts-node scripts/verify-account-types.ts
   ```

2. **Test Transfer**:
   ```bash
   # Test small transfer
   npx ts-node scripts/test-transfer.ts
   ```

3. **Test Full Flow**:
   - Create test subscription
   - Wait for `invoice.payment_succeeded` webhook
   - Check logs for transfer IDs
   - Verify transfers in Stripe Dashboard

## Questions for Partners

When requesting upgrade, ask:

1. "Can you upgrade your Stripe account from Standard to Express or Custom?"
2. "What information do you need to complete the upgrade?"
3. "Will your account ID change after upgrade?" (Usually no, but verify)
4. "When can you complete the upgrade?"

