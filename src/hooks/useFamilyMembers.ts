/**
 * React hooks for family members management
 * 
 * Provides hooks for CRUD operations on family members using React 19 Actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/db/supabase.client';
import { FamilyMembersService } from '@/services/familyMembers.service';
import { createFamilyMember as createFamilyMemberAction } from '@/actions/createFamilyMember';
import { deleteFamilyMember as deleteFamilyMemberAction } from '@/actions/deleteFamilyMember';
import type { FamilyMember, CreateFamilyMemberRequest } from '@/types';

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Return type for useFamilyMembers hook
 */
interface UseFamilyMembersReturn {
  members: FamilyMember[];
  isLoading: boolean;
  error: ApiError | null;
  addMember: (request: CreateFamilyMemberRequest) => Promise<FamilyMember | null>;
  deleteMember: (memberId: string) => Promise<boolean>;
  reload: () => Promise<void>;
}

/**
 * Hook for managing family members
 * 
 * Features:
 * - Auto-loads members on mount
 * - Uses React 19 Actions for mutations
 * - Returns Result pattern for error handling
 * - Optimistic UI ready
 * 
 * @returns Hook state with CRUD operations
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { members, addMember, deleteMember, isLoading, error } = useFamilyMembers();
 * 
 *   const handleAdd = async () => {
 *     const member = await addMember({ name: 'Emma', is_admin: false });
 *     if (member) {
 *       console.log('Added:', member);
 *     }
 *   };
 * }
 * ```
 */
export function useFamilyMembers(): UseFamilyMembersReturn {
  const { profile } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Load members from database
   */
  const loadMembers = useCallback(async () => {
    if (!profile?.family_id) {
      console.log('⚠️ useFamilyMembers: No family_id, skipping load');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📥 useFamilyMembers: Loading members for family:', profile.family_id);
      
      // Create fresh Supabase client with current session
      const supabase = createClient();
      const service = new FamilyMembersService(supabase);
      
      const data = await service.list(profile.family_id);
      
      console.log('✅ useFamilyMembers: Members loaded:', {
        count: data.length,
        members: data
      });
      
      setMembers(data);
    } catch (err) {
      // Error is already logged by service
      
      // Convert to ApiError format
      const apiError: ApiError = {
        error: {
          code: 'DATABASE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to load members'
        }
      };
      
      setError(apiError);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.family_id]);

  // Auto-load on mount
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  /**
   * Add a new family member
   * Uses React 19 Action for proper error handling
   * 
   * @param request - Member data (name, is_admin)
   * @returns Created member or null if failed
   */
  const addMember = useCallback(async (
    request: CreateFamilyMemberRequest
  ): Promise<FamilyMember | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createFamilyMemberAction(request);

      if (!result.success) {
        setError(result.error);
        return null;
      }

      // Optimistically update local state
      setMembers(prev => [...prev, result.data]);
      return result.data;
    } catch (err) {
      // Error already logged
      
      const apiError: ApiError = {
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to add member'
        }
      };
      
      setError(apiError);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a family member
   * Uses React 19 Action for proper error handling
   * 
   * @param memberId - ID of member to delete
   * @returns True if successful, false otherwise
   */
  const deleteMember = useCallback(async (memberId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await deleteFamilyMemberAction(memberId);

      if (!result.success) {
        setError(result.error);
        return false;
      }

      // Optimistically update local state
      setMembers(prev => prev.filter(m => m.id !== memberId));
      return true;
    } catch (err) {
      // Error already logged
      
      const apiError: ApiError = {
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to delete member'
        }
      };
      
      setError(apiError);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    members,
    isLoading,
    error,
    addMember,
    deleteMember,
    reload: loadMembers
  };
}