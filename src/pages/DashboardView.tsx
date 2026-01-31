/**
 * DashboardView - główny widok aplikacji
 * Łączy CalendarArea i DailyTasksSidebar
 * Używa custom hooka useDashboard do zarządzania stanem
 */

import { useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/hooks/useAuth';
import { CalendarArea } from '@/components/dashboard/CalendarArea';
import { DailyTasksSidebar } from '@/components/dashboard/DailyTasksSidebar';
import { CreateEventDialog } from '@/components/events/CreateEventDialog';
import { EventDetailsDialog } from '@/components/events/EventDetailsDialog';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { FamilySettingsView } from '@/pages/FamilySettingsView';
import { UserMenu } from '@/components/dashboard/UserMenu';
import { Toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export function DashboardView() {
  const {
    selectedDate,
    currentMonth,
    activeFilter,
    events,
    tasks,
    tasksForSelectedDate,
    isLoading,
    error,
    handleDateSelect,
    handleMonthChange,
    handleFilterChange,
    handleTaskToggleComplete,
    handleClearError,
    refetchEvents,
    refetchTasks,
  } = useDashboard();

  const { user } = useAuth();

  // State for Create Event Dialog
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [eventDefaultDate, setEventDefaultDate] = useState<Date | undefined>();

  // State for Create Task Dialog
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [taskDefaultDueDate, setTaskDefaultDueDate] = useState<Date | undefined>();

  // State for Event Details Dialog
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // State for Family Settings Dialog
  const [isFamilySettingsOpen, setIsFamilySettingsOpen] = useState(false);

  // Handlers
  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleTaskClick = (taskId: string) => {
    console.log('Task clicked:', taskId);
    // TODO: Open Task Edit Modal
  };

  const handleAddEvent = () => {
    setEventDefaultDate(selectedDate);
    setIsCreateEventOpen(true);
  };

  const handleAddTask = (dueDate: Date) => {
    setTaskDefaultDueDate(dueDate);
    setIsCreateTaskOpen(true);
  };

  const handleEventCreated = async () => {
    // Refresh events after successful creation
    await refetchEvents();
  };

  const handleEventDeleted = async () => {
    // Refresh events after successful deletion
    await refetchEvents();
  };

  const handleTaskCreated = async () => {
    // Refresh tasks after successful creation
    await refetchTasks();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">HomeHQ</h1>
            <p className="text-sm text-muted-foreground">Family Calendar & Tasks</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="default"
              onClick={() => setIsFamilySettingsOpen(true)}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Family Settings
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <Toast
          key={error}
          message={error}
          type="error"
          onClose={handleClearError}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar Area */}
        <CalendarArea
          events={events}
          tasks={tasks}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          activeFilter={activeFilter}
          isLoading={isLoading}
          onDateSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
          onFilterChange={handleFilterChange}
          onEventClick={handleEventClick}
          onTaskClick={handleTaskClick}
          onTaskToggleComplete={handleTaskToggleComplete}
          onAddEvent={handleAddEvent}
        />

        {/* Daily Tasks Sidebar */}
        <DailyTasksSidebar
          tasks={tasksForSelectedDate}
          selectedDate={selectedDate}
          onTaskClick={handleTaskClick}
          onTaskToggleComplete={handleTaskToggleComplete}
          onAddTask={handleAddTask}
        />
      </div>

      {/* Create Event Dialog */}
      <CreateEventDialog
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onSuccess={handleEventCreated}
        defaultDate={eventDefaultDate}
      />

      {/* Event Details Dialog */}
      <EventDetailsDialog
        isOpen={selectedEventId !== null}
        eventId={selectedEventId}
        currentUserId={user?.id}
        onClose={() => setSelectedEventId(null)}
        onEventDeleted={handleEventDeleted}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onSuccess={handleTaskCreated}
        defaultDueDate={taskDefaultDueDate}
      />

      {/* Family Settings Dialog */}
      <FamilySettingsView
        isOpen={isFamilySettingsOpen}
        onClose={() => setIsFamilySettingsOpen(false)}
      />
    </div>
  );
}

