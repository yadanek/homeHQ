/**
 * Response utility functions for API endpoints
 * 
 * Provides standardized functions for creating success and error responses
 * with consistent formatting across the application.
 */

import type { ApiError } from '@/types';

/**
 * Map of error codes to HTTP status codes
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  'INVALID_QUERY_PARAMS': 400,
  'BAD_REQUEST': 400,
  'UNAUTHORIZED': 401,
  'FORBIDDEN': 403,
  'NOT_FOUND': 404,
  'CONFLICT': 409,
  'INTERNAL_SERVER_ERROR': 500,
};

/**
 * Creates a standardized error response object
 * 
 * Automatically maps error codes to appropriate HTTP status codes
 * and formats the response according to the ApiError interface.
 * 
 * @param code - Error code (determines HTTP status)
 * @param message - Human-readable error message
 * @param details - Optional additional error details
 * @returns Formatted error object
 * 
 * @example
 * ```typescript
 * return createErrorResponse(
 *   'INVALID_QUERY_PARAMS',
 *   'Invalid query parameters',
 *   { limit: 'Must be between 1 and 500' }
 * );
 * ```
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): { error: ApiError['error']; status: number } {
  const status = ERROR_STATUS_MAP[code] || 500;
  
  return {
    error: {
      code,
      message,
      ...(details && { details })
    },
    status
  };
}

/**
 * Creates a standardized success response object
 * 
 * @param data - Response data to send to client
 * @param status - HTTP status code (defaults to 200)
 * @returns Formatted success response object
 * 
 * @example
 * ```typescript
 * return createSuccessResponse(
 *   { events: [...], pagination: {...} },
 *   200
 * );
 * ```
 */
export function createSuccessResponse<T>(
  data: T,
  status = 200
): { data: T; status: number } {
  return {
    data,
    status
  };
}

/**
 * Logs errors with appropriate context based on environment
 * 
 * In development: Logs full error details to console
 * In production: Should integrate with external error tracking service
 * 
 * @param error - Error object or message
 * @param context - Additional context information
 */
export function logError(
  error: Error | unknown,
  context: Record<string, unknown> = {}
): void {
  if (import.meta.env.DEV) {
    console.error('Error:', error);
    console.error('Context:', context);
  } else {
    // In production, send to error tracking service (e.g., Sentry)
    // Sentry.captureException(error, { extra: context });
    console.error('Error occurred:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      context
    });
  }
}

