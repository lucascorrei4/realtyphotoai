# Stripe Region Limitation for Split Payments

## Problem

Stripe Connect **transfers** cannot be sent to connected accounts in different countries/regions than your platform account. 

**Error:** "Funds can't be sent to accounts located in BR because it's restricted outside of your platform's region"

## Current Setup

- **Main Account (Partner 1):** `acct_1SGjNgHPF35oYxpn` (your platform account)
- **Partner 2:** `acct_1SNyLrHFogG8IuIU` (Brazil - BR)
- **Agency:** `acct_1SNyd1QZLhrenJkp` (Brazil - BR)

## Solutions

### Option 1: Use Destination Charges (Recommended)

Instead of collecting payment and then transferring, use **destination charges** where funds go directly to connected accounts during checkout.

**Pros:**
- ✅ Works across regions
- ✅ Automatic split at payment time
- ✅ No transfer fees
- ✅ Simpler flow

**Cons:**
- ⚠️ Requires updating checkout session creation
- ⚠️ Partners receive funds directly (you don't collect first)

### Option 2: Use Application Fees

Use Stripe Connect with **application fees** where you collect the full amount and charge an application fee to connected accounts.

**Pros:**
- ✅ You collect full payment
- ✅ Partners pay you a fee (reversed model)
- ✅ Works across regions

**Cons:**
- ⚠️ Different business model (partners pay you, not you pay them)

### Option 3: Manual Payouts

Collect all payments to your account and manually send payouts to partners via bank transfers or other methods.

**Pros:**
- ✅ Full control
- ✅ No Stripe limitations

**Cons:**
- ⚠️ Manual process
- ⚠️ Not automated

## Recommended: Destination Charges

I can update the code to use destination charges. This means:
- Partner 2 and Agency receive their shares directly at checkout
- Main account (Partner 1) receives their share + platform fees
- All happens automatically during payment

Would you like me to implement destination charges?

