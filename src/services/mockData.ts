/**
 * Mock Data Service for Dashboard Development
 * Provides fake data for events and tasks until API is implemented
 */

import type {
  ListEventsResponse,
  ListTasksResponse,
  UpdateTaskResponse,
  GetEventsQueryParams,
  GetTasksQueryParams,
  EventWithCreator,
  TaskWithDetails,
} from '@/types';

// Sample data
const MOCK_EVENTS: EventWithCreator[] = [
  {
    id: 'event-1',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Dentist Appointment',
    description: 'Annual checkup for Emma',
    start_time: new Date(2026, 0, 15, 10, 0).toISOString(),
    end_time: new Date(2026, 0, 15, 11, 0).toISOString(),
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    participants: [
      { id: 'kid-1', display_name: 'Emma' }
    ],
  },
  {
    id: 'event-2',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Emma\'s Birthday Party',
    description: 'Celebrate Emma turning 8!',
    start_time: new Date(2026, 0, 20, 14, 0).toISOString(),
    end_time: new Date(2026, 0, 20, 18, 0).toISOString(),
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    participants: [
      { id: 'kid-1', display_name: 'Emma' },
      { id: 'user-2', display_name: 'Sarah' }
    ],
  },
  {
    id: 'event-3',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Work Meeting',
    description: 'Q1 Planning',
    start_time: new Date(2026, 0, 12, 9, 0).toISOString(),
    end_time: new Date(2026, 0, 12, 10, 30).toISOString(),
    is_private: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    participants: [],
  },
  {
    id: 'event-4',
    family_id: 'family-1',
    created_by: 'user-2',
    created_by_name: 'Sarah',
    title: 'Weekend Trip to Mountains',
    description: 'Family hiking trip',
    start_time: new Date(2026, 0, 25, 8, 0).toISOString(),
    end_time: new Date(2026, 0, 27, 18, 0).toISOString(),
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    participants: [
      { id: 'user-1', display_name: 'John Smith' },
      { id: 'user-2', display_name: 'Sarah' },
      { id: 'kid-1', display_name: 'Emma' }
    ],
  },
];

const MOCK_TASKS: TaskWithDetails[] = [
  {
    id: 'task-1',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Prepare medical documents',
    due_date: new Date(2026, 0, 14).toISOString(),
    assigned_to: 'user-1',
    assigned_to_name: 'John Smith',
    is_private: false,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    event_id: 'event-1',
    event_title: 'Dentist Appointment',
    suggestion_id: 'health',
    created_from_suggestion: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  },
  {
    id: 'task-2',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Buy birthday cake',
    due_date: new Date(2026, 0, 19).toISOString(),
    assigned_to: 'user-2',
    assigned_to_name: 'Sarah',
    is_private: false,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    event_id: 'event-2',
    event_title: 'Emma\'s Birthday Party',
    suggestion_id: 'birthday',
    created_from_suggestion: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  },
  {
    id: 'task-3',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Send party invitations',
    due_date: new Date(2026, 0, 15).toISOString(),
    assigned_to: 'user-1',
    assigned_to_name: 'John Smith',
    is_private: false,
    is_completed: true,
    completed_at: new Date(2026, 0, 14).toISOString(),
    completed_by: 'user-1',
    completed_by_name: 'John Smith',
    event_id: 'event-2',
    event_title: 'Emma\'s Birthday Party',
    suggestion_id: 'birthday',
    created_from_suggestion: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  },
  {
    id: 'task-4',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Check hiking equipment',
    due_date: new Date(2026, 0, 24).toISOString(),
    assigned_to: 'user-1',
    assigned_to_name: 'John Smith',
    is_private: false,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    event_id: 'event-4',
    event_title: 'Weekend Trip to Mountains',
    suggestion_id: 'travel',
    created_from_suggestion: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  },
  {
    id: 'task-5',
    family_id: 'family-1',
    created_by: 'user-1',
    created_by_name: 'John Smith',
    title: 'Review quarterly report',
    due_date: new Date(2026, 0, 12).toISOString(),
    assigned_to: 'user-1',
    assigned_to_name: 'John Smith',
    is_private: true,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    event_id: 'event-3',
    event_title: 'Work Meeting',
    suggestion_id: null,
    created_from_suggestion: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  },
];

/**
 * Mock API call to get events
 */
export async function getMockEvents(
  params: GetEventsQueryParams
): Promise<ListEventsResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  let filteredEvents = [...MOCK_EVENTS];

  // Filter by date range
  if (params.start_date) {
    const startDate = new Date(params.start_date);
    filteredEvents = filteredEvents.filter(
      (event) => new Date(event.start_time) >= startDate
    );
  }

  if (params.end_date) {
    const endDate = new Date(params.end_date);
    filteredEvents = filteredEvents.filter(
      (event) => new Date(event.start_time) <= endDate
    );
  }

  // Filter by privacy
  if (params.is_private !== undefined) {
    filteredEvents = filteredEvents.filter(
      (event) => event.is_private === params.is_private
    );
  }

  // Filter by participant
  if (params.participant_id) {
    filteredEvents = filteredEvents.filter((event) =>
      event.participants.some((p) => p.id === params.participant_id)
    );
  }

  // Apply pagination
  const limit = params.limit || 100;
  const offset = params.offset || 0;
  const paginatedEvents = filteredEvents.slice(offset, offset + limit);

  return {
    events: paginatedEvents,
    pagination: {
      total: filteredEvents.length,
      limit,
      offset,
      has_more: offset + limit < filteredEvents.length,
    },
  };
}

/**
 * Mock API call to get tasks
 */
export async function getMockTasks(
  params: GetTasksQueryParams
): Promise<ListTasksResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  let filteredTasks = [...MOCK_TASKS];

  // Filter by completion status
  if (params.is_completed !== undefined) {
    filteredTasks = filteredTasks.filter(
      (task) => task.is_completed === params.is_completed
    );
  }

  // Filter by privacy
  if (params.is_private !== undefined) {
    filteredTasks = filteredTasks.filter(
      (task) => task.is_private === params.is_private
    );
  }

  // Filter by assignee
  if (params.assigned_to) {
    const assigneeId = params.assigned_to === 'me' ? 'user-1' : params.assigned_to;
    filteredTasks = filteredTasks.filter(
      (task) => task.assigned_to === assigneeId
    );
  }

  // Filter by due date range
  if (params.due_after) {
    const dueAfter = new Date(params.due_after);
    filteredTasks = filteredTasks.filter((task) => {
      if (!task.due_date) return false;
      return new Date(task.due_date) >= dueAfter;
    });
  }

  if (params.due_before) {
    const dueBefore = new Date(params.due_before);
    filteredTasks = filteredTasks.filter((task) => {
      if (!task.due_date) return false;
      return new Date(task.due_date) <= dueBefore;
    });
  }

  // Filter by event
  if (params.event_id) {
    filteredTasks = filteredTasks.filter(
      (task) => task.event_id === params.event_id
    );
  }

  // Sort
  const sort = params.sort || 'due_date_asc';
  if (sort === 'due_date_asc') {
    filteredTasks.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  } else if (sort === 'due_date_desc') {
    filteredTasks.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
    });
  } else if (sort === 'created_at_desc') {
    filteredTasks.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Apply pagination
  const limit = params.limit || 100;
  const offset = params.offset || 0;
  const paginatedTasks = filteredTasks.slice(offset, offset + limit);

  return {
    tasks: paginatedTasks,
    pagination: {
      total: filteredTasks.length,
      limit,
      offset,
      has_more: offset + limit < filteredTasks.length,
    },
  };
}

/**
 * Mock API call to update task completion status
 */
export async function updateTaskCompletion(
  taskId: string,
  isCompleted: boolean
): Promise<UpdateTaskResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Find task in mock data
  const taskIndex = MOCK_TASKS.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) {
    throw new Error('Task not found');
  }

  const task = MOCK_TASKS[taskIndex];

  // Update mock data
  MOCK_TASKS[taskIndex] = {
    ...task,
    is_completed: isCompleted,
    completed_at: isCompleted ? new Date().toISOString() : null,
    completed_by: isCompleted ? 'user-1' : null,
    updated_at: new Date().toISOString(),
  };

  return {
    id: task.id,
    title: task.title,
    due_date: task.due_date,
    assigned_to: task.assigned_to,
    is_completed: isCompleted,
    completed_at: isCompleted ? new Date().toISOString() : null,
    completed_by: isCompleted ? 'user-1' : null,
    updated_at: new Date().toISOString(),
  };
}

