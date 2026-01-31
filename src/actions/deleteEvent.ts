/**
 * React 19 Server Action: deleteEvent
 * 
 * Handles event soft deletion with authentication and authorization.
 * Implements comprehensive validation and error handling.
 * 
 * This is the primary API endpoint for DELETE /events/:eventId functionality.
 */

import { createClient } from '@/db/supabase.client';
import { EventsService } from '@/services/events.service';
// Removed DEV_MODE and MOCK_USER - always use real authentication
import type { ApiError } from '@/types';
import { isUUID } from '@/types';

/**
 * Result type for deleteEvent action
 * Follows Either pattern for type-safe error handling
 */
export type DeleteEventResult =
  | { success: true }
  | { success: false; error: ApiError };

/**
 * Deletes an event (soft delete)
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must be event creator
 * 
 * Process:
 * 1. Validate eventId format early
 * 2. Authenticate user and extract context
 * 3. Call EventsService to delete event
 * 4. Return formatted response or error
 * 
 * Error handling:
 * - 401: Missing or invalid authentication
 * - 400: Invalid event ID format
 * - 403: User is not event creator
 * - 404: Event not found or already archived
 * - 500: Unexpected server errors
 * 
 * @param eventId - UUID of event to delete
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```tsx
 * // In a React component
 * import { deleteEvent } from '@/actions/deleteEvent';
 * 
 * function DeleteEventButton({ eventId }: { eventId: string }) {
 *   const handleDelete = async () => {
 *     const result = await deleteEvent(eventId);
 *     if (result.success) {
 *       console.log('Event deleted successfully');
 *     } else {
 *       console.error('Error:', result.error);
 *     }
 *   };
 *   
 *   return <button onClick={handleDelete}>Delete</button>;
 * }
 * ```
 */
export async function deleteEvent(
  eventId: string
): Promise<DeleteEventResult> {
  try {
    // Step 1: Validate eventId format early (fail-fast)
    if (!isUUID(eventId)) {
      console.warn(`Invalid event ID format: ${eventId}`);
      return {
        success: false,
        error: {
          error: {
            code: 'INVALID_EVENT_ID',
            message: 'Event ID must be a valid UUID',
            details: { eventId }
          }
        }
      };
    }

    // Step 2: Get authenticated user from current session
    // Always use the real authenticated user - no mock override
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('Unauthenticated delete attempt');
      return {
        success: false,
        error: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.'
          }
        }
      };
    }

    // Step 3: Get user's family_id from profile (works in both DEV and PROD)
    // Use real supabase client which has valid JWT from authenticated session
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(`Failed to fetch profile for user ${user.id}:`, profileError);
      return {
        success: false,
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to verify user permissions'
          }
        }
      };
    }

    if (!profile?.family_id) {
      console.warn(`User ${user.id} attempted to delete event without family`);
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'You must join a family before deleting events'
          }
        }
      };
    }

    const familyId = profile.family_id;

    // Step 4: Delete event with service layer
    const eventsService = new EventsService(supabase);
    await eventsService.deleteEvent(eventId, user.id, familyId);

    console.info(
      `Event deleted successfully: ${eventId} by user ${user.id}`
    );

    return {
      success: true
    };
  } catch (error: any) {
    // Step 5: Handle service layer errors
    console.error('Event deletion error:', {
      eventId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Handle ServiceError (from service layer)
    if (error.status && error.code) {
      return {
        success: false,
        error: {
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        }
      };
    }

    // Generic internal error
    return {
      success: false,
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete event. Please try again.',
          details: {
            technical: error.message
          }
        }
      }
    };
  }
}

