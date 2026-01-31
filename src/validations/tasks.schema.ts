/**
 * Zod validation schemas for tasks API
 * 
 * Provides strict validation for task-related query parameters and request bodies
 * to ensure data integrity and type safety throughout the application.
 */

import { z } from 'zod';

/**
 * Schema for GET /tasks query parameters
 * 
 * Validates and transforms query parameters for listing tasks with filters and pagination.
 * Ensures dates are in ISO 8601 format and pagination limits are within acceptable ranges.
 */
export const getTasksQuerySchema = z.object({
  // Completion filter
  is_completed: z.enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),
  
  // Privacy filter - transforms string to boolean
  is_private: z.enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),
  
  // Assignee filter - can be UUID or "me"
  assigned_to: z.string().optional(),
  
  // Due date filters - must be valid ISO 8601 date strings
  due_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),
  
  // Event filter - must be valid UUID
  event_id: z.string().uuid().optional(),
  
  // Sort option
  sort: z.enum(['due_date_asc', 'due_date_desc', 'created_at_desc']).default('due_date_asc'),
  
  // Pagination parameters with defaults and constraints
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}).refine(
  (data) => {
    // Ensure due_after is not after due_before
    if (data.due_after && data.due_before) {
      return new Date(data.due_after) <= new Date(data.due_before);
    }
    return true;
  },
  {
    message: "due_after must be before or equal to due_before",
    path: ["due_after"],
  }
);

/**
 * Inferred TypeScript type from the schema
 */
export type GetTasksQueryParams = z.infer<typeof getTasksQuerySchema>;


/**
 * Schema for POST /tasks request body
 * 
 * Validates task creation data ensuring:
 * - Title is present and non-empty after trimming
 * - Due date is in valid ISO 8601 format if provided
 * - assigned_to is a valid UUID if provided
 * - is_private is explicitly provided as boolean
 */
export const createTaskSchema = z.object({
  // Title - required, must be non-empty after trimming
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty"),
  
  // Due date - optional ISO 8601 datetime string
  due_date: z
    .string()
    .datetime({ message: "Invalid date format. Expected ISO 8601" })
    .optional()
    .nullable(),
  
  // Assigned to - optional UUID of profile in same family
  assigned_to: z
    .string()
    .uuid({ message: "Invalid UUID format for assigned_to" })
    .optional()
    .nullable(),
  
  // Privacy flag - required boolean
  is_private: z
    .boolean({ message: "is_private is required" })
});

/**
 * Inferred TypeScript type for task creation input
 */
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Schema for POST /tasks/from-suggestion request body
 * 
 * Validates task creation from AI suggestion ensuring:
 * - Title is present and non-empty after trimming
 * - event_id is valid UUID and exists
 * - suggestion_id is one of 4 valid AI rules
 * - Due date is in valid ISO 8601 format if provided
 * - assigned_to is a valid UUID if provided
 * - is_private is explicitly provided as boolean
 */
export const createTaskFromSuggestionSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty")
    .max(500, "Title cannot exceed 500 characters"),
  
  event_id: z
    .string({ message: "Event ID is required" })
    .uuid({ message: "Invalid UUID format for event_id" }),
  
  suggestion_id: z
    .enum(['birthday', 'health', 'outing', 'travel'], {
      message: "Invalid suggestion_id. Must be one of: birthday, health, outing, travel"
    }),
  
  is_private: z
    .boolean({ message: "is_private is required" }),
  
  due_date: z
    .string()
    .datetime({ message: "Invalid date format. Expected ISO 8601" })
    .optional()
    .nullable(),
  
  assigned_to: z
    .string()
    .uuid({ message: "Invalid UUID format for assigned_to" })
    .optional()
    .nullable()
});

/**
 * Inferred TypeScript type for task creation from suggestion input
 */
export type CreateTaskFromSuggestionInput = z.infer<typeof createTaskFromSuggestionSchema>;
