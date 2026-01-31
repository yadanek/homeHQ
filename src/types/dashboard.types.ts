/**
 * ViewModels and local types for Dashboard View
 */

import type { EventWithCreator, TaskWithDetails } from '@/types';

/**
 * Filter options for event visibility
 */
export type FilterOption = 'all' | 'private' | 'shared';

/**
 * Dashboard view state
 */
export interface DashboardState {
  selectedDate: Date;
  currentMonth: Date;
  activeFilter: FilterOption;
  events: EventWithCreator[];
  tasks: TaskWithDetails[];
  isLoadingEvents: boolean;
  isLoadingTasks: boolean;
  error: string | null;
}

/**
 * Unified calendar item for Schedule-X
 * Combines events and tasks into single format
 */
export interface CalendarItemViewModel {
  id: string;
  type: 'event' | 'task';
  title: string;
  start: Date;
  end: Date;
  isPrivate: boolean;
  participants?: Array<{ id: string; display_name: string }>;
  assignedTo?: string | null;
  isCompleted?: boolean;
  rawData: EventWithCreator | TaskWithDetails;
}

/**
 * Example event for empty state quick start
 */
export interface QuickStartExample {
  title: string;
  suggestionPreview: string;
  demoDate: Date;
}

/**
 * Tasks grouped by specific date
 */
export interface TasksForDate {
  date: Date;
  tasks: TaskWithDetails[];
  pendingCount: number;
  completedCount: number;
}

/**
 * ISO 8601 date string (YYYY-MM-DD)
 */
export type ISO8601Date = string;

/**
 * Date range for API queries
 */
export interface DateRange {
  start: ISO8601Date;
  end: ISO8601Date;
}

