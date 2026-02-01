/**
 * React 19 Server Action: createEvent
 * 
 * Handles event creation with AI-generated task suggestions.
 * Implements comprehensive validation, authentication, and error handling.
 * 
 * This is the primary API endpoint for POST /events functionality.
 */

import { createClient } from '@/db/supabase.client';
import { EventsService } from '@/services/events.service';
import { createEventSchema } from '@/validations/events.schema';
// Removed DEV_MODE and MOCK_USER imports - always use real authentication
import type {
  CreateEventRequest,
  CreateEventResponse,
  ApiError,
  UserRole
} from '@/types';

/**
 * Result type for createEvent action
 * Follows Either pattern for type-safe error handling
 */
export type CreateEventResult =
  | { success: true; data: CreateEventResponse }
  | { success: false; error: ApiError };

/**
 * Creates a new event with optional AI-generated task suggestions
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must belong to a family
 * 
 * Process:
 * 1. Authenticate user and extract context
 * 2. Validate input with Zod schema
 * 3. Additional business rule validation
 * 4. Call EventsService to create event
 * 5. Return formatted response or error
 * 
 * Error handling:
 * - 401: Missing or invalid authentication
 * - 400: Validation errors
 * - 403: Authorization errors (wrong family, etc)
 * - 500: Unexpected server errors
 * 
 * @param formData - Event creation request data
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```tsx
 * // In a React component
 * import { createEvent } from '@/actions/createEvent';
 * 
 * function CreateEventForm() {
 *   const handleSubmit = async (data: CreateEventRequest) => {
 *     const result = await createEvent(data);
 *     if (result.success) {
 *       console.log('Event created:', result.data.event);
 *     } else {
 *       console.error('Error:', result.error);
 *     }
 *   };
 * }
 * ```
 */
export async function createEvent(
  formData: CreateEventRequest
): Promise<CreateEventResult> {
  try {
    // Step 1: Get authenticated user from current session
    // Always use the real authenticated user - no mock override
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Step 2: Validate input with Zod
    const validation = createEventSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
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

    // Step 3: Get user context (family_id and role from profile)
    // In DEV mode, we still fetch from real database (not mock metadata)
    
    // Always fetch profile from database (even in DEV mode)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('family_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'You must join a family before creating events',
            details: { reason: 'Profile not found or user not in family' }
          }
        }
      };
    }

    const familyId = profile.family_id;
    const userRole = profile.role as UserRole;

    if (!familyId) {
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'You must join a family before creating events'
          }
        }
      };
    }

    // Step 4: Additional validation - private event constraints
    // This is a business rule check beyond Zod schema validation
    if (
      validation.data.is_private &&
      validation.data.participant_ids &&
      validation.data.participant_ids.length > 1
    ) {
      return {
        success: false,
        error: {
          error: {
            code: 'INVALID_PRIVATE_EVENT',
            message: 'Private events cannot have multiple participants'
          }
        }
      };
    }

    // Step 5: Create event with service layer
    const eventsService = new EventsService(supabase);
    const result = await eventsService.createEventWithSuggestions(
      validation.data,
      user.id,
      familyId,
      userRole
    );

    return {
      success: true,
      data: result
    };
  } catch (error: unknown) {
    // Step 6: Handle service layer errors
    const err = error as any;

    // Handle ServiceError (from service layer)
    if (err.statusCode) {
      return {
        success: false,
        error: {
          error: {
            code: err.code,
            message: err.message,
            details: err.details
          }
        }
      };
    }

    // Handle specific error messages
    if (err.message?.includes('Participant does not belong')) {
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot add participants from other families'
          }
        }
      };
    }

    if (err.message?.includes('same family')) {
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

    // Generic internal error
    return {
      success: false,
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create event. Please try again.',
          details: {
            technical: err.message
          }
        }
      }
    };
  }
}

