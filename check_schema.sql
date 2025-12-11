-- Check users table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users';

-- Check intervals_connections table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'intervals_connections';

-- Check RLS policies on users
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'users';
