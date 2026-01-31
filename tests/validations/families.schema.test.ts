/**
 * Unit Tests for Family Validation Schemas
 * 
 * Tests Zod validation schemas for family-related requests
 * to ensure data integrity and proper error messages.
 */

import { describe, it, expect } from 'vitest';
import { createFamilySchema } from '@/validations/families.schema';

describe('createFamilySchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid family data', () => {
      const validData = {
        name: 'Smith Family',
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept family name at minimum length (1 character)', () => {
      const validData = {
        name: 'A',
        display_name: 'John'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept family name at maximum length (100 characters)', () => {
      const validData = {
        name: 'A'.repeat(100),
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept display name at minimum length (1 character)', () => {
      const validData = {
        name: 'Smith Family',
        display_name: 'J'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept display name at maximum length (100 characters)', () => {
      const validData = {
        name: 'Smith Family',
        display_name: 'B'.repeat(100)
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should trim whitespace from family name', () => {
      const validData = {
        name: '  Smith Family  ',
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Smith Family');
      }
    });

    it('should trim whitespace from display name', () => {
      const validData = {
        name: 'Smith Family',
        display_name: '  John Smith  '
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.display_name).toBe('John Smith');
      }
    });

    it('should accept family names with special characters', () => {
      const validData = {
        name: "O'Brien-Smith Family & Friends",
        display_name: 'John'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept display names with unicode characters', () => {
      const validData = {
        name: 'Kowalski Family',
        display_name: 'Józef Müller'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid inputs - family name', () => {
    it('should reject missing family name', () => {
      const invalidData = {
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('required');
      }
    });

    it('should reject empty family name', () => {
      const invalidData = {
        name: '',
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Family name cannot be empty');
      }
    });

    it('should reject family name with only whitespace', () => {
      const invalidData = {
        name: '   ',
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Family name cannot be empty');
      }
    });

    it('should reject family name longer than 100 characters', () => {
      const invalidData = {
        name: 'A'.repeat(101),
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Family name must be 100 characters or less');
      }
    });

    it('should reject non-string family name', () => {
      const invalidData = {
        name: 123,
        display_name: 'John Smith'
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - display name', () => {
    it('should reject missing display name', () => {
      const invalidData = {
        name: 'Smith Family'
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('required');
      }
    });

    it('should reject empty display name', () => {
      const invalidData = {
        name: 'Smith Family',
        display_name: ''
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Display name cannot be empty');
      }
    });

    it('should reject display name with only whitespace', () => {
      const invalidData = {
        name: 'Smith Family',
        display_name: '   '
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Display name cannot be empty');
      }
    });

    it('should reject display name longer than 100 characters', () => {
      const invalidData = {
        name: 'Smith Family',
        display_name: 'B'.repeat(101)
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Display name must be 100 characters or less');
      }
    });

    it('should reject non-string display name', () => {
      const invalidData = {
        name: 'Smith Family',
        display_name: 123
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should reject completely missing data', () => {
      const result = createFamilySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject null values', () => {
      const invalidData = {
        name: null,
        display_name: null
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject undefined values', () => {
      const invalidData = {
        name: undefined,
        display_name: undefined
      };

      const result = createFamilySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should ignore extra fields not in schema', () => {
      const validData = {
        name: 'Smith Family',
        display_name: 'John Smith',
        extraField: 'should be ignored'
      };

      const result = createFamilySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('extraField');
      }
    });
  });
});
