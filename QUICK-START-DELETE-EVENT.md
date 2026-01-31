# Quick Start: Using DELETE Event Endpoint

**5-minute guide to using the delete event functionality in your components.**

---

## 🚀 Quick Usage

### 1. Basic Delete Button

```tsx
import { DeleteEventButton } from '@/components/events/DeleteEventButton';

function MyEventPage({ event }) {
  return (
    <div>
      <h1>{event.title}</h1>
      <DeleteEventButton
        eventId={event.id}
        eventTitle={event.title}
        onDeleted={() => router.push('/events')}
      />
    </div>
  );
}
```

**That's it!** The button includes:
- ✅ Confirmation dialog
- ✅ Loading state
- ✅ Error handling
- ✅ Success toast
- ✅ Full accessibility

---

### 2. Custom Implementation

```tsx
import { useDeleteEvent } from '@/hooks/useEvents';

function MyCustomButton({ eventId }) {
  const { deleteEvent, isDeleting, error } = useDeleteEvent();
  
  const handleClick = async () => {
    const result = await deleteEvent(eventId);
    if (result.success) {
      // Your success logic
    }
  };
  
  return (
    <button onClick={handleClick} disabled={isDeleting}>
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}
```

---

### 3. With Optimistic UI

```tsx
import { useEvents, useEventsOptimistic } from '@/hooks/useEvents';

function EventList() {
  const { events, refetch } = useEvents();
  const { optimisticEvents, deleteEventOptimistic } = useEventsOptimistic(events);
  
  const handleDelete = async (eventId: string) => {
    await deleteEventOptimistic(eventId);
    await refetch(); // Sync with server
  };
  
  return optimisticEvents.map(event => (
    <EventCard key={event.id} event={event} onDelete={handleDelete} />
  ));
}
```

**Benefits:**
- Event disappears instantly from UI
- Automatic rollback on error
- Better UX

---

## 📦 What's Included

### Components
- `DeleteEventButton` - Ready-to-use button with dialog
- `DeleteEventIconButton` - Icon-only variant
- `AlertDialog` - Reusable confirmation dialog

### Hooks
- `useDeleteEvent()` - Standard delete with loading/error states
- `useEventsOptimistic()` - Optimistic UI support

### Types
- `DeleteEventResult` - Type-safe result type
- `ApiError` - Standardized error format

---

## 🔑 Key Features

### Security
- ✅ Only event creator can delete
- ✅ JWT authentication required
- ✅ RLS policies enforced
- ✅ Soft delete (data preserved)

### UX
- ✅ Confirmation dialog
- ✅ Loading states
- ✅ Success/error feedback
- ✅ Optimistic UI option

### Accessibility
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ ARIA labels
- ✅ Focus management

---

## 🎨 Customization

### Custom Button Style

```tsx
<DeleteEventButton
  eventId={event.id}
  eventTitle={event.title}
  variant="outline"  // or 'ghost', 'default'
  size="lg"          // or 'sm', 'icon'
  className="my-custom-class"
/>
```

### Icon-Only Button

```tsx
import { DeleteEventIconButton } from '@/components/events/DeleteEventButton';

<DeleteEventIconButton
  eventId={event.id}
  eventTitle={event.title}
  onDeleted={handleDeleted}
/>
```

### Custom Dialog

```tsx
import { useDeleteEvent } from '@/hooks/useEvents';
import { AlertDialog, ... } from '@/components/ui/alert-dialog';

function MyCustomDialog({ eventId, eventTitle }) {
  const { deleteEvent, isDeleting } = useDeleteEvent();
  
  return (
    <AlertDialog>
      <AlertDialogTrigger>Delete</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Custom Title</AlertDialogTitle>
        <AlertDialogDescription>Custom message</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteEvent(eventId)}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## ⚠️ Error Handling

### Automatic Error Display

The `DeleteEventButton` automatically shows errors in:
1. Dialog (during deletion)
2. Toast (after dialog closes)

### Manual Error Handling

```tsx
const { deleteEvent, error, reset } = useDeleteEvent();

// Check error
if (error) {
  console.log(error.error.code);    // Error code
  console.log(error.error.message); // User message
  console.log(error.error.details); // Additional info
}

// Clear error
reset();
```

### Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_EVENT_ID` | Invalid UUID format |
| `UNAUTHORIZED` | Not logged in |
| `FORBIDDEN` | Not event creator |
| `EVENT_NOT_FOUND` | Event doesn't exist |
| `INTERNAL_ERROR` | Server error |

---

## 🧪 Testing

### In DEV_MODE

```tsx
// DEV_MODE is enabled by default in src/lib/mockAuth.ts
// Mock user is automatically authenticated
// All delete operations work with mock data

import { DEV_MODE, MOCK_USER } from '@/lib/mockAuth';

console.log(DEV_MODE);        // true
console.log(MOCK_USER.id);    // 'mock-user-123'
```

### Manual Testing

1. Create an event
2. Click delete button
3. Confirm in dialog
4. Verify success toast
5. Verify event removed from list

---

## 📚 Examples

### Full Example: Event Detail Page

```tsx
import { useEvent } from '@/hooks/useEvents';
import { DeleteEventButton } from '@/components/events/DeleteEventButton';
import { useRouter } from 'next/navigation';
import { DEV_MODE, MOCK_USER } from '@/lib/mockAuth';

export function EventDetailPage({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { event, isLoading, error } = useEvent(eventId);
  const currentUserId = DEV_MODE ? MOCK_USER.id : 'user-from-auth';

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!event) return <div>Event not found</div>;

  const isCreator = event.created_by === currentUserId;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground mt-2">{event.description}</p>
        </div>
        
        {isCreator && (
          <DeleteEventButton
            eventId={event.id}
            eventTitle={event.title}
            onDeleted={() => router.push('/events')}
          />
        )}
      </div>
      
      {/* More event details... */}
    </div>
  );
}
```

### Full Example: Event List with Optimistic Delete

```tsx
import { useEvents, useEventsOptimistic } from '@/hooks/useEvents';
import { EventCard } from '@/components/events/EventCard';
import { DEV_MODE, MOCK_USER } from '@/lib/mockAuth';

export function EventListPage() {
  const { events, isLoading, error, refetch } = useEvents({ limit: 50 });
  const { optimisticEvents, deleteEventOptimistic, isDeleting } = 
    useEventsOptimistic(events);
  
  const currentUserId = DEV_MODE ? MOCK_USER.id : 'user-from-auth';

  const handleDelete = async (eventId: string) => {
    const result = await deleteEventOptimistic(eventId);
    if (result.success) {
      await refetch(); // Sync with server
    }
  };

  if (isLoading) return <div>Loading events...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Events</h1>
        {isDeleting && (
          <span className="text-sm text-muted-foreground">Deleting...</span>
        )}
      </div>
      
      <div className="space-y-4">
        {optimisticEvents.map(event => (
          <EventCard
            key={event.id}
            event={event}
            currentUserId={currentUserId}
            onDeleted={() => handleDelete(event.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 🔧 Troubleshooting

### Button doesn't appear
- Check if user is event creator: `event.created_by === currentUserId`
- Verify event data is loaded

### Delete fails with 403
- User is not the event creator
- Check authentication (JWT token valid?)

### Delete fails with 404
- Event doesn't exist
- Event is already archived

### Optimistic UI doesn't work
- Make sure you're using `useEventsOptimistic` hook
- Pass initial events array to the hook

---

## 📖 More Information

- **Full Documentation:** `DELETE-EVENT-IMPLEMENTATION-SUMMARY.md`
- **Implementation Plan:** `.ai/delete-event-implementation-plan.md`
- **Test Examples:** `src/actions/deleteEvent.test.example.ts`
- **API Documentation:** `.ai/api-plan.md`

---

**Happy coding!** 🚀

