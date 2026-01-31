-- migration: create event and participant tables
-- description: creates events and event_participants tables with binary visibility model
-- affected objects: events, event_participants tables
-- dependencies: 20260102120001_create_core_tables.sql

-- =============================================================================
-- table: events
-- purpose: stores calendar events with binary visibility (private vs shared)
-- visibility model:
--   - is_private = false (shared): visible to all family members
--   - is_private = true (private): visible only to creator
-- =============================================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 200),
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null check (end_time > start_time),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- create composite index on family_id and start_time for calendar queries
-- partial index excludes archived events for performance
create index idx_events_family_start 
  on events(family_id, start_time) 
  where archived_at is null;

-- create index on created_by for user's event queries
create index idx_events_created_by on events(created_by);

-- enable row level security on events table
alter table events enable row level security;

comment on table events is 'stores calendar events with binary visibility model (private/shared)';
comment on column events.title is 'event title, max 200 chars for ai processing efficiency';
comment on column events.start_time is 'event start timestamp';
comment on column events.end_time is 'event end timestamp, must be after start_time';
comment on column events.is_private is 'visibility flag: false = shared with family, true = private to creator';
comment on column events.archived_at is 'soft delete timestamp, null if active';

-- =============================================================================
-- table: event_participants
-- purpose: many-to-many relationship between events and family members/profiles
-- constraints: participants must belong to same family as event (enforced by trigger)
-- supports: both profiles (users with accounts) and family_members (without accounts)
-- =============================================================================

create table event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  member_id uuid references family_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  
  -- constraint: participant MUST be either profile OR member (not both, not neither)
  constraint participant_must_be_profile_or_member check (
    (profile_id is not null and member_id is null) or 
    (profile_id is null and member_id is not null)
  )
);

-- create index on event_id for listing participants of an event
create index idx_event_participants_event on event_participants(event_id);

-- create index on profile_id for finding events a user is participating in
create index idx_event_participants_profile on event_participants(profile_id) where profile_id is not null;

-- create index on member_id for finding events a member is participating in
create index idx_event_participants_member on event_participants(member_id) where member_id is not null;

-- unique constraint: one profile per event
create unique index event_participants_profile_unique 
  on event_participants(event_id, profile_id) 
  where profile_id is not null;

-- unique constraint: one member per event
create unique index event_participants_member_unique 
  on event_participants(event_id, member_id) 
  where member_id is not null;

-- enable row level security on event_participants table
alter table event_participants enable row level security;

comment on table event_participants is 'junction table for event-participant many-to-many relationship';
comment on column event_participants.event_id is 'references the event';
comment on column event_participants.profile_id is 'references profile (user with account), null if this is a member participant';
comment on column event_participants.member_id is 'references family_member (person without account), null if this is a profile participant';

