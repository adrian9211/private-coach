-- Complete fix for authentication and upload issues
-- Run this in Supabase SQL Editor

-- 1. Fix RLS policies for users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to insert their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Create policy for users to view their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- Create policy for users to update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Create policy for users to delete their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can delete their own profile'
  ) THEN
    CREATE POLICY "Users can delete their own profile" ON users
    FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;

-- 2. Add additional columns to activities table
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

-- 3. Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_activities_sub_sport ON activities(sub_sport);
CREATE INDEX IF NOT EXISTS idx_activities_processed_at ON activities(processed_at);
CREATE INDEX IF NOT EXISTS idx_activities_gps_track ON activities USING GIN (gps_track);
