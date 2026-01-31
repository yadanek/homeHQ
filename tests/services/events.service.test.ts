/**
 * Unit Tests for EventsService
 * 
 * Test framework: Vitest (to be installed)
 * 
 * Installation:
 * npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
 * 
 * Run tests:
 * npm run test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventsService } from '@/services/events.service';
import type { SupabaseClient } from '@/db/supabase.client';
import type { CreateEventRequest } from '@/types';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  functions: {
    invoke: vi.fn()
  },
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn()
  }
} as unknown as SupabaseClient;

describe('EventsService', () => {
  let eventsService: EventsService;

  beforeEach(() => {
    eventsService = new EventsService(mockSupabase);
    vi.clearAllMocks();
  });

  describe('createEventWithSuggestions', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
    const mockFamilyId = '660e8400-e29b-41d4-a716-446655440000';
    const mockUserRole = 'admin' as const;

    const validRequest: CreateEventRequest = {
      title: 'Doctor Appointment',
      description: 'Annual checkup',
      start_time: '2026-02-01T10:00:00Z',
      end_time: '2026-02-01T11:00:00Z',
      is_private: false,
      participant_ids: []
    };

    it('should create event without suggestions', async () => {
      // Mock AI engine to return empty suggestions
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
        data: { suggestions: [] },
        error: null
      });

      // Mock event creation
      const mockEvent = {
        id: 'event-123',
        ...validRequest,
        family_id: mockFamilyId,
        created_by: mockUserId,
        created_at: '2026-01-26T12:00:00Z',
        updated_at: '2026-01-26T12:00:00Z',
        archived_at: null
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockEvent,
          error: null
        })
      } as any);

      // Mock get event with participants
      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { ...mockEvent, event_participants: [] },
          error: null
        })
      } as any);

      const result = await eventsService.createEventWithSuggestions(
        validRequest,
        mockUserId,
        mockFamilyId,
        mockUserRole
      );

      expect(result.event.id).toBe('event-123');
      expect(result.suggestions).toHaveLength(0);
      expect(result.created_tasks).toHaveLength(0);
    });

    it('should generate health suggestions for doctor keyword', async () => {
      const requestWithDoctor: CreateEventRequest = {
        ...validRequest,
        title: 'Doctor appointment'
      };

      // Mock AI engine to return health suggestion
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
        data: {
          suggestions: [{
            suggestion_id: 'health',
            title: 'Prepare medical documents',
            due_date: '2026-01-31T10:00:00Z',
            description: 'Gather insurance cards and medical history'
          }]
        },
        error: null
      });

      // Mock event creation
      const mockEvent = {
        id: 'event-123',
        ...requestWithDoctor,
        family_id: mockFamilyId,
        created_by: mockUserId,
        created_at: '2026-01-26T12:00:00Z',
        updated_at: '2026-01-26T12:00:00Z',
        archived_at: null
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockEvent,
          error: null
        })
      } as any);

      // Mock get event with participants
      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { ...mockEvent, event_participants: [] },
          error: null
        })
      } as any);

      const result = await eventsService.createEventWithSuggestions(
        requestWithDoctor,
        mockUserId,
        mockFamilyId,
        mockUserRole
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].suggestion_id).toBe('health');
    });

    it('should create tasks from accepted suggestions', async () => {
      const requestWithAcceptedSuggestion: CreateEventRequest = {
        ...validRequest,
        title: 'Doctor appointment',
        accept_suggestions: ['health']
      };

      // Mock AI engine
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
        data: {
          suggestions: [{
            suggestion_id: 'health',
            title: 'Prepare medical documents',
            due_date: '2026-01-31T10:00:00Z',
            description: 'Gather insurance cards'
          }]
        },
        error: null
      });

      // Mock event creation
      const mockEvent = {
        id: 'event-123',
        ...requestWithAcceptedSuggestion,
        family_id: mockFamilyId,
        created_by: mockUserId,
        created_at: '2026-01-26T12:00:00Z',
        updated_at: '2026-01-26T12:00:00Z',
        archived_at: null
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockEvent,
          error: null
        })
      } as any);

      // Mock task creation
      const mockTask = {
        id: 'task-123',
        family_id: mockFamilyId,
        created_by: mockUserId,
        title: 'Prepare medical documents',
        due_date: '2026-01-31T10:00:00Z',
        is_private: false,
        event_id: 'event-123',
        suggestion_id: 'health',
        created_from_suggestion: true,
        assigned_to: null,
        is_completed: false,
        completed_at: null,
        completed_by: null,
        created_at: '2026-01-26T12:00:00Z',
        updated_at: '2026-01-26T12:00:00Z',
        archived_at: null
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockTask,
          error: null
        })
      } as any);

      // Mock get event with participants
      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { ...mockEvent, event_participants: [] },
          error: null
        })
      } as any);

      const result = await eventsService.createEventWithSuggestions(
        requestWithAcceptedSuggestion,
        mockUserId,
        mockFamilyId,
        mockUserRole
      );

      expect(result.created_tasks).toHaveLength(1);
      expect(result.created_tasks[0].suggestion_id).toBe('health');
      expect(result.suggestions[0].accepted).toBe(true);
    });

    it('should handle AI engine failure gracefully', async () => {
      // Mock AI engine to fail
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: new Error('AI engine timeout')
      });

      // Mock event creation
      const mockEvent = {
        id: 'event-123',
        ...validRequest,
        family_id: mockFamilyId,
        created_by: mockUserId,
        created_at: '2026-01-26T12:00:00Z',
        updated_at: '2026-01-26T12:00:00Z',
        archived_at: null
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockEvent,
          error: null
        })
      } as any);

      // Mock get event with participants
      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { ...mockEvent, event_participants: [] },
          error: null
        })
      } as any);

      // Should not throw error, should degrade gracefully
      const result = await eventsService.createEventWithSuggestions(
        validRequest,
        mockUserId,
        mockFamilyId,
        mockUserRole
      );

      expect(result.event.id).toBe('event-123');
      expect(result.suggestions).toHaveLength(0); // Graceful degradation
    });

    it('should rollback event on participant insert failure', async () => {
      const requestWithParticipants: CreateEventRequest = {
        ...validRequest,
        participant_ids: ['participant-123']
      };

      // Mock AI engine
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
        data: { suggestions: [] },
        error: null
      });

      // Mock event creation
      const mockEvent = {
        id: 'event-123',
        ...requestWithParticipants,
        family_id: mockFamilyId,
        created_by: mockUserId,
        created_at: '2026-01-26T12:00:00Z',
        updated_at: '2026-01-26T12:00:00Z',
        archived_at: null
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockEvent,
          error: null
        })
      } as any);

      // Mock participant insert failure
      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Participant does not belong to same family' }
        })
      } as any);

      // Mock delete for rollback
      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValueOnce({ data: null, error: null })
      } as any);

      await expect(
        eventsService.createEventWithSuggestions(
          requestWithParticipants,
          mockUserId,
          mockFamilyId,
          mockUserRole
        )
      ).rejects.toThrow();

      // Verify delete was called for rollback
      expect(mockSupabase.from).toHaveBeenCalledWith('events');
    });
  });
});


