-- Apply the migration manually via Supabase SQL Editor
-- Add additional columns inferred from decoded CSVs (sessions/summary/metadata)
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS sub_sport TEXT,
  ADD COLUMN IF NOT EXISTS total_elapsed_time NUMERIC,
  ADD COLUMN IF NOT EXISTS total_descent INTEGER,
  ADD COLUMN IF NOT EXISTS min_temperature INTEGER,
  ADD COLUMN IF NOT EXISTS max_temperature INTEGER,
  ADD COLUMN IF NOT EXISTS avg_temperature INTEGER,
  ADD COLUMN IF NOT EXISTS processing_method TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS gps_track JSONB;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_activities_sub_sport ON activities(sub_sport);
CREATE INDEX IF NOT EXISTS idx_activities_processed_at ON activities(processed_at);
CREATE INDEX IF NOT EXISTS idx_activities_gps_track ON activities USING GIN (gps_track);
