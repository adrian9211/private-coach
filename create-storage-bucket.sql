-- Manual storage bucket creation script
-- Run this in your Supabase SQL editor

-- First, check if the bucket already exists
SELECT * FROM storage.buckets WHERE id = 'activity-files';

-- If it doesn't exist, create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-files',
  'activity-files',
  false,
  52428800, -- 50MB limit
  ARRAY['application/octet-stream', 'application/fit', 'application/gpx+xml', 'application/tcx+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the storage bucket
CREATE POLICY "Users can upload their own activity files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'activity-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own activity files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'activity-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own activity files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'activity-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
