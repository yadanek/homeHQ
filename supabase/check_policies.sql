-- Check RLS status and policies for family_members table

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'family_members';

-- 2. List all policies on family_members
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'family_members';

-- 3. Check ALL auth.users raw_app_meta_data
SELECT 
  id,
  email,
  raw_app_meta_data,
  raw_app_meta_data->>'family_id' as family_id_in_db
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check ALL profiles
SELECT 
  id,
  family_id,
  role,
  display_name,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- 5. Test policy manually
SELECT 
  auth.jwt() ->> 'family_id' as jwt_family_id,
  auth.uid() as current_user_id;
