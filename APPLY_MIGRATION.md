# Apply Scheduled Workouts Migration

## Quick Method: Supabase SQL Editor

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/otkxverokhbsxrmrxdrx/sql/new

2. **Copy and paste this SQL:**

```sql
-- Create scheduled_workouts table for workout calendar/scheduling
CREATE TABLE IF NOT EXISTS public.scheduled_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  workout_name TEXT NOT NULL, -- Store name even if workout is deleted
  workout_category TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME, -- Optional time of day
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'skipped', 'cancelled')),
  source TEXT DEFAULT 'ai_recommendation' CHECK (source IN ('ai_recommendation', 'manual', 'week_plan')),
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL, -- Link to completed activity if done
  notes TEXT, -- User notes or AI reasoning
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one workout per user per day (can be overridden if needed)
  UNIQUE(user_id, scheduled_date, workout_name)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_user_date ON public.scheduled_workouts(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_status ON public.scheduled_workouts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_workout_id ON public.scheduled_workouts(workout_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_source ON public.scheduled_workouts(source);

-- Enable Row Level Security
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own scheduled workouts
CREATE POLICY IF NOT EXISTS "Users can view own scheduled workouts"
  ON public.scheduled_workouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own scheduled workouts
CREATE POLICY IF NOT EXISTS "Users can insert own scheduled workouts"
  ON public.scheduled_workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own scheduled workouts
CREATE POLICY IF NOT EXISTS "Users can update own scheduled workouts"
  ON public.scheduled_workouts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own scheduled workouts
CREATE POLICY IF NOT EXISTS "Users can delete own scheduled workouts"
  ON public.scheduled_workouts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all scheduled workouts
CREATE POLICY IF NOT EXISTS "Service role can manage scheduled workouts"
  ON public.scheduled_workouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_workouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_scheduled_workouts_updated_at ON public.scheduled_workouts;
CREATE TRIGGER update_scheduled_workouts_updated_at
  BEFORE UPDATE ON public.scheduled_workouts
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_workouts_updated_at();

-- Add comment
COMMENT ON TABLE public.scheduled_workouts IS 'Calendar of scheduled workouts for users, can be AI-recommended or manually added';
COMMENT ON COLUMN public.scheduled_workouts.source IS 'How the workout was scheduled: ai_recommendation (from analysis), manual (user added), week_plan (from weekly plan generation)';
```

3. **Click "Run"** to execute

4. **Verify it worked:**
   ```sql
   SELECT * FROM scheduled_workouts LIMIT 1;
   ```

## Alternative: Using Supabase CLI (After fixing policy conflicts)

If you want to use CLI, first fix the policy conflict in migration `20250101000014_create_user_insights.sql` by adding `IF NOT EXISTS` to policies, then run:

```bash
supabase db push
```

But the SQL Editor method above is faster and easier!

