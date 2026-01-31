/**
 * React 19 Server Action for deleting family members
 */

import { supabase } from '@/db/supabase.client';
import { FamilyMembersService } from '@/services/familyMembers.service';
import type { ApiError, Result } from '@/types';
// Removed DEV_MODE and MOCK_USER - always use real authentication

const service = new FamilyMembersService(supabase);

/**
 * Server action for deleting a family member
 * 
 * @param memberId - ID of member to delete
 * @returns Result with success or error
 */
export async function deleteFamilyMember(
  memberId: string
): Promise<Result<void, ApiError>> {
  try {
    // Validate input
    if (!memberId || typeof memberId !== 'string') {
      return {
        success: false,
        error: {
          status: 400,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid member ID'
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

    // Delete family member
    await service.delete(memberId, familyId);

    return {
      success: true,
      data: undefined
    };
  } catch (error) {
    console.error('Failed to delete family member:', error);

    if (error && typeof error === 'object' && 'statusCode' in error) {
      return {
        success: false,
        error: {
          status: (error as any).statusCode || 500,
          error: {
            code: (error as any).code || 'INTERNAL_ERROR',
            message: (error as any).message || 'Failed to delete family member'
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
          message: error instanceof Error ? error.message : 'Failed to delete family member'
        }
      }
    };
  }
}
