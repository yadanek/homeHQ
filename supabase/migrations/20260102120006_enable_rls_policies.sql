-- migration: enable row level security and create rls policies
-- description: creates granular rls policies for all tables with comprehensive access control
-- affected objects: rls policies on all tables
-- dependencies: 20260102120005_create_triggers.sql
-- security model: jwt-based family isolation with role-based admin permissions

-- =============================================================================
-- rls policies: families
-- select: all family members can view their family
-- update: only admins can update family details
-- insert: handled via create_family_and_assign_admin() function
-- delete: not allowed (use soft delete or admin operation)
-- =============================================================================

-- policy: authenticated users can select their own family
create policy families_select_authenticated
  on families
  for select
  to authenticated
  using (id in (select family_id from profiles where id = auth.uid()));

-- policy: authenticated admins can update their family
create policy families_update_authenticated
  on families
  for update
  to authenticated
  using (
    id in (select family_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

comment on policy families_select_authenticated on families is 'allows family members to view their family';
comment on policy families_update_authenticated on families is 'allows only admins to update family details';

-- =============================================================================
-- rls policies: profiles
-- select: all family members can view other members' profiles + users can view their own
-- update: users can only update their own profile
-- insert: handled via functions (create_family_and_assign_admin, use_invitation_code)
-- delete: not allowed (use auth system)
-- =============================================================================

-- policy: authenticated users can select profiles in their family
create policy profiles_select_authenticated
  on profiles
  for select
  to authenticated
  using (family_id in (select family_id from profiles where id = auth.uid()));

-- policy: authenticated users can always read their own profile (needed during onboarding)
create policy profiles_select_own_authenticated
  on profiles
  for select
  to authenticated
  using (id = auth.uid());

-- policy: authenticated users can update their own profile
create policy profiles_update_authenticated
  on profiles
  for update
  to authenticated
  using (id = auth.uid());

comment on policy profiles_select_authenticated on profiles is 'allows family members to view other family members';
comment on policy profiles_select_own_authenticated on profiles is 'allows users to always read their own profile, even without family_id in jwt';
comment on policy profiles_update_authenticated on profiles is 'allows users to update their own profile only';

-- =============================================================================
-- rls policies: invitation_codes
-- select: only admins can view invitation codes for their family
-- insert: only admins can create invitation codes (also enforced by generate_invitation_code function)
-- update: not allowed (codes are immutable except via function)
-- delete: not allowed (use expiration and cleanup job)
-- =============================================================================

-- policy: authenticated admins can select invitation codes for their family
create policy invitation_codes_select_authenticated
  on invitation_codes
  for select
  to authenticated
  using (
    family_id in (select family_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

-- policy: authenticated admins can insert invitation codes for their family
create policy invitation_codes_insert_authenticated
  on invitation_codes
  for insert
  to authenticated
  with check (
    family_id in (select family_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

comment on policy invitation_codes_select_authenticated on invitation_codes is 'allows admins to view invitation codes for their family';
comment on policy invitation_codes_insert_authenticated on invitation_codes is 'allows admins to create invitation codes for their family';

-- =============================================================================
-- rls policies: family_members
-- all: all family members can perform all operations on family_members
-- rationale: simple model for managing non-account family members
-- =============================================================================

-- policy: authenticated users can perform all operations on family_members in their family
create policy family_members_all
  on family_members
  for all 
  to authenticated
  using (family_id in (select family_id from profiles where id = auth.uid()))
  with check (family_id in (select family_id from profiles where id = auth.uid()));

comment on policy family_members_all on family_members is 'allows family members to manage family_members in their family';

-- =============================================================================
-- rls policies: events
-- select: family members see shared events OR their own private events
-- insert: authenticated users can create events in their family
-- update: users can only update events they created (if not archived)
-- delete: users can only delete (soft delete) events they created
-- =============================================================================

-- policy: authenticated users can select shared events in their family
create policy events_select_shared_authenticated
  on events
  for select
  to authenticated
  using (
    family_id in (select family_id from profiles where id = auth.uid())
    and is_private = false
    and archived_at is null
  );

-- policy: authenticated users can select their own private events
create policy events_select_own_private_authenticated
  on events
  for select
  to authenticated
  using (
    created_by = auth.uid()
    and is_private = true
    and archived_at is null
  );

-- policy: authenticated users can insert events in their family
create policy events_insert_authenticated
  on events
  for insert
  to authenticated
  with check (
    family_id in (select family_id from profiles where id = auth.uid())
    and created_by = auth.uid()
  );

-- policy: authenticated users can update their own events (if not archived)
create policy events_update_own_authenticated
  on events
  for update
  to authenticated
  using (
    created_by = auth.uid()
    and archived_at is null
  );

-- policy: authenticated users can delete (soft delete) their own events
create policy events_delete_own_authenticated
  on events
  for delete
  to authenticated
  using (created_by = auth.uid());

comment on policy events_select_shared_authenticated on events is 'allows family members to view shared events';
comment on policy events_select_own_private_authenticated on events is 'allows users to view their own private events';
comment on policy events_insert_authenticated on events is 'allows users to create events in their family';
comment on policy events_update_own_authenticated on events is 'allows users to update their own events';
comment on policy events_delete_own_authenticated on events is 'allows users to delete their own events';

-- =============================================================================
-- rls policies: event_participants
-- select: visible for shared events or user's own private events
-- insert: only event creator can add participants
-- delete: only event creator can remove participants
-- update: not applicable (no updatable columns)
-- =============================================================================

-- policy: authenticated users can select participants for visible events
create policy participants_select_authenticated
  on event_participants
  for select
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (e.is_private = false or e.created_by = auth.uid())
        and e.family_id in (select family_id from profiles where id = auth.uid())
    )
  );

-- policy: authenticated event creators can insert participants
create policy participants_insert_authenticated
  on event_participants
  for insert
  to authenticated
  with check (
    exists (
      select 1 from events e
      where e.id = event_id
        and e.created_by = auth.uid()
    )
  );

-- policy: authenticated event creators can delete participants
create policy participants_delete_authenticated
  on event_participants
  for delete
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_id
        and e.created_by = auth.uid()
    )
  );

comment on policy participants_select_authenticated on event_participants is 'allows viewing participants for accessible events';
comment on policy participants_insert_authenticated on event_participants is 'allows event creators to add participants';
comment on policy participants_delete_authenticated on event_participants is 'allows event creators to remove participants';

-- =============================================================================
-- rls policies: tasks
-- select: family members see shared tasks OR their own private tasks
-- insert: authenticated users can create tasks in their family
-- update: creator or assignee can update task (if not archived)
-- delete: only creator can delete (soft delete) tasks
-- =============================================================================

-- policy: authenticated users can select shared tasks in their family
create policy tasks_select_shared_authenticated
  on tasks
  for select
  to authenticated
  using (
    family_id in (select family_id from profiles where id = auth.uid())
    and is_private = false
    and archived_at is null
  );

-- policy: authenticated users can select their own private tasks
create policy tasks_select_own_private_authenticated
  on tasks
  for select
  to authenticated
  using (
    created_by = auth.uid()
    and is_private = true
    and archived_at is null
  );

-- policy: authenticated users can insert tasks in their family
create policy tasks_insert_authenticated
  on tasks
  for insert
  to authenticated
  with check (
    family_id in (select family_id from profiles where id = auth.uid())
    and created_by = auth.uid()
  );

-- policy: authenticated users can update tasks they created or are assigned to (if not archived)
create policy tasks_update_own_authenticated
  on tasks
  for update
  to authenticated
  using (
    (created_by = auth.uid() or assigned_to = auth.uid())
    and archived_at is null
  );

-- policy: authenticated users can delete (soft delete) tasks they created
create policy tasks_delete_own_authenticated
  on tasks
  for delete
  to authenticated
  using (created_by = auth.uid());

comment on policy tasks_select_shared_authenticated on tasks is 'allows family members to view shared tasks';
comment on policy tasks_select_own_private_authenticated on tasks is 'allows users to view their own private tasks';
comment on policy tasks_insert_authenticated on tasks is 'allows users to create tasks in their family';
comment on policy tasks_update_own_authenticated on tasks is 'allows creators and assignees to update tasks';
comment on policy tasks_delete_own_authenticated on tasks is 'allows creators to delete their tasks';
