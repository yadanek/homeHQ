-- migration: create triggers for data integrity and automation
-- description: creates triggers for jwt sync, timestamp updates, participant cleanup, and task metadata
-- affected objects: trigger functions and triggers
-- dependencies: 20260102120004_create_functions.sql

-- =============================================================================
-- trigger: update_timestamp
-- purpose: automatically updates updated_at timestamp on row modification
-- applies to: families, profiles, family_members, events, tasks tables
-- =============================================================================

create or replace function update_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function update_timestamp is 'automatically updates updated_at column on row update';

-- create triggers for automatic timestamp updates
create trigger trg_update_timestamp_families
  before update on families
  for each row
  execute function update_timestamp();

create trigger trg_update_timestamp_profiles
  before update on profiles
  for each row
  execute function update_timestamp();

create trigger trg_update_timestamp_family_members
  before update on family_members
  for each row
  execute function update_timestamp();

create trigger trg_update_timestamp_events
  before update on events
  for each row
  execute function update_timestamp();

create trigger trg_update_timestamp_tasks
  before update on tasks
  for each row
  execute function update_timestamp();

-- =============================================================================
-- trigger: sync_family_to_jwt
-- purpose: syncs family_id to supabase auth jwt metadata for rls optimization
-- applies to: profiles table
-- event: after insert or update of family_id
-- optimization: eliminates join to profiles table in rls policies
-- note: this is optional optimization, policies work with or without JWT sync
-- =============================================================================

create or replace function sync_family_to_jwt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- update auth.users raw_app_meta_data with family_id
  -- wrapped in exception handler to prevent trigger failure if auth.users is not accessible
  begin
    update auth.users
    set raw_app_meta_data = 
      coalesce(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('family_id', new.family_id::text)
    where id = new.id;
  exception
    when others then
      -- log error but don't fail the trigger
      raise warning 'failed to sync family_id to jwt for user %: %', new.id, sqlerrm;
  end;
  
  return new;
end;
$$;

comment on function sync_family_to_jwt is 'syncs family_id to jwt metadata for rls performance optimization';

create trigger trg_sync_family_to_jwt
  after insert or update of family_id on profiles
  for each row
  when (new.family_id is not null)
  execute function sync_family_to_jwt();

-- =============================================================================
-- trigger: clean_participants_on_private
-- purpose: automatically removes participants when event becomes private
-- applies to: events table
-- event: after update of is_private
-- rationale: private events should have no participants
-- =============================================================================

create or replace function clean_participants_on_private()
returns trigger
language plpgsql
as $$
begin
  -- check if event changed from shared to private
  if new.is_private = true and old.is_private = false then
    -- delete all participants for this event
    delete from event_participants 
    where event_id = new.id;
  end if;
  
  return new;
end;
$$;

comment on function clean_participants_on_private is 'removes participants when event becomes private';

create trigger trg_clean_participants_on_private
  after update of is_private on events
  for each row
  execute function clean_participants_on_private();

-- =============================================================================
-- trigger: validate_participant_family
-- purpose: ensures participants (profiles or members) belong to the same family as the event
-- applies to: event_participants table
-- event: before insert
-- security: prevents cross-family participant injection
-- =============================================================================

create or replace function validate_participant_family()
returns trigger
language plpgsql
as $$
declare
  event_family_id uuid;
  participant_family_id uuid;
begin
  -- get the event's family_id
  select family_id into event_family_id
  from events
  where id = new.event_id;

  -- if event not found, let it fail naturally
  if event_family_id is null then
    raise exception 'event not found';
  end if;

  -- check if it's a profile participant
  if new.profile_id is not null then
    -- verify profile's family_id matches event's family_id
    select family_id into participant_family_id
    from profiles
    where id = new.profile_id;

    if participant_family_id is null then
      raise exception 'profile not found';
    end if;

    if participant_family_id != event_family_id then
      raise exception 'participant must belong to the same family as the event';
    end if;

  -- check if it's a member participant
  elsif new.member_id is not null then
    -- verify member's family_id matches event's family_id
    select family_id into participant_family_id
    from family_members
    where id = new.member_id;

    if participant_family_id is null then
      raise exception 'family member not found';
    end if;

    if participant_family_id != event_family_id then
      raise exception 'participant must belong to the same family as the event';
    end if;

  else
    -- should never happen due to check constraint
    raise exception 'participant must have either profile_id or member_id';
  end if;

  return new;
end;
$$;

comment on function validate_participant_family is 'validates that participant (profile or member) belongs to event family';

create trigger trg_validate_participant_family
  before insert on event_participants
  for each row
  execute function validate_participant_family();

-- =============================================================================
-- trigger: set_task_completion_metadata
-- purpose: automatically sets completed_at and completed_by when task is completed
-- applies to: tasks table
-- event: before update of is_completed
-- =============================================================================

create or replace function set_task_completion_metadata()
returns trigger
language plpgsql
as $$
begin
  -- check if task is being marked as completed
  if new.is_completed = true and old.is_completed = false then
    -- set completion timestamp and user
    new.completed_at = now();
    new.completed_by = auth.uid();
  end if;
  
  return new;
end;
$$;

comment on function set_task_completion_metadata is 'sets completion metadata when task is marked complete';

create trigger trg_set_task_completion_metadata
  before update of is_completed on tasks
  for each row
  execute function set_task_completion_metadata();
