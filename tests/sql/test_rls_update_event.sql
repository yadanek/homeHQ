-- ============================================================================
-- RLS POLICY TESTS: UPDATE EVENT
-- ============================================================================
-- Tests for events_update_own_authenticated policy
-- Verifies that only event creator can update their own events
-- 
-- To run these tests:
-- 1. Connect to Supabase database
-- 2. Execute: psql -U postgres -d postgres -f tests/sql/test_rls_update_event.sql
-- 3. Review output for PASS/FAIL indicators
-- ============================================================================

-- Setup: Create test data
-- Note: This assumes families, profiles, and events tables exist

BEGIN;

-- Test User IDs (simulated)
-- In real scenario, these would be actual auth.users IDs
DO $$
DECLARE
  v_family_id uuid;
  v_user1_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_user2_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
BEGIN
  -- Create test family
  INSERT INTO families (id, name) 
  VALUES (gen_random_uuid(), 'Test Family')
  RETURNING id INTO v_family_id;

  -- Create test profiles
  INSERT INTO profiles (id, family_id, display_name, role)
  VALUES 
    (v_user1_id, v_family_id, 'User 1', 'admin'),
    (v_user2_id, v_family_id, 'User 2', 'member');

  -- Create test event (owned by user1)
  INSERT INTO events (
    id, 
    family_id, 
    created_by, 
    title, 
    start_time, 
    end_time, 
    is_private
  )
  VALUES (
    v_event_id,
    v_family_id,
    v_user1_id,
    'Test Event',
    '2026-02-01T10:00:00Z',
    '2026-02-01T11:00:00Z',
    false
  );

  RAISE NOTICE 'Test data created:';
  RAISE NOTICE '  Family ID: %', v_family_id;
  RAISE NOTICE '  User1 ID (creator): %', v_user1_id;
  RAISE NOTICE '  User2 ID (non-creator): %', v_user2_id;
  RAISE NOTICE '  Event ID: %', v_event_id;
END $$;

-- ============================================================================
-- TEST CASE 1: Creator can update their own event
-- ============================================================================
-- Expected: SUCCESS (1 row updated)
-- Policy: events_update_own_authenticated should allow this

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_user1_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_rows_affected int;
BEGIN
  -- Simulate auth.uid() returning user1_id
  -- Note: In real environment, this would be set by JWT
  PERFORM set_config('request.jwt.claims', 
    json_build_object('sub', v_user1_id::text)::text, 
    true);

  -- Attempt to update event
  UPDATE events
  SET title = 'Updated by Creator'
  WHERE id = v_event_id 
    AND created_by = v_user1_id  -- RLS will check this
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 1 THEN
    RAISE NOTICE '✓ TEST 1 PASSED: Creator can update their own event (% row updated)', v_rows_affected;
  ELSE
    RAISE WARNING '✗ TEST 1 FAILED: Expected 1 row updated, got %', v_rows_affected;
  END IF;
END $$;

-- ============================================================================
-- TEST CASE 2: Non-creator cannot update event
-- ============================================================================
-- Expected: FAILURE (0 rows updated due to RLS)
-- Policy: events_update_own_authenticated should block this

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_user2_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_rows_affected int;
BEGIN
  -- Simulate auth.uid() returning user2_id (non-creator)
  PERFORM set_config('request.jwt.claims', 
    json_build_object('sub', v_user2_id::text)::text, 
    true);

  -- Attempt to update event (should be blocked by RLS)
  UPDATE events
  SET title = 'Updated by Non-Creator'
  WHERE id = v_event_id 
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE NOTICE '✓ TEST 2 PASSED: Non-creator cannot update event (% rows updated)', v_rows_affected;
  ELSE
    RAISE WARNING '✗ TEST 2 FAILED: Expected 0 rows updated, got %', v_rows_affected;
  END IF;
END $$;

-- ============================================================================
-- TEST CASE 3: Cannot update archived event (even as creator)
-- ============================================================================
-- Expected: FAILURE (0 rows updated due to RLS)
-- Policy: events_update_own_authenticated checks archived_at IS NULL

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_user1_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_rows_affected int;
BEGIN
  -- Simulate auth.uid() returning user1_id (creator)
  PERFORM set_config('request.jwt.claims', 
    json_build_object('sub', v_user1_id::text)::text, 
    true);

  -- First, archive the event (bypass RLS with service role would be needed)
  UPDATE events
  SET archived_at = NOW()
  WHERE id = v_event_id;

  -- Attempt to update archived event (should be blocked by RLS)
  UPDATE events
  SET title = 'Updated Archived Event'
  WHERE id = v_event_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE NOTICE '✓ TEST 3 PASSED: Cannot update archived event (% rows updated)', v_rows_affected;
  ELSE
    RAISE WARNING '✗ TEST 3 FAILED: Expected 0 rows updated, got %', v_rows_affected;
  END IF;
END $$;

-- ============================================================================
-- TEST CASE 4: Update updates the updated_at timestamp (trigger test)
-- ============================================================================
-- Expected: SUCCESS with updated_at changed
-- Trigger: trg_update_timestamp_events should fire

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_user1_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_old_updated_at timestamptz;
  v_new_updated_at timestamptz;
BEGIN
  -- First, unarchive the event for this test
  UPDATE events
  SET archived_at = NULL
  WHERE id = v_event_id;

  -- Get current updated_at
  SELECT updated_at INTO v_old_updated_at
  FROM events
  WHERE id = v_event_id;

  -- Wait a moment to ensure timestamp difference
  PERFORM pg_sleep(0.1);

  -- Simulate auth.uid()
  PERFORM set_config('request.jwt.claims', 
    json_build_object('sub', v_user1_id::text)::text, 
    true);

  -- Update event
  UPDATE events
  SET title = 'Trigger Test'
  WHERE id = v_event_id 
    AND created_by = v_user1_id
    AND archived_at IS NULL;

  -- Get new updated_at
  SELECT updated_at INTO v_new_updated_at
  FROM events
  WHERE id = v_event_id;

  IF v_new_updated_at > v_old_updated_at THEN
    RAISE NOTICE '✓ TEST 4 PASSED: updated_at timestamp was updated (old: %, new: %)', v_old_updated_at, v_new_updated_at;
  ELSE
    RAISE WARNING '✗ TEST 4 FAILED: updated_at was not updated (old: %, new: %)', v_old_updated_at, v_new_updated_at;
  END IF;
END $$;

-- Cleanup: Rollback all test data
ROLLBACK;

RAISE NOTICE '';
RAISE NOTICE '============================================================================';
RAISE NOTICE 'RLS POLICY TESTS COMPLETED';
RAISE NOTICE '============================================================================';
RAISE NOTICE 'Note: All test data has been rolled back';
RAISE NOTICE '';

-- ============================================================================
-- MANUAL VERIFICATION CHECKLIST
-- ============================================================================
-- [ ] All 4 tests passed
-- [ ] RLS policies are enforcing creator-only updates
-- [ ] Archived events cannot be updated
-- [ ] updated_at trigger is working
-- [ ] No errors in Supabase logs
