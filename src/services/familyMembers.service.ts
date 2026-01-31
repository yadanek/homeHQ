/**
 * Family Members Service Layer
 * 
 * Handles CRUD operations for family members (people without accounts)
 */

import type { SupabaseClient } from '@/db/supabase.client';
import type { FamilyMember, CreateFamilyMemberRequest } from '@/types';
import { ServiceError } from '@/lib/utils/api-errors';

/**
 * Service class for managing family members
 * 
 * Provides methods for CRUD operations on family members table.
 * All operations are protected by RLS at the database level.
 */
export class FamilyMembersService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * List all family members for the authenticated user's family
   * 
   * @param familyId - Family ID to filter by
   * @returns Array of family members
   * @throws ServiceError if database query fails
   */
  async list(familyId: string): Promise<FamilyMember[]> {
    const { data, error } = await this.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('family_members' as any) // Type assertion for custom table
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new ServiceError(
        500,
        'DATABASE_ERROR',
        'Failed to fetch family members',
        { error: error.message }
      );
    }

    return (data as unknown as FamilyMember[]) || [];
  }

  /**
   * Create a new family member
   * 
   * @param familyId - Family ID for the member
   * @param request - Member data (name, is_admin)
   * @returns Newly created family member
   * @throws ServiceError if validation or database operation fails
   */
  async create(
    familyId: string,
    request: CreateFamilyMemberRequest
  ): Promise<FamilyMember> {
    // Validate input
    if (!request.name || request.name.trim().length === 0) {
      throw new ServiceError(
        400,
        'VALIDATION_ERROR',
        'Name is required'
      );
    }

    if (request.name.trim().length > 100) {
      throw new ServiceError(
        400,
        'VALIDATION_ERROR',
        'Name must be less than 100 characters'
      );
    }

    const { data, error } = await this.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('family_members' as any) // Type assertion for custom table
      .insert({
        family_id: familyId,
        name: request.name.trim(),
        is_admin: request.is_admin || false
      })
      .select()
      .single();

    if (error) {
      // Debug: Check JWT
      const { data: { session } } = await this.supabase.auth.getSession();
      console.error('🔍 JWT Debug:', {
        family_id_in_jwt: session?.user?.app_metadata?.family_id,
        family_id_trying_to_insert: familyId,
        full_app_metadata: session?.user?.app_metadata,
        error: error
      });
      
      throw new ServiceError(
        500,
        'DATABASE_ERROR',
        'Failed to create family member',
        { error: error.message }
      );
    }

    if (!data) {
      throw new ServiceError(
        500,
        'UNEXPECTED_ERROR',
        'No data returned after insert'
      );
    }

    return data as unknown as FamilyMember;
  }

  /**
   * Delete a family member
   * 
   * @param memberId - ID of member to delete
   * @param familyId - Family ID for security check
   * @throws ServiceError if database operation fails
   */
  async delete(memberId: string, familyId: string): Promise<void> {
    // RLS will handle authorization, but we double-check family_id
    const { error } = await this.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('family_members' as any) // Type assertion for custom table
      .delete()
      .eq('id', memberId)
      .eq('family_id', familyId);

    if (error) {
      throw new ServiceError(
        500,
        'DATABASE_ERROR',
        'Failed to delete family member',
        { error: error.message }
      );
    }
  }
}