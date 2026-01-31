/**
 * React 19 Server Action: createTaskFromSuggestion
 * 
 * Handles task creation from AI-generated suggestions with comprehensive validation.
 * Tasks created through this action are marked as created_from_suggestion=true for analytics.
 * 
 * This is the API endpoint for POST /tasks/from-suggestion functionality.
 */

import { createClient } from '@/db/supabase.client';
import { createTasksService } from '@/services/tasks.service';
import { createTaskFromSuggestionSchema } from '@/validations/tasks.schema';
// Removed DEV_MODE and MOCK_USER - always use real authentication
import type {
  CreateTaskFromSuggestionRequest,
  TaskResponse,
  ApiError,
} from '@/types';

/**
 * Result type for createTaskFromSuggestion action
 * Follows Either pattern for type-safe error handling
 */
export type CreateTaskFromSuggestionResult =
  | { success: true; data: TaskResponse }
  | { success: false; error: ApiError };

/**
 * Creates a new task from an AI suggestion
 * 
 * This React Server Action handles task creation from AI-generated suggestions
 * linked to calendar events. It's used when users accept suggestions after
 * event creation, either individually or retrospectively.
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must belong to a family and have access to the source event
 * 
 * Process:
 * 1. Authenticate user and extract user ID
 * 2. Validate input with Zod schema
 * 3. Call TasksService to create task with event validation
 * 4. Return formatted response or error
 * 
 * Automatic field assignment:
 * - family_id: From user's profile
 * - created_by: Current user ID
 * - created_from_suggestion: true (analytics flag)
 * 
 * Error handling:
 * - 401: Missing or invalid authentication
 * - 400: Validation errors (invalid UUID, enum, date format)
 * - 403: Authorization errors (no profile, cross-family access, private event)
 * - 404: Resource not found (event archived, assigned user not found)
 * - 500: Unexpected server errors
 * 
 * @param request - Task creation request data from suggestion
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```typescript
 * const result = await createTaskFromSuggestion({
 *   title: 'Buy a gift',
 *   event_id: '550e8400-e29b-41d4-a716-446655440001',
 *   suggestion_id: 'birthday',
 *   is_private: false,
 *   due_date: '2026-01-13T15:00:00Z',
 *   assigned_to: '550e8400-e29b-41d4-a716-446655440000'
 * });
 * 
 * if (result.success) {
 *   console.log('Task created:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function createTaskFromSuggestion(
  request: CreateTaskFromSuggestionRequest
): Promise<CreateTaskFromSuggestionResult> {
  try {
    // === Step 1: Input Validation ===
    const validationResult = createTaskFromSuggestionSchema.safeParse(request);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return {
        success: false,
        error: {
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
            details: {
              field: firstError.path.join('.'),
              issues: validationResult.error.issues
            }
          }
        }
      };
    }

    const validatedData = validationResult.data;

    // === Step 2: Authentication ===
    // Always use the authenticated user from current session
    // No mock override - use real authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization token'
          }
        }
      };
    }

    const userId = user.id;

    // === Step 3: Call Service Layer ===
    const tasksService = createTasksService(supabase);
    const result = await tasksService.createTaskFromSuggestion(validatedData, userId);

    // === Step 4: Handle Service Response ===
    if (result.error) {
      return {
        success: false,
        error: result.error
      };
    }

    if (!result.data) {
      // Should never happen, but TypeScript safety
      console.error('[createTaskFromSuggestion] Service returned success but no data');
      return {
        success: false,
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Task created but no data returned'
          }
        }
      };
    }

    // === Step 5: Return Success ===
    return {
      success: true,
      data: result.data
    };

  } catch (error) {
    // === Unexpected error handling ===
    console.error('[createTaskFromSuggestion] Unexpected error:', error);

    return {
      success: false,
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    };
  }
}
