-- =============================================================================
-- OPTIONAL BACKFILL SCRIPT
-- =============================================================================
-- This script is ONLY needed if you're applying migrations to an EXISTING database
-- with users already in it. For a fresh database setup, this is NOT needed as the
-- trigger will automatically sync family_id for new users.
--
-- Purpose: Synchronizes existing users' family_id from profiles to JWT app_metadata
--
-- When to use:
--   - Migrating from an old database version without JWT sync
--   - Users experiencing RLS errors after migration
--
-- How to use:
--   1. Run all migrations first (20260102120000 through 20260102120006)
--   2. Then run this script manually in Supabase SQL Editor
--
-- =============================================================================

do $$
declare
  profile_record record;
  updated_count int := 0;
  error_count int := 0;
begin
  raise notice 'Starting family_id JWT backfill...';
  
  -- Loop through all profiles with family_id
  for profile_record in 
    select p.id, p.family_id, p.display_name
    from public.profiles p
    where p.family_id is not null
  loop
    begin
      -- Update auth.users.raw_app_meta_data with family_id
      update auth.users
      set raw_app_meta_data = 
        coalesce(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('family_id', profile_record.family_id::text)
      where id = profile_record.id;
      
      updated_count := updated_count + 1;
      
    exception when others then
      error_count := error_count + 1;
      raise warning 'Failed to update user %: %', profile_record.id, sqlerrm;
    end;
  end loop;
  
  raise notice 'Backfill complete: % users updated, % errors', updated_count, error_count;
end $$;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Run this to verify that family_id is properly synced to JWT for all users
--
-- Expected result: All rows should show '✅ Synced' in the status column
-- If any show '❌ Not synced', investigate or re-run the backfill script
-- =============================================================================

/*
select 
  p.id,
  p.display_name,
  p.family_id as profile_family_id,
  u.raw_app_meta_data ->> 'family_id' as jwt_family_id,
  case 
    when p.family_id::text = u.raw_app_meta_data ->> 'family_id' 
    then '✅ Synced' 
    else '❌ Not synced' 
  end as status
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at desc;
*/
