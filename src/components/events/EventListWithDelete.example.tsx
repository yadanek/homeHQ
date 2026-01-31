/**
 * EventListWithDelete - Example Component
 * 
 * Demonstrates how to use the delete event functionality with optimistic UI.
 * This is an example implementation showing best practices.
 */

import { useEvents, useEventsOptimistic } from '@/hooks/useEvents';
import { EventCard } from './EventCard';
import { DEV_MODE, MOCK_USER } from '@/lib/mockAuth';

/**
 * Example: Event list with optimistic delete
 * 
 * Shows how to integrate delete functionality with event listing.
 * Uses optimistic UI for instant feedback.
 */
export function EventListWithOptimisticDelete() {
  // Fetch events
  const { events, isLoading, error, refetch } = useEvents({
    limit: 50,
    is_private: false
  });

  // Setup optimistic UI
  const { 
    optimisticEvents, 
    deleteEventOptimistic, 
    isDeleting 
  } = useEventsOptimistic(events);

  // Get current user ID (from auth or mock)
  const currentUserId = DEV_MODE ? MOCK_USER.id : 'user-id-from-auth';

  const handleDelete = async (eventId: string) => {
    const result = await deleteEventOptimistic(eventId);
    
    if (result.success) {
      // Optionally refetch to ensure sync with server
      await refetch();
    }
  };

  if (isLoading) {
    return <div>Loading events...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (optimisticEvents.length === 0) {
    return <div>No events found</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">
        Upcoming Events
        {isDeleting && <span className="text-sm text-muted-foreground ml-2">(Deleting...)</span>}
      </h2>
      
      {optimisticEvents.map(event => (
        <EventCard
          key={event.id}
          event={event}
          currentUserId={currentUserId}
          onDeleted={() => handleDelete(event.id)}
        />
      ))}
    </div>
  );
}

/**
 * Example: Simple event list without optimistic UI
 * 
 * Shows basic integration with manual refetch after deletion.
 */
export function EventListSimple() {
  const { events, isLoading, error, refetch } = useEvents();
  const currentUserId = DEV_MODE ? MOCK_USER.id : 'user-id-from-auth';

  const handleDeleted = async () => {
    // Refetch events after deletion
    await refetch();
  };

  if (isLoading) {
    return <div>Loading events...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {events.map(event => (
        <EventCard
          key={event.id}
          event={event}
          currentUserId={currentUserId}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}

