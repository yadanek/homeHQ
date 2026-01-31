# Deployment Guide: POST /events Endpoint

## Overview

This guide provides step-by-step instructions for deploying the `POST /events` endpoint and all its dependencies to production.

**Prerequisites**:
- Supabase project created
- Database migrations up to date
- Node.js 18+ installed
- Supabase CLI installed (`npm install -g supabase`)

## Pre-Deployment Checklist

### 1. Environment Variables

Ensure the following environment variables are set:

**Frontend (.env.local)**:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Verify**:
```bash
# Check frontend env
cat .env.local

# Verify Supabase connection
supabase status
```

### 2. Database Schema

**Verify tables exist**:
```bash
supabase db remote --db-url $DATABASE_URL execute \
  "SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('events', 'event_participants', 'tasks');"
```

**Expected output**: events, event_participants, tasks

### 3. Dependencies Installed

```bash
# Install all npm dependencies
npm install

# Verify Zod is installed (required for validation)
npm list zod

# Verify Supabase client is installed
npm list @supabase/supabase-js
```

## Deployment Steps

### Step 1: Apply Database Migrations

#### 1.1 Review Migration Files

```bash
ls -la supabase/migrations/
```

**Required migrations**:
- ✅ `20260102120002_create_event_tables.sql`
- ✅ `20260102120003_create_task_tables.sql`
- ✅ `20260102120005_create_triggers.sql`
- ✅ `20260126120000_add_event_helper_functions.sql` (NEW)

#### 1.2 Apply Migrations

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations to production
supabase db push

# Verify migrations applied
supabase db remote --db-url $DATABASE_URL execute \
  "SELECT * FROM supabase_migrations.schema_migrations 
   ORDER BY version DESC LIMIT 5;"
```

#### 1.3 Verify Database Functions

```bash
# Check if helper functions exist
supabase db remote --db-url $DATABASE_URL execute \
  "SELECT proname FROM pg_proc 
   WHERE proname IN ('get_event_with_participants', 'validate_event_participants_bulk');"
```

**Expected output**:
- get_event_with_participants
- validate_event_participants_bulk

### Step 2: Deploy Edge Function

#### 2.1 Review Edge Function Code

```bash
cat supabase/functions/analyze-event-for-suggestions/index.ts
```

Verify:
- ✅ Keyword templates are correct
- ✅ CORS headers included
- ✅ Error handling implemented

#### 2.2 Deploy to Supabase

```bash
# Deploy function
supabase functions deploy analyze-event-for-suggestions

# Verify deployment
supabase functions list
```

#### 2.3 Test Edge Function

```bash
# Test with sample data
supabase functions invoke analyze-event-for-suggestions \
  --data '{
    "title": "Doctor appointment",
    "start_time": "2026-02-01T10:00:00Z",
    "user_role": "admin"
  }'
```

**Expected response**:
```json
{
  "suggestions": [
    {
      "suggestion_id": "health",
      "title": "Prepare medical documents",
      "due_date": "2026-01-31T10:00:00Z",
      "description": "Gather insurance cards and medical history"
    }
  ]
}
```

#### 2.4 Monitor Function Logs

```bash
# View real-time logs
supabase functions logs analyze-event-for-suggestions --follow
```

### Step 3: Verify RLS Policies

#### 3.1 Check Events Table Policies

```bash
supabase db remote --db-url $DATABASE_URL execute \
  "SELECT schemaname, tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'events';"
```

**Required policies**:
- ✅ `Users can create events in their family` (INSERT)
- ✅ `Users can view events based on privacy` (SELECT)

#### 3.2 Check Event Participants Policies

```bash
supabase db remote --db-url $DATABASE_URL execute \
  "SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE tablename = 'event_participants';"
```

#### 3.3 Test RLS Enforcement

```sql
-- Run as authenticated user
SET LOCAL jwt.claims.sub = 'test-user-id';

-- Try to create event in different family (should fail)
INSERT INTO events (family_id, created_by, title, start_time, end_time)
VALUES ('different-family-id', 'test-user-id', 'Test', NOW(), NOW() + INTERVAL '1 hour');
```

**Expected**: Permission denied

### Step 4: Build and Deploy Frontend

#### 4.1 Run Linter

```bash
npm run lint
```

**Expected**: No errors

#### 4.2 Type Check

```bash
npx tsc --noEmit
```

**Expected**: No type errors

#### 4.3 Build Application

```bash
npm run build
```

**Expected**: Build completes successfully

#### 4.4 Test Build Locally

```bash
npm run preview
```

Navigate to `http://localhost:4173` and test event creation.

#### 4.5 Deploy to Hosting Provider

**Vercel**:
```bash
vercel deploy --prod
```

**Netlify**:
```bash
netlify deploy --prod
```

**Custom Server**:
```bash
# Copy dist folder to server
scp -r dist/* user@server:/var/www/html/
```

### Step 5: Smoke Tests

#### 5.1 Test Event Creation (No Suggestions)

```bash
curl -X POST https://your-app.com/api/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Meeting",
    "start_time": "2026-02-01T10:00:00Z",
    "end_time": "2026-02-01T11:00:00Z",
    "is_private": false
  }'
```

**Expected**: 201 Created with event object

#### 5.2 Test Event Creation (With AI Suggestions)

```bash
curl -X POST https://your-app.com/api/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Doctor appointment",
    "start_time": "2026-02-15T10:00:00Z",
    "end_time": "2026-02-15T11:00:00Z",
    "is_private": false,
    "accept_suggestions": ["health"]
  }'
```

**Expected**: 
- 201 Created
- `suggestions` array with health suggestion
- `created_tasks` array with 1 task

#### 5.3 Test Validation Errors

```bash
# Test empty title
curl -X POST https://your-app.com/api/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "",
    "start_time": "2026-02-01T10:00:00Z",
    "end_time": "2026-02-01T11:00:00Z",
    "is_private": false
  }'
```

**Expected**: 400 Bad Request with validation error

#### 5.4 Test Private Event Constraint

```bash
# Test private event with multiple participants
curl -X POST https://your-app.com/api/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Private Meeting",
    "start_time": "2026-02-01T10:00:00Z",
    "end_time": "2026-02-01T11:00:00Z",
    "is_private": true,
    "participant_ids": ["uuid1", "uuid2"]
  }'
```

**Expected**: 400 Bad Request with "Private events cannot have multiple participants"

### Step 6: Monitoring Setup

#### 6.1 Enable Supabase Monitoring

1. Navigate to Supabase Dashboard
2. Go to **Reports** > **API**
3. Monitor Edge Function invocations

#### 6.2 Set Up Alerts

Create alerts for:
- Edge Function error rate > 5%
- Edge Function P95 latency > 500ms
- Database connection pool exhaustion

#### 6.3 Log Aggregation

```bash
# View Edge Function logs
supabase functions logs analyze-event-for-suggestions --tail 100

# Filter for errors
supabase functions logs analyze-event-for-suggestions | grep "ERROR"
```

## Post-Deployment Verification

### Verify All Features

- [ ] Create event without suggestions
- [ ] Create event with AI suggestions
- [ ] Accept AI suggestions to create tasks
- [ ] Add participants to event
- [ ] Create private event
- [ ] Validation errors show correct messages
- [ ] RLS policies prevent cross-family access
- [ ] Edge Function generates correct suggestions
- [ ] Due dates calculated correctly

### Performance Checks

```bash
# Test response time
time curl -X POST https://your-app.com/api/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-event.json
```

**Expected**: < 1 second total time

### Database Health

```sql
-- Check for orphaned participants
SELECT COUNT(*) 
FROM event_participants ep
LEFT JOIN events e ON e.id = ep.event_id
WHERE e.id IS NULL;

-- Expected: 0

-- Check for tasks without events
SELECT COUNT(*)
FROM tasks t
WHERE t.event_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM events WHERE id = t.event_id);

-- Expected: 0
```

## Rollback Plan

### If Deployment Fails

#### 1. Rollback Database Migration

```bash
# Get last successful migration
supabase db remote --db-url $DATABASE_URL execute \
  "SELECT version FROM supabase_migrations.schema_migrations 
   ORDER BY version DESC LIMIT 2;"

# Revert to previous migration
supabase db reset --version=PREVIOUS_VERSION
```

#### 2. Rollback Edge Function

```bash
# Re-deploy previous version
git checkout HEAD~1 supabase/functions/analyze-event-for-suggestions/
supabase functions deploy analyze-event-for-suggestions
```

#### 3. Rollback Frontend

```bash
# Vercel
vercel rollback

# Or re-deploy previous git commit
git checkout HEAD~1
npm run build
vercel deploy --prod
```

## Troubleshooting

### Issue: Edge Function Returns Empty Suggestions

**Diagnosis**:
```bash
# Check function logs
supabase functions logs analyze-event-for-suggestions | grep "suggestions"
```

**Solutions**:
1. Verify keyword templates match event titles
2. Check case-insensitive matching
3. Ensure user_role is passed correctly

### Issue: RLS Policy Denies Insert

**Diagnosis**:
```sql
-- Check user's family_id in JWT
SELECT auth.uid(), 
       (SELECT family_id FROM profiles WHERE id = auth.uid());
```

**Solutions**:
1. Verify JWT metadata sync trigger is enabled
2. Check profile exists for user
3. Verify family_id matches

### Issue: Tasks Not Created

**Diagnosis**:
```bash
# Check if tasks table has RLS policies
SELECT * FROM pg_policies WHERE tablename = 'tasks';
```

**Solutions**:
1. Verify task creation permissions in RLS
2. Check suggestion_id format
3. Ensure event_id is valid

## Maintenance

### Weekly Tasks

- Review Edge Function error logs
- Monitor database query performance
- Check RLS policy effectiveness
- Review user-reported issues

### Monthly Tasks

- Update dependencies
- Review and optimize database indexes
- Analyze AI suggestion acceptance rate
- Plan feature improvements

---

**Deployed By**: _____________  
**Deployment Date**: _____________  
**Production URL**: _____________  
**Verified By**: _____________


