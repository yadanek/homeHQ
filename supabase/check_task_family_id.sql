-- Check if tasks have correct family_id
-- This query shows the last created tasks with their family_id and event's family_id

SELECT 
  t.id as task_id,
  t.title as task_title,
  t.family_id as task_family_id,
  t.event_id,
  e.title as event_title,
  e.family_id as event_family_id,
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

-- Also show profile's family_id for comparison
SELECT 
  p.id as profile_id,
  p.display_name,
  p.family_id as profile_family_id,
  f.name as family_name
FROM profiles p
LEFT JOIN families f ON p.family_id = f.id
WHERE p.family_id IS NOT NULL
LIMIT 5;
