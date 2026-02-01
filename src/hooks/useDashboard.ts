/**
 * Custom hook for Dashboard view state management
 * Encapsulates all business logic and API calls
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { FilterOption } from '@/types/dashboard.types';
import { useEvents } from '@/hooks/useEvents';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/db/supabase.client';
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
  const [hasAnyEvents, setHasAnyEvents] = useState<boolean | null>(null);

  const { profile } = useAuth();

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

  // Check if family has any events at all (for EmptyState logic)
  useEffect(() => {
    const checkForAnyEvents = async () => {
      if (!profile?.family_id) {
        setHasAnyEvents(null);
        return;
      }

      try {
        const supabase = createClient();
        const { count, error } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('family_id', profile.family_id)
          .limit(1);

        if (error) {
          console.error('Failed to check for events:', error);
          setHasAnyEvents(null);
        } else {
          setHasAnyEvents((count ?? 0) > 0);
        }
      } catch (err) {
        console.error('Error checking for events:', err);
        setHasAnyEvents(null);
      }
    };

    checkForAnyEvents();
  }, [profile?.family_id, events]); // Re-check when events change (after create/delete)

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
    hasAnyEvents,

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

