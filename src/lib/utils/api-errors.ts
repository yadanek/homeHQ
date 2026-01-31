/**
 * API Error Helper Functions
 * 
 * Provides standardized error response creators for API operations.
 * Implements consistent error formatting across the application following
 * the ApiError interface defined in types.ts
 */

import type { ApiError } from '@/types';

/**
 * Creates a standardized API error object
 * 
 * @param code - Error code identifier
 * @param message - Human-readable error message
 * @param details - Optional additional error context
 * @returns Formatted ApiError object
 */
function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return {
    error: {
      code,
      message,
      ...(details && { details })
    }
  };
}

/**
 * Standard API Error Responses
 * 
 * Pre-configured error creators for common API error scenarios.
 * Each function returns an ApiError object with appropriate status code.
 */
export const ApiErrors = {
  /**
   * 400 Bad Request - Invalid Event ID format
   */
  invalidEventId: (eventId: string): { error: ApiError; status: number } => ({
    error: createError(
      'INVALID_EVENT_ID',
      'Event ID must be a valid UUID',
      { eventId }
    ),
    status: 400
  }),

  /**
   * 403 Forbidden - User cannot access this event
   */
  forbidden: (reason: string): { error: ApiError; status: number } => ({
    error: createError(
      'FORBIDDEN',
      'You do not have permission to access this event',
      { reason }
    ),
    status: 403
  }),

  /**
   * 403 Forbidden - Event belongs to different family
   */
  forbiddenDifferentFamily: (): { error: ApiError; status: number } => ({
    error: createError(
      'FORBIDDEN',
      'You do not have permission to access this event',
      { reason: 'Event belongs to a different family' }
    ),
    status: 403
  }),

  /**
   * 403 Forbidden - Private event access denied
   */
  forbiddenPrivateEvent: (): { error: ApiError; status: number } => ({
    error: createError(
      'FORBIDDEN',
      'You do not have permission to access this event',
      { reason: 'Event is private and you are not the creator' }
    ),
    status: 403
  }),

  /**
   * 404 Not Found - Event not found or archived
   */
  eventNotFound: (): { error: ApiError; status: number } => ({
    error: createError(
      'EVENT_NOT_FOUND',
      'Event not found or has been archived'
    ),
    status: 404
  }),

  /**
   * 500 Internal Server Error - Unexpected error
   */
  internalError: (requestId?: string): { error: ApiError; status: number } => ({
    error: createError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      { requestId: requestId || crypto.randomUUID() }
    ),
    status: 500
  })
};

/**
 * Error class for service layer operations
 * 
 * Allows service functions to throw structured errors that can be
 * caught and transformed into appropriate HTTP responses.
 */
export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
  }

  /**
   * Converts ServiceError to ApiError format
   */
  toApiError(): { error: ApiError; status: number } {
    return {
      error: {
        error: {
          code: this.code,
          message: this.message,
          ...(this.details && { details: this.details })
        }
      },
      status: this.status
    };
  }
}


