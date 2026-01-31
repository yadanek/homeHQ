/**
 * Mock Data for Development
 * 
 * Przykładowe dane do testowania kalendarza i tasków bez backendu.
 * Usuń gdy podłączysz prawdziwy Supabase.
 */

import type { EventWithCreator, TaskWithDetails } from '@/types';

export const MOCK_EVENTS: EventWithCreator[] = [
  {
    id: 'event-1',
    family_id: 'mock-family-123',
    created_by: 'mock-user-123',
    created_by_name: 'Test User',
    title: 'Team Meeting',
    description: 'Weekly sync',
    start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    end_time: new Date(Date.now() + 90000000).toISOString(),
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    participants: []
  },
  {
    id: 'event-2',
    family_id: 'mock-family-123',
    created_by: 'mock-user-123',
    created_by_name: 'Test User',
    title: 'Doctor Appointment',
    description: 'Annual checkup',
    start_time: new Date(Date.now() + 172800000).toISOString(), // In 2 days
    end_time: new Date(Date.now() + 176400000).toISOString(),
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    participants: []
  }
];

export const MOCK_TASKS: TaskWithDetails[] = [
  {
    id: 'task-1',
    family_id: 'mock-family-123',
    created_by: 'mock-user-123',
    created_by_name: 'Test User',
    title: 'Buy groceries',
    due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    assigned_to: null,
    assigned_to_name: null,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    is_private: false,
    event_id: null,
    event_title: null,
    suggestion_id: null,
    created_from_suggestion: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null
  },
  {
    id: 'task-2',
    family_id: 'mock-family-123',
    created_by: 'mock-user-123',
    created_by_name: 'Test User',
    title: 'Prepare medical documents',
    due_date: new Date(Date.now() + 172800000).toISOString(), // In 2 days
    assigned_to: null,
    assigned_to_name: null,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    is_private: false,
    event_id: 'event-2',
    event_title: 'Doctor Appointment',
    suggestion_id: 'health',
    created_from_suggestion: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null
  }
];

// Store for created events in memory (tylko dla dev mode)
export const mockEventsStore: EventWithCreator[] = [...MOCK_EVENTS];
export const mockTasksStore: TaskWithDetails[] = [...MOCK_TASKS];

export function addMockEvent(event: EventWithCreator) {
  mockEventsStore.push(event);
}

export function addMockTask(task: TaskWithDetails) {
  mockTasksStore.push(task);
}

export function getMockEvents() {
  return [...mockEventsStore];
}

export function getMockTasks() {
  return [...mockTasksStore];
}


