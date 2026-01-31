-- Simplified TASKS policy for MVP
-- Allow all operations for authenticated users with a family

DROP POLICY IF EXISTS tasks_all_authenticated ON tasks;

-- Simple policy: if you're in a family, you can manage all tasks
CREATE POLICY tasks_all_authenticated
  ON tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND family_id IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND family_id IS NOT NULL
    )
  );
