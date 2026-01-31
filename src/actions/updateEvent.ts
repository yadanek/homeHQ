/**
 * React 19 Server Action: updateEvent
 * 
 * Handles event updates with comprehensive validation and authorization.
 * Implements partial update pattern - all fields are optional.
 * 
 * This is the primary API endpoint for PATCH /events/:eventId functionality.
 */

import { createClient } from '@/db/supabase.client';
import { EventsService } from '@/services/events.service';
import { updateEventSchema } from '@/validations/events.schema';
// Removed DEV_MODE, wrapSupabaseWithMockAuth and MOCK_USER - always use real authentication
import type {
  UpdateEventRequest,
  UpdateEventResponse,
  ApiError
} from '@/types';
import { isUUID } from '@/types';

/**
 * Result type for updateEvent action
 * Follows Either pattern for type-safe error handling
 */
export type UpdateEventResult =
  | { success: true; data: UpdateEventResponse }
  | { success: false; error: ApiError };

/**
 * Updates an existing event with partial data
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must be event creator (enforced by RLS)
 * 
 * Process:
 * 1. Validate eventId format early (fail-fast)
 * 2. Authenticate user and extract context
 * 3. Validate input with Zod schema
 * 4. Additional business rule validation
 * 5. Call EventsService to update event
 * 6. Return formatted response or error
 * 
 * Error handling:
 * - 400: Invalid eventId or validation errors
 * - 401: Missing or invalid authentication
 * - 403: User is not event creator or participants from wrong family
 * - 404: Event not found or already archived
 * - 500: Unexpected server errors
 * 
 * @param eventId - UUID of event to update
 * @param formData - Partial event update data
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```tsx
 * // In a React component
 * import { updateEvent } from '@/actions/updateEvent';
 * 
 * function EditEventForm({ eventId }: { eventId: string }) {
 *   const handleSubmit = async (data: UpdateEventRequest) => {
 *     const result = await updateEvent(eventId, data);
 *     if (result.success) {
 *       console.log('Event updated:', result.data);
 *     } else {
 *       console.error('Error:', result.error);
 *     }
 *   };
 * }
 * ```
 */
export async function updateEvent(
  eventId: string,
  formData: UpdateEventRequest
): Promise<UpdateEventResult> {
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
      console.warn('Unauthenticated event update attempt');
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

    // Step 3: Validate input with Zod
    const validation = updateEventSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      console.warn('Event update validation failed:', fieldErrors);
      return {
        success: false,
        error: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Validation failed',
            details: fieldErrors
          }
        }
      };
    }

    // Step 4: Get user context from JWT metadata
    const { data: { session } } = await supabase.auth.getSession();
    const familyId = user.user_metadata?.family_id || session?.user?.user_metadata?.family_id;

    if (!familyId) {
      console.warn(`User ${user.id} attempted to update event without family`);
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'You must join a family before updating events'
          }
        }
      };
    }

    // Step 5: Check if trying to make event private while keeping participants
    // This is caught by Zod, but we double-check at business logic level
    if (
      validation.data.is_private === true &&
      validation.data.participant_ids &&
      validation.data.participant_ids.length > 0
    ) {
      console.warn('Attempt to add participants to private event');
      return {
        success: false,
        error: {
          error: {
            code: 'INVALID_PRIVATE_EVENT',
            message: 'Cannot add participants to private event'
          }
        }
      };
    }

    // Step 6: Update event with service layer
    const eventsService = new EventsService(supabase);
    const result = await eventsService.updateEvent(
      eventId,
      validation.data,
      user.id,
      familyId
    );

    console.info(
      `Event updated successfully: ${eventId} by user ${user.id}`
    );

    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    // Step 7: Handle service layer errors
    console.error('Event update error:', {
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

    // Handle specific error messages
    if (error.message?.includes('not belong to your family')) {
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'All participants must belong to your family'
          }
        }
      };
    }

    if (error.message?.includes('not the creator')) {
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Only event creator can update events'
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
          message: 'Failed to update event. Please try again.',
          details: {
            technical: error.message
          }
        }
      }
    };
  }
}


