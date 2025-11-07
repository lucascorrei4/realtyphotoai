# Recreate stripe_subscriptions Table

## Steps

1. **Drop the existing table in Supabase:**
   - Go to Supabase Dashboard → Table Editor
   - Find `stripe_subscriptions` table
   - Click the three dots menu → Delete table
   - Confirm deletion

2. **Run the recreation script:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `docs/recreate-stripe-subscriptions-table.sql`
   - Click Run

3. **Verify the table was created:**
   ```sql
   SELECT column_name, data_type, udt_name
   FROM information_schema.columns
   WHERE table_name = 'stripe_subscriptions'
   ORDER BY ordinal_position;
   ```
   
   You should see `plan_name` as `text` (not enum).

4. **Test the sync:**
   ```bash
   npx ts-node scripts/sync-subscription-from-stripe.ts
   ```

## What This Fixes

- Removes any triggers that were trying to set `subscription_plan`
- Removes any constraints causing enum casting issues
- Creates a clean table with `plan_name` as TEXT
- Sets up proper indexes and RLS policies
- Ensures the RPC function will work correctly

After recreating the table, the sync should work perfectly!

