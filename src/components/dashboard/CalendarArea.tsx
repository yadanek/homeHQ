/**
 * CalendarArea - główny obszar kalendarza
 * Łączy CalendarControls, CalendarGrid, AddEventButton i EmptyState
 */

import type { EventWithCreator, TaskWithDetails } from '@/types';
import type { FilterOption } from '@/types/dashboard.types';
import { CalendarControls } from './CalendarControls';
import { CalendarGrid } from './CalendarGrid';
import { EmptyState } from './EmptyState';

interface CalendarAreaProps {
  events: EventWithCreator[];
  tasks: TaskWithDetails[];
  currentMonth: Date;
  selectedDate: Date;
  activeFilter: FilterOption;
  isLoading: boolean;
  onDateSelect: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  onFilterChange: (filter: FilterOption) => void;
  onEventClick: (eventId: string) => void;
  onTaskClick: (taskId: string) => void;
  onTaskToggleComplete: (taskId: string, isCompleted: boolean) => void;
  onAddEvent: () => void;
}

export function CalendarArea({
  events,
  tasks,
  currentMonth,
  selectedDate,
  activeFilter,
  isLoading,
  onDateSelect,
  onMonthChange,
  onFilterChange,
  onEventClick,
  onTaskClick,
  onTaskToggleComplete,
  onAddEvent,
}: CalendarAreaProps) {
  const hasEvents = events.length > 0;

  return (
    <div className="flex-1 flex flex-col p-4 lg:p-6">
      {/* Controls */}
      <CalendarControls
        currentMonth={currentMonth}
        activeFilter={activeFilter}
        onMonthChange={onMonthChange}
        onFilterChange={onFilterChange}
        onAddEvent={onAddEvent}
      />

      {/* Calendar or Empty State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      ) : hasEvents ? (
        <CalendarGrid
          events={events}
          tasks={tasks}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onDateClick={onDateSelect}
          onEventClick={onEventClick}
          onTaskClick={onTaskClick}
          onTaskToggleComplete={onTaskToggleComplete}
        />
      ) : (
        <EmptyState onTryExample={onAddEvent} />
      )}
    </div>
  );
}

