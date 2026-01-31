/**
 * React 19 Server Action: createTask
 * 
 * Handles manual task creation with comprehensive validation and error handling.
 * Tasks created through this action are marked as manual (not from AI suggestions).
 * 
 * This is the primary API endpoint for POST /tasks functionality.
 */

import { createClient } from '@/db/supabase.client';
import { createTasksService } from '@/services/tasks.service';
import { createTaskSchema } from '@/validations/tasks.schema';
// Removed DEV_MODE and MOCK_USER - always use real authentication
import type {
  CreateTaskRequest,
  TaskResponse,
  ApiError,
} from '@/types';

/**
 * Result type for createTask action
 * Follows Either pattern for type-safe error handling
 */
export type CreateTaskResult =
  | { success: true; data: TaskResponse }
  | { success: false; error: ApiError };

/**
 * Creates a new manual task in the user's family
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must belong to a family
 * 
 * Process:
 * 1. Authenticate user and extract user ID
 * 2. Validate input with Zod schema
 * 3. Call TasksService to create task with family validation
 * 4. Return formatted response or error
 * 
 * Automatic field assignment:
 * - family_id: From user's profile
 * - created_by: Current user ID
 * - event_id: NULL (manual tasks)
 * - created_from_suggestion: false
 * 
 * Error handling:
 * - 401: Missing or invalid authentication
 * - 400: Validation errors (empty title, invalid date format, invalid UUID)
 * - 403: Authorization errors (no profile, assigned_to outside family)
 * - 500: Unexpected server errors
 * 
 * @param request - Task creation request data
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```typescript
 * const result = await createTask({
 *   title: 'Buy groceries',
 *   due_date: '2026-01-05T18:00:00Z',
 *   assigned_to: '550e8400-e29b-41d4-a716-446655440000',
 *   is_private: false
 * });
 * 
 * if (result.success) {
 *   console.log('Task created:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function createTask(
  request: CreateTaskRequest
): Promise<CreateTaskResult> {
  try {
    // === Step 1: Input Validation ===
    const validationResult = createTaskSchema.safeParse(request);

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
              value: firstError.path.length > 0 
                ? request[firstError.path[0] as keyof CreateTaskRequest]
                : undefined
            },
          },
        },
      };
    }

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
            message: 'Missing or invalid authorization token',
          },
        },
      };
    }

    const userId = user.id;

    // === Step 3: Call Service Layer ===
    const tasksService = createTasksService(supabase);
    const result = await tasksService.createTask(validationResult.data, userId);

    // Check if service returned an error
    if (result.error) {
      return {
        success: false,
        error: result.error,
      };
    }

    // === Step 4: Return Success Response ===
    if (!result.data) {
      // This should never happen, but handle it defensively
      console.error('[createTask] Service returned success but no data');
      return {
        success: false,
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
      };
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    // === Error Handling ===
    console.error('[createTask] Unexpected error:', error);

    return {
      success: false,
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the task',
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
    };
  }
}
