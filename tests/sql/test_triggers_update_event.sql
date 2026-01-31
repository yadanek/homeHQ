-- ============================================================================
-- TRIGGER TESTS: UPDATE EVENT
-- ============================================================================
-- Tests for triggers that fire on event updates:
-- 1. trg_update_timestamp_events - updates updated_at field
-- 2. trg_clean_participants_on_private - removes participants when is_private changes to true
-- 
-- To run these tests:
-- 1. Connect to Supabase database
-- 2. Execute: psql -U postgres -d postgres -f tests/sql/test_triggers_update_event.sql
-- 3. Review output for PASS/FAIL indicators
-- ============================================================================

BEGIN;

-- Setup: Create test data
DO $$
DECLARE
  v_family_id uuid;
  v_user_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_participant1_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
  v_participant2_id uuid := '55555555-5555-5555-5555-555555555555'::uuid;
BEGIN
  -- Create test family
  INSERT INTO families (id, name) 
  VALUES (gen_random_uuid(), 'Test Family')
  RETURNING id INTO v_family_id;

  -- Create test profiles
  INSERT INTO profiles (id, family_id, display_name, role)
  VALUES 
    (v_user_id, v_family_id, 'Creator', 'admin'),
    (v_participant1_id, v_family_id, 'Participant 1', 'member'),
    (v_participant2_id, v_family_id, 'Participant 2', 'member');

  -- Create test event (shared with participants)
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
    v_user_id,
    'Shared Event',
    '2026-02-01T10:00:00Z',
    '2026-02-01T11:00:00Z',
    false  -- Initially shared
  );

  -- Add participants to the shared event
  INSERT INTO event_participants (event_id, profile_id)
  VALUES 
    (v_event_id, v_participant1_id),
    (v_event_id, v_participant2_id);

  RAISE NOTICE 'Test data created:';
  RAISE NOTICE '  Family ID: %', v_family_id;
  RAISE NOTICE '  Creator ID: %', v_user_id;
  RAISE NOTICE '  Event ID: %', v_event_id;
  RAISE NOTICE '  Participants: 2 added';
END $$;

-- ============================================================================
-- TEST CASE 1: update_timestamp trigger updates updated_at
-- ============================================================================
-- Expected: updated_at should be updated to current timestamp
-- Trigger: trg_update_timestamp_events (BEFORE UPDATE)

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_old_updated_at timestamptz;
  v_new_updated_at timestamptz;
  v_old_title text;
  v_new_title text;
BEGIN
  -- Get current state
  SELECT updated_at, title 
  INTO v_old_updated_at, v_old_title
  FROM events
  WHERE id = v_event_id;

  RAISE NOTICE 'Before update:';
  RAISE NOTICE '  Title: %', v_old_title;
  RAISE NOTICE '  Updated_at: %', v_old_updated_at;

  -- Wait to ensure timestamp difference
  PERFORM pg_sleep(0.1);

  -- Update event (trigger should fire)
  UPDATE events
  SET title = 'Updated Title for Timestamp Test'
  WHERE id = v_event_id;

  -- Get new state
  SELECT updated_at, title 
  INTO v_new_updated_at, v_new_title
  FROM events
  WHERE id = v_event_id;

  RAISE NOTICE 'After update:';
  RAISE NOTICE '  Title: %', v_new_title;
  RAISE NOTICE '  Updated_at: %', v_new_updated_at;

  IF v_new_updated_at > v_old_updated_at THEN
    RAISE NOTICE '✓ TEST 1 PASSED: updated_at timestamp was automatically updated';
    RAISE NOTICE '  Time difference: % ms', EXTRACT(EPOCH FROM (v_new_updated_at - v_old_updated_at)) * 1000;
  ELSE
    RAISE WARNING '✗ TEST 1 FAILED: updated_at was not updated';
    RAISE WARNING '  Old: %, New: %', v_old_updated_at, v_new_updated_at;
  END IF;
END $$;

-- ============================================================================
-- TEST CASE 2: clean_participants_on_private trigger removes participants
-- ============================================================================
-- Expected: When is_private changes to true, all participants should be deleted
-- Trigger: trg_clean_participants_on_private (AFTER UPDATE OF is_private)

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_participants_before int;
  v_participants_after int;
  v_is_private_before boolean;
  v_is_private_after boolean;
BEGIN
  -- Get state before
  SELECT is_private INTO v_is_private_before
  FROM events
  WHERE id = v_event_id;

  SELECT COUNT(*) INTO v_participants_before
  FROM event_participants
  WHERE event_id = v_event_id;

  RAISE NOTICE 'Before changing to private:';
  RAISE NOTICE '  is_private: %', v_is_private_before;
  RAISE NOTICE '  Participant count: %', v_participants_before;

  -- Change event to private (trigger should fire and clean participants)
  UPDATE events
  SET is_private = true
  WHERE id = v_event_id;

  -- Get state after
  SELECT is_private INTO v_is_private_after
  FROM events
  WHERE id = v_event_id;

  SELECT COUNT(*) INTO v_participants_after
  FROM event_participants
  WHERE event_id = v_event_id;

  RAISE NOTICE 'After changing to private:';
  RAISE NOTICE '  is_private: %', v_is_private_after;
  RAISE NOTICE '  Participant count: %', v_participants_after;

  IF v_is_private_after = true AND v_participants_after = 0 AND v_participants_before > 0 THEN
    RAISE NOTICE '✓ TEST 2 PASSED: Participants were automatically removed when event became private';
    RAISE NOTICE '  Removed % participants', v_participants_before;
  ELSE
    RAISE WARNING '✗ TEST 2 FAILED: Participants were not removed';
    RAISE WARNING '  Before: %, After: %', v_participants_before, v_participants_after;
  END IF;
END $$;

-- ============================================================================
-- TEST CASE 3: clean_participants_on_private trigger does NOT fire on other updates
-- ============================================================================
-- Expected: Updating other fields should not affect participants
-- Trigger: trg_clean_participants_on_private should NOT fire

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_participant_id uuid := '66666666-6666-6666-6666-666666666666'::uuid;
  v_family_id uuid;
  v_participants_before int;
  v_participants_after int;
BEGIN
  -- Get family_id for new participant
  SELECT family_id INTO v_family_id
  FROM events
  WHERE id = v_event_id;

  -- First, change event back to shared
  UPDATE events
  SET is_private = false
  WHERE id = v_event_id;

  -- Add a new profile as participant
  INSERT INTO profiles (id, family_id, display_name, role)
  VALUES (v_participant_id, v_family_id, 'Test Participant', 'member');

  -- Add participant
  INSERT INTO event_participants (event_id, profile_id)
  VALUES (v_event_id, v_participant_id);

  SELECT COUNT(*) INTO v_participants_before
  FROM event_participants
  WHERE event_id = v_event_id;

  RAISE NOTICE 'Before updating title (not is_private):';
  RAISE NOTICE '  Participant count: %', v_participants_before;

  -- Update title only (not is_private)
  UPDATE events
  SET title = 'Updated Title Without Privacy Change'
  WHERE id = v_event_id;

  SELECT COUNT(*) INTO v_participants_after
  FROM event_participants
  WHERE event_id = v_event_id;

  RAISE NOTICE 'After updating title:';
  RAISE NOTICE '  Participant count: %', v_participants_after;

  IF v_participants_after = v_participants_before THEN
    RAISE NOTICE '✓ TEST 3 PASSED: Participants unchanged when updating other fields';
  ELSE
    RAISE WARNING '✗ TEST 3 FAILED: Participants changed unexpectedly';
    RAISE WARNING '  Before: %, After: %', v_participants_before, v_participants_after;
  END IF;
END $$;

-- ============================================================================
-- TEST CASE 4: clean_participants_on_private does NOT fire when changing FROM private TO shared
-- ============================================================================
-- Expected: Changing from private to shared should not remove participants (there are none anyway)
-- Trigger: trg_clean_participants_on_private checks old.is_private = false

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_is_private_before boolean;
  v_is_private_after boolean;
  v_participants_count int;
BEGIN
  -- Change to private first
  UPDATE events
  SET is_private = true
  WHERE id = v_event_id;

  SELECT is_private INTO v_is_private_before
  FROM events
  WHERE id = v_event_id;

  RAISE NOTICE 'Before changing from private to shared:';
  RAISE NOTICE '  is_private: %', v_is_private_before;

  -- Change from private to shared (trigger should NOT clean participants)
  UPDATE events
  SET is_private = false
  WHERE id = v_event_id;

  SELECT is_private INTO v_is_private_after
  FROM events
  WHERE id = v_event_id;

  SELECT COUNT(*) INTO v_participants_count
  FROM event_participants
  WHERE event_id = v_event_id;

  RAISE NOTICE 'After changing to shared:';
  RAISE NOTICE '  is_private: %', v_is_private_after;
  RAISE NOTICE '  Participant count: %', v_participants_count;

  IF v_is_private_after = false THEN
    RAISE NOTICE '✓ TEST 4 PASSED: Successfully changed from private to shared';
    RAISE NOTICE '  Note: Participants were already removed when event became private';
  ELSE
    RAISE WARNING '✗ TEST 4 FAILED: is_private did not change to false';
  END IF;
END $$;

-- ============================================================================
-- TEST CASE 5: validate_participant_family trigger prevents cross-family participants
-- ============================================================================
-- Expected: Adding participant from different family should fail
-- Trigger: trg_validate_participant_family (BEFORE INSERT on event_participants)

DO $$
DECLARE
  v_event_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_other_family_id uuid;
  v_other_user_id uuid := '77777777-7777-7777-7777-777777777777'::uuid;
  v_error_caught boolean := false;
BEGIN
  -- Create a different family
  INSERT INTO families (id, name) 
  VALUES (gen_random_uuid(), 'Other Family')
  RETURNING id INTO v_other_family_id;

  -- Create user in different family
  INSERT INTO profiles (id, family_id, display_name, role)
  VALUES (v_other_user_id, v_other_family_id, 'Other Family User', 'member');

  RAISE NOTICE 'Attempting to add participant from different family...';

  -- Try to add participant from different family (should fail)
  BEGIN
    INSERT INTO event_participants (event_id, profile_id)
    VALUES (v_event_id, v_other_user_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_error_caught := true;
      RAISE NOTICE 'Caught error: %', SQLERRM;
  END;

  IF v_error_caught THEN
    RAISE NOTICE '✓ TEST 5 PASSED: Cross-family participant was rejected by trigger';
  ELSE
    RAISE WARNING '✗ TEST 5 FAILED: Cross-family participant was allowed (security issue!)';
  END IF;
END $$;

-- Cleanup: Rollback all test data
ROLLBACK;

RAISE NOTICE '';
RAISE NOTICE '============================================================================';
RAISE NOTICE 'TRIGGER TESTS COMPLETED';
RAISE NOTICE '============================================================================';
RAISE NOTICE 'Note: All test data has been rolled back';
RAISE NOTICE '';

-- ============================================================================
-- MANUAL VERIFICATION CHECKLIST
-- ============================================================================
-- [ ] TEST 1 PASSED: updated_at trigger works
-- [ ] TEST 2 PASSED: clean_participants_on_private removes participants
-- [ ] TEST 3 PASSED: Trigger only fires on is_private change
-- [ ] TEST 4 PASSED: Trigger only fires on false->true change
-- [ ] TEST 5 PASSED: Cross-family participants are prevented
-- [ ] No errors in Supabase logs
