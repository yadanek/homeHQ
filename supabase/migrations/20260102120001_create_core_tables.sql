-- migration: create core tables for multi-tenant family structure
-- description: creates families, profiles, and invitation_codes tables with constraints
-- affected objects: families, profiles, invitation_codes tables
-- dependencies: 20260102120000_enable_extensions.sql

-- =============================================================================
-- table: families
-- purpose: central hub for multi-tenant isolation, each family is a separate tenant
-- =============================================================================

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- enable row level security on families table
-- all tables must have rls enabled even if policies allow public access
alter table families enable row level security;

comment on table families is 'stores family/household information for multi-tenant isolation';
comment on column families.name is 'display name of the family/household';

-- =============================================================================
-- table: profiles
-- purpose: extends auth.users with family context and role information
-- notes: family_id will be synced to jwt raw_app_meta_data via trigger
-- =============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  role text not null check (role in ('admin', 'member')) default 'member',
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- create index on family_id for efficient family member lookups
create index idx_profiles_family_id on profiles(family_id);

-- enable row level security on profiles table
alter table profiles enable row level security;

comment on table profiles is 'extends auth.users with family membership and role information';
comment on column profiles.family_id is 'references the family this user belongs to';
comment on column profiles.role is 'user role within family: admin can manage family, member has standard access';
comment on column profiles.display_name is 'user-facing display name shown to family members';

-- =============================================================================
-- table: invitation_codes
-- purpose: manages time-limited invitation codes for family member onboarding
-- security: only admins can create codes, codes expire after configured period
-- =============================================================================

create table invitation_codes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  code text not null unique check (length(code) = 8),
  created_by uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references profiles(id) on delete set null
);

-- create unique index on code for fast lookups during redemption
create unique index idx_invitation_codes_code on invitation_codes(code);

-- create composite index on family_id and expires_at for cleanup queries
create index idx_invitation_codes_family_expires on invitation_codes(family_id, expires_at);

-- enable row level security on invitation_codes table
alter table invitation_codes enable row level security;

comment on table invitation_codes is 'stores time-limited invitation codes for adding new family members';
comment on column invitation_codes.code is '8-character alphanumeric invitation code';
comment on column invitation_codes.created_by is 'admin who generated this invitation code';
comment on column invitation_codes.expires_at is 'expiration timestamp, codes invalid after this time';
comment on column invitation_codes.used_at is 'timestamp when code was redeemed, null if unused';
comment on column invitation_codes.used_by is 'user who redeemed this code';

-- =============================================================================
-- table: family_members
-- purpose: stores family members without user accounts (e.g., children, pets)
-- security: all family members can view and manage these
-- =============================================================================

create table family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- create index on family_id for efficient family member lookups
create index idx_family_members_family_id on family_members(family_id);

-- enable row level security on family_members table
alter table family_members enable row level security;

comment on table family_members is 'stores family members without user accounts (children, pets, etc.)';
comment on column family_members.name is 'display name of the family member';
comment on column family_members.is_admin is 'reserved for future use, currently not enforced';

