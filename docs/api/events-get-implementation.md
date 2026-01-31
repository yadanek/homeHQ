# GET Events - Implementation Documentation

## Overview

This document describes the implementation of the events listing functionality in the HomeHQ application. The implementation follows a layered architecture with proper separation of concerns.

## Architecture

```
React Component
      ↓
  useEvents Hook (src/hooks/useEvents.ts)
      ↓
Events Service (src/services/events.service.ts)
      ↓
Supabase Client (src/db/supabase.client.ts)
      ↓
PostgreSQL Database with RLS
```

## Components

### 1. Validation Layer (`src/validations/events.schema.ts`)

**Purpose**: Validates query parameters using Zod schema

**Schema**: `getEventsQuerySchema`

**Validated Parameters**:
- `start_date` (optional): ISO 8601 datetime string
- `end_date` (optional): ISO 8601 datetime string
- `is_private` (optional): Boolean (as 'true' or 'false' string)
- `participant_id` (optional): Valid UUID
- `limit` (default: 100): Integer between 1-500
- `offset` (default: 0): Non-negative integer

**Validation Rules**:
- Dates must be valid ISO 8601 format
- `start_date` must be <= `end_date`
- UUIDs must be valid format
- Pagination limits are enforced

### 2. Service Layer (`src/services/events.service.ts`)

**Purpose**: Encapsulates business logic and database operations

**Class**: `EventsService`

**Methods**:

#### `listEvents(params, userId, familyId)`
Fetches paginated list of events with filters.

**Parameters**:
- `params`: `GetEventsQueryParams` - Validated query parameters
- `userId`: `string` - Authenticated user's UUID
- `familyId`: `string` - User's family UUID

**Returns**: `Promise<ListEventsResponse>`

**Features**:
- Automatic RLS enforcement (filters by family_id and privacy)
- Joins with profiles for creator name
- Joins with event_participants for participant details
- Excludes archived events
- Orders by start_time ascending
- Handles participant filtering with separate query

**Error Handling**:
- Throws Error with descriptive message on database failure
- Returns empty array for participant with no events

#### `getEventById(eventId)`
Fetches a single event by ID.

**Parameters**:
- `eventId`: `string` - Event UUID

**Returns**: `Promise<EventWithCreator | null>`

**Features**:
- Returns `null` if event not found or access denied (RLS)
- Same data structure as listEvents items

### 3. Utility Functions

#### Authentication (`src/utils/auth.utils.ts`)

**Function**: `extractAndValidateUser(supabase)`

**Purpose**: Validates user authentication and retrieves family_id

**Returns**: `Promise<AuthResult>`
```typescript
interface AuthResult {
  user?: { id: string; email?: string };
  familyId?: string;
  error: { code: string; message: string } | null;
  status: number;
}
```

**Error Codes**:
- `UNAUTHORIZED` (401): Missing/invalid token or profile not found

#### Response Utilities (`src/utils/response.utils.ts`)

**Functions**:
- `createErrorResponse(code, message, details)`: Creates standardized error object
- `createSuccessResponse(data, status)`: Creates standardized success object
- `logError(error, context)`: Logs errors with environment-appropriate detail

### 4. React Hook (`src/hooks/useEvents.ts`)

**Purpose**: Provides React-friendly interface for fetching events

**Hook**: `useEvents(options)`

**Parameters**:
```typescript
interface UseEventsOptions {
  start_date?: string;
  end_date?: string;
  is_private?: boolean;
  participant_id?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean; // If false, won't fetch automatically
}
```

**Returns**:
```typescript
interface UseEventsState {
  events: EventWithCreator[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

**Features**:
- Automatic authentication handling
- Validates parameters before fetching
- Manages loading and error states
- Refetches when parameters change
- Provides manual refetch function
- Can be disabled with `enabled: false`

**Bonus Hook**: `useEvent(eventId, options)`
Fetches a single event by ID with same state management pattern.

## Usage Examples

### Basic Usage

```typescript
import { useEvents } from '@/hooks/useEvents';

function EventsList() {
  const { events, isLoading, error } = useEvents({
    limit: 50
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {events.map(event => (
        <div key={event.id}>
          <h3>{event.title}</h3>
          <p>Created by: {event.created_by_name}</p>
        </div>
      ))}
    </div>
  );
}
```

### With Filters

```typescript
const { events, pagination, refetch } = useEvents({
  start_date: '2026-01-01T00:00:00Z',
  end_date: '2026-12-31T23:59:59Z',
  is_private: false,
  limit: 100,
  offset: 0
});
```

### With Pagination

```typescript
function PaginatedEvents() {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { events, pagination, isLoading } = useEvents({
    limit: pageSize,
    offset: page * pageSize
  });

  return (
    <div>
      {/* Events list */}
      <button 
        onClick={() => setPage(p => p - 1)}
        disabled={page === 0}
      >
        Previous
      </button>
      <button 
        onClick={() => setPage(p => p + 1)}
        disabled={!pagination?.has_more}
      >
        Next
      </button>
    </div>
  );
}
```

### Single Event

```typescript
function EventDetail({ eventId }: { eventId: string }) {
  const { event, isLoading, error } = useEvent(eventId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!event) return <div>Event not found</div>;

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p>Creator: {event.created_by_name}</p>
      <ul>
        {event.participants.map(p => (
          <li key={p.id}>{p.display_name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Security

### Row Level Security (RLS)

The implementation relies on Supabase RLS policies to enforce security:

1. **Family Isolation**: Users can only see events from their family
2. **Privacy Enforcement**: 
   - Shared events (`is_private = false`) visible to all family members
   - Private events (`is_private = true`) visible only to creator
3. **Automatic Filtering**: No manual filtering needed - RLS handles it

### Authentication

- All requests require authenticated Supabase session
- User's `family_id` is retrieved from their profile
- Session is validated before every query
- Invalid/expired sessions return 401 errors

### Input Validation

- All query parameters validated with Zod schema
- SQL injection prevented by Supabase parameterized queries
- Type safety enforced by TypeScript
- UUID format validation for IDs

## Performance Considerations

### Database Indexes

Ensure these indexes exist for optimal performance:

```sql
CREATE INDEX idx_events_family_id_start_time ON events(family_id, start_time);
CREATE INDEX idx_events_archived_at ON events(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_profile_id ON event_participants(profile_id);
```

### Optimization Strategies

1. **Eager Loading**: Single query fetches events with creators and participants (no N+1)
2. **Pagination**: Default limit of 100, max 500 to prevent large result sets
3. **Selective Fields**: Only fetches required fields from database
4. **RLS Optimization**: Database-level filtering is faster than application-level

### Potential Bottlenecks

1. **Participant Filter**: Requires additional query to event_participants table
2. **Large Result Sets**: Use pagination aggressively
3. **Frequent Refetches**: Consider implementing client-side caching

## Error Handling

### Error Types

1. **Validation Errors** (400):
   - Invalid date format
   - Invalid UUID
   - Out of range pagination values
   - start_date after end_date

2. **Authentication Errors** (401):
   - Missing session
   - Expired session
   - User not associated with family

3. **Database Errors** (500):
   - Connection failures
   - Query timeouts
   - Unexpected database errors

### Error Messages

All errors include:
- Error code (e.g., 'UNAUTHORIZED', 'INVALID_QUERY_PARAMS')
- Human-readable message
- Optional details object with field-specific errors

## Testing

### Manual Testing Checklist

- [ ] Fetch all events (no filters)
- [ ] Filter by date range
- [ ] Filter by privacy (shared/private)
- [ ] Filter by participant
- [ ] Test pagination (multiple pages)
- [ ] Test with invalid parameters
- [ ] Test without authentication
- [ ] Test as different users (RLS enforcement)

### Example Test Scenarios

See `src/components/examples/EventsListExample.tsx` for a complete working example.

## Future Enhancements

1. **Client-side Caching**: Implement React Query or SWR for better cache management
2. **Cursor-based Pagination**: More efficient than offset-based for large datasets
3. **Real-time Updates**: Subscribe to Supabase real-time events
4. **Optimistic Updates**: Update UI immediately before server confirmation
5. **Rate Limiting**: Implement request throttling
6. **Performance Monitoring**: Track query execution times

## Troubleshooting

### Common Issues

**Issue**: "User is not associated with a family"
- **Cause**: User's profile doesn't exist or lacks family_id
- **Solution**: Ensure user created/joined a family

**Issue**: "Invalid query parameters"
- **Cause**: Malformed dates, invalid UUIDs, or out-of-range values
- **Solution**: Check parameter format matches schema requirements

**Issue**: Empty results when events exist
- **Cause**: RLS policies blocking access or archived events
- **Solution**: Check user's family_id and event privacy settings

**Issue**: Slow queries
- **Cause**: Missing indexes or large result sets
- **Solution**: Check database indexes, reduce limit parameter

## Related Documentation

- [Database Schema](../../.ai/db-plan.md)
- [API Plan](../../.ai/api-plan.md)
- [Types Reference](../../src/types.ts)

---

**Last Updated**: 2026-01-22
**Status**: ✅ Implemented and Tested

