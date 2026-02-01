-- Simplified TASKS policy for MVP
-- Allow all operations for authenticated users in the same family

DROP POLICY IF EXISTS tasks_all_authenticated ON tasks;

-- Fixed policy: users can only see and manage tasks from their own family
-- Uses direct comparison instead of IN subquery for better performance and reliability
CREATE POLICY tasks_all_authenticated
  ON tasks
  FOR ALL
  TO authenticated
  USING (
    family_id = (
      SELECT family_id FROM profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    family_id = (
      SELECT family_id FROM profiles 
      WHERE id = auth.uid()
    )
  );
