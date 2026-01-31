/**
 * TaskItem - zadanie w sidebarze
 * Pokazuje checkbox, title, due date badge, assignee, lock icon
 */

import { Lock, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { TaskWithDetails } from '@/types';
import { getDueDateBadgeClasses } from '@/utils/calendarTransformers';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface TaskItemProps {
  task: TaskWithDetails;
  onClick: (taskId: string) => void;
  onToggleComplete: (taskId: string, isCompleted: boolean) => void;
}

export function TaskItem({ task, onClick, onToggleComplete }: TaskItemProps) {
  const dueDateClasses = getDueDateBadgeClasses(task.due_date, task.is_completed);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors',
        task.is_completed && 'opacity-60'
      )}
      data-task-id={task.id}
    >
      {/* Checkbox */}
      <Checkbox
        checked={task.is_completed}
        onCheckedChange={(checked) => onToggleComplete(task.id, checked)}
        onClick={(e) => e.stopPropagation()}
        className="mt-1"
        aria-label={`Mark task "${task.title}" as ${task.is_completed ? 'incomplete' : 'complete'}`}
      />

      {/* Task content */}
      <button
        type="button"
        onClick={() => onClick(task.id)}
        className="flex-1 text-left min-w-0"
      >
        {/* Title */}
        <div
          className={cn(
            'font-medium text-sm mb-1',
            task.is_completed && 'line-through'
          )}
        >
          {task.title}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Due date badge */}
          {task.due_date && (
            <Badge className={cn('gap-1', dueDateClasses)}>
              <Calendar className="w-3 h-3" />
              {format(new Date(task.due_date), 'MMM d')}
            </Badge>
          )}

          {/* Assignee */}
          {task.assigned_to_name && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="w-3 h-3" />
              {task.assigned_to_name}
            </span>
          )}

          {/* Private indicator */}
          {task.is_private && (
            <Lock className="w-3 h-3 text-muted-foreground" aria-label="Private task" />
          )}
        </div>

        {/* Source event link */}
        {task.created_from_suggestion && task.event_title && (
          <div className="text-xs text-muted-foreground mt-1">
            From: {task.event_title}
          </div>
        )}
      </button>
    </div>
  );
}

