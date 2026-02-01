/**
 * FamiliesService - Business logic for family management
 * 
 * Handles all family-related operations including:
 * - Family creation with automatic admin profile assignment
 * - Family information retrieval
 * - Member management
 * 
 * Security:
 * - All operations require authenticated user
 * - RLS policies enforce family isolation
 * - Atomic transactions for family creation
 */

import type { SupabaseClient } from '@/db/supabase.client';
import type {
  CreateFamilyRequest,
  CreateFamilyResponse,
  CreateFamilyAndAssignAdminParams,
} from '@/types';

/**
 * Custom error class for family-specific errors
 */
export class FamilyServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FamilyServiceError';
  }
}

export class FamiliesService {
  /**
   * Creates a new family and assigns the user as admin
   * 
   * Process:
   * 1. Check if user already has a profile (belongs to a family)
   * 2. Call database function to create family and profile atomically
   * 3. Fetch created family and profile data
   * 4. Return formatted response
   * 
   * Security:
   * - User can only create one family (enforced by profile uniqueness)
   * - Database trigger automatically syncs family_id to JWT metadata
   * - Transaction ensures atomic creation (all-or-nothing)
   * 
   * @param supabase - Authenticated Supabase client
   * @param userId - Authenticated user ID from JWT
   * @param request - Family creation request data
   * @returns Created family with profile data
   * @throws FamilyServiceError if user already belongs to a family or database operation fails
   */
  static async createFamily(
    supabase: SupabaseClient,
    userId: string,
    request: CreateFamilyRequest
  ): Promise<CreateFamilyResponse> {
    // 1. Check if user already has a profile (belongs to a family)
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, family_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileCheckError) {
      throw new FamilyServiceError(
        `Failed to check existing profile: ${profileCheckError.message}`,
        'DATABASE_ERROR',
        { originalError: profileCheckError }
      );
    }

    if (existingProfile) {
      throw new FamilyServiceError(
        'User already belongs to a family',
        'USER_ALREADY_IN_FAMILY',
        { family_id: existingProfile.family_id }
      );
    }

    // 2. Call database function to create family and profile atomically
    const params: CreateFamilyAndAssignAdminParams = {
      user_id: userId,
      family_name: request.name,
      user_display_name: request.display_name,
    };

    const { data: familyId, error: rpcError } = await supabase.rpc(
      'create_family_and_assign_admin',
      params
    );

    if (rpcError || !familyId) {
      throw new FamilyServiceError(
        `Failed to create family: ${rpcError?.message || 'Unknown error'}`,
        'DATABASE_ERROR',
        { originalError: rpcError }
      );
    }

    // 3. Refresh session to get updated JWT with family_id
    // The database trigger updated raw_app_meta_data, but we need to refresh
    // the session to get the updated JWT for RLS policies to work
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('[createFamily] Failed to refresh session after family creation:', refreshError);
      // Continue anyway - we'll try to read the data
    }

    // 4. Fetch created family and profile data
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id, name, created_at')
      .eq('id', familyId)
      .maybeSingle();

    if (familyError) {
      throw new FamilyServiceError(
        `Failed to fetch created family: ${familyError.message}`,
        'DATABASE_ERROR',
        { familyId, originalError: familyError }
      );
    }
    
    if (!family) {
      // Family was created but we can't read it - likely RLS issue
      throw new FamilyServiceError(
        'Family created but not accessible - possible RLS policy issue',
        'DATABASE_ERROR',
        { familyId }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, family_id, role, display_name, created_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new FamilyServiceError(
        `Failed to fetch created profile: ${profileError?.message || 'Profile not found'}`,
        'DATABASE_ERROR',
        { userId, originalError: profileError }
      );
    }

    // 5. Return formatted response
    return {
      id: family.id,
      name: family.name,
      created_at: family.created_at,
      profile: {
        id: profile.id,
        family_id: profile.family_id,
        role: profile.role,
        display_name: profile.display_name,
        created_at: profile.created_at,
      },
    };
  }
}
