/**
 * Unit Tests for Task Creation from Suggestion Validation Schema
 * 
 * Tests Zod validation schema for POST /tasks/from-suggestion request
 * to ensure data integrity and proper error messages.
 */

import { describe, it, expect } from 'vitest';
import { createTaskFromSuggestionSchema } from '@/validations/tasks.schema';

describe('createTaskFromSuggestionSchema', () => {
  const validData = {
    title: 'Buy a gift',
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    suggestion_id: 'birthday' as const,
    is_private: false,
    due_date: '2026-01-13T15:00:00Z',
    assigned_to: '550e8400-e29b-41d4-a716-446655440001'
  };

  describe('Valid inputs', () => {
    it('should accept valid full data', () => {
      const result = createTaskFromSuggestionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Buy a gift');
        expect(result.data.event_id).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.suggestion_id).toBe('birthday');
        expect(result.data.is_private).toBe(false);
      }
    });

    it('should accept minimal required fields', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        title: 'Task',
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        suggestion_id: 'health',
        is_private: true
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.due_date).toBeUndefined();
        expect(result.data.assigned_to).toBeUndefined();
      }
    });

    it('should trim title whitespace', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: '  Trimmed Title  '
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Trimmed Title');
      }
    });

    it('should accept all valid suggestion_id values', () => {
      const suggestionIds = ['birthday', 'health', 'outing', 'travel'] as const;
      
      suggestionIds.forEach(id => {
        const result = createTaskFromSuggestionSchema.safeParse({
          ...validData,
          suggestion_id: id
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept title at max length (500 characters)', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: 'a'.repeat(500)
      });
      expect(result.success).toBe(true);
    });

    it('should accept null optional fields', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        title: 'Task',
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        suggestion_id: 'birthday',
        is_private: false,
        due_date: null,
        assigned_to: null
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid inputs - title', () => {
    it('should reject missing title', () => {
      const { title, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Title is required');
      }
    });

    it('should reject empty title after trim', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: '   '
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Title cannot be empty');
      }
    });

    it('should reject title exceeding 500 characters', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: 'a'.repeat(501)
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Title cannot exceed 500 characters');
      }
    });

    it('should reject non-string title', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: 123
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - event_id', () => {
    it('should reject missing event_id', () => {
      const { event_id, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Event ID is required');
      }
    });

    it('should reject invalid UUID format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        event_id: 'not-a-uuid'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid UUID format for event_id');
      }
    });

    it('should reject malformed UUID', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        event_id: '550e8400-e29b-41d4'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid UUID format for event_id');
      }
    });

    it('should reject numeric event_id', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        event_id: 123
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - suggestion_id', () => {
    it('should reject missing suggestion_id', () => {
      const { suggestion_id, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid suggestion_id value', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        suggestion_id: 'invalid_rule'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Invalid suggestion_id. Must be one of: birthday, health, outing, travel'
        );
      }
    });

    it('should reject numeric suggestion_id', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        suggestion_id: 123
      });
      expect(result.success).toBe(false);
    });

    it('should reject null suggestion_id', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        suggestion_id: null
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - is_private', () => {
    it('should reject missing is_private', () => {
      const { is_private, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('is_private is required');
      }
    });

    it('should reject non-boolean values', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        is_private: 'true'
      });
      expect(result.success).toBe(false);
    });

    it('should reject null is_private', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        is_private: null
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - due_date', () => {
    it('should reject invalid date format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        due_date: '2026-01-13'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });

    it('should reject non-ISO 8601 format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        due_date: '13/01/2026'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });

    it('should reject numeric timestamp', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        due_date: 1704470400000
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid string', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        due_date: 'tomorrow'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - assigned_to', () => {
    it('should reject invalid UUID format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        assigned_to: 'not-a-uuid'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid UUID format for assigned_to');
      }
    });

    it('should reject malformed UUID', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        assigned_to: '550e8400-e29b-41d4'
      });
      expect(result.success).toBe(false);
    });

    it('should reject numeric assigned_to', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        assigned_to: 123
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Valid date formats', () => {
    const validDateFormats = [
      '2026-01-13T15:00:00Z',
      '2026-01-13T15:00:00.000Z',
      '2026-12-31T23:59:59Z',
      '2026-01-01T00:00:00Z',
      '2026-06-15T12:30:45.123Z'
    ];

    validDateFormats.forEach(dateStr => {
      it(`should accept valid ISO 8601 date: ${dateStr}`, () => {
        const result = createTaskFromSuggestionSchema.safeParse({
          ...validData,
          due_date: dateStr
        });
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
      it(`should accept valid UUID for event_id: ${uuid}`, () => {
        const result = createTaskFromSuggestionSchema.safeParse({
          ...validData,
          event_id: uuid
        });
        expect(result.success).toBe(true);
      });

      it(`should accept valid UUID for assigned_to: ${uuid}`, () => {
        const result = createTaskFromSuggestionSchema.safeParse({
          ...validData,
          assigned_to: uuid
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle extra unknown fields (should be stripped)', () => {
      const dataWithExtra = {
        ...validData,
        extra_field: 'should be ignored'
      };

      const result = createTaskFromSuggestionSchema.safeParse(dataWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect('extra_field' in result.data).toBe(false);
      }
    });

    it('should accept all suggestion_id enum values', () => {
      const validIds = ['birthday', 'health', 'outing', 'travel'];
      validIds.forEach(id => {
        const result = createTaskFromSuggestionSchema.safeParse({
          ...validData,
          suggestion_id: id
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept both true and false for is_private', () => {
      const resultTrue = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        is_private: true
      });
      const resultFalse = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        is_private: false
      });
      
      expect(resultTrue.success).toBe(true);
      expect(resultFalse.success).toBe(true);
    });

    it('should accept undefined optional fields', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        title: 'Task',
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        suggestion_id: 'birthday',
        is_private: false,
        due_date: undefined,
        assigned_to: undefined
      });
      expect(result.success).toBe(true);
    });
  });
});
