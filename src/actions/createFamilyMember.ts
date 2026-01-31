/**
 * React 19 Server Action for creating family members
 * 
 * Handles validation, authentication, and database operations
 * for creating family members without user accounts.
 */

import { supabase } from '@/db/supabase.client';
import { FamilyMembersService } from '@/services/familyMembers.service';
import { createFamilyMemberSchema } from '@/validations/familyMembers.schema';
import type { CreateFamilyMemberRequest, FamilyMember, ApiError, Result } from '@/types';
// Removed DEV_MODE and MOCK_USER - always use real authentication

const service = new FamilyMembersService(supabase);

/**
 * Server action for creating a family member
 * 
 * @param request - Member data (name, is_admin)
 * @returns Result with created member or error
 */
export async function createFamilyMember(
  request: CreateFamilyMemberRequest
): Promise<Result<FamilyMember, ApiError>> {
  try {
    // Validate input with Zod
    const validationResult = createFamilyMemberSchema.safeParse(request);
    if (!validationResult.success) {
      return {
        success: false,
        error: {
          status: 400,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors
          }
        }
      };
    }

    // Get authenticated user from current session
    // Always use the real authenticated user - no mock override
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: {
          status: 401,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        }
      };
    }

    const userId = user.id;

    // Fetch profile to get family_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: {
          status: 500,
          error: {
            code: 'PROFILE_ERROR',
            message: 'Failed to fetch user profile'
          }
        }
      };
    }

    const familyId = profile.family_id;

    if (!familyId) {
      return {
        success: false,
        error: {
          status: 403,
          error: {
            code: 'NO_FAMILY',
            message: 'User does not belong to a family'
          }
        }
      };
    }

    // Create family member
    const member = await service.create(familyId, validationResult.data);

    return {
      success: true,
      data: member
    };
  } catch (error) {
    console.error('Failed to create family member:', error);

    // Handle service errors
    if (error && typeof error === 'object' && 'statusCode' in error) {
      return {
        success: false,
        error: {
          status: (error as any).statusCode || 500,
          error: {
            code: (error as any).code || 'INTERNAL_ERROR',
            message: (error as any).message || 'Failed to create family member'
          }
        }
      };
    }

    return {
      success: false,
      error: {
        status: 500,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create family member'
        }
      }
    };
  }
}
