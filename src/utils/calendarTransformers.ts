/**
 * Calendar data transformation utilities
 */

import type {
  EventWithCreator,
  TaskWithDetails,
} from '@/types';
import type {
  CalendarItemViewModel,
  FilterOption,
} from '@/types/dashboard.types';
import { isSameDay } from './dateHelpers';

/**
 * Transforms events and tasks into unified calendar items
 * Used by Schedule-X calendar component
 */
export function transformToCalendarItems(
  events: EventWithCreator[],
  tasks: TaskWithDetails[]
): CalendarItemViewModel[] {
  const eventItems: CalendarItemViewModel[] = events.map((event) => ({
    id: event.id,
    type: 'event' as const,
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    isPrivate: event.is_private,
    participants: event.participants.map(p => ({
      id: p.profile?.id || p.member?.id || p.id,
      display_name: p.profile?.display_name || p.member?.name || 'Unknown'
    })),
    rawData: event,
  }));

  const taskItems: CalendarItemViewModel[] = tasks
    .filter((task) => task.due_date) // Only tasks with due_date
    .map((task) => ({
      id: task.id,
      type: 'task' as const,
      title: task.title,
      start: new Date(task.due_date!),
      end: new Date(task.due_date!), // Tasks don't have end_time
      isPrivate: task.is_private,
      assignedTo: task.assigned_to,
      isCompleted: task.is_completed,
      rawData: task,
    }));

  return [...eventItems, ...taskItems];
}

/**
 * Maps filter option to API parameter value
 * Used for GET /events API calls
 */
export function mapFilterToApiParam(
  filter: FilterOption
): boolean | undefined {
  if (filter === 'private') return true;
  if (filter === 'shared') return false;
  return undefined; // 'all' returns undefined
}

/**
 * Returns Tailwind CSS classes for event color coding
 * Blue for private, green for shared (US-000)
 */
export function getEventColorClasses(isPrivate: boolean): string {
  return isPrivate
    ? 'bg-blue-100 border-blue-300 text-blue-900' // Private events
    : 'bg-green-100 border-green-300 text-green-900'; // Shared events
}

/**
 * Returns Tailwind CSS classes for task items
 * Orange color for tasks
 */
export function getTaskColorClasses(isCompleted: boolean): string {
  const baseClasses = 'bg-orange-50 border-orange-200 text-orange-900';
  const completedClasses = 'opacity-60 line-through';
  
  return isCompleted ? `${baseClasses} ${completedClasses}` : baseClasses;
}

/**
 * Returns Tailwind CSS classes for due date badge
 * Red for overdue, orange for today, gray for future
 */
export function getDueDateBadgeClasses(
  dueDate: string | null,
  isCompleted: boolean
): string {
  if (!dueDate || isCompleted) {
    return 'bg-gray-100 text-gray-600';
  }

  const due = new Date(dueDate);
  const today = new Date();
  
  // Compare dates without time component
  if (due < today && !isSameDay(due, today)) {
    return 'bg-red-100 text-red-700'; // Overdue
  }
  
  if (isSameDay(due, today)) {
    return 'bg-orange-100 text-orange-700'; // Due today
  }
  
  return 'bg-gray-100 text-gray-600'; // Future
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

