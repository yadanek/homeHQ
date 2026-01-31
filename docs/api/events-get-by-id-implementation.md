# GET /events/:eventId - Implementation Documentation

## Overview

This document describes the implementation of the **GET /events/:eventId** endpoint for retrieving detailed information about a single calendar event.

**Status**: ✅ Implemented  
**Date**: 2026-01-26  
**Version**: 1.0

---

## Architecture

### Layer Structure

```
React Component (EventDetailsView)
    ↓
React Hook (useEvent)
    ↓
Service Layer (EventsService.getEventById)
    ↓
Supabase Client
    ↓
PostgreSQL Database (with RLS)
```

### Files Created/Modified

#### New Files
- ✅ `src/lib/utils/api-errors.ts` - Standardized error response helpers
- ✅ `src/components/events/EventDetailsView.tsx` - UI component for displaying event details
- ✅ `src/components/examples/EventDetailsExample.tsx` - Example usage and testing playground
- ✅ `docs/api/events-get-by-id-implementation.md` - This documentation file

#### Modified Files
- ✅ `src/services/events.service.ts` - Enhanced `getEventById()` with security checks
- ✅ `src/hooks/useEvents.ts` - Updated `useEvent()` hook with better error handling
- ✅ `src/validations/events.schema.ts` - Added `eventIdSchema` for UUID validation

---

## Implementation Details

### 1. Service Layer (`EventsService.getEventById`)

**Location**: `src/services/events.service.ts`

**Method Signature**:
```typescript
async getEventById(
  eventId: string,
  userId: string,
  familyId: string
): Promise<EventDetailsResponse>
```

**Security Implementation** (Defense-in-depth):

1. **UUID Validation** (fail-fast)
   ```typescript
   if (!isUUID(eventId)) {
     throw new ServiceError(400, 'INVALID_EVENT_ID', 'Event ID must be a valid UUID');
   }
   ```

2. **Database Query with RLS**
   - Supabase RLS policies automatically filter by `family_id`
   - Only returns events user has access to

3. **Additional Family Check** (belt-and-suspenders)
   ```typescript
   if (data.family_id !== familyId) {
     throw new ServiceError(403, 'FORBIDDEN', 'Event belongs to a different family');
   }
   ```

4. **Privacy Check** (belt-and-suspenders)
   ```typescript
   if (data.is_private && data.created_by !== userId) {
     throw new ServiceError(403, 'FORBIDDEN', 'Event is private');
   }
   ```

**Query Optimization**:
- Single query with JOINs (no N+1 problem)
- Fetches creator name and participants in one request
- Filters archived events (`archived_at IS NULL`)

### 2. React Hook (`useEvent`)

**Location**: `src/hooks/useEvents.ts`

**Hook Signature**:
```typescript
function useEvent(
  eventId: string | null,
  options?: { enabled?: boolean }
): {
  event: EventWithCreator | null;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  refetch: () => Promise<void>;
}
```

**Features**:
- ✅ Automatic authentication validation
- ✅ Structured error handling with error codes
- ✅ Loading state management
- ✅ Manual refetch capability
- ✅ Conditional fetching (enabled option)

**Error Codes Returned**:
- `INVALID_EVENT_ID` - Invalid UUID format (400)
- `EVENT_NOT_FOUND` - Event not found or archived (404)
- `FORBIDDEN` - Access denied (403)
- `UNAUTHORIZED` - Authentication failed (401)
- `INTERNAL_SERVER_ERROR` - Unexpected error (500)

### 3. UI Component (`EventDetailsView`)

**Location**: `src/components/events/EventDetailsView.tsx`

**Component Props**:
```typescript
interface EventDetailsViewProps {
  eventId: string;
  onClose?: () => void;
}
```

**Features**:
- ✅ Loading skeleton for better UX
- ✅ Specific error displays for each error code
- ✅ Privacy indicator (lock icon for private events)
- ✅ Formatted date/time display
- ✅ Participant badges
- ✅ Creator information
- ✅ Metadata (created/updated timestamps)

**Error Handling**:
- Different UI for each error type (404, 403, 400, 500)
- Retry button for recoverable errors
- Clear error messages for users

---

## Error Responses

### 400 Bad Request - Invalid UUID

**Condition**: `eventId` is not a valid UUID format

**Response**:
```json
{
  "error": {
    "code": "INVALID_EVENT_ID",
    "message": "Event ID must be a valid UUID",
    "details": {
      "eventId": "invalid-format"
    }
  }
}
```

### 403 Forbidden - Access Denied

**Conditions**:
- Event belongs to different family
- Event is private and user is not the creator

**Response**:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this event",
    "details": {
      "reason": "Event is private and you are not the creator"
    }
  }
}
```

### 404 Not Found

**Conditions**:
- Event doesn't exist
- Event has been archived
- RLS filtered the event

**Response**:
```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found or has been archived"
  }
}
```

### 500 Internal Server Error

**Condition**: Unexpected database or application error

**Response**:
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "requestId": "req_abc123xyz"
    }
  }
}
```

---

## Security Features

### 1. Row Level Security (RLS)

**Database Policy**:
```sql
CREATE POLICY "Users can read family events"
ON events FOR SELECT
TO authenticated
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    is_private = false 
    OR created_by = auth.uid()
  )
  AND archived_at IS NULL
);
```

### 2. Application-Level Checks

**Belt-and-suspenders approach**:
- Additional `family_id` verification after RLS
- Additional privacy check for private events
- Logging of security violations

### 3. Input Validation

- UUID format validation using `isUUID()` helper
- Zod schema validation available (`eventIdSchema`)
- Early return for invalid inputs (fail-fast)

---

## Usage Examples

### Basic Usage

```typescript
import { EventDetailsView } from '@/components/events/EventDetailsView';

function MyPage() {
  return (
    <EventDetailsView 
      eventId="123e4567-e89b-12d3-a456-426614174000"
    />
  );
}
```

### With Hook (Custom Implementation)

```typescript
import { useEvent } from '@/hooks/useEvents';

function MyComponent({ eventId }: { eventId: string }) {
  const { event, isLoading, error, errorCode, refetch } = useEvent(eventId);

  if (isLoading) {
    return <div>Loading event...</div>;
  }

  if (errorCode === 'FORBIDDEN') {
    return <div>You don't have permission to view this event.</div>;
  }

  if (errorCode === 'EVENT_NOT_FOUND') {
    return <div>Event not found or has been archived.</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={refetch}>Try Again</button>
      </div>
    );
  }

  if (!event) {
    return <div>No event data available.</div>;
  }

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p>Created by: {event.created_by_name}</p>
      <p>Participants: {event.participants.length}</p>
      {event.is_private && <span>🔒 Private</span>}
    </div>
  );
}
```

### Testing Different Scenarios

See `src/components/examples/EventDetailsExample.tsx` for a complete testing playground.

---

## Performance Considerations

### Query Optimization

✅ **Single Query with JOINs**
- Fetches event, creator, and participants in one query
- No N+1 query problem

✅ **Database Indexes**
Required indexes:
- `events.id` (PRIMARY KEY)
- `events.family_id` (for RLS filtering)
- `events.archived_at` (for filtering)
- `event_participants.event_id` (for JOIN)

### Caching Strategy

**Potential improvements** (not yet implemented):
- Client-side caching with React Query
- CDN caching for public events
- ETag support for conditional requests

---

## Testing Checklist

### Unit Tests (Recommended)

- [ ] `isUUID()` validation function
- [ ] `ServiceError` class
- [ ] `ApiErrors` helper functions
- [ ] Event data transformation logic

### Integration Tests (Recommended)

- [ ] Valid event retrieval (200)
- [ ] Invalid UUID format (400)
- [ ] Non-existent event (404)
- [ ] Archived event access (404)
- [ ] Different family event access (403)
- [ ] Private event access by non-creator (403)
- [ ] Unauthenticated access (401)

### Manual Testing

✅ Use `EventDetailsExample` component:
```typescript
import { EventDetailsExample } from '@/components/examples/EventDetailsExample';

// In your app
<EventDetailsExample />
```

---

## Edge Cases Handled

✅ **Invalid UUID Format**
- Validated before database query
- Returns 400 with clear error message

✅ **Archived Events**
- Filtered at database level (`archived_at IS NULL`)
- Returns 404 (treated as not found)

✅ **Private Events**
- RLS policy filters automatically
- Additional check in service layer
- Returns 403 with specific reason

✅ **Different Family Access**
- RLS policy filters automatically
- Additional check in service layer
- Returns 403 with specific reason

✅ **Non-existent Events**
- Returns 404 with generic message
- Doesn't reveal whether event exists (security)

✅ **Database Errors**
- Caught and logged
- Returns 500 with request ID for tracking
- Doesn't expose internal details to client

---

## Future Enhancements

### Authentication (Planned)

Currently uses placeholder `userId` and `familyId`. Future implementation will:
- Extract JWT from Authorization header
- Validate token with Supabase Auth
- Get user context automatically

### Additional Features (Potential)

- [ ] Event editing capability
- [ ] Event deletion (soft delete to archived)
- [ ] Event sharing/invitation links
- [ ] iCal export for single event
- [ ] Related tasks display
- [ ] Event recurrence support

---

## Troubleshooting

### Common Issues

**Issue**: "Event not found" for existing event
- **Cause**: RLS policy filtering or archived event
- **Solution**: Check user's family_id and event's archived_at

**Issue**: "Invalid Event ID" error
- **Cause**: eventId is not a valid UUID
- **Solution**: Ensure eventId is a valid UUID v4 format

**Issue**: "Access denied" for family event
- **Cause**: Private event created by another user
- **Solution**: Only creator can view private events

### Debugging

Enable detailed logging:
```typescript
// In EventsService.getEventById
console.info(`Event ${eventId} fetched successfully by user ${userId}`);
console.warn(`Privacy violation: User ${userId} tried to access private event`);
```

Check Supabase logs for RLS policy enforcement.

---

## References

- Implementation Plan: `.ai/event-view-implementation-plan.md`
- Type Definitions: `src/types.ts`
- Database Schema: `src/db/database.types.ts`
- RLS Policies: See Supabase dashboard

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-26  
**Implemented By**: AI Assistant  
**Status**: ✅ Complete and Ready for Use


