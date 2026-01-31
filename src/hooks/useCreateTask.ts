/**
 * Custom Hook for Creating Tasks
 * 
 * Provides task creation functionality with automatic validation (Zod),
 * loading states (useTransition), and error handling.
 * 
 * @example
 * ```tsx
 * const { createTask, isPending, error, reset } = useCreateTask();
 * 
 * const handleSubmit = async () => {
 *   try {
 *     const task = await createTask({
 *       title: 'Buy groceries',
 *       due_date: null,
 *       assigned_to: null,
 *       is_private: false
 *     });
 *     console.log('Created:', task);
 *   } catch (err) {
 *     // Error already in error state
 *   }
 * };
 * ```
 */

import { useCallback, useState, useTransition } from 'react';
import { createTask as createTaskAction } from '@/actions/createTask';
import { createTaskSchema } from '@/validations/tasks.schema';
import { logError } from '@/utils/response.utils';
import type { CreateTaskRequest, TaskResponse } from '@/types';

/**
 * Return type for useCreateTask hook
 */
interface UseCreateTaskReturn {
  /** Function to create a new task */
  createTask: (data: CreateTaskRequest) => Promise<TaskResponse | undefined>;
  /** Whether task creation is in progress (React 19 useTransition) */
  isPending: boolean;
  /** Error message if task creation failed */
  error: string | null;
  /** Function to reset error state */
  reset: () => void;
}

/**
 * Custom Hook for Creating Tasks
 * 
 * Features:
 * - Client-side validation with Zod before API call
 * - React 19 useTransition for non-blocking UI
 * - Automatic error extraction and state management
 * - Promise-based API for easy async/await usage
 * - Reset function to clear error state
 * 
 * Validation Rules:
 * - title: Required, min 1 char after trim
 * - due_date: Optional, ISO 8601 format
 * - assigned_to: Optional, valid UUID
 * - is_private: Required, boolean
 */
export function useCreateTask(): UseCreateTaskReturn {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const createTask = useCallback(
    async (data: CreateTaskRequest): Promise<TaskResponse | undefined> => {
      setError(null);

      const validationResult = createTaskSchema.safeParse(data);
      if (!validationResult.success) {
        const firstError = validationResult.error.issues[0];
        const message = firstError?.message ?? 'Invalid task data';
        setError(message);
        throw new Error(message);
      }

      return new Promise((resolve, reject) => {
        startTransition(async () => {
          try {
            const result = await createTaskAction(validationResult.data);

            if (!result.success) {
              const message = result.error.error.message;
              setError(message);
              reject(new Error(message));
              return;
            }

            resolve(result.data);
          } catch (err) {
            const message = err instanceof Error
              ? err.message
              : 'An unexpected error occurred';
            setError(message);
            logError(err, { scope: 'useCreateTask' });
            reject(err);
          }
        });
      });
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    createTask,
    isPending,
    error,
    reset,
  };
}
