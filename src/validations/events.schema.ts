/**
 * Zod validation schemas for events API
 * 
 * Provides strict validation for event-related query parameters and request bodies
 * to ensure data integrity and type safety throughout the application.
 */

import { z } from 'zod';

/**
 * Schema for GET /events query parameters
 * 
 * Validates and transforms query parameters for listing events with filters and pagination.
 * Ensures dates are in ISO 8601 format and pagination limits are within acceptable ranges.
 */
export const getEventsQuerySchema = z.object({
  // Date filters - must be valid ISO 8601 datetime strings
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  
  // Privacy filter - transforms string to boolean
  is_private: z.enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),
  
  // Participant filter - must be valid UUID
  participant_id: z.string().uuid().optional(),
  
  // Pagination parameters with defaults and constraints
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}).refine(
  (data) => {
    // Ensure start_date is not after end_date
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: "start_date must be before or equal to end_date",
    path: ["start_date"],
  }
);

/**
 * Inferred TypeScript type from the schema
 */
export type GetEventsQueryParams = z.infer<typeof getEventsQuerySchema>;

/**
 * Schema for validating single event ID parameter
 * 
 * Ensures the event ID is a valid UUID v4 format.
 * Used for GET /events/:eventId and other single-event operations.
 */
export const eventIdSchema = z.string().uuid({
  message: "Event ID must be a valid UUID"
});

/**
 * Schema for event details path parameters
 * 
 * Wraps eventId for consistent validation across endpoints.
 */
export const eventIdParamsSchema = z.object({
  eventId: eventIdSchema
});

/**
 * Inferred TypeScript type for event ID params
 */
export type EventIdParams = z.infer<typeof eventIdParamsSchema>;

/**
 * Schema for POST /events request body
 * 
 * Validates all fields required to create a new event including:
 * - Title (1-200 characters after trim)
 * - Time range (end_time must be after start_time)
 * - Privacy constraints (private events can't have multiple participants)
 * - Participant IDs (profiles with accounts - must be valid UUIDs)
 * - Member IDs (family members without accounts - must be valid UUIDs)
 * - Accepted AI suggestions (from predefined list)
 */
export const createEventSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  
  description: z.string().optional(),
  
  start_time: z.string()
    .datetime({ message: 'start_time must be a valid ISO 8601 timestamp' }),
  
  end_time: z.string()
    .datetime({ message: 'end_time must be a valid ISO 8601 timestamp' }),
  
  is_private: z.boolean({
    required_error: 'is_private is required',
    invalid_type_error: 'is_private must be a boolean'
  }),
  
  participant_ids: z.array(z.string().uuid({
    message: 'Each participant ID must be a valid UUID'
  })).optional(),
  
  member_ids: z.array(z.string().uuid({
    message: 'Each member ID must be a valid UUID'
  })).optional(),
  
  accept_suggestions: z.array(
    z.enum([
      // Birthday events
      'birthday_invitations',
      'birthday_cake',
      'birthday_gifts',
      // School events
      'parent_teacher_meeting',
      'school_trip_food',
      'school_trip_clothes',
      'end_of_school_year_gift',
      'school_year_start_supplies',
      'school_year_start_books',
      'semester_end_celebration',
      'school_performance',
      'school_break_activities',
      // Date night / Outing
      'date_night_babysitter',
      'date_night_reservation',
      // Health
      'health_documents',
      // Travel
      'travel_pack',
      'travel_documents',
      // Holidays
      'christmas_gifts',
      'christmas_outfits',
      // Costume parties
      'costume_party',
      // Sports & Activities
      'swimming_bag',
      // Legacy IDs (for backward compatibility)
      'birthday',
      'health',
      'outing',
      'travel'
    ], {
      errorMap: () => ({ message: 'Invalid suggestion ID' })
    })
  ).optional()
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  { 
    message: 'end_time must be after start_time', 
    path: ['end_time'] 
  }
).refine(
  (data) => {
    // Private events cannot have multiple participants
    if (data.is_private && data.participant_ids && data.participant_ids.length > 1) {
      return false;
    }
    return true;
  },
  { 
    message: 'Private events cannot have multiple participants', 
    path: ['participant_ids'] 
  }
);

/**
 * Inferred TypeScript type from createEventSchema
 */
export type CreateEventInput = z.infer<typeof createEventSchema>;

/**
 * Schema for PATCH /events/:eventId request body
 * 
 * Validates partial update fields for existing events:
 * - All fields are optional (partial update)
 * - Title must be 1-200 characters when provided
 * - Time range validation (end_time must be after start_time)
 * - Participant IDs must be valid UUIDs
 * - Privacy constraints (cannot add participants to private events)
 */
export const updateEventSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title must not be empty')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  
  description: z.string().optional().nullable(),
  
  start_time: z.string()
    .datetime({ message: 'start_time must be a valid ISO 8601 timestamp' })
    .optional(),
  
  end_time: z.string()
    .datetime({ message: 'end_time must be a valid ISO 8601 timestamp' })
    .optional(),
  
  is_private: z.boolean({
    invalid_type_error: 'is_private must be a boolean'
  }).optional(),
  
  participant_ids: z.array(z.string().uuid({
    message: 'Each participant ID must be a valid UUID'
  })).optional()
}).refine(
  (data) => {
    // If both start_time and end_time are provided, end_time must be after start_time
    if (data.start_time && data.end_time) {
      return new Date(data.end_time) > new Date(data.start_time);
    }
    return true;
  },
  { 
    message: 'end_time must be after start_time', 
    path: ['end_time'] 
  }
).refine(
  (data) => {
    // Cannot add participants to private event
    if (data.is_private === true && data.participant_ids && data.participant_ids.length > 0) {
      return false;
    }
    return true;
  },
  { 
    message: 'Cannot add participants to private event', 
    path: ['participant_ids'] 
  }
);

/**
 * Inferred TypeScript type from updateEventSchema
 */
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

