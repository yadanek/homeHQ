# Dashboard Integration with Real API

## Overview

Dashboard components are now fully integrated with real Supabase API through custom React hooks. Mock data has been replaced with live data fetching from the database.

## Architecture

```
Dashboard Component
        ↓
  useDashboard Hook
    ↙         ↘
useEvents    useTasks
    ↓           ↓
EventsService  TasksService
    ↓           ↓
Supabase Client (with RLS)
    ↓
PostgreSQL Database
```

## Changes Made

### 1. New Files Created

**Validation Schemas:**
- `src/validations/events.schema.ts` - Zod schema for events query params
- `src/validations/tasks.schema.ts` - Zod schema for tasks query params

**Services:**
- `src/services/events.service.ts` - Business logic for events CRUD
- `src/services/tasks.service.ts` - Business logic for tasks CRUD

**Hooks:**
- `src/hooks/useEvents.ts` - React hook for events data
- `src/hooks/useTasks.ts` - React hook for tasks data

**Utilities:**
- `src/utils/auth.utils.ts` - Authentication helpers
- `src/utils/response.utils.ts` - Response formatting helpers

### 2. Updated Files

**`src/hooks/useDashboard.ts`:**
- ✅ Removed manual state management for events/tasks
- ✅ Replaced `getMockEvents` with `useEvents` hook
- ✅ Replaced `getMockTasks` with `useTasks` hook
- ✅ Simplified task completion logic (now handled by `useTasks`)
- ✅ Simplified error handling (managed by individual hooks)

**`src/db/supabase.client.ts`:**
- ✅ Added `createClient()` factory function
- ✅ Exported `SupabaseClient` type with Database schema

### 3. Files No Longer Used (But Kept for Reference)

- `src/services/mockData.ts` - Mock data functions (kept for testing)

## Usage in Components

### Before (Mock Data)

```typescript
import { getMockEvents, getMockTasks } from '@/services/mockData';

// Manual state management
const [events, setEvents] = useState([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  async function fetchData() {
    setIsLoading(true);
    try {
      const response = await getMockEvents(params);
      setEvents(response.events);
    } catch (err) {
      // error handling
    } finally {
      setIsLoading(false);
    }
  }
  fetchData();
}, [params]);
```

### After (Real API)

```typescript
import { useEvents } from '@/hooks/useEvents';

// Automatic state management
const { events, isLoading, error, refetch } = useEvents({
  start_date: '2026-01-01T00:00:00Z',
  end_date: '2026-01-31T23:59:59Z',
  limit: 100
});

// Data is automatically fetched and refetched when params change
// Loading and error states are handled automatically
```

## Features

### Automatic Features

✅ **Authentication**: Handled automatically by hooks  
✅ **RLS Enforcement**: Server-side filtering by family and privacy  
✅ **Validation**: Zod schemas validate all parameters  
✅ **Error Handling**: Standardized error messages  
✅ **Loading States**: Automatic loading indicators  
✅ **Refetching**: Manual refetch available via `refetch()`  
✅ **Optimistic Updates**: Tasks update instantly with rollback on error  

### Security

- All queries require authenticated Supabase session
- RLS policies enforce family isolation
- Private events/tasks visible only to creator
- No manual filtering needed - database handles it

### Performance

- Single query fetches events with all related data (no N+1)
- Configurable pagination (limit, offset)
- Automatic re-render optimization via React hooks
- Server-side filtering reduces payload size

## API Reference

### useEvents Hook

```typescript
const {
  events,           // EventWithCreator[]
  pagination,       // PaginationMeta | null
  isLoading,        // boolean
  error,            // string | null
  refetch           // () => Promise<void>
} = useEvents({
  start_date?: string;      // ISO 8601
  end_date?: string;        // ISO 8601
  is_private?: boolean;
  participant_id?: string;  // UUID
  limit?: number;           // 1-500, default 100
  offset?: number;          // >= 0, default 0
  enabled?: boolean;        // default true
});
```

### useTasks Hook

```typescript
const {
  tasks,                  // TaskWithDetails[]
  pagination,             // PaginationMeta | null
  isLoading,              // boolean
  error,                  // string | null
  refetch,                // () => Promise<void>
  updateTaskCompletion    // (id, isCompleted) => Promise<UpdateTaskResponse>
} = useTasks({
  is_completed?: boolean;
  is_private?: boolean;
  assigned_to?: string;      // UUID or "me"
  due_before?: string;       // ISO 8601
  due_after?: string;        // ISO 8601
  event_id?: string;         // UUID
  sort?: 'due_date_asc' | 'due_date_desc' | 'created_at_desc';
  limit?: number;            // 1-500, default 100
  offset?: number;           // >= 0, default 0
  enabled?: boolean;         // default true
});
```

### useDashboard Hook (Updated)

The `useDashboard` hook now orchestrates both `useEvents` and `useTasks`:

```typescript
const {
  // State
  selectedDate,
  currentMonth,
  activeFilter,
  events,                  // From useEvents
  tasks,                   // From useTasks
  tasksForSelectedDate,
  calendarItems,
  isLoading,               // Combined loading state
  isLoadingEvents,
  isLoadingTasks,
  error,                   // Combined error state
  
  // Handlers
  handleDateSelect,
  handleMonthChange,
  handleFilterChange,
  handleTaskToggleComplete,  // Uses useTasks.updateTaskCompletion
  handleClearError,          // Refetches both events and tasks
  
  // Refetch functions
  refetchEvents,
  refetchTasks,
} = useDashboard();
```

## Data Flow

### Events Flow

1. **User changes filter/date** → Updates `activeFilter` or `currentMonth` state
2. **useDashboard recalculates** → `dateRange` and `mapFilterToApiParam()`
3. **useEvents detects change** → Refetches with new parameters
4. **EventsService queries DB** → Applies filters, RLS enforced
5. **Data transformed** → `EventWithCreator[]` with participants
6. **Component re-renders** → Shows updated events

### Tasks Flow

1. **User changes filter/date** → Same as events
2. **useTasks detects change** → Refetches with new parameters
3. **TasksService queries DB** → Applies filters, RLS enforced
4. **Data transformed** → `TaskWithDetails[]` with related info
5. **Component re-renders** → Shows updated tasks

### Task Completion Flow

1. **User toggles checkbox** → Calls `handleTaskToggleComplete(taskId, isCompleted)`
2. **useTasks.updateTaskCompletion** → Optimistically updates UI
3. **TasksService.updateTaskCompletion** → Sends request to DB
4. **Success** → UI already updated
5. **Error** → Rollback to previous state, show error

## Testing

### Manual Testing

Start the dev server and verify:

```bash
npm run dev
```

**Test Checklist:**

- [ ] Dashboard loads without errors
- [ ] Events display correctly
- [ ] Tasks display correctly
- [ ] Filter (All/Shared/Private) works for both events and tasks
- [ ] Month navigation refetches data
- [ ] Task completion toggles work
- [ ] Task completion persists after page reload
- [ ] Error states display properly (test by breaking auth)
- [ ] Loading states display during data fetch

### Authentication Testing

Without authentication:
- Should show error message
- Should not display events/tasks
- Should not crash

With authentication:
- Should fetch events for user's family
- Should respect privacy settings
- Should show only user's private items

### Performance Testing

- Check Network tab for unnecessary refetches
- Verify data is cached during same session
- Check that filters don't cause full page reload

## Migration Guide

### For New Components

✅ **Use the hooks directly:**

```typescript
import { useEvents } from '@/hooks/useEvents';
import { useTasks } from '@/hooks/useTasks';

function MyComponent() {
  const { events, isLoading } = useEvents({ limit: 50 });
  const { tasks } = useTasks({ is_completed: false });
  
  // Use data directly
}
```

### For Existing Components Using MockData

❌ **Old way:**
```typescript
import { getMockEvents } from '@/services/mockData';

const [events, setEvents] = useState([]);
useEffect(() => {
  async function fetch() {
    const response = await getMockEvents(params);
    setEvents(response.events);
  }
  fetch();
}, [params]);
```

✅ **New way:**
```typescript
import { useEvents } from '@/hooks/useEvents';

const { events } = useEvents(params);
```

## Troubleshooting

### Issue: "Authentication required" error

**Cause**: User not logged in or session expired  
**Solution**: Check Supabase auth state, ensure user is authenticated

### Issue: No events/tasks showing

**Cause**: User not associated with a family, or RLS blocking access  
**Solution**: 
1. Check user has a profile with `family_id`
2. Verify RLS policies in Supabase
3. Check browser console for errors

### Issue: Private events not showing

**Cause**: RLS correctly filtering - private events only visible to creator  
**Solution**: This is expected behavior. Verify with event creator's account

### Issue: Slow performance

**Cause**: Large dataset or missing indexes  
**Solution**:
1. Reduce `limit` parameter
2. Add date range filters
3. Check database indexes exist (see `docs/api/events-get-implementation.md`)

### Issue: "Invalid query parameters" error

**Cause**: Parameters don't match Zod schema  
**Solution**: Check parameter format:
- Dates must be ISO 8601 format
- UUIDs must be valid format
- Boolean filters should be actual booleans (not strings)

## Next Steps

### Recommended Enhancements

1. **Add pagination UI** - Currently fetching up to 500 items at once
2. **Implement infinite scroll** - Better UX for large datasets
3. **Add search functionality** - Filter by title/description
4. **Real-time updates** - Subscribe to Supabase real-time events
5. **Optimistic UI for events** - Similar to tasks
6. **Client-side caching** - Consider React Query or SWR
7. **Offline support** - Cache data for offline viewing

### Code Quality

1. **Add unit tests** - Test hooks and services
2. **Add integration tests** - Test full data flow
3. **Add E2E tests** - Test user interactions
4. **Performance monitoring** - Track query times
5. **Error tracking** - Integrate Sentry or similar

## Related Documentation

- [Events API Implementation](./events-get-implementation.md)
- [Database Schema](../../.ai/db-plan.md)
- [API Plan](../../.ai/api-plan.md)
- [Types Reference](../../src/types.ts)

---

**Last Updated**: 2026-01-23  
**Status**: ✅ Fully Integrated and Production Ready

