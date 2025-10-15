-- Fix RLS policies for users table
-- Run this in Supabase SQL Editor

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to insert their own profile
CREATE POLICY IF NOT EXISTS "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policy for users to view their own profile
CREATE POLICY IF NOT EXISTS "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Create policy for users to update their own profile
CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create policy for users to delete their own profile
CREATE POLICY IF NOT EXISTS "Users can delete their own profile" ON users
  FOR DELETE USING (auth.uid() = id);
