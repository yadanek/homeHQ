-- IMPORTANT: Run this query in Supabase SQL Editor
-- This bypasses RLS to see ALL tasks regardless of policies

-- Disable RLS temporarily for this query session
SET LOCAL role TO service_role;

-- Check if tasks have correct family_id
SELECT 
  t.id as task_id,
  t.title as task_title,
  t.family_id as task_family_id,
  t.event_id,
  e.title as event_title,
  e.family_id as event_family_id,
  t.created_by,
  t.created_at,
  CASE 
    WHEN t.family_id = e.family_id THEN '✅ OK'
    WHEN t.family_id IS NULL THEN '❌ NULL'
    ELSE '❌ MISMATCH'
  END as status
FROM tasks t
LEFT JOIN events e ON t.event_id = e.id
ORDER BY t.created_at DESC
LIMIT 10;

-- Show which user created the tasks
SELECT 
  t.id as task_id,
  t.title as task_title,
  t.created_by,
  p.display_name as creator_name,
  p.family_id as creator_family_id,
  t.family_id as task_family_id,
  CASE 
    WHEN t.family_id = p.family_id THEN '✅ MATCH'
    WHEN t.family_id IS NULL THEN '❌ NULL'
    ELSE '❌ DIFFERENT'
  END as family_match
FROM tasks t
LEFT JOIN profiles p ON t.created_by = p.id
ORDER BY t.created_at DESC
LIMIT 10;
