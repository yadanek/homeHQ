/**
 * Date helper functions for Dashboard
 */

import { startOfMonth, endOfMonth, format, isToday, isPast, startOfDay } from 'date-fns';
import type { DateRange, ISO8601Date } from '@/types/dashboard.types';

/**
 * Gets the first and last day of a month in ISO 8601 format with time
 * Used for API query parameters
 * 
 * Returns dates in full ISO 8601 datetime format (e.g., "2026-01-01T00:00:00.000Z")
 * as required by the events API validation schema.
 */
export function getMonthDateRange(month: Date): DateRange {
  if (!(month instanceof Date) || isNaN(month.getTime())) {
    throw new Error('Invalid month date');
  }

  const start = startOfMonth(month);
  const end = endOfMonth(month);

  // Use toISOString() to get full ISO 8601 datetime format
  return {
    start: start.toISOString() as ISO8601Date,
    end: end.toISOString() as ISO8601Date,
  };
}

/**
 * Checks if two dates are on the same day
 * Ignores time component
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Formats a date for the sidebar header
 * Returns "Tasks for Today" if date is today
 * Returns "Tasks for Jan 15" otherwise
 */
export function formatDateForSidebar(date: Date): string {
  if (isToday(date)) {
    return 'Tasks for Today';
  }

  return `Tasks for ${format(date, 'MMM d')}`;
}

/**
 * Formats a date for calendar controls header
 * Returns "January 2026" format
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy');
}

/**
 * Checks if a date is in the past (before today)
 */
export function isPastDate(date: Date): boolean {
  return isPast(startOfDay(date)) && !isToday(date);
}

/**
 * Checks if a task is overdue
 */
export function isOverdue(dueDate: string | null, isCompleted: boolean): boolean {
  if (!dueDate || isCompleted) return false;
  return isPastDate(new Date(dueDate));
}

