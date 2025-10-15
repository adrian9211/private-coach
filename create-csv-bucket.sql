-- Create a separate bucket for CSV files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-csv-files',
  'activity-csv-files',
  false,
  10485760, -- 10MB limit
  ARRAY['text/csv', 'application/csv']
);

-- Enable RLS for the CSV bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own CSV files
CREATE POLICY "Users can access their own CSV files" ON storage.objects
FOR ALL USING (
  bucket_id = 'activity-csv-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for service role to manage CSV files
CREATE POLICY "Service role can manage CSV files" ON storage.objects
FOR ALL USING (
  bucket_id = 'activity-csv-files' AND
  auth.role() = 'service_role'
);
