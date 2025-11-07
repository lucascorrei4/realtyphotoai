# Supabase CLI Setup and Table Inspection Guide

## Install Supabase CLI

### Windows (PowerShell)
```powershell
# Using Scoop (recommended)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase
```

### Alternative: Use Supabase Dashboard
If CLI installation is problematic, you can use the Supabase Dashboard SQL Editor directly.

## Login to Supabase

1. **Get your project reference and access token:**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Go to Settings → API
   - Copy your "Project URL" and "anon/public key"
   - For CLI, you'll need an access token: Settings → Access Tokens

2. **Login via CLI:**
```bash
supabase login
# Follow the prompts to authenticate
```

3. **Link to your project:**
```bash
supabase link --project-ref your-project-ref
```

## Inspect Tables

### Method 1: Using SQL Editor in Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Run the queries from `scripts/inspect-supabase-tables.sql`

### Method 2: Using CLI
```bash
# Connect to database
supabase db connect

# Or use psql directly if you have connection string
psql "your-connection-string"
```

### Method 3: Run SQL Scripts
Copy and paste the SQL from `scripts/inspect-supabase-tables.sql` into the Supabase SQL Editor.

## Key Queries to Run

1. **Check stripe_subscriptions schema:**
```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'stripe_subscriptions';
```

2. **Check if subscription_plan column exists:**
```sql
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_name = 'stripe_subscriptions'
AND column_name LIKE '%plan%';
```

3. **Check all enum types:**
```sql
SELECT t.typname, string_agg(e.enumlabel, ', ')
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'subscription_plan'
GROUP BY t.typname;
```

## Next Steps

After inspecting the schema:
1. If `stripe_subscriptions` has `subscription_plan` (enum) column → Run `docs/fix-stripe-subscriptions-insert.sql`
2. If `stripe_subscriptions` has `plan_name` (text) column → The code should work, but check for other issues
3. Update the code accordingly based on the actual schema

