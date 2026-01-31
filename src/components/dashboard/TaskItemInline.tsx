/**
 * TaskItemInline - zadanie wyświetlane w kalendarzu
 * Pokazuje mini checkbox, title, i assignee
 */

import { User } from 'lucide-react';
import type { TaskWithDetails } from '@/types';
import { getTaskColorClasses, truncateText } from '@/utils/calendarTransformers';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface TaskItemInlineProps {
  task: TaskWithDetails;
  onClick: (taskId: string) => void;
  onToggleComplete: (taskId: string, isCompleted: boolean) => void;
}

export function TaskItemInline({
  task,
  onClick,
  onToggleComplete,
}: TaskItemInlineProps) {
  const colorClasses = getTaskColorClasses(task.is_completed);

  return (
    <div
      className={cn(
        'w-full p-1 rounded border',
        colorClasses
      )}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-1">
        {/* Checkbox - smaller */}
        <div className="mt-0.5">
          <Checkbox
            checked={task.is_completed}
            onCheckedChange={(checked) => onToggleComplete(task.id, checked)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Mark task "${task.title}" as ${task.is_completed ? 'incomplete' : 'complete'}`}
            className="w-3 h-3"
          />
        </div>

        {/* Task content */}
        <div
          onClick={(e) => {
            e.stopPropagation(); // Prevent calendar day click
            onClick(task.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onClick(task.id);
            }
          }}
          role="button"
          tabIndex={0}
          className="flex-1 text-left min-w-0 cursor-pointer"
        >
          {/* Task badge - smaller */}
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            Task
          </Badge>

          {/* Title - compact */}
          <div className={cn('text-xs font-medium leading-tight', task.is_completed && 'line-through')}>
            {truncateText(task.title, 18)}
          </div>

          {/* Assignee - hidden on very small screens */}
          {task.assigned_to_name && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] mt-0.5 opacity-75">
              <User className="w-2.5 h-2.5" />
              <span>{task.assigned_to_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

