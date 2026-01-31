/**
 * Tasks Service Layer
 * 
 * Provides business logic for managing tasks.
 * Handles all database operations for tasks with proper RLS enforcement.
 */

import type { SupabaseClient } from '@/db/supabase.client';
import type {
  GetTasksQueryParams,
  ListTasksResponse,
  TaskWithDetails,
  UpdateTaskRequest,
  UpdateTaskResponse,
  PaginationMeta,
  CreateTaskRequest,
  CreateTaskFromSuggestionRequest,
  TaskResponse,
  ApiError
} from '@/types';
import type { TablesInsert } from '@/db/database.types';
import { createTaskSchema } from '@/validations/tasks.schema';
import { logError } from '@/utils/response.utils';

/**
 * Tasks Service class
 * 
 * Encapsulates all task-related business logic and database operations.
 * Uses Supabase client for database access with automatic RLS enforcement.
 */
export class TasksService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Retrieves a paginated list of tasks for the authenticated user's family
   * 
   * Automatically filters tasks based on RLS policies:
   * - Shared tasks visible to all family members
   * - Private tasks visible only to creator
   */
  async listTasks(
    params: GetTasksQueryParams,
    userId: string,
    _familyId: string
  ): Promise<ListTasksResponse> {
    // Build base query with all necessary joins
    // Note: RLS policies automatically filter by family_id and privacy settings
    let query = this.supabase
      .from('tasks')
      .select(`
        id,
        created_by,
        family_id,
        title,
        due_date,
        assigned_to,
        is_private,
        is_completed,
        completed_at,
        completed_by,
        event_id,
        suggestion_id,
        created_from_suggestion,
        created_at,
        updated_at,
        archived_at,
        created_by_profile:profiles!tasks_created_by_fkey(display_name),
        assigned_to_profile:profiles!tasks_assigned_to_fkey(display_name),
        completed_by_profile:profiles!tasks_completed_by_fkey(display_name),
        event:events(title)
      `, { count: 'exact' })
      .is('archived_at', null);

    // Apply filters
    if (params.is_completed !== undefined) {
      query = query.eq('is_completed', params.is_completed);
    }

    if (params.is_private !== undefined) {
      query = query.eq('is_private', params.is_private);
    }

    if (params.assigned_to) {
      // Handle "me" special case
      const assigneeId = params.assigned_to === 'me' ? userId : params.assigned_to;
      query = query.eq('assigned_to', assigneeId);
    }

    if (params.due_after) {
      query = query.gte('due_date', params.due_after);
    }

    if (params.due_before) {
      query = query.lte('due_date', params.due_before);
    }

    if (params.event_id) {
      query = query.eq('event_id', params.event_id);
    }

    // Apply sorting
    const sort = params.sort ?? 'due_date_asc';
    if (sort === 'due_date_asc') {
      query = query.order('due_date', { ascending: true, nullsFirst: false });
    } else if (sort === 'due_date_desc') {
      query = query.order('due_date', { ascending: false, nullsFirst: false });
    } else if (sort === 'created_at_desc') {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    
    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1
    );

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    // Transform data to match TaskWithDetails interface
    const tasks: TaskWithDetails[] = (data || []).map(task => {
      // Get names with fallbacks
      const createdByName = Array.isArray(task.created_by_profile)
        ? task.created_by_profile[0]?.display_name || 'Unknown'
        : task.created_by_profile?.display_name || 'Unknown';

      const assignedToName = task.assigned_to_profile
        ? (Array.isArray(task.assigned_to_profile)
          ? task.assigned_to_profile[0]?.display_name || null
          : task.assigned_to_profile?.display_name || null)
        : null;

      const completedByName = task.completed_by_profile
        ? (Array.isArray(task.completed_by_profile)
          ? task.completed_by_profile[0]?.display_name || null
          : task.completed_by_profile?.display_name || null)
        : null;

      const eventTitle = task.event
        ? (Array.isArray(task.event)
          ? task.event[0]?.title || null
          : task.event?.title || null)
        : null;

      return {
        id: task.id,
        created_by: task.created_by,
        created_by_name: createdByName,
        family_id: task.family_id,
        title: task.title,
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        assigned_to_name: assignedToName,
        is_private: task.is_private,
        is_completed: task.is_completed,
        completed_at: task.completed_at,
        completed_by: task.completed_by,
        completed_by_name: completedByName,
        event_id: task.event_id,
        event_title: eventTitle,
        suggestion_id: task.suggestion_id,
        created_from_suggestion: task.created_from_suggestion,
        created_at: task.created_at,
        updated_at: task.updated_at,
        archived_at: task.archived_at,
      };
    });

    // Create pagination metadata
    const total = count || 0;
    const pagination: PaginationMeta = {
      total,
      limit,
      offset,
      has_more: total > offset + limit
    };

    return { tasks, pagination };
  }

  /**
   * Retrieves a single task by ID
   * 
   * RLS policies ensure the user can only access:
   * - Tasks in their family
   * - Shared tasks or their own private tasks
   */
  async getTaskById(taskId: string): Promise<TaskWithDetails | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select(`
        id,
        created_by,
        family_id,
        title,
        due_date,
        assigned_to,
        is_private,
        is_completed,
        completed_at,
        completed_by,
        event_id,
        suggestion_id,
        created_from_suggestion,
        created_at,
        updated_at,
        archived_at,
        created_by_profile:profiles!tasks_created_by_fkey(display_name),
        assigned_to_profile:profiles!tasks_assigned_to_fkey(display_name),
        completed_by_profile:profiles!tasks_completed_by_fkey(display_name),
        event:events(title)
      `)
      .eq('id', taskId)
      .is('archived_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found or no access due to RLS
        return null;
      }
      throw new Error(`Failed to fetch task: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Transform data
    const createdByName = Array.isArray(data.created_by_profile)
      ? data.created_by_profile[0]?.display_name || 'Unknown'
      : data.created_by_profile?.display_name || 'Unknown';

    const assignedToName = data.assigned_to_profile
      ? (Array.isArray(data.assigned_to_profile)
        ? data.assigned_to_profile[0]?.display_name || null
        : data.assigned_to_profile?.display_name || null)
      : null;

    const completedByName = data.completed_by_profile
      ? (Array.isArray(data.completed_by_profile)
        ? data.completed_by_profile[0]?.display_name || null
        : data.completed_by_profile?.display_name || null)
      : null;

    const eventTitle = data.event
      ? (Array.isArray(data.event)
        ? data.event[0]?.title || null
        : data.event?.title || null)
      : null;

    return {
      id: data.id,
      created_by: data.created_by,
      created_by_name: createdByName,
      family_id: data.family_id,
      title: data.title,
      due_date: data.due_date,
      assigned_to: data.assigned_to,
      assigned_to_name: assignedToName,
      is_private: data.is_private,
      is_completed: data.is_completed,
      completed_at: data.completed_at,
      completed_by: data.completed_by,
      completed_by_name: completedByName,
      event_id: data.event_id,
      event_title: eventTitle,
      suggestion_id: data.suggestion_id,
      created_from_suggestion: data.created_from_suggestion,
      created_at: data.created_at,
      updated_at: data.updated_at,
      archived_at: data.archived_at,
    };
  }

  /**
   * Creates a new manual task
   * 
   * Creates a task in the user's family with automatic field assignment:
   * - family_id: Automatically set from user's profile
   * - created_by: Set to current user ID
   * - event_id: Set to NULL (manual tasks not linked to events)
   * - created_from_suggestion: Set to false (manual creation)
   * 
   * Validates that assigned_to (if provided) belongs to the same family.
   * 
   * @param input - Task creation data (title, due_date, assigned_to, is_private)
   * @param userId - ID of the authenticated user creating the task
   * @returns Promise resolving to created task or error
   * 
   * @throws Error if validation fails or database operation fails
   */
  async createTask(
    input: CreateTaskRequest,
    userId: string
  ): Promise<{ data?: TaskResponse; error?: ApiError }> {
    const validationResult = createTaskSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return {
        error: {
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
            details: { issues: validationResult.error.issues },
          },
        },
      };
    }

    // === Step 1: Get user's family_id ===
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logError(profileError, { scope: 'TasksService.createTask', userId });
      return {
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'User profile not found',
          },
        },
      };
    }

    // === Step 2: Validate assigned_to (if provided) ===
    if (input.assigned_to) {
      const { data: assignedProfile, error: assignedError } = await this.supabase
        .from('profiles')
        .select('family_id')
        .eq('id', input.assigned_to)
        .single();

      if (assignedError || !assignedProfile) {
        logError(assignedError, { scope: 'TasksService.createTask', assignedTo: input.assigned_to });
        return {
          error: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Assigned user not found',
              details: { assigned_to: input.assigned_to },
            },
          },
        };
      }

      // Check if assigned user is in same family
      if (assignedProfile.family_id !== profile.family_id) {
        return {
          error: {
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot assign task to user outside your family',
              details: { assigned_to: input.assigned_to },
            },
          },
        };
      }
    }

    // === Step 3: Prepare task data for insertion ===
    const taskData: TablesInsert<'tasks'> = {
      family_id: profile.family_id,
      created_by: userId,
      title: input.title,
      due_date: input.due_date || null,
      assigned_to: input.assigned_to || null,
      is_private: input.is_private,
      event_id: null,
      suggestion_id: null,
      created_from_suggestion: false
    };

    // === Step 4: Insert task into database ===
    const { data, error } = await this.supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) {
      logError(error, { scope: 'TasksService.createTask', userId });
      return {
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: import.meta.env.DEV ? { dbError: error.message } : undefined,
          },
        },
      };
    }

    // === Step 5: Return created task ===
    return { data };
  }

  /**
   * Creates a task from an AI suggestion
   * 
   * This method is used when users accept AI-generated task suggestions
   * after event creation, either individually or retrospectively.
   * 
   * Key differences from createTask():
   * - Requires event_id and validates event accessibility
   * - Requires suggestion_id (AI rule identifier)
   * - Sets created_from_suggestion = true for analytics
   * - Validates is_private consistency with source event
   * 
   * @param input - Task creation data from suggestion
   * @param userId - Authenticated user ID from JWT
   * @returns Created task or error
   */
  async createTaskFromSuggestion(
    input: CreateTaskFromSuggestionRequest,
    userId: string
  ): Promise<{ data?: TaskResponse; error?: ApiError }> {
    if (!input.event_id) {
      return {
        error: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'event_id is required',
          },
        },
      };
    }
    
    // === Step 1: Get user's profile and family_id ===
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logError(profileError, { scope: 'TasksService.createTaskFromSuggestion', userId });
      
      return {
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'User profile not found',
            details: { user_id: userId },
          },
        },
      };
    }

    // === Step 2: Validate event_id (must exist and be accessible) ===
    const { data: event, error: eventError } = await this.supabase
      .from('events')
      .select('family_id, is_private, created_by')
      .eq('id', input.event_id)
      .is('archived_at', null)
      .single();

    if (eventError || !event) {
      return {
        error: {
          error: {
            code: 'NOT_FOUND',
            message: 'Event not found or has been archived',
            details: { event_id: input.event_id },
          },
        },
      };
    }

    // === Step 3: Check event family boundary ===
    if (event.family_id !== profile.family_id) {
      return {
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot create task from event outside your family',
            details: { event_id: input.event_id },
          },
        },
      };
    }

    // === Step 4: Check private event access ===
    if (event.is_private && event.created_by !== userId) {
      return {
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot create tasks from private events created by other users',
            details: { event_id: input.event_id },
          },
        },
      };
    }

    // === Step 5: Validate assigned_to (if provided) ===
    const assignedTo = input.assigned_to ?? null;
    if (assignedTo) {
      const { data: assignedProfile, error: assignedError } = await this.supabase
        .from('profiles')
        .select('family_id')
        .eq('id', assignedTo)
        .single();

      if (assignedError || !assignedProfile) {
        logError(assignedError, { scope: 'TasksService.createTaskFromSuggestion', assignedTo });
        return {
          error: {
            error: {
              code: 'NOT_FOUND',
              message: 'Assigned user not found',
              details: { assigned_to: assignedTo },
            },
          },
        };
      }

      // Check if assigned user is in same family
      if (assignedProfile.family_id !== profile.family_id) {
        return {
          error: {
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot assign task to user outside your family',
              details: { assigned_to: assignedTo },
            },
          },
        };
      }
    }

    // === Step 6: Prepare task data for insertion ===
    const taskData: TablesInsert<'tasks'> = {
      family_id: profile.family_id,
      created_by: userId,
      title: input.title,
      event_id: input.event_id,
      suggestion_id: input.suggestion_id,
      is_private: input.is_private,
      created_from_suggestion: true, // Analytics flag
      due_date: input.due_date || null,
      assigned_to: input.assigned_to || null
    };

    // === Step 7: Insert task into database ===
    const { data, error } = await this.supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) {
      logError(error, { scope: 'TasksService.createTaskFromSuggestion', userId });
      return {
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: import.meta.env.DEV 
              ? { dbError: error.message } 
              : undefined,
          },
        },
      };
    }

    // === Step 8: Return created task ===
    return { data };
  }

  /**
   * Updates a task's completion status
   * 
   * Only the task creator, assignee, or family admins can update tasks
   */
  async updateTaskCompletion(
    taskId: string,
    isCompleted: boolean,
    userId: string
  ): Promise<UpdateTaskResponse> {
    const updateData: UpdateTaskRequest = {
      is_completed: isCompleted,
    };

    // If completing, set completion metadata
    // If uncompleting, clear completion metadata
    const { data, error } = await this.supabase
      .from('tasks')
      .update({
        ...updateData,
        completed_at: isCompleted ? new Date().toISOString() : null,
        completed_by: isCompleted ? userId : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select('id, title, due_date, assigned_to, is_completed, completed_at, completed_by, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    if (!data) {
      throw new Error('Task not found');
    }

    return data;
  }
}

/**
 * Factory function to create TasksService instance
 * 
 * @param supabase - Supabase client instance
 * @returns New TasksService instance
 */
export function createTasksService(supabase: SupabaseClient): TasksService {
  return new TasksService(supabase);
}

