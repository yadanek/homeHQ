/**
 * Zod validation schemas for families API
 * 
 * Provides strict validation for family-related request bodies
 * to ensure data integrity and type safety throughout the application.
 */

import { z } from 'zod';

/**
 * Schema for POST /families request body
 * 
 * Validates family creation request including:
 * - Family name (1-100 characters after trim)
 * - Display name for the creator (1-100 characters after trim)
 * 
 * Both fields are required and will be trimmed of whitespace.
 * Empty strings or strings with only whitespace will be rejected.
 */
export const createFamilySchema = z.object({
  name: z
    .string({ required_error: 'Family name is required' })
    .trim()
    .min(1, 'Family name cannot be empty')
    .max(100, 'Family name must be 100 characters or less'),
  
  display_name: z
    .string({ required_error: 'Display name is required' })
    .trim()
    .min(1, 'Display name cannot be empty')
    .max(100, 'Display name must be 100 characters or less'),
});

/**
 * Inferred TypeScript type from createFamilySchema
 */
export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
