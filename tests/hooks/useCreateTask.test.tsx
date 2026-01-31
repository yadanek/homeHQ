/**
 * Unit Tests for useCreateTask Hook
 * 
 * Tests custom hook with useTransition, Zod validation, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCreateTask } from '@/hooks/useCreateTask';
import { createTask as createTaskAction } from '@/actions/createTask';
import type { CreateTaskRequest, TaskResponse } from '@/types';

// Mock the createTask action
vi.mock('@/actions/createTask', () => ({
  createTask: vi.fn(),
}));

describe('useCreateTask', () => {
  const mockTaskResponse: TaskResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    family_id: 'family-123',
    created_by: 'user-123',
    assigned_to: null,
    title: 'Buy groceries',
    due_date: null,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    is_private: false,
    event_id: null,
    suggestion_id: null,
    created_from_suggestion: false,
    created_at: '2026-01-30T12:00:00Z',
    updated_at: '2026-01-30T12:00:00Z',
    archived_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useCreateTask());

      expect(result.current.isPending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide createTask function', () => {
      const { result } = renderHook(() => useCreateTask());

      expect(typeof result.current.createTask).toBe('function');
    });

    it('should provide reset function', () => {
      const { result } = renderHook(() => useCreateTask());

      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Successful Task Creation', () => {
    it('should create task successfully', async () => {
      vi.mocked(createTaskAction).mockResolvedValueOnce({
        success: true,
        data: mockTaskResponse,
      });

      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: 'Buy groceries',
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      const taskPromise = result.current.createTask(request);

      // Should set pending state
      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      const task = await taskPromise;

      // Should clear pending and return task
      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
        expect(task).toEqual(mockTaskResponse);
        expect(result.current.error).toBeNull();
      });
    });

    it('should call createTaskAction with validated data', async () => {
      vi.mocked(createTaskAction).mockResolvedValueOnce({
        success: true,
        data: mockTaskResponse,
      });

      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: '  Buy groceries  ', // With whitespace
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      await result.current.createTask(request);

      await waitFor(() => {
        expect(createTaskAction).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Buy groceries', // Should be trimmed
            is_private: false,
          })
        );
      });
    });
  });

  describe('Validation Errors', () => {
    it('should reject when title is empty', async () => {
      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: '',
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      await expect(result.current.createTask(request)).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toContain('Title cannot be empty');
        expect(result.current.isPending).toBe(false);
      });
    });

    it('should reject when title is only whitespace', async () => {
      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: '   ',
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      await expect(result.current.createTask(request)).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toContain('Title cannot be empty');
      });
    });

    it('should reject when due_date has invalid format', async () => {
      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: 'Valid title',
        due_date: 'invalid-date',
        assigned_to: null,
        is_private: false,
      };

      await expect(result.current.createTask(request)).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toContain('Invalid date format');
      });
    });

    it('should reject when assigned_to has invalid UUID', async () => {
      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: 'Valid title',
        due_date: null,
        assigned_to: 'not-a-uuid',
        is_private: false,
      };

      await expect(result.current.createTask(request)).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toContain('Invalid UUID');
      });
    });
  });

  describe('API Errors', () => {
    it('should handle API error', async () => {
      vi.mocked(createTaskAction).mockResolvedValueOnce({
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot assign task to user outside your family',
          },
        },
      });

      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: 'Buy groceries',
        due_date: null,
        assigned_to: 'other-user-id',
        is_private: false,
      };

      await expect(result.current.createTask(request)).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toBe('Cannot assign task to user outside your family');
        expect(result.current.isPending).toBe(false);
      });
    });

    it('should handle network error', async () => {
      vi.mocked(createTaskAction).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: 'Buy groceries',
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      await expect(result.current.createTask(request)).rejects.toThrow('Network error');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.isPending).toBe(false);
      });
    });
  });

  describe('Reset Function', () => {
    it('should clear error state', async () => {
      const { result } = renderHook(() => useCreateTask());

      // Trigger validation error
      const request: CreateTaskRequest = {
        title: '',
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      await expect(result.current.createTask(request)).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Reset
      result.current.reset();

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle task with all optional fields', async () => {
      vi.mocked(createTaskAction).mockResolvedValueOnce({
        success: true,
        data: { ...mockTaskResponse, due_date: '2026-12-31T23:59:59Z', assigned_to: 'user-456' },
      });

      const { result } = renderHook(() => useCreateTask());

      const request: CreateTaskRequest = {
        title: 'Complete task',
        due_date: '2026-12-31T23:59:59Z',
        assigned_to: '550e8400-e29b-41d4-a716-446655440000',
        is_private: true,
      };

      const task = await result.current.createTask(request);

      await waitFor(() => {
        expect(task).toBeTruthy();
        expect(createTaskAction).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Complete task',
            due_date: '2026-12-31T23:59:59Z',
            assigned_to: '550e8400-e29b-41d4-a716-446655440000',
            is_private: true,
          })
        );
      });
    });

    it('should handle concurrent create calls', async () => {
      vi.mocked(createTaskAction).mockResolvedValue({
        success: true,
        data: mockTaskResponse,
      });

      const { result } = renderHook(() => useCreateTask());

      const request1: CreateTaskRequest = {
        title: 'Task 1',
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      const request2: CreateTaskRequest = {
        title: 'Task 2',
        due_date: null,
        assigned_to: null,
        is_private: false,
      };

      const [task1, task2] = await Promise.all([
        result.current.createTask(request1),
        result.current.createTask(request2),
      ]);

      expect(task1).toBeTruthy();
      expect(task2).toBeTruthy();
      expect(createTaskAction).toHaveBeenCalledTimes(2);
    });
  });
});
