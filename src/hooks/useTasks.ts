/**
 * React Hook for fetching and managing tasks
 * 
 * Provides a convenient interface for components to access tasks data
 * with automatic loading states, error handling, and data refetching.
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/db/supabase.client';
import { createTasksService } from '@/services/tasks.service';
import { getTasksQuerySchema } from '@/validations/tasks.schema';
import { extractAndValidateUser } from '@/utils/auth.utils';
import { logError } from '@/utils/response.utils';
import { createTask as createTaskAction } from '@/actions/createTask';
import { createTaskFromSuggestion as createTaskFromSuggestionAction } from '@/actions/createTaskFromSuggestion';
import { DEV_MODE } from '@/lib/mockAuth';
import { getMockTasks } from '@/lib/mockData';
import type {
  GetTasksQueryParams,
  ListTasksResponse,
  TaskWithDetails,
  UpdateTaskResponse,
  CreateTaskRequest,
  CreateTaskFromSuggestionRequest,
  TaskResponse,
  ApiError
} from '@/types';
import { z } from 'zod';

/**
 * Hook state interface
 */
interface UseTasksState {
  tasks: TaskWithDetails[];
  pagination: ListTasksResponse['pagination'] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateTaskCompletion: (taskId: string, isCompleted: boolean) => Promise<UpdateTaskResponse | null>;
}

/**
 * Hook options interface
 */
interface UseTasksOptions extends Partial<Omit<GetTasksQueryParams, 'sort'>> {
  enabled?: boolean; // If false, query won't run automatically
  sort?: 'due_date_asc' | 'due_date_desc' | 'created_at_desc';
}

/**
 * Custom hook for fetching tasks with filters and pagination
 * 
 * Handles authentication, data fetching, loading states, and errors.
 * Automatically refetches when query parameters change.
 * 
 * @param options - Query parameters and hook options
 * @returns Hook state with tasks data and utility functions
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { tasks, isLoading, error } = useTasks({
 *   limit: 50,
 *   is_completed: false
 * });
 * 
 * // With date range filter
 * const { tasks, pagination, refetch } = useTasks({
 *   due_after: '2026-01-01T00:00:00Z',
 *   due_before: '2026-01-31T23:59:59Z',
 *   limit: 100
 * });
 * 
 * // Disabled until user action
 * const { tasks, refetch, updateTaskCompletion } = useTasks({
 *   enabled: false,
 *   limit: 20
 * });
 * // Later: await refetch();
 * ```
 */
export function useTasks(options: UseTasksOptions = {}): UseTasksState {
  const { enabled = true, ...queryParams } = options;

  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [pagination, setPagination] = useState<ListTasksResponse['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches tasks from the service
   */
  const fetchTasks = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // NOTE: DEV_MODE now only affects auth (auto-login), not data source
      // We always fetch from real database to ensure consistency
      // (no mock data in DEV mode)

      // Initialize Supabase client
      const supabase = createClient();

      // Validate authentication
      const authResult = await extractAndValidateUser(supabase);
      
      if (authResult.error) {
        setError(authResult.error.message);
        setTasks([]);
        setPagination(null);
        setIsLoading(false);
        return;
      }

      const { user, familyId } = authResult;

      if (!user || !familyId) {
        setError('Authentication failed');
        setTasks([]);
        setPagination(null);
        setIsLoading(false);
        return;
      }

      // Validate query parameters
      let validatedParams: GetTasksQueryParams;
      try {
        // Convert params to string format for validation
        const paramsForValidation = {
          is_completed: queryParams.is_completed !== undefined 
            ? String(queryParams.is_completed) 
            : undefined,
          is_private: queryParams.is_private !== undefined 
            ? String(queryParams.is_private) 
            : undefined,
          assigned_to: queryParams.assigned_to,
          due_before: queryParams.due_before,
          due_after: queryParams.due_after,
          event_id: queryParams.event_id,
          sort: queryParams.sort,
          limit: queryParams.limit !== undefined ? String(queryParams.limit) : undefined,
          offset: queryParams.offset !== undefined ? String(queryParams.offset) : undefined,
        };

        validatedParams = getTasksQuerySchema.parse(paramsForValidation);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const errorMessages = validationError.issues.map((e: z.ZodIssue) => e.message).join(', ');
          setError(`Invalid query parameters: ${errorMessages}`);
        } else {
          setError('Invalid query parameters');
        }
        setTasks([]);
        setPagination(null);
        setIsLoading(false);
        return;
      }

      // Fetch tasks using service
      const tasksService = createTasksService(supabase);
      const result = await tasksService.listTasks(
        validatedParams,
        user.id,
        familyId
      );

      setTasks(result.tasks);
      setPagination(result.pagination);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tasks';
      logError(err, { queryParams });
      setError(errorMessage);
      setTasks([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, queryParams.is_completed, queryParams.is_private, queryParams.assigned_to,
      queryParams.due_before, queryParams.due_after, queryParams.event_id, queryParams.sort,
      queryParams.limit, queryParams.offset]);

  /**
   * Updates task completion status with optimistic UI update
   */
  const updateTaskCompletion = useCallback(async (
    taskId: string,
    isCompleted: boolean
  ): Promise<UpdateTaskResponse | null> => {
    try {
      const supabase = createClient();
      const authResult = await extractAndValidateUser(supabase);
      
      if (authResult.error || !authResult.user) {
        setError('Authentication required to update task');
        return null;
      }

      // Optimistic UI update
      setTasks(prev => 
        prev.map(t => t.id === taskId ? { ...t, is_completed: isCompleted } : t)
      );

      const tasksService = createTasksService(supabase);
      const result = await tasksService.updateTaskCompletion(
        taskId,
        isCompleted,
        authResult.user.id
      );

      // Update with server response
      setTasks(prev => 
        prev.map(t => t.id === taskId ? { ...t, ...result } : t)
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
      logError(err, { taskId, isCompleted });
      setError(errorMessage);
      
      // Rollback optimistic update on error
      await fetchTasks();
      
      return null;
    }
  }, [fetchTasks]);

  /**
   * Refetch tasks manually
   */
  const refetch = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  // Fetch tasks when options change
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    pagination,
    isLoading,
    error,
    refetch,
    updateTaskCompletion
  };
}

/**
 * Custom hook for fetching a single task by ID
 * 
 * @param taskId - Task UUID to fetch
 * @param options - Hook options
 * @returns Hook state with single task data
 * 
 * @example
 * ```typescript
 * const { task, isLoading, error } = useTask('task-uuid-123');
 * ```
 */
export function useTask(
  taskId: string | null,
  options: { enabled?: boolean } = {}
): {
  task: TaskWithDetails | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { enabled = true } = options;

  const [task, setTask] = useState<TaskWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled && !!taskId);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    if (!enabled || !taskId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const tasksService = createTasksService(supabase);
      
      const result = await tasksService.getTaskById(taskId);
      
      if (!result) {
        setError('Task not found or access denied');
        setTask(null);
      } else {
        setTask(result);
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch task';
      logError(err, { taskId });
      setError(errorMessage);
      setTask(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, taskId]);

  const refetch = useCallback(async () => {
    await fetchTask();
  }, [fetchTask]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  return {
    task,
    isLoading,
    error,
    refetch
  };
}

/**
 * Custom hook for creating a new manual task
 * 
 * Provides loading state, error handling, and result data for task creation.
 * Use this hook when you need to create a task from a form or button click.
 * 
 * @returns Hook state with create function and status
 * 
 * @example
 * const { createTask, isLoading, error, data, reset } = useCreateTask();
 * 
 * await createTask({
 *   title: "Buy groceries",
 *   due_date: "2026-01-05T18:00:00Z",
 *   assigned_to: "uuid-here",
 *   is_private: false
 * });
 */
export function useCreateTask() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<TaskResponse | null>(null);  /**
   * Creates a new manual task
   * 
   * @param request - Task creation request data
   * @returns Promise with success/error result
   */
  const createTask = useCallback(
    async (request: CreateTaskRequest) => {
      setIsLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await createTaskAction(request);

        if (result.success) {
          setData(result.data);
          setError(null);
          console.info('Task created successfully:', result.data.id);
          return result;
        } else {
          setError(result.error);
          setData(null);
          console.warn('Task creation failed:', result.error);
          return result;
        }
      } catch (err) {
        const errorResponse: ApiError = {
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'An unexpected error occurred',
          },
        };
        setError(errorResponse);
        setData(null);
        logError(err, { request });
        return { success: false, error: errorResponse };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Resets the hook state (useful after successful submission)
   */
  const reset = useCallback(() => {
    setError(null);
    setData(null);
    setIsLoading(false);
  }, []);

  return {
    createTask,
    isLoading,
    error,
    data,
    reset
  };
}



/**
 * Custom hook for creating tasks from AI suggestions
 * 
 * Provides loading state, error handling, and result data for task creation from suggestions.
 * Use this hook when users accept AI-generated task suggestions linked to events.
 * 
 * @returns Hook state with create function and status
 * 
 * @example
 * const { createFromSuggestion, isLoading, error, data, reset } = useCreateTaskFromSuggestion();
 * 
 * await createFromSuggestion({
 *   title: "Buy a gift",
 *   event_id: "550e8400-e29b-41d4-a716-446655440001",
 *   suggestion_id: "birthday",
 *   is_private: false,
 *   due_date: "2026-01-13T15:00:00Z",
 *   assigned_to: null
 * });
 */
export function useCreateTaskFromSuggestion() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<TaskResponse | null>(null);

  /**
   * Creates a task from an AI suggestion
   * 
   * @param request - Task creation data from suggestion
   * @returns Promise with success/error result
   */
  const createFromSuggestion = useCallback(
    async (request: CreateTaskFromSuggestionRequest) => {
      setIsLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await createTaskFromSuggestionAction(request);

        if (result.success) {
          setData(result.data);
          setError(null);
          console.info('Task created from suggestion successfully:', result.data.id);
          return result;
        } else {
          setError(result.error);
          setData(null);
          console.warn('Task creation from suggestion failed:', result.error);
          return result;
        }
      } catch (err) {
        const errorResponse: ApiError = {
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'An unexpected error occurred',
          },
        };
        setError(errorResponse);
        setData(null);
        logError(err, { request });
        return { success: false, error: errorResponse };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Resets the hook state (useful after successful submission)
   */
  const reset = useCallback(() => {
    setError(null);
    setData(null);
    setIsLoading(false);
  }, []);

  return {
    createFromSuggestion,
    isLoading,
    error,
    data,
    reset
  };
}
