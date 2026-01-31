/**
 * TaskList - scrollable lista zadań
 */

import type { TaskWithDetails } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: TaskWithDetails[];
  onTaskClick: (taskId: string) => void;
  onTaskToggleComplete: (taskId: string, isCompleted: boolean) => void;
}

export function TaskList({
  tasks,
  onTaskClick,
  onTaskToggleComplete,
}: TaskListProps) {
  return (
    <ScrollArea className="flex-1 px-2">
      <div className="space-y-2 py-2">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onClick={onTaskClick}
            onToggleComplete={onTaskToggleComplete}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

