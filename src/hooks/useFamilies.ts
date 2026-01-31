/**
 * React Hook for family management
 * 
 * Provides a convenient interface for components to create and manage families
 * with automatic loading states, error handling, and success management.
 */

import { useState, useCallback } from 'react';
import { createFamily } from '@/actions/createFamily';
import type {
  CreateFamilyRequest,
  CreateFamilyResponse,
  ApiError,
} from '@/types';

/**
 * Hook state for family creation
 */
interface UseCreateFamilyState {
  data: CreateFamilyResponse | null;
  error: ApiError | null;
  isLoading: boolean;
  isSuccess: boolean;
  createFamilyAction: (request: CreateFamilyRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for creating a new family
 * 
 * Manages loading state, error state, and success data for family creation.
 * Provides a clean interface for form components to handle family creation.
 * 
 * Features:
 * - Loading state management
 * - Error handling with detailed error objects
 * - Success state tracking
 * - Reset functionality to clear state
 * 
 * @returns Hook state with creation function and state data
 * 
 * @example
 * ```typescript
 * function CreateFamilyForm() {
 *   const { createFamilyAction, isLoading, error, isSuccess, data } = useCreateFamily();
 * 
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     await createFamilyAction({
 *       name: 'Smith Family',
 *       display_name: 'John Smith'
 *     });
 *   };
 * 
 *   if (isSuccess) {
 *     return <div>Family created: {data?.name}</div>;
 *   }
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {error && <Alert>{error.error.message}</Alert>}
 *       <Button disabled={isLoading}>Create Family</Button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useCreateFamily(): UseCreateFamilyState {
  const [data, setData] = useState<CreateFamilyResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * Creates a new family with the provided data
   * 
   * Handles the entire creation flow including loading states,
   * error handling, and success state management.
   */
  const createFamilyAction = useCallback(async (request: CreateFamilyRequest) => {
    // Reset state before starting
    setIsLoading(true);
    setError(null);
    setData(null);
    setIsSuccess(false);

    try {
      const result = await createFamily(request);

      if (result.success) {
        setData(result.data);
        setIsSuccess(true);
      } else {
        setError(result.error);
        setIsSuccess(false);
      }
    } catch (err) {
      // Handle unexpected errors
      setError({
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
          details: {
            reason: err instanceof Error ? err.message : 'Unknown error',
          },
        },
      });
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Resets all state to initial values
   * 
   * Useful for clearing the form after successful creation
   * or when the component unmounts.
   */
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsSuccess(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    isSuccess,
    createFamilyAction,
    reset,
  };
}
