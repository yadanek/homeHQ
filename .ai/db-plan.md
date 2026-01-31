# HomeHQ - Database Schema (PostgreSQL)

## Overview

This document defines the complete database schema for HomeHQ MVP, a family management application built on Supabase (PostgreSQL). The design emphasizes multi-tenant isolation, binary visibility model (Private vs. Shared), and Row Level Security (RLS) optimized through JWT metadata.

---

## 1. Tables

### 1.1. `families`

Central hub for multi-tenant isolation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique family identifier |
| `name` | `text` | `NOT NULL CHECK (length(trim(name)) > 0)` | Family display name |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last modification timestamp |

**Indexes:**
- Primary key index on `id` (automatic)

---

### 1.2. `profiles`

Extends `auth.users` with family context and role information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | References Supabase Auth user |
| `family_id` | `uuid` | `NOT NULL REFERENCES families(id) ON DELETE CASCADE` | Family membership |
| `role` | `text` | `NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member'` | User role within family |
| `display_name` | `text` | `NOT NULL CHECK (length(trim(display_name)) > 0)` | User's display name |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Profile creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last modification timestamp |

**Indexes:**
- Primary key index on `id` (automatic)
- `idx_profiles_family_id` on `family_id` (B-tree)

**Notes:**
- The `family_id` will be synced to JWT `raw_app_meta_data` via trigger for RLS optimization.
- First user to create a family automatically receives `role = 'admin'`.

---

### 1.3. `family_members`

Stores family members without user accounts (e.g., children, dependents).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique member identifier |
| `family_id` | `uuid` | `NOT NULL REFERENCES families(id) ON DELETE CASCADE` | Family membership |
| `name` | `text` | `NOT NULL CHECK (length(trim(name)) > 0)` | Member's display name |
| `is_admin` | `boolean` | `NOT NULL DEFAULT false` | Admin flag (for display purposes) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |

**Indexes:**
- Primary key index on `id` (automatic)
- `idx_family_members_family_id` on `family_id` (B-tree)

**Notes:**
- Used for family members who don't have user accounts (profiles).
- Can be event participants alongside profiles.
- The `is_admin` flag is for display/organizational purposes only; does not grant system permissions.

---

### 1.4. `invitation_codes`

Manages family invitation codes with expiration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique invitation identifier |
| `family_id` | `uuid` | `NOT NULL REFERENCES families(id) ON DELETE CASCADE` | Family this code belongs to |
| `code` | `text` | `NOT NULL UNIQUE CHECK (length(code) = 8)` | Short invitation code (8 chars) |
| `created_by` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | Admin who created the code |
| `expires_at` | `timestamptz` | `NOT NULL` | Expiration timestamp |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `used_at` | `timestamptz` | - | When code was used (NULL if unused) |
| `used_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Who used this code |

**Indexes:**
- Primary key index on `id` (automatic)
- `idx_invitation_codes_code` on `code` (B-tree, unique)
- `idx_invitation_codes_family_expires` on `(family_id, expires_at)` (B-tree)

**Notes:**
- Codes are generated using `pg_crypto` extension for security.
- Only users with `role = 'admin'` can create invitation codes.
- Expired codes should be periodically cleaned via cron job.

---

### 1.5. `events`

Calendar events with binary visibility model.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique event identifier |
| `family_id` | `uuid` | `NOT NULL REFERENCES families(id) ON DELETE CASCADE` | Family this event belongs to |
| `created_by` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | Event creator |
| `title` | `text` | `NOT NULL CHECK (length(trim(title)) > 0 AND length(title) <= 200)` | Event title (analyzed by AI) |
| `description` | `text` | - | Optional event details |
| `start_time` | `timestamptz` | `NOT NULL` | Event start time |
| `end_time` | `timestamptz` | `NOT NULL CHECK (end_time > start_time)` | Event end time (must be after start) |
| `is_private` | `boolean` | `NOT NULL DEFAULT false` | Visibility flag (false = Shared, true = Private) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last modification timestamp |
| `archived_at` | `timestamptz` | - | Soft delete timestamp |

**Indexes:**
- Primary key index on `id` (automatic)
- `idx_events_family_start` on `(family_id, start_time)` WHERE `archived_at IS NULL` (B-tree, partial)
- `idx_events_created_by` on `created_by` (B-tree)

**Notes:**
- `title` length limited to 200 chars for AI processing efficiency.
- `archived_at` enables soft delete for analytics.
- When `is_private` changes from `false` to `true`, trigger cleans `event_participants`.

---

### 1.6. `event_participants`

Many-to-many relationship between events and family members (both profiles and members).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique participation record |
| `event_id` | `uuid` | `NOT NULL REFERENCES events(id) ON DELETE CASCADE` | Event reference |
| `profile_id` | `uuid` | `REFERENCES profiles(id) ON DELETE CASCADE` | Profile participant reference (nullable) |
| `member_id` | `uuid` | `REFERENCES family_members(id) ON DELETE CASCADE` | Member participant reference (nullable) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | When participant was added |
| `CHECK (participant_must_be_profile_or_member)` | - | Check constraint | Ensures exactly one of profile_id or member_id is set |

**Indexes:**
- Primary key index on `id` (automatic)
- `idx_event_participants_event` on `event_id` (B-tree)
- `idx_event_participants_profile` on `profile_id` (B-tree)
- `event_participants_profile_unique` on `(event_id, profile_id)` WHERE `profile_id IS NOT NULL` (partial unique)
- `event_participants_member_unique` on `(event_id, member_id)` WHERE `member_id IS NOT NULL` (partial unique)

**Notes:**
- Participants can be EITHER profiles (users with accounts) OR members (without accounts).
- The CHECK constraint enforces that exactly one of `profile_id` or `member_id` must be set (not both, not neither).
- Participants must belong to the same `family_id` as the event (enforced by trigger).
- Private events should have no participants or only the creator.
- Partial unique indexes prevent duplicate participants for each type separately.

---

### 1.7. `tasks`

Task feed combining AI-generated and manual tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique task identifier |
| `family_id` | `uuid` | `NOT NULL REFERENCES families(id) ON DELETE CASCADE` | Family context (denormalized) |
| `created_by` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE SET NULL` | Task creator |
| `assigned_to` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Optional assignee |
| `title` | `text` | `NOT NULL CHECK (length(trim(title)) > 0)` | Task description |
| `due_date` | `timestamptz` | - | Optional deadline |
| `is_completed` | `boolean` | `NOT NULL DEFAULT false` | Completion status |
| `completed_at` | `timestamptz` | - | When task was marked complete |
| `completed_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Who completed the task |
| `is_private` | `boolean` | `NOT NULL DEFAULT false` | Visibility flag (denormalized from event) |
| `event_id` | `uuid` | `REFERENCES events(id) ON DELETE SET NULL` | Source event (if AI-generated from calendar event, NULL for manual tasks) |
| `suggestion_id` | `text` | - | AI rule identifier (e.g., 'birthday', 'health') |
| `created_from_suggestion` | `boolean` | `NOT NULL DEFAULT false` | Analytics flag: was this task added from AI suggestion? |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last modification timestamp |
| `archived_at` | `timestamptz` | - | Soft delete timestamp |

**Indexes:**
- Primary key index on `id` (automatic)
- `idx_tasks_family_completed` on `(family_id, is_completed)` WHERE `archived_at IS NULL` (B-tree, partial)
- `idx_tasks_assigned_to` on `assigned_to` WHERE `is_completed = false AND archived_at IS NULL` (B-tree, partial)
- `idx_tasks_event_id` on `event_id` (B-tree)
- `idx_tasks_due_date` on `due_date` WHERE `archived_at IS NULL AND is_completed = false` (B-tree, partial)

**Notes:**
- Tasks can be **manual** (`event_id = NULL`) or **AI-generated** (`event_id` references source calendar event).
- `family_id` and `is_private` are denormalized for RLS performance.
- `suggestion_id` tracks which AI rule generated the task (e.g., 'birthday', 'health') for metrics.
- `created_from_suggestion = true` measures conversion rate (US-006 metric).
- `ON DELETE SET NULL` preserves task history even if user leaves family or event is deleted.

---

## 2. Relationships

### Entity Relationship Diagram (Text Format)

```
families (1) ──< (M) profiles
families (1) ──< (M) family_members
families (1) ──< (M) invitation_codes
families (1) ──< (M) events
families (1) ──< (M) tasks

profiles (1) ──< (M) events [created_by]
profiles (1) ──< (M) tasks [created_by]
profiles (1) ──< (M) tasks [assigned_to]
profiles (1) ──< (M) tasks [completed_by]
profiles (1) ──< (M) invitation_codes [created_by]
profiles (1) ──< (M) invitation_codes [used_by]

events (M) ──< (M) profiles [via event_participants]
events (M) ──< (M) family_members [via event_participants]
events (1) ──< (M) tasks [event_id]
```

### Cardinality Summary

| Relationship | Type | Description |
|--------------|------|-------------|
| `families` → `profiles` | 1:M | One family has many profiles (users with accounts) |
| `families` → `family_members` | 1:M | One family has many members (people without accounts) |
| `families` → `events` | 1:M | One family has many events |
| `families` → `tasks` | 1:M | One family has many tasks |
| `families` → `invitation_codes` | 1:M | One family has many invitation codes |
| `profiles` → `events` | 1:M | One user creates many events |
| `profiles` → `tasks` | 1:M | One user creates/is assigned/completes many tasks |
| `events` ↔ `profiles` | M:M | Events have multiple profile participants (via `event_participants`) |
| `events` ↔ `family_members` | M:M | Events have multiple member participants (via `event_participants`) |
| `events` → `tasks` | 1:M | One event can generate multiple AI-suggested tasks |

---

## 3. Database Functions

### 3.1. `create_family_and_assign_admin(user_id uuid, family_name text, user_display_name text)`

**Purpose:** Atomically creates a new family and assigns the user as admin.

**Returns:** `uuid` (family_id)

**Logic:**
1. Insert new record into `families` with provided `family_name`
2. Insert new record into `profiles` with `family_id`, `user_id`, `role = 'admin'`, and `user_display_name`
3. Return `family_id`

**Transaction:** Wrapped in transaction to ensure atomicity.

---

### 3.2. `generate_invitation_code(family_id uuid, admin_id uuid, days_valid integer)`

**Purpose:** Generates a secure 8-character invitation code.

**Returns:** `text` (invitation code)

**Logic:**
1. Verify `admin_id` has `role = 'admin'` in specified `family_id`
2. Generate random 8-character alphanumeric code using `encode(gen_random_bytes(6), 'base64')` (truncated/cleaned)
3. Insert into `invitation_codes` with `expires_at = now() + days_valid * interval '1 day'`
4. Return code

---

### 3.3. `use_invitation_code(code text, user_id uuid, user_display_name text)`

**Purpose:** Redeems invitation code and adds user to family.

**Returns:** `uuid` (family_id)

**Logic:**
1. Find valid invitation code (not expired, not used)
2. Insert user into `profiles` with corresponding `family_id` and `role = 'member'`
3. Update `invitation_codes` set `used_at = now()`, `used_by = user_id`
4. Return `family_id`

**Validation:**
- Code must exist and not be expired (`expires_at > now()`)
- Code must not be used (`used_at IS NULL`)

---

### 3.4. `get_all_event_participants(event_uuid uuid)`

**Purpose:** Returns unified view of all event participants (both profiles and members).

**Returns:** TABLE with columns:
- `participant_type` (text): 'profile' or 'member'
- `participant_id` (uuid): ID of the participant
- `participant_name` (text): Display name
- `is_admin` (boolean): Admin status

**Logic:**
1. Query profile participants and join with `profiles` table
2. Query member participants and join with `family_members` table
3. UNION ALL results to return unified list

**Notes:**
- Helper function for client-side queries
- Simplifies retrieving all participants regardless of type

---

## 4. Triggers

### 4.1. `trg_sync_family_to_jwt`

**Table:** `profiles`  
**Event:** `AFTER INSERT OR UPDATE OF family_id`  
**Purpose:** Syncs `family_id` to Supabase Auth JWT metadata for RLS optimization.

**Function:** `sync_family_to_jwt()`

**Logic:**
```sql
UPDATE auth.users
SET raw_app_meta_data = 
  COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('family_id', NEW.family_id::text)
WHERE id = NEW.id;
```

---

### 4.2. `trg_clean_participants_on_private`

**Table:** `events`  
**Event:** `AFTER UPDATE OF is_private`  
**Purpose:** Automatically removes participants when event becomes private.

**Function:** `clean_participants_on_private()`

**Logic:**
```sql
IF NEW.is_private = true AND OLD.is_private = false THEN
  DELETE FROM event_participants 
  WHERE event_id = NEW.id;
END IF;
```

---

### 4.3. `trg_validate_participant_family`

**Table:** `event_participants`  
**Event:** `BEFORE INSERT`  
**Purpose:** Ensures participants (both profiles and members) belong to the same family as the event.

**Function:** `validate_participant_family()`

**Logic:**
```sql
-- Get event's family_id
SELECT family_id INTO event_family_id FROM events WHERE id = NEW.event_id;

-- If profile participant
IF NEW.profile_id IS NOT NULL THEN
  SELECT family_id INTO participant_family_id 
  FROM profiles WHERE id = NEW.profile_id;
  
  IF participant_family_id != event_family_id THEN
    RAISE EXCEPTION 'participant must belong to the same family as the event';
  END IF;

-- If member participant
ELSIF NEW.member_id IS NOT NULL THEN
  SELECT family_id INTO participant_family_id 
  FROM family_members WHERE id = NEW.member_id;
  
  IF participant_family_id != event_family_id THEN
    RAISE EXCEPTION 'participant must belong to the same family as the event';
  END IF;

ELSE
  RAISE EXCEPTION 'participant must have either profile_id or member_id';
END IF;
```

**Notes:**
- Validates both profile and member participants
- Ensures cross-family participants cannot be added

---

### 4.4. `trg_update_timestamp`

**Tables:** `families`, `profiles`, `events`, `tasks`  
**Event:** `BEFORE UPDATE`  
**Purpose:** Automatically updates `updated_at` timestamp.

**Function:** `update_timestamp()`

**Logic:**
```sql
NEW.updated_at = now();
RETURN NEW;
```

---

### 4.5. `trg_set_task_completion_metadata`

**Table:** `tasks`  
**Event:** `BEFORE UPDATE OF is_completed`  
**Purpose:** Sets `completed_at` and `completed_by` when task is marked complete.

**Function:** `set_task_completion_metadata()`

**Logic:**
```sql
IF NEW.is_completed = true AND OLD.is_completed = false THEN
  NEW.completed_at = now();
  NEW.completed_by = auth.uid();
END IF;
```

---

## 5. Row Level Security (RLS) Policies

### 5.1. `families`

**Enable RLS:** `ALTER TABLE families ENABLE ROW LEVEL SECURITY;`

| Policy Name | Command | Expression |
|-------------|---------|------------|
| `families_select` | `SELECT` | `auth.jwt() ->> 'family_id' = id::text` |
| `families_update` | `UPDATE` | `auth.jwt() ->> 'family_id' = id::text AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` |

**Notes:**
- All family members can view their family.
- Only admins can update family details.
- Family creation is handled via `create_family_and_assign_admin()` function.

---

### 5.2. `profiles`

**Enable RLS:** `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`

| Policy Name | Command | Expression |
|-------------|---------|------------|
| `profiles_select` | `SELECT` | `auth.jwt() ->> 'family_id' = family_id::text` |
| `profiles_update` | `UPDATE` | `id = auth.uid()` |

**Notes:**
- All family members can see other members' profiles.
- Users can only update their own profile (display_name).
- Role changes and family assignments are admin-only operations (handled via functions).

---

### 5.3. `family_members`

**Enable RLS:** `ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;`

| Policy Name | Command | Expression |
|-------------|---------|------------|
| `family_members_all` | `ALL` | `auth.jwt() ->> 'family_id' = family_id::text` |

**Notes:**
- All family members can perform all operations (SELECT, INSERT, UPDATE, DELETE) on family_members.
- Family members without accounts cannot log in, so they cannot be added as participants by themselves.
- The `is_admin` field is for organizational purposes only and does not grant system-level permissions.

---

### 5.4. `invitation_codes`

**Enable RLS:** `ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;`

| Policy Name | Command | Expression |
|-------------|---------|------------|
| `invitation_codes_select` | `SELECT` | `auth.jwt() ->> 'family_id' = family_id::text AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` |
| `invitation_codes_insert` | `INSERT` | `auth.jwt() ->> 'family_id' = family_id::text AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` |

**Notes:**
- Only admins can view and create invitation codes for their family.
- Code redemption is handled via `use_invitation_code()` function (bypasses RLS).

---

### 5.5. `events`

**Enable RLS:** `ALTER TABLE events ENABLE ROW LEVEL SECURITY;`

| Policy Name | Command | Expression |
|-------------|---------|------------|
| `events_select_shared` | `SELECT` | `auth.jwt() ->> 'family_id' = family_id::text AND is_private = false AND archived_at IS NULL` |
| `events_select_own_private` | `SELECT` | `created_by = auth.uid() AND is_private = true AND archived_at IS NULL` |
| `events_insert` | `INSERT` | `auth.jwt() ->> 'family_id' = family_id::text AND created_by = auth.uid()` |
| `events_update_own` | `UPDATE` | `created_by = auth.uid() AND archived_at IS NULL` |
| `events_delete_own` | `DELETE` | `created_by = auth.uid()` (soft delete via `archived_at`) |

**Notes:**
- Family members see all shared events.
- Users see only their own private events.
- Users can only modify/delete events they created.

---

### 5.6. `event_participants`

**Enable RLS:** `ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;`

| Policy Name | Command | Expression |
|-------------|---------|------------|
| `participants_select` | `SELECT` | `EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND (e.is_private = false OR e.created_by = auth.uid()) AND auth.jwt() ->> 'family_id' = e.family_id::text)` |
| `participants_insert` | `INSERT` | `EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.created_by = auth.uid())` |
| `participants_delete` | `DELETE` | `EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.created_by = auth.uid())` |

**Notes:**
- Participants visible only for shared events or user's own private events.
- Only event creator can add/remove participants (both profile and member participants).
- The trigger `trg_validate_participant_family` ensures participants belong to the same family.

---

### 5.7. `tasks`

**Enable RLS:** `ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;`

| Policy Name | Command | Expression |
|-------------|---------|------------|
| `tasks_select_shared` | `SELECT` | `family_id::text = auth.jwt() ->> 'family_id' AND is_private = false AND archived_at IS NULL` |
| `tasks_select_own_private` | `SELECT` | `created_by = auth.uid() AND is_private = true AND archived_at IS NULL` |
| `tasks_insert` | `INSERT` | `family_id::text = auth.jwt() ->> 'family_id' AND created_by = auth.uid()` |
| `tasks_update_own` | `UPDATE` | `(created_by = auth.uid() OR assigned_to = auth.uid()) AND archived_at IS NULL` |
| `tasks_delete_own` | `DELETE` | `created_by = auth.uid()` (soft delete via `archived_at`) |

**Notes:**
- Family members see all shared tasks.
- Users see only their own private tasks.
- Both creator and assignee can update task status (mark complete).
- Only creator can delete tasks.

---

## 6. Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Secure code generation
```

---

## 7. Performance Optimization Notes

### 7.1. Index Strategy

- **Composite indexes** on frequently filtered columns (`family_id`, `start_time`, `is_completed`)
- **Partial indexes** exclude soft-deleted records (`WHERE archived_at IS NULL`)
- **Covering indexes** for common query patterns (e.g., task feed filtered by family and completion status)

### 7.2. Denormalization Trade-offs

- `tasks.family_id`: Denormalized to avoid JOIN with events in RLS policies
- `tasks.is_private`: Denormalized to simplify visibility logic
- Trade-off: Slightly more complex update logic vs. significant RLS performance gain

### 7.3. JWT Metadata Optimization

- Storing `family_id` in JWT eliminates need for JOIN to `profiles` table in every RLS check
- Reduces query complexity from O(n log n) to O(log n) for family-scoped queries

---

## 8. Analytics & Metrics Support

### 8.1. AI Suggestion Conversion Rate

**Query Example:**
```sql
SELECT 
  suggestion_id,
  COUNT(*) FILTER (WHERE created_from_suggestion = true) as accepted,
  COUNT(*) as total_tasks
FROM tasks
WHERE suggestion_id IS NOT NULL
  AND family_id = [family_id]
GROUP BY suggestion_id;
```

### 8.2. Task Completion Rate

**Query Example:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE is_completed = true) * 100.0 / COUNT(*) as completion_rate
FROM tasks
WHERE family_id = [family_id]
  AND archived_at IS NULL
  AND created_at > now() - interval '30 days';
```

### 8.3. Daily Active Users (DAU)

Tracked via Supabase Auth session logs (not stored in application schema).

---

## 9. Migration Sequence

Recommended order for schema creation:

1. Enable extensions (`uuid-ossp`, `pgcrypto`)
2. Create `families` table
3. Create `profiles` table
4. Create `invitation_codes` table
5. Create `events` table
6. Create `event_participants` table
7. Create `tasks` table
8. Create database functions
9. Create triggers
10. Enable RLS on all tables
11. Create RLS policies
12. Create indexes
13. **[Added 2026-01-28]** Create `family_members` table
14. **[Added 2026-01-28]** Add `member_id` column to `event_participants`
15. **[Added 2026-01-29]** Make `profile_id` nullable in `event_participants`
16. **[Added 2026-01-29]** Update `validate_participant_family()` function to support both profiles and members

**Note:** Migrations 13-16 were added post-MVP to support family members without user accounts.

---

## 10. Future Considerations (Post-MVP)

### 10.1. Unresolved Issues from Planning Session

- **Calendar Conflict Detection:** May require additional index on `(family_id, start_time, end_time)` with range queries
- **Resource Limits:** Consider adding constraints like `MAX 10 active invitation codes per family`
- **Data Cleanup:** Implement Supabase cron job for `invitation_codes` cleanup (WHERE `expires_at < now()`)
- **Rejected AI Suggestions:** Currently not logged; consider adding `suggestion_log` table for full analytics

### 10.2. Scalability Enhancements

- **Partitioning:** If family count exceeds 100K, consider partitioning `events` and `tasks` by `family_id`
- **Archival:** Move `archived_at IS NOT NULL` records to separate cold storage tables after 1 year
- **Read Replicas:** For analytics queries, use Supabase read replicas to offload reporting workload

---

## 11. Security Checklist

- [x] RLS enabled on all tables
- [x] JWT metadata sync for performance
- [x] CHECK constraints prevent invalid data
- [x] Foreign keys enforce referential integrity
- [x] ON DELETE CASCADE for tenant isolation (families)
- [x] ON DELETE SET NULL for preserving task history
- [x] Admin-only operations protected by role checks
- [x] Private event participants auto-cleaned on visibility change
- [x] Cross-family participant insertion blocked by trigger
- [x] Invitation codes use cryptographic randomness

---

## 12. Recent Schema Changes

### January 28-29, 2026: Family Members Support

**Migration Files:**
- `20260128000000_add_family_members.sql`
- `20260129000000_fix_participant_validation.sql`
- `20260129000001_make_profile_id_nullable.sql`

**Changes:**

1. **New Table: `family_members`**
   - Stores family members without user accounts (e.g., children, dependents)
   - Allows events to have participants who don't have login credentials
   - Has columns: `id`, `family_id`, `name`, `is_admin`, `created_at`

2. **Updated: `event_participants` Table**
   - Added `member_id` column (references `family_members`)
   - Made `profile_id` nullable (was previously NOT NULL)
   - Added CHECK constraint: `participant_must_be_profile_or_member`
     - Ensures exactly one of `profile_id` or `member_id` is set
   - Replaced single unique constraint with two partial unique indexes:
     - `event_participants_profile_unique` on `(event_id, profile_id)` WHERE `profile_id IS NOT NULL`
     - `event_participants_member_unique` on `(event_id, member_id)` WHERE `member_id IS NOT NULL`

3. **Updated: `validate_participant_family()` Function**
   - Now validates both profile and member participants
   - Ensures both types belong to the same family as the event
   - Raises appropriate errors for invalid participants

4. **New Function: `get_all_event_participants()`**
   - Helper function returning unified view of all participants
   - Returns participant type, ID, name, and admin status
   - Uses UNION ALL to combine profile and member participants

**Impact:**
- Event participants can now be users with accounts OR family members without accounts
- Frontend must handle both participant types when displaying event attendees
- The system is more flexible for families with young children or dependents

---

## Appendix: Complete SQL Schema

See migration files for executable SQL statements. This document serves as the architectural blueprint for implementation.

**Version:** 1.1.0 (MVP + Family Members)  
**Last Updated:** 2026-01-29  
**Owner:** HomeHQ Engineering Team

