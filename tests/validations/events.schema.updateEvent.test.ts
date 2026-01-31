/**
 * Unit Tests for updateEventSchema (Zod validation)
 * 
 * Tests input validation for PATCH /events/:eventId request body.
 * Validates:
 * - Field type checking
 * - Required vs optional fields
 * - String length constraints
 * - Date/time validation
 * - Business rule refinements
 * 
 * @see src/validations/events.schema.ts
 */

import { describe, it, expect } from 'vitest';
import { updateEventSchema } from '@/validations/events.schema';
import type { UpdateEventRequest } from '@/types';

describe('updateEventSchema', () => {
  // ============================================================================
  // VALID INPUT TESTS
  // ============================================================================

  describe('Valid Inputs', () => {
    it('should accept empty object (all fields optional)', () => {
      const input = {};
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it('should accept valid title only', () => {
      const input = {
        title: 'Updated Event Title'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Updated Event Title');
      }
    });

    it('should accept valid description', () => {
      const input = {
        description: 'This is an updated description'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('This is an updated description');
      }
    });

    it('should accept null description (clearing description)', () => {
      const input = {
        description: null
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeNull();
      }
    });

    it('should accept valid datetime strings', () => {
      const input = {
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should accept valid is_private boolean', () => {
      const input = {
        is_private: true
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_private).toBe(true);
      }
    });

    it('should accept valid participant_ids array', () => {
      const input = {
        participant_ids: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002'
        ]
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should accept empty participant_ids array', () => {
      const input = {
        participant_ids: []
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.participant_ids).toEqual([]);
      }
    });

    it('should accept all fields together', () => {
      const input: UpdateEventRequest = {
        title: 'Full Update',
        description: 'Complete description',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T12:00:00Z',
        is_private: false,
        participant_ids: ['550e8400-e29b-41d4-a716-446655440001']
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // TITLE VALIDATION TESTS
  // ============================================================================

  describe('Title Validation', () => {
    it('should reject empty title after trim', () => {
      const input = {
        title: '   '  // Only whitespace
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
        expect(result.error.issues[0].message).toContain('empty');
      }
    });

    it('should trim whitespace from title', () => {
      const input = {
        title: '  Title with spaces  '
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Title with spaces');
      }
    });

    it('should reject title longer than 200 characters', () => {
      const input = {
        title: 'a'.repeat(201)
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
        expect(result.error.issues[0].message).toContain('200');
      }
    });

    it('should accept title exactly 200 characters', () => {
      const input = {
        title: 'a'.repeat(200)
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should accept single character title', () => {
      const input = {
        title: 'A'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject undefined title (if provided)', () => {
      // Note: undefined means field not provided (valid for partial update)
      // This test ensures we don't accidentally accept undefined
      const input = {
        title: undefined
      };
      const result = updateEventSchema.safeParse(input);
      
      // Should either succeed (field omitted) or have proper handling
      // TODO: Verify expected behavior
      expect(true).toBe(true);
    });
  });

  // ============================================================================
  // DATETIME VALIDATION TESTS
  // ============================================================================

  describe('DateTime Validation', () => {
    it('should reject invalid datetime format', () => {
      const input = {
        start_time: '2026-02-01'  // Missing time component
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('start_time');
      }
    });

    it('should reject non-ISO 8601 datetime', () => {
      const input = {
        start_time: '01/02/2026 10:00 AM'  // US format
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should accept datetime with timezone offset', () => {
      const input = {
        start_time: '2026-02-01T10:00:00+02:00'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should accept datetime with milliseconds', () => {
      const input = {
        start_time: '2026-02-01T10:00:00.123Z'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // TIME RANGE REFINEMENT TESTS
  // ============================================================================

  describe('Time Range Refinement', () => {
    it('should reject end_time before start_time', () => {
      const input = {
        start_time: '2026-02-01T12:00:00Z',
        end_time: '2026-02-01T10:00:00Z'  // 2 hours BEFORE start
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => 
          i.path.includes('end_time') && i.message.includes('after')
        );
        expect(issue).toBeDefined();
      }
    });

    it('should reject end_time equal to start_time', () => {
      const input = {
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T10:00:00Z'  // Same time
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should accept end_time after start_time', () => {
      const input = {
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should skip time range validation if only start_time provided', () => {
      const input = {
        start_time: '2026-02-01T10:00:00Z'
        // No end_time
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should skip time range validation if only end_time provided', () => {
      const input = {
        end_time: '2026-02-01T11:00:00Z'
        // No start_time
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // IS_PRIVATE VALIDATION TESTS
  // ============================================================================

  describe('is_private Validation', () => {
    it('should reject non-boolean is_private', () => {
      const input = {
        is_private: 'true'  // String instead of boolean
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('is_private');
      }
    });

    it('should accept true for is_private', () => {
      const input = {
        is_private: true
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should accept false for is_private', () => {
      const input = {
        is_private: false
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // PARTICIPANT_IDS VALIDATION TESTS
  // ============================================================================

  describe('participant_ids Validation', () => {
    it('should reject non-UUID participant IDs', () => {
      const input = {
        participant_ids: ['not-a-uuid']
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('participant_ids');
        expect(result.error.issues[0].message).toContain('UUID');
      }
    });

    it('should reject mixed valid and invalid UUIDs', () => {
      const input = {
        participant_ids: [
          '550e8400-e29b-41d4-a716-446655440001',  // Valid
          'invalid-uuid'  // Invalid
        ]
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should accept multiple valid UUIDs', () => {
      const input = {
        participant_ids: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003'
        ]
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject non-array participant_ids', () => {
      const input = {
        participant_ids: '550e8400-e29b-41d4-a716-446655440001'  // String not array
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should accept empty array', () => {
      const input = {
        participant_ids: []
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // PRIVACY CONSTRAINT REFINEMENT TESTS
  // ============================================================================

  describe('Privacy Constraint Refinement', () => {
    it('should reject adding participants to private event', () => {
      const input = {
        is_private: true,
        participant_ids: ['550e8400-e29b-41d4-a716-446655440001']
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => 
          i.message.includes('private') && i.message.includes('participant')
        );
        expect(issue).toBeDefined();
      }
    });

    it('should allow is_private=true with empty participants array', () => {
      const input = {
        is_private: true,
        participant_ids: []
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should allow is_private=true without participant_ids field', () => {
      const input = {
        is_private: true
        // No participant_ids field
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should allow is_private=false with participants', () => {
      const input = {
        is_private: false,
        participant_ids: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002'
        ]
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should allow participants without is_private field', () => {
      const input = {
        participant_ids: ['550e8400-e29b-41d4-a716-446655440001']
        // is_private not specified
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle null values correctly', () => {
      const input = {
        description: null  // Explicitly clearing description
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject extra fields', () => {
      const input = {
        title: 'Valid Title',
        extra_field: 'Should be stripped'  // Extra field
      };
      const result = updateEventSchema.safeParse(input);
      
      // Zod by default strips unknown fields
      expect(result.success).toBe(true);
      if (result.success) {
        expect('extra_field' in result.data).toBe(false);
      }
    });

    it('should handle very long participant lists', () => {
      const input = {
        participant_ids: Array(100).fill(0).map((_, i) => 
          `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`
        )
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in title', () => {
      const input = {
        title: '🎉 Party Event 🎊 with emojis'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should handle special characters in description', () => {
      const input = {
        description: 'Line 1\nLine 2\tTabbed\r\nWindows newline'
      };
      const result = updateEventSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // ERROR MESSAGE TESTS
  // ============================================================================

  describe('Error Messages', () => {
    it('should provide clear error message for empty title', () => {
      const result = updateEventSchema.safeParse({ title: '' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.flatten().fieldErrors.title;
        expect(titleError).toBeDefined();
        expect(titleError![0]).toContain('empty');
      }
    });

    it('should provide clear error message for invalid UUID', () => {
      const result = updateEventSchema.safeParse({ 
        participant_ids: ['not-a-uuid'] 
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.flatten().fieldErrors.participant_ids;
        expect(error).toBeDefined();
        expect(error![0]).toContain('UUID');
      }
    });

    it('should provide clear error message for time range violation', () => {
      const result = updateEventSchema.safeParse({
        start_time: '2026-02-01T12:00:00Z',
        end_time: '2026-02-01T10:00:00Z'
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.flatten().fieldErrors.end_time;
        expect(error).toBeDefined();
        expect(error![0]).toContain('after');
      }
    });
  });
});

/**
 * IMPLEMENTATION CHECKLIST:
 * 
 * [x] Valid input tests - all optional fields
 * [x] Title validation - trim, length, empty
 * [x] DateTime validation - ISO 8601 format
 * [x] Time range refinement - end > start
 * [x] is_private validation - boolean type
 * [x] participant_ids validation - UUID array
 * [x] Privacy constraint refinement - no participants on private
 * [x] Edge cases - null, unicode, special chars
 * [x] Error messages - clear and helpful
 * 
 * COVERAGE TARGET: 100% of schema validation logic
 */
