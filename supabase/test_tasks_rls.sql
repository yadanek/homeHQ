-- Test if RLS policy works correctly
-- This simulates what happens when user Zenek queries tasks

-- First, show what the RLS policy checks
SELECT 
  t.id,
  t.title,
  t.family_id as task_family_id,
  (SELECT family_id FROM profiles WHERE id = 'b236c6e9-3e68-4cd8-9470-fd6b2500869a') as user_family_id,
  CASE 
    WHEN t.family_id IN (
      SELECT family_id FROM profiles 
      WHERE id = 'b236c6e9-3e68-4cd8-9470-fd6b2500869a' 
      AND family_id IS NOT NULL
    ) THEN 'VISIBLE ✅'
    ELSE 'HIDDEN ❌'
  END as rls_result
FROM tasks t
WHERE t.id = '499a779a-2948-4f0a-a8f2-6fd1b2b605b6'  -- Pack bags task
LIMIT 1;

-- Check the subquery that RLS uses
SELECT 
  'User family_id check:' as test,
  family_id 
FROM profiles 
WHERE id = 'b236c6e9-3e68-4cd8-9470-fd6b2500869a' 
AND family_id IS NOT NULL;

-- Test if the IN clause works
SELECT 
  '82e225cf-8fd6-4f5a-8b14-ef4486d16ee1' IN (
    SELECT family_id FROM profiles 
    WHERE id = 'b236c6e9-3e68-4cd8-9470-fd6b2500869a' 
    AND family_id IS NOT NULL
  ) as should_be_true;
