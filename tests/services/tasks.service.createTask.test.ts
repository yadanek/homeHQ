/**
 * Unit Tests for TasksService.createTask
 * 
 * Tests business logic for manual task creation
 * with mocked Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TasksService } from '@/services/tasks.service';
import type { SupabaseClient } from '@/db/supabase.client';
import type { CreateTaskRequest } from '@/types';

// Mock Supabase client
const createMockSupabaseClient = () => ({
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
} as any as SupabaseClient);

describe('TasksService.createTask', () => {
  let mockSupabase: SupabaseClient;
  let tasksService: TasksService;
  const testUserId = 'test-user-123';
  const testFamilyId = 'family-456';
  const testAssignedUserId = 'assigned-user-789';

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    tasksService = new TasksService(mockSupabase);
    vi.clearAllMocks();
  });

  describe('Success scenarios', () => {
    const validRequest: CreateTaskRequest = {
      title: 'Buy groceries',
      due_date: '2026-01-05T18:00:00Z',
      assigned_to: null,
      is_private: false
    };

    it('should create task successfully with all fields', async () => {
      // Mock: Get user's profile
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Mock: Insert task
      (mockSupabase.from as any).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'task-123',
                family_id: testFamilyId,
                created_by: testUserId,
                title: 'Buy groceries',
                due_date: '2026-01-05T18:00:00Z',
                assigned_to: null,
                is_private: false,
                is_completed: false,
                completed_at: null,
                completed_by: null,
                event_id: null,
                suggestion_id: null,
                created_from_suggestion: false,
                created_at: '2026-01-02T12:00:00Z',
                updated_at: '2026-01-02T12:00:00Z',
                archived_at: null
              },
              error: null
            })
          })
        })
      });

      const result = await tasksService.createTask(validRequest, testUserId);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Buy groceries');
      expect(result.data?.family_id).toBe(testFamilyId);
      expect(result.data?.created_by).toBe(testUserId);
      expect(result.data?.event_id).toBeNull();
      expect(result.data?.created_from_suggestion).toBe(false);
    });

    it('should create task without optional fields (minimal)', async () => {
      const minimalRequest: CreateTaskRequest = {
        title: 'Quick task',
        due_date: null,
        assigned_to: null,
        is_private: true
      };

      // Mock: Get user's profile
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Mock: Insert task
      (mockSupabase.from as any).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'task-456',
                family_id: testFamilyId,
                created_by: testUserId,
                title: 'Quick task',
                due_date: null,
                assigned_to: null,
                is_private: true,
                is_completed: false,
                completed_at: null,
                completed_by: null,
                event_id: null,
                suggestion_id: null,
                created_from_suggestion: false,
                created_at: '2026-01-02T12:00:00Z',
                updated_at: '2026-01-02T12:00:00Z',
                archived_at: null
              },
              error: null
            })
          })
        })
      });

      const result = await tasksService.createTask(minimalRequest, testUserId);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.due_date).toBeNull();
      expect(result.data?.assigned_to).toBeNull();
      expect(result.data?.is_private).toBe(true);
    });

    it('should create task with assigned_to in same family', async () => {
      const requestWithAssignee: CreateTaskRequest = {
        title: 'Assigned task',
        due_date: null,
        assigned_to: testAssignedUserId,
        is_private: false
      };

      // Mock: Get user's profile
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Mock: Get assigned user's profile (same family)
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Mock: Insert task
      (mockSupabase.from as any).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'task-789',
                family_id: testFamilyId,
                created_by: testUserId,
                title: 'Assigned task',
                due_date: null,
                assigned_to: testAssignedUserId,
                is_private: false,
                is_completed: false,
                completed_at: null,
                completed_by: null,
                event_id: null,
                suggestion_id: null,
                created_from_suggestion: false,
                created_at: '2026-01-02T12:00:00Z',
                updated_at: '2026-01-02T12:00:00Z',
                archived_at: null
              },
              error: null
            })
          })
        })
      });

      const result = await tasksService.createTask(requestWithAssignee, testUserId);

      expect(result.error).toBeUndefined();
      expect(result.data?.assigned_to).toBe(testAssignedUserId);
    });
  });

  describe('Error scenarios - User profile issues', () => {
    const validRequest: CreateTaskRequest = {
      title: 'Test task',
      due_date: null,
      assigned_to: null,
      is_private: false
    };

    it('should return error when user profile not found', async () => {
      // Mock: Profile fetch returns null
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await tasksService.createTask(validRequest, testUserId);

      expect(result.error).toBeDefined();
      expect(result.error?.error.code).toBe('FORBIDDEN');
      expect(result.error?.error.message).toBe('User profile not found');
      expect(result.data).toBeUndefined();
    });

    it('should return error when profile fetch fails', async () => {
      // Mock: Profile fetch error
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });

      const result = await tasksService.createTask(validRequest, testUserId);

      expect(result.error).toBeDefined();
      expect(result.error?.error.code).toBe('FORBIDDEN');
      expect(result.data).toBeUndefined();
    });
  });

  describe('Error scenarios - assigned_to validation', () => {
    const requestWithAssignee: CreateTaskRequest = {
      title: 'Test task',
      due_date: null,
      assigned_to: testAssignedUserId,
      is_private: false
    };

    it('should return error when assigned user not found', async () => {
      // Mock: Get user's profile
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Mock: Assigned user profile not found
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await tasksService.createTask(requestWithAssignee, testUserId);

      expect(result.error).toBeDefined();
      expect(result.error?.error.code).toBe('VALIDATION_ERROR');
      expect(result.error?.error.message).toBe('Assigned user not found');
      expect(result.error?.error.details).toEqual({ assigned_to: testAssignedUserId });
      expect(result.data).toBeUndefined();
    });

    it('should return error when assigned user is in different family', async () => {
      const otherFamilyId = 'other-family-999';

      // Mock: Get user's profile
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Mock: Assigned user profile from different family
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: otherFamilyId },
              error: null
            })
          })
        })
      });

      const result = await tasksService.createTask(requestWithAssignee, testUserId);

      expect(result.error).toBeDefined();
      expect(result.error?.error.code).toBe('FORBIDDEN');
      expect(result.error?.error.message).toBe('Cannot assign task to user outside your family');
      expect(result.error?.error.details).toEqual({ assigned_to: testAssignedUserId });
      expect(result.data).toBeUndefined();
    });
  });

  describe('Error scenarios - Database errors', () => {
    const validRequest: CreateTaskRequest = {
      title: 'Test task',
      due_date: null,
      assigned_to: null,
      is_private: false
    };

    it('should return error when task insertion fails', async () => {
      // Mock: Get user's profile
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Mock: Insert fails
      (mockSupabase.from as any).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed', code: 'PGRST116' }
            })
          })
        })
      });

      const result = await tasksService.createTask(validRequest, testUserId);

      expect(result.error).toBeDefined();
      expect(result.error?.error.code).toBe('INTERNAL_ERROR');
      expect(result.error?.error.message).toBe('An unexpected error occurred');
      expect(result.data).toBeUndefined();
    });
  });

  describe('Field validations', () => {
    it('should properly set automatic fields', async () => {
      const request: CreateTaskRequest = {
        title: 'Auto-fields test',
        due_date: null,
        assigned_to: null,
        is_private: false
      };

      // Mock: Get user's profile
      (mockSupabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: testFamilyId },
              error: null
            })
          })
        })
      });

      // Capture the insert call to verify data
      let insertedData: any;
      (mockSupabase.from as any).mockReturnValueOnce({
        insert: vi.fn().mockImplementation((data) => {
          insertedData = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...data,
                  id: 'task-auto',
                  created_at: '2026-01-02T12:00:00Z',
                  updated_at: '2026-01-02T12:00:00Z',
                  is_completed: false,
                  completed_at: null,
                  completed_by: null,
                  archived_at: null
                },
                error: null
              })
            })
          };
        })
      });

      await tasksService.createTask(request, testUserId);

      // Verify automatic fields were set correctly
      expect(insertedData.family_id).toBe(testFamilyId);
      expect(insertedData.created_by).toBe(testUserId);
      expect(insertedData.event_id).toBeNull();
      expect(insertedData.suggestion_id).toBeNull();
      expect(insertedData.created_from_suggestion).toBe(false);
    });
  });
});
