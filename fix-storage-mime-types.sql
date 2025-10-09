-- Update storage bucket to allow FIT file MIME types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/octet-stream', 
  'application/fit', 
  'application/vnd.ant.fit',
  'application/gpx+xml', 
  'application/tcx+xml',
  'application/x-fit',
  'application/x-garmin-fit'
]
WHERE id = 'activity-files';
