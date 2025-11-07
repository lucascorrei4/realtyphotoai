# Transfers vs Destination Charges - Key Differences

## Current Approach: Transfers (Manual)

**How it works:**
1. Customer pays $49.90 → **All goes to your main account**
2. Payment succeeds → Webhook triggers
3. Your code calculates split amounts
4. Your code **manually creates transfers** to partners
5. Partners receive funds (if transfers succeed)

**Timeline:**
```
Payment → Your Account ($49.90) → [Webhook] → Calculate Split → Transfer to Partners
```

**Problems:**
- ❌ Requires webhook processing
- ❌ Manual step (your code must run)
- ❌ Region restrictions (can't transfer to BR)
- ❌ If webhook fails, split doesn't happen
- ❌ Transfers can fail independently

## Destination Charges (Automatic)

**How it works:**
1. Customer pays $49.90 → **Stripe automatically splits at checkout**
2. Funds go directly to multiple accounts simultaneously
3. No webhook needed for splitting
4. No manual transfers required

**Timeline:**
```
Payment → Automatically Split → Partner 2 ($22.15) + Agency ($3.85) + Your Account ($23.90)
```

**Benefits:**
- ✅ **Fully automatic** - happens during payment
- ✅ **No webhook dependency** for splitting
- ✅ **Works across regions** (no BR restriction)
- ✅ **Atomic** - either all succeed or all fail
- ✅ **Simpler code** - no transfer logic needed

## Visual Comparison

### Transfers (Current):
```
Customer Payment: $49.90
    ↓
Your Account: $49.90 (all funds)
    ↓
[Webhook: invoice.payment_succeeded]
    ↓
Your Code: Calculate split
    ↓
Your Code: Create transfer to Partner 2 ($22.15)
Your Code: Create transfer to Agency ($3.85)
    ↓
Partner 2 Account: $22.15
Agency Account: $3.85
Your Account: $23.90 (remaining)
```

### Destination Charges (Proposed):
```
Customer Payment: $49.90
    ↓
Stripe Automatically Splits:
    ├─ Partner 2 Account: $22.15 (direct)
    ├─ Agency Account: $3.85 (direct)
    └─ Your Account: $23.90 (direct)
    
[All happens in one transaction - automatic!]
```

## Key Difference

**Transfers = "Collect first, then distribute"** (manual, after payment)
**Destination Charges = "Split at payment time"** (automatic, during payment)

## Implementation

With destination charges, the checkout session would specify:
- Payment amount: $49.90
- Partner 2 receives: $22.15 (directly)
- Agency receives: $3.85 (directly)
- You receive: $23.90 (directly)

All happens in **one atomic transaction** - no separate transfer step needed!

