/**
 * React Hook for fetching and managing calendar events
 * 
 * Provides a convenient interface for components to access events data
 * with automatic loading states, error handling, and data refetching.
 */

import { useState, useEffect, useCallback, useOptimistic } from 'react';
import { createClient } from '@/db/supabase.client';
import { createEventsService } from '@/services/events.service';
import { getEventsQuerySchema } from '@/validations/events.schema';
import { extractAndValidateUser } from '@/utils/auth.utils';
import { logError } from '@/utils/response.utils';
import { createEvent as createEventAction } from '@/actions/createEvent';
import { deleteEvent as deleteEventAction, type DeleteEventResult } from '@/actions/deleteEvent';
import { DEV_MODE } from '@/lib/mockAuth';
import { getMockEvents } from '@/lib/mockData';
import type {
  GetEventsQueryParams,
  ListEventsResponse,
  EventWithCreator,
  CreateEventRequest,
  CreateEventResponse,
  ApiError
} from '@/types';
import { z } from 'zod';

/**
 * Hook state interface
 */
interface UseEventsState {
  events: EventWithCreator[];
  pagination: ListEventsResponse['pagination'] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook options interface
 */
interface UseEventsOptions extends Partial<GetEventsQueryParams> {
  enabled?: boolean; // If false, query won't run automatically
}

/**
 * Custom hook for fetching events with filters and pagination
 * 
 * Handles authentication, data fetching, loading states, and errors.
 * Automatically refetches when query parameters change.
 * 
 * @param options - Query parameters and hook options
 * @returns Hook state with events data and utility functions
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { events, isLoading, error } = useEvents({
 *   limit: 50,
 *   is_private: false
 * });
 * 
 * // With date range filter
 * const { events, pagination, refetch } = useEvents({
 *   start_date: '2026-01-01T00:00:00Z',
 *   end_date: '2026-01-31T23:59:59Z',
 *   limit: 100
 * });
 * 
 * // Disabled until user action
 * const { events, refetch } = useEvents({
 *   enabled: false,
 *   limit: 20
 * });
 * // Later: await refetch();
 * ```
 */
export function useEvents(options: UseEventsOptions = {}): UseEventsState {
  const { enabled = true, ...queryParams } = options;

  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [pagination, setPagination] = useState<ListEventsResponse['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches events from the service
   */
  const fetchEvents = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // NOTE: DEV_MODE now only affects auth (auto-login), not data source
      // We always fetch from real database to ensure consistency after family creation
      // (no mock data in DEV mode)

      // Initialize Supabase client
      const supabase = createClient();

      // Validate authentication
      const authResult = await extractAndValidateUser(supabase);
      
      if (authResult.error) {
        setError(authResult.error.message);
        setEvents([]);
        setPagination(null);
        setIsLoading(false);
        return;
      }

      const { user, familyId } = authResult;

      if (!user || !familyId) {
        setError('Authentication failed');
        setEvents([]);
        setPagination(null);
        setIsLoading(false);
        return;
      }

      // Validate query parameters
      let validatedParams: GetEventsQueryParams;
      try {
        // Convert params to string format for validation
        const paramsForValidation = {
          start_date: queryParams.start_date,
          end_date: queryParams.end_date,
          is_private: queryParams.is_private !== undefined 
            ? String(queryParams.is_private) 
            : undefined,
          participant_id: queryParams.participant_id,
          limit: queryParams.limit !== undefined ? String(queryParams.limit) : undefined,
          offset: queryParams.offset !== undefined ? String(queryParams.offset) : undefined,
        };

        validatedParams = getEventsQuerySchema.parse(paramsForValidation);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const errorMessages = validationError.issues.map((e: z.ZodIssue) => e.message).join(', ');
          setError(`Invalid query parameters: ${errorMessages}`);
        } else {
          setError('Invalid query parameters');
        }
        setEvents([]);
        setPagination(null);
        setIsLoading(false);
        return;
      }

      // Fetch events using service
      const eventsService = createEventsService(supabase);
      const result = await eventsService.listEvents(
        validatedParams,
        user.id,
        familyId
      );

      setEvents(result.events);
      setPagination(result.pagination);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch events';
      logError(err, { queryParams });
      setError(errorMessage);
      setEvents([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, queryParams.start_date, queryParams.end_date, queryParams.is_private, 
      queryParams.participant_id, queryParams.limit, queryParams.offset]);

  /**
   * Refetch events manually
   */
  const refetch = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  // Fetch events when options change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    pagination,
    isLoading,
    error,
    refetch
  };
}

/**
 * Custom hook for fetching a single event by ID
 * 
 * Implements enhanced error handling with specific error codes:
 * - 400: Invalid UUID format
 * - 403: Forbidden (different family or private event)
 * - 404: Event not found or archived
 * 
 * @param eventId - Event UUID to fetch
 * @param options - Hook options
 * @returns Hook state with single event data
 * 
 * @example
 * ```typescript
 * const { event, isLoading, error, errorCode } = useEvent('event-uuid-123');
 * 
 * if (errorCode === 'FORBIDDEN') {
 *   // Handle permission denied
 * } else if (errorCode === 'EVENT_NOT_FOUND') {
 *   // Handle not found
 * }
 * ```
 */
export function useEvent(
  eventId: string | null,
  options: { enabled?: boolean } = {}
): {
  event: EventWithCreator | null;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  refetch: () => Promise<void>;
} {
  const { enabled = true } = options;

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled && !!eventId);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!enabled || !eventId) return;

    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      // Initialize Supabase client
      const supabase = createClient();

      // Validate authentication
      const authResult = await extractAndValidateUser(supabase);
      
      if (authResult.error) {
        setError(authResult.error.message);
        setErrorCode('UNAUTHORIZED');
        setEvent(null);
        setIsLoading(false);
        return;
      }

      const { user, familyId } = authResult;

      if (!user || !familyId) {
        setError('Authentication failed');
        setErrorCode('UNAUTHORIZED');
        setEvent(null);
        setIsLoading(false);
        return;
      }

      // Fetch event using service with enhanced security checks
      const eventsService = createEventsService(supabase);
      const result = await eventsService.getEventById(eventId, user.id, familyId);
      
      setEvent(result);
      setError(null);
      setErrorCode(null);
    } catch (err: any) {
      // Handle ServiceError with specific error codes
      if (err.code) {
        setErrorCode(err.code);
        setError(err.message);
        logError(err, { eventId, errorCode: err.code });
      } else {
        // Handle generic errors
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch event';
        setErrorCode('INTERNAL_SERVER_ERROR');
        setError(errorMessage);
        logError(err, { eventId });
      }
      setEvent(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, eventId]);

  const refetch = useCallback(async () => {
    await fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return {
    event,
    isLoading,
    error,
    errorCode,
    refetch
  };
}

/**
 * Custom hook for creating events with AI suggestions
 * 
 * Provides a clean interface for components to create events with loading
 * states, error handling, and automatic optimistic updates.
 * 
 * @returns Hook state with mutation function and status
 * 
 * @example
 * ```typescript
 * function CreateEventForm() {
 *   const { createEvent, isLoading, error, data } = useCreateEvent();
 * 
 *   const handleSubmit = async (formData: CreateEventRequest) => {
 *     const result = await createEvent(formData);
 *     if (result.success) {
 *       console.log('Event created:', result.data.event);
 *       navigate(`/events/${result.data.event.id}`);
 *     }
 *   };
 * 
 *   return (
 *     <form onSubmit={e => {
 *       e.preventDefault();
 *       handleSubmit(getFormData());
 *     }}>
 *       {error && <ErrorMessage error={error} />}
 *       {isLoading ? <Spinner /> : <SubmitButton />}
 *     </form>
 *   );
 * }
 * ```
 */
export function useCreateEvent() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<CreateEventResponse | null>(null);

  /**
   * Creates a new event
   * 
   * @param request - Event creation request data
   * @returns Promise with success/error result
   */
  const createEvent = useCallback(
    async (request: CreateEventRequest) => {
      setIsLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await createEventAction(request);

        if (result.success) {
          setData(result.data);
          setError(null);
          console.info('Event created successfully:', result.data.event.id);
          return result;
        } else {
          setError(result.error);
          setData(null);
          console.warn('Event creation failed:', result.error);
          return result;
        }
      } catch (err) {
        const errorResponse: ApiError = {
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'An unexpected error occurred',
          },
        };
        setError(errorResponse);
        setData(null);
        logError(err, { request });
        return { success: false, error: errorResponse };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Resets the hook state (useful after successful submission)
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    createEvent,
    isLoading,
    error,
    data,
    reset
  };
}

/**
 * Custom hook for deleting events (soft delete)
 * 
 * Provides loading state, error handling, and reset functionality.
 * Compatible with optimistic UI updates using useOptimistic.
 * 
 * @returns Object with deleteEvent function and state
 * 
 * @example
 * ```typescript
 * function EventCard({ event }) {
 *   const { deleteEvent, isDeleting, error, reset } = useDeleteEvent();
 *   
 *   const handleDelete = async () => {
 *     const result = await deleteEvent(event.id);
 *     if (result.success) {
 *       toast.success('Event deleted');
 *     } else {
 *       toast.error(result.error.error.message);
 *     }
 *   };
 *   
 *   return (
 *     <button 
 *       onClick={handleDelete} 
 *       disabled={isDeleting}
 *     >
 *       {isDeleting ? 'Deleting...' : 'Delete'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDeleteEvent() {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Deletes an event
   * 
   * @param eventId - UUID of event to delete
   * @returns Promise with success/error result
   */
  const deleteEvent = useCallback(
    async (eventId: string): Promise<DeleteEventResult> => {
      setIsDeleting(true);
      setError(null);

      try {
        const result = await deleteEventAction(eventId);

        if (result.success) {
          console.info('Event deleted successfully:', eventId);
          setError(null);
          return result;
        } else {
          console.warn('Event deletion failed:', result.error);
          setError(result.error);
          return result;
        }
      } catch (err) {
        const errorResponse: ApiError = {
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'An unexpected error occurred',
          },
        };
        setError(errorResponse);
        logError(err, { eventId });
        return { success: false, error: errorResponse };
      } finally {
        setIsDeleting(false);
      }
    },
    []
  );

  /**
   * Resets the hook state (useful for dismissing error messages)
   */
  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    deleteEvent,
    isDeleting,
    error,
    reset
  };
}

/**
 * Custom hook with optimistic UI support for event deletion
 * 
 * Uses React 19's useOptimistic for instant UI feedback.
 * Automatically rolls back on error.
 * 
 * @param initialEvents - Initial events array
 * @returns Hook state with optimistic events and delete function
 * 
 * @example
 * ```tsx
 * function EventList() {
 *   const { events } = useEvents();
 *   const { optimisticEvents, deleteEventOptimistic } = useEventsOptimistic(events);
 *   
 *   const handleDelete = async (eventId: string) => {
 *     // UI updates immediately
 *     const result = await deleteEventOptimistic(eventId);
 *     
 *     if (!result.success) {
 *       // Rollback is automatic
 *       toast.error('Failed to delete');
 *     }
 *   };
 *   
 *   return optimisticEvents.map(event => (
 *     <EventCard 
 *       key={event.id} 
 *       event={event} 
 *       onDelete={handleDelete} 
 *     />
 *   ));
 * }
 * ```
 */
export function useEventsOptimistic(initialEvents: EventWithCreator[]) {
  const [optimisticEvents, setOptimisticEvents] = useOptimistic(
    initialEvents,
    (state, deletedId: string) => state.filter(e => e.id !== deletedId)
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Deletes an event with optimistic UI update
   * 
   * @param eventId - UUID of event to delete
   * @returns Promise with success/error result
   */
  const deleteEventOptimistic = useCallback(
    async (eventId: string): Promise<DeleteEventResult> => {
      setIsDeleting(true);
      setError(null);

      // Optimistically remove from UI
      setOptimisticEvents(eventId);

      try {
        const result = await deleteEventAction(eventId);

        if (result.success) {
          console.info('Event deleted successfully (optimistic):', eventId);
          setError(null);
          return result;
        } else {
          console.warn('Event deletion failed (rollback):', result.error);
          setError(result.error);
          // Rollback happens automatically via useOptimistic
          return result;
        }
      } catch (err) {
        const errorResponse: ApiError = {
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'An unexpected error occurred',
          },
        };
        setError(errorResponse);
        logError(err, { eventId });
        // Rollback happens automatically via useOptimistic
        return { success: false, error: errorResponse };
      } finally {
        setIsDeleting(false);
      }
    },
    [setOptimisticEvents]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    optimisticEvents,
    deleteEventOptimistic,
    isDeleting,
    error,
    reset
  };
}

