/**
 * CalendarGrid - siatka kalendarza miesięcznego
 * Uproszczona wersja MVP bez Schedule-X (można dodać później)
 * Pokazuje wydarzenia i zadania w prostym grid layout
 */

import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay as isSameDayFns,
  format 
} from 'date-fns';
import type { EventWithCreator, TaskWithDetails } from '@/types';
import { cn } from '@/lib/utils';
import { EventCard } from './EventCard';
import { TaskItemInline } from './TaskItemInline';

interface CalendarGridProps {
  events: EventWithCreator[];
  tasks: TaskWithDetails[];
  currentMonth: Date;
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (eventId: string) => void;
  onTaskClick: (taskId: string) => void;
  onTaskToggleComplete: (taskId: string, isCompleted: boolean) => void;
}

export function CalendarGrid({
  events,
  tasks,
  currentMonth,
  selectedDate,
  onDateClick,
  onEventClick,
  onTaskClick,
  onTaskToggleComplete,
}: CalendarGridProps) {
  // Calculate calendar days (week starts on Monday)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Get events and tasks for specific date
  const getItemsForDate = (date: Date) => {
    const dayEvents = events.filter((event) => 
      isSameDayFns(new Date(event.start_time), date)
    );
    
    const dayTasks = tasks.filter((task) => 
      task.due_date && isSameDayFns(new Date(task.due_date), date)
    );
    
    return { events: dayEvents, tasks: dayTasks };
  };

  return (
    <div className="border rounded-lg overflow-hidden" role="grid" aria-label="Calendar">
      {/* Week day headers */}
      <div className="grid grid-cols-7 bg-muted">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-1.5 text-center text-xs sm:text-sm font-medium text-muted-foreground"
            role="columnheader"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 auto-rows-fr max-h-[calc(100vh-240px)] min-h-[400px]" style={{ height: 'calc(100vh - 240px)' }}>
        {calendarDays.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDayFns(day, selectedDate);
          const isToday = isSameDayFns(day, new Date());
          const { events: dayEvents, tasks: dayTasks } = getItemsForDate(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDateClick(day)}
              className={cn(
                'h-full p-1.5 sm:p-2 border-r border-b text-left overflow-hidden hover:bg-accent/50 transition-colors flex flex-col',
                !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                isSelected && 'ring-2 ring-primary ring-inset',
                isToday && 'bg-accent/20'
              )}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={format(day, 'MMMM d, yyyy')}
            >
              {/* Date number */}
              <div
                className={cn(
                  'text-xs sm:text-sm font-medium mb-1',
                  isToday && 'bg-primary text-primary-foreground rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center'
                )}
              >
                {format(day, 'd')}
              </div>

              {/* Events and tasks */}
              <div className="space-y-0.5 flex-1 overflow-y-auto overflow-x-hidden">
                {dayEvents.map((event) => (
                  <EventCard key={event.id} event={event} onClick={onEventClick} />
                ))}
                
                {dayTasks.map((task) => (
                  <TaskItemInline
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    onToggleComplete={onTaskToggleComplete}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

