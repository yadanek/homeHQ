/**
 * Zod validation schemas for family members
 */

import { z } from 'zod';

/**
 * Schema for creating a family member
 */
export const createFamilyMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  is_admin: z.boolean().default(false)
});

/**
 * Schema for updating a family member
 */
export const updateFamilyMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  is_admin: z.boolean().optional()
});

export type CreateFamilyMemberInput = z.infer<typeof createFamilyMemberSchema>;
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;
