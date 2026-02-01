-- migration: create database functions
-- description: creates atomic functions for family creation, invitation code management, and event operations
-- affected objects: database functions
-- dependencies: 20260102120003_create_task_tables.sql

-- =============================================================================
-- function: create_family_and_assign_admin
-- purpose: atomically creates a new family and assigns the user as admin
-- parameters:
--   - user_id: uuid of the auth.users record
--   - family_name: name for the new family
--   - user_display_name: display name for the user's profile
-- returns: uuid (family_id)
-- transaction: wrapped in transaction for atomicity
-- =============================================================================

create or replace function create_family_and_assign_admin(
  user_id uuid,
  family_name text,
  user_display_name text
)
returns uuid
language plpgsql
security definer -- runs with privileges of function owner
set search_path = public
as $$
declare
  new_family_id uuid;
begin
  -- validate input parameters
  if user_id is null or family_name is null or user_display_name is null then
    raise exception 'all parameters are required';
  end if;

  -- check if user already has a profile (prevents duplicate family creation)
  if exists (select 1 from profiles where id = user_id) then
    raise exception 'user already belongs to a family';
  end if;

  -- insert new family record
  insert into families (name)
  values (family_name)
  returning id into new_family_id;

  -- insert profile record with admin role
  insert into profiles (id, family_id, role, display_name)
  values (user_id, new_family_id, 'admin', user_display_name);

  -- return the new family id
  return new_family_id;
end;
$$;

comment on function create_family_and_assign_admin is 'atomically creates family and assigns user as admin';

-- grant execute permission to authenticated users
grant execute on function create_family_and_assign_admin(uuid, text, text) to authenticated;

-- =============================================================================
-- function: generate_invitation_code
-- purpose: generates a secure 8-character alphanumeric invitation code
-- parameters:
--   - p_family_id: uuid of the family
--   - admin_id: uuid of the admin creating the code
--   - days_valid: number of days until code expires
-- returns: text (invitation code)
-- security: verifies admin_id has admin role before proceeding
-- =============================================================================

create or replace function generate_invitation_code(
  p_family_id uuid,
  admin_id uuid,
  days_valid integer default 7
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  code_exists boolean;
begin
  -- verify user is an admin in the specified family
  if not exists (
    select 1 from profiles
    where id = admin_id
      and family_id = p_family_id
      and role = 'admin'
  ) then
    raise exception 'user must be an admin of the family to generate invitation codes';
  end if;

  -- validate days_valid parameter
  if days_valid < 1 or days_valid > 365 then
    raise exception 'days_valid must be between 1 and 365';
  end if;

  -- generate unique 8-character alphanumeric code
  -- loop until we find a code that doesn't exist (collision avoidance)
  loop
    -- generate random bytes and encode to base64, then clean and truncate to 8 chars
    new_code := upper(substring(
      regexp_replace(
        encode(gen_random_bytes(6), 'base64'),
        '[^a-zA-Z0-9]',
        '',
        'g'
      ),
      1,
      8
    ));

    -- check if code already exists
    select exists(
      select 1 from invitation_codes where code = new_code
    ) into code_exists;

    -- exit loop if code is unique
    exit when not code_exists;
  end loop;

  -- insert invitation code record
  insert into invitation_codes (
    family_id,
    code,
    created_by,
    expires_at
  ) values (
    p_family_id,
    new_code,
    admin_id,
    now() + (days_valid || ' days')::interval
  );

  -- return the generated code
  return new_code;
end;
$$;

comment on function generate_invitation_code is 'generates secure 8-character invitation code with expiration';

-- grant execute permission to authenticated users (RLS handles admin check)
grant execute on function generate_invitation_code(uuid, uuid, integer) to authenticated;

-- =============================================================================
-- function: use_invitation_code
-- purpose: redeems invitation code and adds user to family
-- parameters:
--   - p_code: invitation code to redeem
--   - user_id: uuid of the auth.users record
--   - user_display_name: display name for the user's profile
-- returns: uuid (family_id)
-- validation: code must exist, not be expired, and not be used
-- =============================================================================

create or replace function use_invitation_code(
  p_code text,
  user_id uuid,
  user_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_record record;
  target_family_id uuid;
begin
  -- validate input parameters
  if p_code is null or user_id is null or user_display_name is null then
    raise exception 'all parameters are required';
  end if;

  -- check if user already belongs to a family
  if exists (select 1 from profiles where id = user_id) then
    raise exception 'user already belongs to a family';
  end if;

  -- find and validate invitation code
  select *
  into invitation_record
  from invitation_codes
  where code = p_code
    and expires_at > now()
    and used_at is null
  for update; -- lock row to prevent concurrent redemption

  -- validate code exists and is valid
  if invitation_record is null then
    raise exception 'invitation code is invalid, expired, or already used';
  end if;

  target_family_id := invitation_record.family_id;

  -- create profile for user with member role
  insert into profiles (id, family_id, role, display_name)
  values (user_id, target_family_id, 'member', user_display_name);

  -- mark invitation code as used
  update invitation_codes
  set used_at = now(),
      used_by = user_id
  where id = invitation_record.id;

  -- return the family id
  return target_family_id;
end;
$$;

comment on function use_invitation_code is 'redeems invitation code and adds user to family as member';

-- grant execute permission to authenticated users
grant execute on function use_invitation_code(text, uuid, text) to authenticated;

-- =============================================================================
-- function: get_event_with_participants
-- purpose: retrieves event with all participant details in single query
-- parameters:
--   - event_uuid: uuid of the event to retrieve
-- returns: json object with event data and participants array
-- optimization: single query to fetch event + participants instead of n+1
-- =============================================================================

create or replace function get_event_with_participants(event_uuid uuid)
returns json
language sql
stable -- indicates function doesn't modify database
security definer
set search_path = public
as $$
  select json_build_object(
    'id', e.id,
    'family_id', e.family_id,
    'created_by', e.created_by,
    'title', e.title,
    'description', e.description,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'is_private', e.is_private,
    'created_at', e.created_at,
    'updated_at', e.updated_at,
    'archived_at', e.archived_at,
    'participants', coalesce(
      (
        select json_agg(
          json_build_object(
            'participant_type', case 
              when ep.profile_id is not null then 'profile'
              else 'member'
            end,
            'id', coalesce(p.id, m.id),
            'name', coalesce(p.display_name, m.name)
          )
        )
        from event_participants ep
        left join profiles p on p.id = ep.profile_id
        left join family_members m on m.id = ep.member_id
        where ep.event_id = e.id
      ),
      '[]'::json
    )
  )
  from events e
  where e.id = event_uuid;
$$;

comment on function get_event_with_participants is 'retrieves event with participant details in single optimized query';

-- grant execute permission to authenticated users (RLS handles visibility)
grant execute on function get_event_with_participants(uuid) to authenticated;

-- =============================================================================
-- function: validate_event_participants_bulk
-- purpose: validates all participant IDs belong to the same family before insert
-- parameters:
--   - event_uuid: uuid of the event
--   - profile_ids: array of profile UUIDs to validate (can be empty)
--   - member_ids: array of member UUIDs to validate (can be empty)
-- returns: boolean (true if all valid, raises exception otherwise)
-- security: prevents cross-family participant injection in bulk operations
-- usage: called before batch inserting event_participants
-- =============================================================================

create or replace function validate_event_participants_bulk(
  event_uuid uuid,
  profile_ids uuid[] default array[]::uuid[],
  member_ids uuid[] default array[]::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  event_family_id uuid;
  invalid_profiles integer;
  invalid_members integer;
begin
  -- get the event's family_id
  select family_id into event_family_id
  from events
  where id = event_uuid;
  
  -- check if event exists
  if event_family_id is null then
    raise exception 'event not found';
  end if;
  
  -- check if any profile doesn't belong to the same family
  if profile_ids is not null and array_length(profile_ids, 1) > 0 then
    select count(*) into invalid_profiles
    from unnest(profile_ids) as pid
    where not exists (
      select 1 from profiles
      where id = pid
        and family_id = event_family_id
    );
    
    if invalid_profiles > 0 then
      raise exception 'one or more profile participants do not belong to the event family';
    end if;
  end if;
  
  -- check if any member doesn't belong to the same family
  if member_ids is not null and array_length(member_ids, 1) > 0 then
    select count(*) into invalid_members
    from unnest(member_ids) as mid
    where not exists (
      select 1 from family_members
      where id = mid
        and family_id = event_family_id
    );
    
    if invalid_members > 0 then
      raise exception 'one or more member participants do not belong to the event family';
    end if;
  end if;
  
  return true;
end;
$$;

comment on function validate_event_participants_bulk is 'validates bulk participants (profiles and members) belong to event family';

-- grant execute permission to authenticated users
grant execute on function validate_event_participants_bulk(uuid, uuid[], uuid[]) to authenticated;

-- =============================================================================
-- function: get_all_event_participants
-- purpose: retrieves all participants (profiles and members) for an event
-- parameters:
--   - event_uuid: uuid of the event
-- returns: table with participant details
-- =============================================================================

create or replace function get_all_event_participants(event_uuid uuid)
returns table (
  participant_type text,
  participant_id uuid,
  participant_name text,
  is_admin boolean
) 
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  -- profile participants
  select 
    'profile'::text as participant_type,
    p.id as participant_id,
    p.display_name as participant_name,
    (p.role = 'admin') as is_admin
  from event_participants ep
  join profiles p on ep.profile_id = p.id
  where ep.event_id = event_uuid
    and ep.profile_id is not null
  
  union all
  
  -- member participants
  select 
    'member'::text as participant_type,
    m.id as participant_id,
    m.name as participant_name,
    m.is_admin as is_admin
  from event_participants ep
  join family_members m on ep.member_id = m.id
  where ep.event_id = event_uuid
    and ep.member_id is not null;
end;
$$;

comment on function get_all_event_participants is 'retrieves all participants (profiles and members) for an event';

-- grant execute permission to authenticated users (RLS handles visibility)
grant execute on function get_all_event_participants(uuid) to authenticated;

-- =============================================================================
-- function: sync_current_user_jwt
-- purpose: manually syncs current user's family_id to JWT app_metadata
-- parameters: none (uses auth.uid())
-- returns: jsonb with success status and family_id
-- usage: called from client after login to ensure JWT has family_id
-- =============================================================================

create or replace function sync_current_user_jwt()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  user_family_id uuid;
begin
  -- get current user's family_id from profiles
  select family_id into user_family_id
  from profiles
  where id = auth.uid();
  
  -- if no profile or no family_id, return error
  if user_family_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'No family_id found for current user'
    );
  end if;
  
  -- update auth.users.raw_app_meta_data with family_id
  update auth.users
  set raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('family_id', user_family_id::text)
  where id = auth.uid();
  
  -- return success with family_id
  return jsonb_build_object(
    'success', true,
    'family_id', user_family_id
  );
end;
$$;

comment on function sync_current_user_jwt is 'synchronizes current user''s family_id from profiles to JWT app_metadata';

-- grant execute permission to authenticated users
grant execute on function sync_current_user_jwt() to authenticated;

