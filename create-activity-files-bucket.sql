-- Check if activity-files bucket exists and create it if not
-- Run this in Supabase SQL Editor

-- Check existing buckets
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'activity-files';

-- If the above returns no rows, create the bucket:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-files',
  'activity-files',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/octet-stream', 
    'application/vnd.ant.fit',
    'application/fit',
    'application/x-fit',
    'application/x-garmin-fit',
    'application/gpx+xml', 
    'application/tcx+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY IF NOT EXISTS "Users can upload their own activity files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'activity-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "Users can view their own activity files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'activity-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "Users can delete their own activity files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'activity-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
