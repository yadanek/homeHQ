-- Fix all RLS policies to use profiles.family_id instead of JWT
-- This fixes the issue where JWT is not updated immediately after login

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================

-- Drop old policies
DROP POLICY IF EXISTS events_insert_authenticated ON events;
DROP POLICY IF EXISTS events_select_shared_authenticated ON events;
DROP POLICY IF EXISTS events_select_own_private_authenticated ON events;
DROP POLICY IF EXISTS events_update_own_authenticated ON events;
DROP POLICY IF EXISTS events_delete_own_authenticated ON events;

-- Insert: users can create events in their family
CREATE POLICY events_insert_authenticated
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

-- Select: users can view shared events in their family OR their own private events
CREATE POLICY events_select_shared_authenticated
  ON events
  FOR SELECT
  TO authenticated
  USING (
    (
      family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
      AND is_private = false
      AND archived_at IS NULL
    )
    OR
    (
      created_by = auth.uid()
      AND is_private = true
      AND archived_at IS NULL
    )
  );

-- Update: users can update their own events
CREATE POLICY events_update_own_authenticated
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND archived_at IS NULL
  );

-- Delete: users can delete their own events
CREATE POLICY events_delete_own_authenticated
  ON events
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =============================================================================
-- EVENT_PARTICIPANTS TABLE
-- =============================================================================

DROP POLICY IF EXISTS participants_select_authenticated ON event_participants;
DROP POLICY IF EXISTS participants_insert_authenticated ON event_participants;
DROP POLICY IF EXISTS participants_delete_authenticated ON event_participants;

-- Select: users can view participants for events in their family
CREATE POLICY participants_select_authenticated
  ON event_participants
  FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events 
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Insert: only event creator can add participants
CREATE POLICY participants_insert_authenticated
  ON event_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM events 
      WHERE created_by = auth.uid()
    )
  );

-- Delete: only event creator can remove participants
CREATE POLICY participants_delete_authenticated
  ON event_participants
  FOR DELETE
  TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events 
      WHERE created_by = auth.uid()
    )
  );

-- =============================================================================
-- TASKS TABLE
-- =============================================================================

DROP POLICY IF EXISTS tasks_all_authenticated ON tasks;

-- All operations: users can manage tasks for events in their family
CREATE POLICY tasks_all_authenticated
  ON tasks
  FOR ALL
  TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events 
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM events 
      WHERE family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    )
  );

-- =============================================================================
-- INVITATION_CODES TABLE (bonus - fix this too)
-- =============================================================================

DROP POLICY IF EXISTS invitation_codes_select_authenticated ON invitation_codes;
DROP POLICY IF EXISTS invitation_codes_insert_authenticated ON invitation_codes;

-- Select: admins can view invitation codes for their family
CREATE POLICY invitation_codes_select_authenticated
  ON invitation_codes
  FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert: admins can create invitation codes for their family
CREATE POLICY invitation_codes_insert_authenticated
  ON invitation_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
