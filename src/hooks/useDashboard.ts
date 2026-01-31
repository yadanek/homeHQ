/**
 * Custom hook for Dashboard view state management
 * Encapsulates all business logic and API calls
 */

import { useState, useMemo, useCallback } from 'react';
import type { FilterOption } from '@/types/dashboard.types';
import { useEvents } from '@/hooks/useEvents';
import { useTasks } from '@/hooks/useTasks';
import { logError } from '@/utils/response.utils';
import {
  getMonthDateRange,
  isSameDay,
} from '@/utils/dateHelpers';
import {
  transformToCalendarItems,
  mapFilterToApiParam,
} from '@/utils/calendarTransformers';

export function useDashboard() {
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  // Calculate date range for current month
  const dateRange = useMemo(() => getMonthDateRange(currentMonth), [currentMonth]);

  // Fetch events using the useEvents hook
  const {
    events,
    isLoading: isLoadingEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents({
    start_date: dateRange.start,
    end_date: dateRange.end,
    is_private: mapFilterToApiParam(activeFilter),
    limit: 500, // Fetch more events for monthly view
  });

  // Fetch tasks using the useTasks hook
  const {
    tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
    updateTaskCompletion: updateTaskCompletionService,
  } = useTasks({
    due_after: dateRange.start,
    due_before: dateRange.end,
    is_private: mapFilterToApiParam(activeFilter),
    limit: 500, // Fetch more tasks for monthly view
  });

  // Computed values
  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;

      const dueDate = new Date(task.due_date);

      if (isNaN(dueDate.getTime())) {
        logError(new Error('Invalid due_date for task'), { taskId: task.id });
        return false;
      }

      return isSameDay(dueDate, selectedDate);
    });
  }, [tasks, selectedDate]);

  // Note: filtering is now handled by useEvents and useTasks hooks via API params
  // So filteredEvents and tasks are already filtered server-side
  const filteredEvents = events;

  const calendarItems = useMemo(() => {
    return transformToCalendarItems(filteredEvents, tasks);
  }, [filteredEvents, tasks]);

  // Combined error handling
  const error = eventsError || tasksError;

  // Handlers
  const handleDateSelect = setSelectedDate;

  const handleMonthChange = useCallback((newMonth: Date) => {
    setCurrentMonth(newMonth);
    // Reset selected date to first day of new month if current selection is out of range
    setSelectedDate(newMonth);
  }, []);

  const handleFilterChange = setActiveFilter;

  const handleClearError = useCallback(() => {
    // Errors are managed by useEvents and useTasks hooks
    // We can refetch to clear errors and retry
    refetchEvents();
    refetchTasks();
  }, [refetchEvents, refetchTasks]);

  const handleTaskToggleComplete = useCallback(
    async (taskId: string, isCompleted: boolean) => {
      // Optimistic update and error handling are managed by useTasks hook
      await updateTaskCompletionService(taskId, isCompleted);
    },
    [updateTaskCompletionService]
  );

  return {
    // State
    selectedDate,
    currentMonth,
    activeFilter,
    events: filteredEvents,
    tasks,
    tasksForSelectedDate,
    calendarItems,
    isLoading: isLoadingEvents || isLoadingTasks,
    isLoadingEvents,
    isLoadingTasks,
    error,

    // Handlers
    handleDateSelect,
    handleMonthChange,
    handleFilterChange,
    handleTaskToggleComplete,
    handleClearError,
    
    // Refetch functions
    refetchEvents,
    refetchTasks,
  };
}

