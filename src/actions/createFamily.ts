/**
 * React 19 Server Action: createFamily
 * 
 * Handles family creation with automatic admin profile assignment.
 * Implements comprehensive validation, authentication, and error handling.
 * 
 * This is the primary API endpoint for POST /families functionality.
 */

import { createClient } from '@/db/supabase.client';
import { FamiliesService, FamilyServiceError } from '@/services/families.service';
import { createFamilySchema } from '@/validations/families.schema';
// Removed DEV_MODE and MOCK_USER - always use real authentication
import type {
  CreateFamilyRequest,
  CreateFamilyResponse,
  ApiError,
} from '@/types';

/**
 * Result type for createFamily action
 * Follows Either pattern for type-safe error handling
 */
export type CreateFamilyResult =
  | { success: true; data: CreateFamilyResponse }
  | { success: false; error: ApiError };

/**
 * Creates a new family hub and automatically assigns the creator as admin
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must NOT already belong to a family
 * 
 * Process:
 * 1. Authenticate user and extract user ID
 * 2. Validate input with Zod schema
 * 3. Call FamiliesService to create family
 * 4. Return formatted response or error
 * 
 * Error handling:
 * - 401: Missing or invalid authentication
 * - 400: Validation errors
 * - 409: User already belongs to a family
 * - 500: Unexpected server errors
 * 
 * @param request - Family creation request data
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```typescript
 * const result = await createFamily({
 *   name: 'Smith Family',
 *   display_name: 'John Smith'
 * });
 * 
 * if (result.success) {
 *   console.log('Family created:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function createFamily(
  request: CreateFamilyRequest
): Promise<CreateFamilyResult> {
  try {
    // === Step 1: Input Validation ===
    const validationResult = createFamilySchema.safeParse(request);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return {
        success: false,
        error: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Validation failed',
            details: {
              field: firstError.path.join('.'),
              reason: firstError.message,
            },
          },
        },
      };
    }

    // === Step 2: Authentication ===
    const supabase = createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authentication token',
          },
        },
      };
    }

    const userId = user.id;

    // === Step 3: Call Service Layer ===
    const data = await FamiliesService.createFamily(
      supabase,
      userId,
      validationResult.data
    );

    // === Step 3.5: Refresh session to get updated JWT with family_id ===
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('[createFamily] Failed to refresh session (non-fatal):', refreshError);
      // Don't fail - family was created successfully
    }

    // === Step 4: Return Success Response ===
    return {
      success: true,
      data,
    };

  } catch (error) {
    // === Error Handling ===
    
    // Handle FamilyServiceError (expected errors)
    if (error instanceof FamilyServiceError) {
      // User already in family - 409 Conflict
      if (error.code === 'USER_ALREADY_IN_FAMILY') {
        return {
          success: false,
          error: {
            error: {
              code: 'USER_ALREADY_IN_FAMILY',
              message: error.message,
              details: error.details,
            },
          },
        };
      }

      // Database errors - 500 Internal Server Error
      if (error.code === 'DATABASE_ERROR') {
        console.error('[createFamily] Database error:', error);
        return {
          success: false,
          error: {
            error: {
              code: 'DATABASE_ERROR',
              message: 'Failed to create family due to database error',
              details: {
                reason: error.message,
              },
            },
          },
        };
      }
    }

    // Handle unexpected errors
    console.error('[createFamily] Unexpected error:', error);

    return {
      success: false,
      error: {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the family',
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
    };
  }
}
