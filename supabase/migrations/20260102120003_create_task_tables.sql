-- migration: create tasks table
-- description: creates tasks table for manual and ai-generated tasks with visibility model
-- affected objects: tasks table
-- dependencies: 20260102120002_create_event_tables.sql

-- =============================================================================
-- table: tasks
-- purpose: unified task feed combining ai-generated and manual tasks
-- task types:
--   - manual tasks: event_id = null, created directly by users
--   - ai-generated tasks: event_id references source calendar event
-- visibility model: inherits is_private from source event or set explicitly
-- denormalization: family_id and is_private denormalized for rls performance
-- =============================================================================

create table tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  due_date timestamptz,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references profiles(id) on delete set null,
  is_private boolean not null default false,
  event_id uuid references events(id) on delete set null,
  suggestion_id text,
  created_from_suggestion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- create composite index on family_id and is_completed for task feed queries
-- partial index excludes archived tasks for performance
create index idx_tasks_family_completed 
  on tasks(family_id, is_completed) 
  where archived_at is null;

-- create index on assigned_to for "my tasks" queries
-- partial index only includes active, incomplete tasks
create index idx_tasks_assigned_to 
  on tasks(assigned_to) 
  where is_completed = false and archived_at is null;

-- create index on event_id for finding tasks generated from a specific event
create index idx_tasks_event_id on tasks(event_id) where event_id is not null;

-- create index on due_date for deadline-based queries
-- partial index only includes active, incomplete tasks
create index idx_tasks_due_date 
  on tasks(due_date) 
  where archived_at is null and is_completed = false;

-- composite index for family task lists with sorting by due date
create index idx_tasks_family_due 
  on tasks(family_id, due_date desc) 
  where is_completed = false and archived_at is null;

-- index for family_id alone (RLS performance)
create index idx_tasks_family_id on tasks(family_id);

-- enable row level security on tasks table
alter table tasks enable row level security;

comment on table tasks is 'stores both manual and ai-generated tasks with binary visibility model';
comment on column tasks.family_id is 'denormalized family context for rls performance optimization';
comment on column tasks.created_by is 'user who created the task, preserved even if user leaves (on delete set null)';
comment on column tasks.assigned_to is 'optional assignee for task';
comment on column tasks.title is 'task description/title';
comment on column tasks.due_date is 'optional deadline for task completion';
comment on column tasks.is_completed is 'completion status flag';
comment on column tasks.completed_at is 'timestamp when task was marked complete';
comment on column tasks.completed_by is 'user who marked task as complete';
comment on column tasks.is_private is 'denormalized visibility flag: false = shared, true = private';
comment on column tasks.event_id is 'source event if ai-generated, null for manual tasks';
comment on column tasks.suggestion_id is 'ai rule identifier (e.g. birthday, health) for analytics';
comment on column tasks.created_from_suggestion is 'analytics flag: true if user accepted ai suggestion';
comment on column tasks.archived_at is 'soft delete timestamp, null if active';

