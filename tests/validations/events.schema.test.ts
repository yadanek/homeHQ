/**
 * Unit Tests for Event Validation Schemas
 * 
 * Tests Zod validation schemas for event-related requests
 * to ensure data integrity and proper error messages.
 */

import { describe, it, expect } from 'vitest';
import { createEventSchema } from '@/validations/events.schema';

describe('createEventSchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid event data', () => {
      const validData = {
        title: 'Team Meeting',
        description: 'Weekly sync',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept event without description', () => {
      const validData = {
        title: 'Team Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept event with participant IDs', () => {
      const validData = {
        title: 'Team Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false,
        participant_ids: [
          '550e8400-e29b-41d4-a716-446655440000',
          '660e8400-e29b-41d4-a716-446655440000'
        ]
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept event with valid suggestions', () => {
      const validData = {
        title: 'Doctor appointment',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false,
        accept_suggestions: ['health', 'birthday']
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should trim whitespace from title', () => {
      const validData = {
        title: '  Team Meeting  ',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Team Meeting');
      }
    });
  });

  describe('Title validation', () => {
    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('required');
      }
    });

    it('should reject title with only whitespace', () => {
      const invalidData = {
        title: '   ',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject title longer than 200 characters', () => {
      const invalidData = {
        title: 'a'.repeat(201),
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('200 characters');
      }
    });
  });

  describe('Time validation', () => {
    it('should reject invalid ISO 8601 start_time', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ISO 8601');
      }
    });

    it('should reject invalid ISO 8601 end_time', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: 'invalid-date',
        is_private: false
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject end_time before start_time', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01T11:00:00Z',
        end_time: '2026-02-01T10:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('after start_time');
      }
    });

    it('should reject end_time equal to start_time', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T10:00:00Z',
        is_private: false
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Privacy validation', () => {
    it('should require is_private field', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z'
        // Missing is_private
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('required');
      }
    });

    it('should reject non-boolean is_private', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: 'true' // String instead of boolean
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject private event with multiple participants', () => {
      const invalidData = {
        title: 'Private Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: true,
        participant_ids: [
          '550e8400-e29b-41d4-a716-446655440000',
          '660e8400-e29b-41d4-a716-446655440000'
        ]
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('multiple participants');
      }
    });

    it('should accept private event with single participant', () => {
      const validData = {
        title: 'Private Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: true,
        participant_ids: ['550e8400-e29b-41d4-a716-446655440000']
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept private event with no participants', () => {
      const validData = {
        title: 'Private Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: true,
        participant_ids: []
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Participant validation', () => {
    it('should reject invalid UUID format', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false,
        participant_ids: ['not-a-uuid', 'also-not-a-uuid']
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('UUID');
      }
    });

    it('should accept empty participant array', () => {
      const validData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false,
        participant_ids: []
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Suggestion validation', () => {
    it('should accept valid suggestion IDs', () => {
      const validData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false,
        accept_suggestions: ['birthday', 'health', 'outing', 'travel']
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid suggestion IDs', () => {
      const invalidData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false,
        accept_suggestions: ['invalid-suggestion']
      };

      const result = createEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('birthday, health, outing, or travel');
      }
    });

    it('should accept empty suggestions array', () => {
      const validData = {
        title: 'Meeting',
        start_time: '2026-02-01T10:00:00Z',
        end_time: '2026-02-01T11:00:00Z',
        is_private: false,
        accept_suggestions: []
      };

      const result = createEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});


