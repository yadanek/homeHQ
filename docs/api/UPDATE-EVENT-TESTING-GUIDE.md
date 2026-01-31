# PATCH /events/:eventId - Manual Testing Guide

## Overview

This guide provides step-by-step instructions for manually testing the event update endpoint using various tools and scenarios.

**Endpoint**: `PATCH /events/:eventId`  
**Implementation**: React 19 Server Action (`src/actions/updateEvent.ts`)  
**Authentication**: Required (Bearer token)

---

## Prerequisites

### 1. Environment Setup

Ensure your `.env` file contains:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Authentication Token

Get a valid JWT token by:
1. Login via the app
2. Extract token from browser DevTools > Application > Local Storage
3. Or use Supabase CLI to generate test token

```bash
# Example: Get session token
supabase auth users list
```

### 3. Test Data

Create test events using `POST /events` or the UI, and note their IDs.

---

## Testing Tools

### Option 1: React Component (Recommended)

Use the example component to test via UI:

```tsx
// src/components/events/UpdateEventExample.tsx
import { updateEvent } from '@/actions/updateEvent';

function UpdateEventExample() {
  const handleUpdate = async (eventId: string) => {
    const result = await updateEvent(eventId, {
      title: 'Updated Title'
    });
    
    if (result.success) {
      console.log('✅ Updated:', result.data);
    } else {
      console.error('❌ Error:', result.error);
    }
  };
  
  return (
    <button onClick={() => handleUpdate('your-event-id')}>
      Update Event
    </button>
  );
}
```

### Option 2: Browser Console

```javascript
// In browser DevTools console
import { updateEvent } from '@/actions/updateEvent';

const eventId = 'your-event-id-here';
const result = await updateEvent(eventId, {
  title: 'Updated via Console'
});
console.log(result);
```

### Option 3: Vitest (Automated)

```bash
npm run test -- tests/actions/updateEvent.test.ts
```

---

## Test Scenarios

### ✅ Scenario 1: Update Single Field (Title)

**Purpose**: Verify partial update works  
**Expected**: Only title changes, other fields unchanged

```typescript
const result = await updateEvent(eventId, {
  title: 'New Event Title'
});

// Expected response:
{
  success: true,
  data: {
    id: "...",
    title: "New Event Title",  // Changed
    description: "...",         // Unchanged
    start_time: "...",          // Unchanged
    end_time: "...",            // Unchanged
    is_private: false,          // Unchanged
    updated_at: "2026-01-27T...", // Updated by trigger
    participants: [...]
  }
}
```

---

### ✅ Scenario 2: Update Multiple Fields

**Purpose**: Verify multiple fields can be updated together  
**Expected**: All specified fields change

```typescript
const result = await updateEvent(eventId, {
  title: 'Updated Title',
  description: 'Updated description',
  start_time: '2026-02-15T10:00:00Z',
  end_time: '2026-02-15T11:00:00Z'
});

// Expected: success with all fields updated
```

---

### ✅ Scenario 3: Update Participants

**Purpose**: Verify participant list replacement  
**Expected**: Old participants removed, new ones added

**Setup**: Create event with participants via POST first

```typescript
// Replace participants
const result = await updateEvent(eventId, {
  participant_ids: [
    'new-participant-uuid-1',
    'new-participant-uuid-2'
  ]
});

// Expected: 
// - Old participants removed from event_participants table
// - New participants added
// - Response includes new participant list
```

---

### ✅ Scenario 4: Remove All Participants

**Purpose**: Verify empty array removes participants  
**Expected**: All participants deleted

```typescript
const result = await updateEvent(eventId, {
  participant_ids: []
});

// Expected response:
{
  success: true,
  data: {
    ...
    participants: []  // Empty array
  }
}
```

---

### ✅ Scenario 5: Change to Private Event

**Purpose**: Verify trigger cleans participants automatically  
**Expected**: Event becomes private, participants auto-removed

```typescript
// Event currently has participants
const result = await updateEvent(eventId, {
  is_private: true
});

// Expected:
// - is_private: true
// - participants: [] (cleaned by trigger)
```

---

### ❌ Scenario 6: Invalid UUID Format

**Purpose**: Verify fail-fast validation  
**Expected**: 400 error before database call

```typescript
const result = await updateEvent('not-a-uuid', {
  title: 'Test'
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'INVALID_EVENT_ID',
      message: 'Event ID must be a valid UUID',
      details: { eventId: 'not-a-uuid' }
    }
  }
}
```

---

### ❌ Scenario 7: Empty Title After Trim

**Purpose**: Verify Zod validation  
**Expected**: 400 validation error

```typescript
const result = await updateEvent(eventId, {
  title: '    '  // Only whitespace
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'INVALID_INPUT',
      message: 'Validation failed',
      details: {
        title: ['Title must not be empty']
      }
    }
  }
}
```

---

### ❌ Scenario 8: Title Too Long

**Purpose**: Verify length constraint  
**Expected**: 400 validation error

```typescript
const result = await updateEvent(eventId, {
  title: 'a'.repeat(201)  // 201 characters
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'INVALID_INPUT',
      message: 'Validation failed',
      details: {
        title: ['Title must be 200 characters or less']
      }
    }
  }
}
```

---

### ❌ Scenario 9: Invalid Time Range

**Purpose**: Verify time range refinement  
**Expected**: 400 validation error

```typescript
const result = await updateEvent(eventId, {
  start_time: '2026-02-15T12:00:00Z',
  end_time: '2026-02-15T10:00:00Z'  // 2 hours BEFORE start
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'INVALID_INPUT',
      message: 'Validation failed',
      details: {
        end_time: ['end_time must be after start_time']
      }
    }
  }
}
```

---

### ❌ Scenario 10: Add Participants to Private Event

**Purpose**: Verify privacy constraint  
**Expected**: 400 validation error

```typescript
const result = await updateEvent(eventId, {
  is_private: true,
  participant_ids: ['uuid1', 'uuid2']
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'INVALID_PRIVATE_EVENT',
      message: 'Cannot add participants to private event'
    }
  }
}
```

---

### ❌ Scenario 11: Cross-Family Participant

**Purpose**: Verify participant family validation  
**Expected**: 400 error

**Setup**: Get participant UUID from different family

```typescript
const result = await updateEvent(eventId, {
  participant_ids: ['participant-from-different-family']
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'INVALID_PARTICIPANTS',
      message: 'Some participants do not belong to your family',
      details: {
        invalid_participant_ids: ['participant-from-different-family']
      }
    }
  }
}
```

---

### ❌ Scenario 12: Update Non-Existent Event

**Purpose**: Verify 404 handling  
**Expected**: 404 error

```typescript
const fakeEventId = '550e8400-0000-0000-0000-000000000000';
const result = await updateEvent(fakeEventId, {
  title: 'Test'
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'EVENT_NOT_FOUND',
      message: 'Event not found or has been archived'
    }
  }
}
```

---

### ❌ Scenario 13: Update Someone Else's Event

**Purpose**: Verify RLS authorization  
**Expected**: 403 error

**Setup**: 
1. User A creates event (get event ID)
2. User B tries to update it

```typescript
// As User B (not creator)
const result = await updateEvent(userAEventId, {
  title: 'Trying to update'
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'FORBIDDEN',
      message: 'You do not have permission to update this event',
      details: {
        reason: 'Only event creator can update events'
      }
    }
  }
}
```

---

### ❌ Scenario 14: Update Archived Event

**Purpose**: Verify archived events cannot be updated  
**Expected**: 404 error (not 403)

**Setup**: Archive event first using DELETE endpoint

```typescript
// First archive
await deleteEvent(eventId);

// Then try to update
const result = await updateEvent(eventId, {
  title: 'Test'
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'EVENT_NOT_FOUND',
      message: 'Event not found or has been archived'
    }
  }
}
```

---

### ❌ Scenario 15: Missing Authentication

**Purpose**: Verify authentication requirement  
**Expected**: 401 error

**Setup**: Clear auth token or logout

```typescript
// When not authenticated
const result = await updateEvent(eventId, {
  title: 'Test'
});

// Expected response:
{
  success: false,
  error: {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in.'
    }
  }
}
```

---

### ✅ Scenario 16: Empty Update Object

**Purpose**: Verify empty update is allowed  
**Expected**: Success (only updated_at changes)

```typescript
const result = await updateEvent(eventId, {});

// Expected: 
// - success: true
// - All fields unchanged except updated_at
```

---

### ✅ Scenario 17: Update Only Description

**Purpose**: Verify optional field updates  
**Expected**: Only description changes

```typescript
const result = await updateEvent(eventId, {
  description: 'New detailed description'
});

// Expected: success with only description updated
```

---

### ✅ Scenario 18: Clear Description (Set to Null)

**Purpose**: Verify nullable fields  
**Expected**: Description set to null

```typescript
const result = await updateEvent(eventId, {
  description: null
});

// Expected response:
{
  success: true,
  data: {
    ...
    description: null  // Cleared
  }
}
```

---

### ✅ Scenario 19: Unicode Characters in Title

**Purpose**: Verify international characters support  
**Expected**: Success with unicode preserved

```typescript
const result = await updateEvent(eventId, {
  title: '🎉 Party Event 派對活動 🎊'
});

// Expected: success with emojis and Chinese characters preserved
```

---

### ✅ Scenario 20: Very Long Participant List

**Purpose**: Verify bulk participant updates  
**Expected**: Success with many participants

**Setup**: Have 20+ valid participant UUIDs from your family

```typescript
const manyParticipants = [
  'uuid1', 'uuid2', 'uuid3', ..., 'uuid20'
];

const result = await updateEvent(eventId, {
  participant_ids: manyParticipants
});

// Expected: success with all participants added
```

---

## Database Verification Queries

After running tests, verify in Supabase Dashboard:

### Check Event Updated

```sql
SELECT 
  id,
  title,
  description,
  start_time,
  end_time,
  is_private,
  updated_at,
  archived_at
FROM events
WHERE id = 'your-event-id';
```

### Check Participants

```sql
SELECT 
  ep.event_id,
  ep.profile_id,
  p.display_name
FROM event_participants ep
JOIN profiles p ON p.id = ep.profile_id
WHERE ep.event_id = 'your-event-id';
```

### Check Trigger Execution

```sql
-- Verify updated_at changed
SELECT 
  id,
  title,
  created_at,
  updated_at,
  (updated_at > created_at) as was_updated
FROM events
WHERE id = 'your-event-id';
```

### Check RLS Enforcement

```sql
-- Should return 0 rows if trying to access another user's private event
SELECT * FROM events
WHERE id = 'other-users-private-event-id';
```

---

## Automated Test Script

Create a test script for batch testing:

```typescript
// tests/manual/updateEvent.manual.test.ts
import { updateEvent } from '@/actions/updateEvent';

const testCases = [
  {
    name: 'Update title',
    input: { title: 'New Title' },
    expectedSuccess: true
  },
  {
    name: 'Invalid UUID',
    eventId: 'not-a-uuid',
    input: { title: 'Test' },
    expectedSuccess: false,
    expectedError: 'INVALID_EVENT_ID'
  },
  // ... more test cases
];

async function runTests(eventId: string) {
  for (const test of testCases) {
    console.log(`\nTesting: ${test.name}`);
    
    const result = await updateEvent(
      test.eventId || eventId,
      test.input
    );
    
    const passed = result.success === test.expectedSuccess;
    console.log(passed ? '✅ PASS' : '❌ FAIL');
    
    if (!passed) {
      console.error('Result:', result);
    }
  }
}

// Usage:
// runTests('your-event-id-here');
```

---

## Performance Testing

### Response Time

Measure update operation time:

```typescript
const start = performance.now();
const result = await updateEvent(eventId, { title: 'Test' });
const duration = performance.now() - start;

console.log(`Update took ${duration.toFixed(2)}ms`);
// Expected: < 200ms for simple updates
```

### Concurrent Updates

Test RLS under concurrent load:

```typescript
// Try 10 concurrent updates from different users
const promises = users.map(user => 
  updateEvent(eventId, { title: `Update by ${user.name}` })
);

const results = await Promise.all(promises);
// Expected: Only creator's update succeeds, others get 403
```

---

## Troubleshooting

### Issue: 401 Unauthorized

**Cause**: Token expired or invalid  
**Fix**: Re-authenticate and get fresh token

### Issue: 403 Forbidden

**Cause**: RLS blocking (not event creator)  
**Fix**: Use correct user account (event creator)

### Issue: 404 Not Found

**Cause**: Event doesn't exist or archived  
**Fix**: Verify event ID and check archived_at column

### Issue: 400 Validation Error

**Cause**: Invalid input data  
**Fix**: Check error.details for specific field errors

### Issue: 500 Internal Error

**Cause**: Unexpected server error  
**Fix**: Check logs, verify database connectivity

---

## DEV MODE Testing

For local development without authentication:

```typescript
// Set DEV_MODE in src/lib/mockAuth.ts
export const DEV_MODE = true;

// Mock user will be used automatically
const result = await updateEvent(eventId, {
  title: 'Test in Dev Mode'
});
// No authentication required in DEV_MODE
```

---

## Test Coverage Checklist

Copy this checklist for manual testing sessions:

```
## Happy Path
- [ ] Update single field (title)
- [ ] Update multiple fields
- [ ] Update participants
- [ ] Remove all participants
- [ ] Change to private event
- [ ] Empty update object
- [ ] Clear description (null)
- [ ] Unicode characters

## Validation Errors (400)
- [ ] Invalid UUID format
- [ ] Empty title after trim
- [ ] Title > 200 chars
- [ ] Invalid time range
- [ ] Add participants to private
- [ ] Cross-family participant

## Authorization Errors (403)
- [ ] Update someone else's event

## Not Found Errors (404)
- [ ] Non-existent event
- [ ] Archived event

## Authentication Errors (401)
- [ ] Missing authentication

## Database Verification
- [ ] updated_at timestamp changed
- [ ] Participants correctly updated
- [ ] Trigger cleaned participants (private)
- [ ] RLS prevented unauthorized access
```

---

## Next Steps

1. **Run all test scenarios** listed above
2. **Document any failures** or unexpected behavior
3. **Verify database state** after each test
4. **Create automated tests** for critical scenarios
5. **Performance benchmark** with realistic data volume

---

**Last Updated**: 2026-01-27  
**Test Status**: Ready for manual testing  
**Automated Coverage**: 0% (tests scaffolded, implementation pending)
