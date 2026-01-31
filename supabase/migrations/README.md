# HomeHQ Database Migrations

Consolidated and production-ready database migrations for HomeHQ multi-tenant family management system.

## Overview

These migrations set up a complete multi-tenant database with:
- ✅ **Authentication** - Supabase Auth integration with JWT sync
- ✅ **Row Level Security (RLS)** - Comprehensive policies for all tables
- ✅ **Edge Functions Support** - Security definer functions callable from edge functions
- ✅ **Multi-tenant Isolation** - Family-based data segregation
- ✅ **Production Ready** - Optimized indexes, triggers, and constraints

## Migration Files

Execute migrations in order:

1. **20260102120000_enable_extensions.sql**
   - Enables `uuid-ossp` and `pgcrypto` extensions
   - Required for UUID generation and secure random codes

2. **20260102120001_create_core_tables.sql**
   - Creates: `families`, `profiles`, `invitation_codes`, `family_members`
   - Core multi-tenant structure with user authentication

3. **20260102120002_create_event_tables.sql**
   - Creates: `events`, `event_participants`
   - Calendar events with binary visibility model (private/shared)
   - Supports both user accounts (profiles) and non-accounts (family_members)

4. **20260102120003_create_task_tables.sql**
   - Creates: `tasks`
   - Unified task system for manual and AI-generated tasks
   - Optimized indexes for performance

5. **20260102120004_create_functions.sql**
   - Database functions for atomic operations:
     - `create_family_and_assign_admin()` - Family creation
     - `generate_invitation_code()` - Secure invitation codes
     - `use_invitation_code()` - Redeem invitations
     - `get_event_with_participants()` - Optimized event queries
     - `validate_event_participants_bulk()` - Bulk validation
     - `sync_current_user_jwt()` - Manual JWT sync RPC
   - All functions have proper GRANT statements for authenticated users

6. **20260102120005_create_triggers.sql**
   - Automated data integrity:
     - `sync_family_to_jwt` - Automatic JWT metadata sync
     - `update_timestamp` - Auto-update timestamps
     - `clean_participants_on_private` - Remove participants from private events
     - `validate_participant_family` - Cross-family validation
     - `set_task_completion_metadata` - Auto-track completion

7. **20260102120006_enable_rls_policies.sql**
   - Comprehensive RLS policies for all tables
   - JWT-based family isolation
   - Role-based admin permissions
   - Proper SELECT, INSERT, UPDATE, DELETE policies

## Fresh Database Setup

For a **brand new database**:

```bash
# Option 1: Supabase CLI
supabase db reset

# Option 2: Manual execution
# Run migrations 1-7 in order via Supabase Dashboard SQL Editor
```

## Existing Database Migration

If you have an **existing database with users**:

```bash
# 1. Run all migrations 1-7 first
supabase db push

# 2. Then run the backfill script
# Execute OPTIONAL_backfill_jwt.sql in Supabase SQL Editor
```

The backfill script syncs existing users' `family_id` to their JWT tokens.

## Key Features

### Authentication Integration
- Profiles extend Supabase Auth users
- Automatic JWT sync via triggers
- Manual sync RPC available: `sync_current_user_jwt()`

### Multi-Tenant Security
- Family-based isolation via RLS
- JWT contains `family_id` for optimized queries
- No cross-family data leakage

### Edge Functions Support
All functions use `SECURITY DEFINER` and proper `GRANT` statements:
```sql
-- Functions callable from edge functions
grant execute on function create_family_and_assign_admin(uuid, text, text) to authenticated;
grant execute on function sync_current_user_jwt() to authenticated;
-- etc.
```

### Visibility Model
- **Events**: Private (creator only) or Shared (all family)
- **Tasks**: Private (creator only) or Shared (all family)
- **Participants**: Can be user accounts OR family members without accounts

### Performance Optimizations
- Denormalized `family_id` in tasks for RLS performance
- Partial indexes on active records only
- Composite indexes for common query patterns
- JWT-based RLS avoids profile joins

## Verification

After migration, verify everything works:

```sql
-- 1. Check extensions
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');

-- 2. Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 3. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 4. Verify JWT sync (if users exist)
SELECT 
  p.display_name,
  p.family_id as profile_family_id,
  u.raw_app_meta_data ->> 'family_id' as jwt_family_id,
  CASE 
    WHEN p.family_id::text = u.raw_app_meta_data ->> 'family_id' 
    THEN '✅ Synced' 
    ELSE '❌ Not synced' 
  END as status
FROM profiles p
JOIN auth.users u ON u.id = p.id;
```

## Architecture Decisions

### Why JWT Sync?
Storing `family_id` in JWT `raw_app_meta_data` allows RLS policies to use `auth.jwt() ->> 'family_id'` instead of joining the `profiles` table, significantly improving performance.

### Why family_members?
Supports non-account participants (children, pets) in events without requiring authentication.

### Why SECURITY DEFINER?
Functions need elevated privileges to:
- Insert into auth.users metadata
- Create profiles during onboarding
- Bypass RLS for atomic operations

### Why Separate Policies?
Granular policies provide:
- Better security audit trail
- Easier debugging of permission issues
- More flexible permission models

## Troubleshooting

### RLS Permission Denied
```sql
-- Check if user's JWT has family_id
SELECT auth.jwt() ->> 'family_id';

-- If null, manually sync:
SELECT sync_current_user_jwt();
```

### Can't Create Family
```sql
-- Ensure user is authenticated
SELECT auth.uid();

-- Check function permissions
SELECT has_function_privilege('create_family_and_assign_admin(uuid, text, text)', 'execute');
```

### Cross-Family Access
```sql
-- Verify family_id matches
SELECT 
  auth.jwt() ->> 'family_id' as jwt_family,
  p.family_id as profile_family
FROM profiles p 
WHERE p.id = auth.uid();
```

## Maintenance

### Cleanup Expired Invitations
```sql
DELETE FROM invitation_codes 
WHERE expires_at < now() 
AND used_at IS NULL;
```

### Archive Old Events
```sql
UPDATE events 
SET archived_at = now() 
WHERE start_time < now() - interval '1 year'
AND archived_at IS NULL;
```

### Performance Monitoring
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Production Checklist

- [ ] All migrations executed in order
- [ ] RLS enabled on all tables
- [ ] Indexes created for common queries
- [ ] Function permissions granted
- [ ] JWT sync verified for all users
- [ ] Backfill script run (if existing users)
- [ ] No RLS permission errors in logs
- [ ] Edge functions can call database functions
- [ ] Backup policy configured
- [ ] Monitoring alerts set up

## Support

For issues or questions:
1. Check verification queries above
2. Review RLS policies in migration 7
3. Check Supabase logs for detailed errors
4. Verify JWT contains `family_id`

---

**Last Updated**: January 31, 2026  
**Database Version**: PostgreSQL 15+ (Supabase)  
**Migration Count**: 7 core + 1 optional backfill
