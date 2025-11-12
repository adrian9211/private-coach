-- Comprehensive fix: Change all numeric columns to proper NUMERIC types
-- PostgreSQL-compatible syntax (one column at a time)

-- Power metrics
ALTER TABLE activities DROP COLUMN IF EXISTS max_power;
ALTER TABLE activities DROP COLUMN IF EXISTS normalized_power;
ALTER TABLE activities DROP COLUMN IF EXISTS tss;
ALTER TABLE activities DROP COLUMN IF EXISTS work_kj;
ALTER TABLE activities DROP COLUMN IF EXISTS work_above_ftp_kj;
ALTER TABLE activities DROP COLUMN IF EXISTS max_wbal_depletion;

ALTER TABLE activities 
  ADD COLUMN max_power NUMERIC(6,1),
  ADD COLUMN normalized_power NUMERIC(6,1),
  ADD COLUMN tss NUMERIC(6,1),
  ADD COLUMN work_kj NUMERIC(8,2),
  ADD COLUMN work_above_ftp_kj NUMERIC(8,2),
  ADD COLUMN max_wbal_depletion NUMERIC(8,1);

-- Power model
ALTER TABLE activities DROP COLUMN IF EXISTS cp;
ALTER TABLE activities DROP COLUMN IF EXISTS w_prime;
ALTER TABLE activities DROP COLUMN IF EXISTS p_max;
ALTER TABLE activities DROP COLUMN IF EXISTS estimated_ftp;
ALTER TABLE activities DROP COLUMN IF EXISTS ftp_at_time;

ALTER TABLE activities
  ADD COLUMN cp NUMERIC(6,1),
  ADD COLUMN w_prime NUMERIC(8,1),
  ADD COLUMN p_max NUMERIC(6,1),
  ADD COLUMN estimated_ftp NUMERIC(6,1),
  ADD COLUMN ftp_at_time NUMERIC(6,1);

-- Rolling power
ALTER TABLE activities DROP COLUMN IF EXISTS rolling_cp;
ALTER TABLE activities DROP COLUMN IF EXISTS rolling_w_prime;
ALTER TABLE activities DROP COLUMN IF EXISTS rolling_p_max;
ALTER TABLE activities DROP COLUMN IF EXISTS rolling_ftp;
ALTER TABLE activities DROP COLUMN IF EXISTS rolling_ftp_delta;

ALTER TABLE activities
  ADD COLUMN rolling_cp NUMERIC(6,1),
  ADD COLUMN rolling_w_prime NUMERIC(8,1),
  ADD COLUMN rolling_p_max NUMERIC(6,1),
  ADD COLUMN rolling_ftp NUMERIC(6,1),
  ADD COLUMN rolling_ftp_delta NUMERIC(6,1);

-- Training load
ALTER TABLE activities DROP COLUMN IF EXISTS hr_load;
ALTER TABLE activities DROP COLUMN IF EXISTS power_load;

ALTER TABLE activities
  ADD COLUMN hr_load NUMERIC(6,1),
  ADD COLUMN power_load NUMERIC(6,1);

-- Energy
ALTER TABLE activities DROP COLUMN IF EXISTS calories;
ALTER TABLE activities DROP COLUMN IF EXISTS carbs_used;
ALTER TABLE activities DROP COLUMN IF EXISTS carbs_ingested;

ALTER TABLE activities
  ADD COLUMN calories NUMERIC(6,1),
  ADD COLUMN carbs_used NUMERIC(6,1),
  ADD COLUMN carbs_ingested NUMERIC(6,1);

-- Cadence
ALTER TABLE activities DROP COLUMN IF EXISTS avg_cadence;
ALTER TABLE activities ADD COLUMN avg_cadence NUMERIC(6,2);

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  numeric_precision, 
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'activities'
  AND column_name IN ('max_power', 'tss', 'cp', 'w_prime', 'hr_load', 'calories', 'avg_cadence')
ORDER BY column_name;

