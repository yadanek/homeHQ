/**
 * Custom hook for creating a new family
 * 
 * Encapsulates the logic for family creation including:
 * - Loading state management
 * - Error handling
 * - Automatic display_name retrieval from auth context
 * - API call to createFamily action
 * 
 * Usage:
 * ```typescript
 * const { createFamily, isCreating, error, reset } = useCreateFamily();
 * 
 * const handleSubmit = async (formData) => {
 *   await createFamily(formData);
 * };
 * ```
 */

import { useState, useCallback } from 'react';
import { createFamily as createFamilyAction } from '@/actions/createFamily';
import { MOCK_USER } from '@/lib/mockAuth';
import type {
  CreateFamilyRequest,
  CreateFamilyResponse,
  ApiError,
} from '@/types';
import type { CreateFamilyFormData } from '@/types/onboarding';

/**
 * Return type for useCreateFamily hook
 */
interface UseCreateFamilyReturn {
  createFamily: (data: CreateFamilyFormData) => Promise<CreateFamilyResponse>;
  isCreating: boolean;
  error: ApiError | null;
  reset: () => void;
}

/**
 * Custom hook for creating a new family
 * 
 * Features:
 * - Automatic display_name retrieval from auth context
 * - Client-side validation (Zod schema applied in action)
 * - Loading state management
 * - Error handling with detailed error objects
 * - Reset functionality
 * 
 * @returns Hook state with creation function and state data
 * 
 * @example
 * ```typescript
 * function CreateFamilyPage() {
 *   const { createFamily, isCreating, error } = useCreateFamily();
 * 
 *   const handleSubmit = async (formData: CreateFamilyFormData) => {
 *     try {
 *       const result = await createFamily(formData);
 *       console.log('Family created:', result);
 *     } catch (err) {
 *       console.error('Failed:', err);
 *     }
 *   };
 * }
 * ```
 */
export function useCreateFamily(): UseCreateFamilyReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Helper function to get user's display name from auth context
   * TODO: Replace with real auth context when available
   */
  const getUserDisplayName = useCallback((): string => {
    // TODO: Replace with real auth context
    // const { user } = useAuth();
    // return user?.user_metadata?.display_name || 'User';
    
    return MOCK_USER.user_metadata.display_name || 'User';
  }, []);

  /**
   * Creates a new family with the provided form data
   * 
   * Automatically retrieves display_name from auth context and
   * combines it with the form data to create the family.
   * 
   * @param data - Form data containing family name
   * @returns Promise resolving to the created family response
   * @throws Error if creation fails
   */
  const createFamily = useCallback(async (
    data: CreateFamilyFormData
  ): Promise<CreateFamilyResponse> => {
    setIsCreating(true);
    setError(null);

    try {
      // Get display_name from auth context
      const displayName = getUserDisplayName();
      
      // Prepare request with display_name
      const request: CreateFamilyRequest = {
        name: data.name.trim(),
        display_name: displayName
      };

      // Call the action
      const result = await createFamilyAction(request);

      if (!result.success) {
        setError(result.error);
        throw new Error(result.error.error.message);
      }

      setIsCreating(false);
      return result.data;
    } catch (err) {
      setIsCreating(false);
      throw err;
    }
  }, [getUserDisplayName]);

  /**
   * Resets all state to initial values
   * 
   * Useful for clearing errors or resetting the form
   * after navigation or component unmount.
   */
  const reset = useCallback(() => {
    setError(null);
    setIsCreating(false);
  }, []);

  return {
    createFamily,
    isCreating,
    error,
    reset,
  };
}
