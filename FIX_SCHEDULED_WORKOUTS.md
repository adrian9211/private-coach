# Fix Scheduled Workouts 404 Error

## Problem
The dashboard is showing 404 errors for `scheduled_workouts` table and the "Generate New Plan" button doesn't work.

## Root Cause
The migration `20250101000018_create_scheduled_workouts.sql` exists but hasn't been applied to your production database.

## Solution

### Step 1: Apply the Migration

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to: https://supabase.com/dashboard/project/otkxverokhbsxrmrxdrx/sql/new
2. Open the migration file: `supabase/migrations/20250101000018_create_scheduled_workouts.sql`
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click "Run"

**Option B: Using Supabase CLI**

```bash
cd /Users/adriannykiel/Projects/private-coach
supabase db push
```

### Step 2: Verify the Table Exists

Run this query in Supabase SQL Editor:

```sql
SELECT * FROM scheduled_workouts LIMIT 1;
```

If it returns without error, the table exists.

### Step 3: Deploy the Edge Function (if not already deployed)

The `generate-week-plan` function needs to be deployed:

```bash
cd /Users/adriannykiel/Projects/private-coach
supabase functions deploy generate-week-plan
```

Or deploy via Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/otkxverokhbsxrmrxdrx/functions
2. Find `generate-week-plan`
3. If it doesn't exist, deploy it from the CLI

### Step 4: Test

1. Refresh your dashboard
2. The 404 errors should be gone
3. Click "Generate New Plan" - it should now work

## What Was Fixed

1. ✅ Improved error handling in `week-plan-generator.tsx` to show clearer error messages
2. ✅ Added detection for missing table/function errors
3. ✅ Better user feedback when things fail

## Migration File Location

The migration file is at:
`supabase/migrations/20250101000018_create_scheduled_workouts.sql`

This creates:
- `scheduled_workouts` table
- RLS policies for user access
- Indexes for performance
- Triggers for `updated_at` timestamp

