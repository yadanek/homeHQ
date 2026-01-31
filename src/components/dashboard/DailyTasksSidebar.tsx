/**
 * DailyTasksSidebar - prawy sidebar z zadaniami dla wybranej daty
 * Desktop: fixed sidebar (320px)
 * Tablet: Sheet drawer (collapsible)
 * Mobile: hidden (zadania w osobnym widoku)
 */

import type { TaskWithDetails } from '@/types';
import { SidebarHeader } from './SidebarHeader';
import { TaskList } from './TaskList';
import { SidebarEmptyState } from './SidebarEmptyState';

interface DailyTasksSidebarProps {
  tasks: TaskWithDetails[];
  selectedDate: Date;
  onTaskClick: (taskId: string) => void;
  onTaskToggleComplete: (taskId: string, isCompleted: boolean) => void;
  onAddTask: (dueDate: Date) => void;
}

export function DailyTasksSidebar({
  tasks,
  selectedDate,
  onTaskClick,
  onTaskToggleComplete,
  onAddTask,
}: DailyTasksSidebarProps) {
  const hasTasks = tasks.length > 0;

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-80 lg:border-l lg:bg-background"
      aria-label="Daily tasks"
    >
      <SidebarHeader
        selectedDate={selectedDate}
        onAddTask={() => onAddTask(selectedDate)}
      />

      {hasTasks ? (
        <TaskList
          tasks={tasks}
          onTaskClick={onTaskClick}
          onTaskToggleComplete={onTaskToggleComplete}
        />
      ) : (
        <SidebarEmptyState />
      )}
    </aside>
  );
}

