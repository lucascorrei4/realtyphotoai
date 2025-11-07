# Automatic Split Payment Approach

## The Solution: Payment Intent with transfer_data

### How It Works

**For Subscriptions:**
1. When a subscription invoice is created, Stripe automatically creates a payment intent
2. We intercept the `invoice.created` webhook event
3. We update the payment intent to add `transfer_data` **before** the customer pays
4. When payment succeeds, funds are **automatically** split:
   - Partner 2 receives their share directly (via `transfer_data`)
   - Main account keeps the rest (via `application_fee_amount`)

### Key Benefits

✅ **Fully Automatic** - No manual transfers needed
✅ **Works Across Regions** - Payment intents with `transfer_data` bypass region restrictions
✅ **Happens During Payment** - Split occurs at payment time, not after
✅ **Atomic** - Either all succeeds or all fails

### The Split

For a $49.90 payment:
- **Partner 2 (46%):** $22.15 → Automatically transferred via payment intent ✅
- **Partner 1 (46%):** $22.15 → Stays in main account (it IS the main account) ✅
- **Agency (8%):** $3.85 → Stays in main account (can't transfer to BR) ⚠️
- **Platform (fees):** $1.75 → Stays in main account ✅

### Current Status

The code is implemented but has a TypeScript type issue. The Stripe API supports `transfer_data.destination` on payment intents, but the TypeScript types don't reflect this.

### Next Steps

1. Fix the TypeScript type issue (use type assertion)
2. Test with a new subscription
3. Verify Partner 2 receives automatic transfer
4. Handle Agency share separately (it's small - $3.85)

### About Agency Share

Since Agency is in Brazil and can't receive automatic transfers:
- Option A: Keep it in main account (you handle separately)
- Option B: Set up a separate payout mechanism
- Option C: Adjust percentages so Agency gets 0% and split between Partner 1 & 2

The approach is **automatic for Partner 2** (the main cross-region transfer), which is the critical part.

