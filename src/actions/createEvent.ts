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
      console.warn('Unauthenticated event creation attempt');
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
      console.warn('Event validation failed:', fieldErrors);
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
    let familyId;
    let userRole: UserRole;
    
    // Always fetch profile from database (even in DEV mode)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('family_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.warn(`Failed to get profile for user ${user.id}:`, profileError);
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

    familyId = profile.family_id;
    userRole = profile.role as UserRole;

    if (!familyId) {
      console.warn(`User ${user.id} attempted to create event without family`);
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

    // Ensure JWT app_metadata has up-to-date family_id for RLS policies
    // Even if signIn handled this, re-sync defensively right before insert
    try {
      const { error: syncError } = await supabase.rpc('sync_current_user_jwt');
      if (syncError) {
        console.warn('[createEvent] JWT sync failed (non-fatal):', syncError);
      } else {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[createEvent] Session refresh after JWT sync failed:', refreshError);
        }
      }
    } catch (e) {
      console.warn('[createEvent] Unexpected error during JWT sync:', e);
    }

    // Step 4: Additional validation - private event constraints
    // This is a business rule check beyond Zod schema validation
    if (
      validation.data.is_private &&
      validation.data.participant_ids &&
      validation.data.participant_ids.length > 1
    ) {
      console.warn('Attempt to create private event with multiple participants');
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

    console.info(
      `Event created successfully: ${result.event.id} by user ${user.id}`
    );

    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    // Step 6: Handle service layer errors
    console.error('Event creation error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Handle ServiceError (from service layer)
    if (error.statusCode) {
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
    if (error.message?.includes('Participant does not belong')) {
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

    if (error.message?.includes('same family')) {
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
            technical: error.message
          }
        }
      }
    };
  }
}

