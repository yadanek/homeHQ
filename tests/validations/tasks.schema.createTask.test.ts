/**
 * Unit Tests for Task Creation Validation Schema
 * 
 * Tests Zod validation schema for POST /tasks request
 * to ensure data integrity and proper error messages.
 */

import { describe, it, expect } from 'vitest';
import { createTaskSchema } from '@/validations/tasks.schema';

describe('createTaskSchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid task data with all fields', () => {
      const validData = {
        title: 'Buy groceries',
        due_date: '2026-01-05T18:00:00Z',
        assigned_to: '550e8400-e29b-41d4-a716-446655440000',
        is_private: false
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Buy groceries');
        expect(result.data.due_date).toBe('2026-01-05T18:00:00Z');
        expect(result.data.assigned_to).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.is_private).toBe(false);
      }
    });

    it('should accept minimal valid data (only required fields)', () => {
      const validData = {
        title: 'Quick task',
        is_private: true
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Quick task');
        expect(result.data.is_private).toBe(true);
        expect(result.data.due_date).toBeUndefined();
        expect(result.data.assigned_to).toBeUndefined();
      }
    });

    it('should accept task with null optional fields', () => {
      const validData = {
        title: 'Task with nulls',
        due_date: null,
        assigned_to: null,
        is_private: false
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.due_date).toBeNull();
        expect(result.data.assigned_to).toBeNull();
      }
    });

    it('should accept private task', () => {
      const validData = {
        title: 'Private note',
        is_private: true
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_private).toBe(true);
      }
    });

    it('should trim whitespace from title', () => {
      const validData = {
        title: '  Buy groceries  ',
        is_private: false
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Buy groceries');
      }
    });

    it('should accept title with minimum length (1 character after trim)', () => {
      const validData = {
        title: 'A',
        is_private: false
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept long title', () => {
      const validData = {
        title: 'A'.repeat(500),
        is_private: false
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid title field', () => {
    it('should reject missing title', () => {
      const invalidData = {
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Title is required');
      }
    });

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Title cannot be empty');
      }
    });

    it('should reject title with only whitespace', () => {
      const invalidData = {
        title: '   ',
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Title cannot be empty');
      }
    });

    it('should reject non-string title', () => {
      const invalidData = {
        title: 123,
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid is_private field', () => {
    it('should reject missing is_private', () => {
      const invalidData = {
        title: 'Test task'
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('is_private is required');
      }
    });

    it('should reject non-boolean is_private', () => {
      const invalidData = {
        title: 'Test task',
        is_private: 'false'
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject null is_private', () => {
      const invalidData = {
        title: 'Test task',
        is_private: null
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid due_date field', () => {
    it('should reject invalid ISO 8601 format', () => {
      const invalidData = {
        title: 'Test task',
        due_date: '2026-01-05',
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });

    it('should reject invalid date string', () => {
      const invalidData = {
        title: 'Test task',
        due_date: 'tomorrow',
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });

    it('should reject numeric timestamp', () => {
      const invalidData = {
        title: 'Test task',
        due_date: 1704470400000,
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject date without time', () => {
      const invalidData = {
        title: 'Test task',
        due_date: '2026-01-05T00:00:00',
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });
  });

  describe('Invalid assigned_to field', () => {
    it('should reject invalid UUID format', () => {
      const invalidData = {
        title: 'Test task',
        assigned_to: 'not-a-uuid',
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid UUID format for assigned_to');
      }
    });

    it('should reject numeric assigned_to', () => {
      const invalidData = {
        title: 'Test task',
        assigned_to: 123,
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject malformed UUID', () => {
      const invalidData = {
        title: 'Test task',
        assigned_to: '550e8400-e29b-41d4-a716',
        is_private: false
      };

      const result = createTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid UUID format for assigned_to');
      }
    });
  });

  describe('Valid date formats', () => {
    const validDateFormats = [
      '2026-01-05T18:00:00Z',
      '2026-01-05T18:00:00.000Z',
      '2026-12-31T23:59:59Z',
      '2026-01-01T00:00:00Z',
      '2026-06-15T12:30:45.123Z'
    ];

    validDateFormats.forEach(dateStr => {
      it(`should accept valid ISO 8601 date: ${dateStr}`, () => {
        const validData = {
          title: 'Test task',
          due_date: dateStr,
          is_private: false
        };

        const result = createTaskSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Valid UUID formats', () => {
    const validUUIDs = [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    ];

    validUUIDs.forEach(uuid => {
      it(`should accept valid UUID: ${uuid}`, () => {
        const validData = {
          title: 'Test task',
          assigned_to: uuid,
          is_private: false
        };

        const result = createTaskSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Edge cases', () => {
    it('should accept task with all optional fields undefined', () => {
      const validData = {
        title: 'Simple task',
        is_private: false,
        due_date: undefined,
        assigned_to: undefined
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle extra unknown fields (should be stripped)', () => {
      const dataWithExtra = {
        title: 'Test task',
        is_private: false,
        extra_field: 'should be ignored'
      };

      const result = createTaskSchema.safeParse(dataWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect('extra_field' in result.data).toBe(false);
      }
    });

    it('should accept boolean false for is_private', () => {
      const validData = {
        title: 'Public task',
        is_private: false
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_private).toBe(false);
      }
    });

    it('should accept boolean true for is_private', () => {
      const validData = {
        title: 'Private task',
        is_private: true
      };

      const result = createTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_private).toBe(true);
      }
    });
  });
});
