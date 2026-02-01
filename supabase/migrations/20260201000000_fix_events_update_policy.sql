-- migration: fix events update policy to allow archiving
-- description: removes archived_at check from update policy to allow soft deletion
--              and adds policy to select all own events regardless of is_private flag
-- affected objects: events_update_own_authenticated and events_select_own_all_authenticated policies
-- issue: users couldn't archive their own events because:
--        1. update policy checked archived_at is null
--        2. select policies didn't cover all own events (missing shared events created by user)

-- drop existing update policy
drop policy if exists events_update_own_authenticated on events;

-- recreate update policy without archived_at restriction and without WITH CHECK
-- rationale: users should be able to update (archive) their own events
-- the archived_at check was preventing soft deletion via UPDATE
-- NOTE: WITH CHECK is removed to allow setting archived_at to non-null values
-- USING checks the old row state (before update), which is what we want
create policy events_update_own_authenticated
  on events
  for update
  to authenticated
  using (
    created_by = auth.uid()
  );

-- add new select policy for ALL own events (both private and shared)
-- this ensures users can always access their own events for updates
create policy events_select_own_all_authenticated
  on events
  for select
  to authenticated
  using (
    created_by = auth.uid()
  );

comment on policy events_update_own_authenticated on events is 'allows users to update and archive their own events';
comment on policy events_select_own_all_authenticated on events is 'allows users to select all their own events regardless of privacy setting';
