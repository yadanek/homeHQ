/**
 * EventCard Component
 * 
 * Displays a single event in a card format with delete functionality.
 * Example component showing integration with DeleteEventButton.
 */

import { Calendar, Clock, Users, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DeleteEventButton } from './DeleteEventButton';
import type { EventWithCreator } from '@/types';
import { cn } from '@/lib/utils';

interface EventCardProps {
  /** Event data to display */
  event: EventWithCreator;
  /** Current user ID (to check if user is creator) */
  currentUserId: string;
  /** Callback when event is deleted */
  onDeleted?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * Card component for displaying event details with delete option
 * 
 * @example
 * ```tsx
 * <EventCard
 *   event={event}
 *   currentUserId={user.id}
 *   onDeleted={() => router.push('/events')}
 * />
 * ```
 */
export function EventCard({ 
  event, 
  currentUserId, 
  onDeleted,
  className 
}: EventCardProps) {
  const isCreator = event.created_by === currentUserId;
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  return (
    <Card className={cn("p-4 hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title and privacy indicator */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold truncate">
              {event.title}
            </h3>
            {event.is_private && (
              <Lock 
                className="h-4 w-4 text-muted-foreground flex-shrink-0" 
                aria-label="Private event"
              />
            )}
          </div>

          {/* Description */}
          {event.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Event details */}
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            {/* Date and time */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {startDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {startDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {' - '}
                {endDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            {/* Participants */}
            {event.participants.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>
                  {event.participants.map(p => p.display_name).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Creator info */}
          <div className="mt-3 text-xs text-muted-foreground">
            Created by {event.created_by_name}
          </div>
        </div>

        {/* Delete button - only visible to creator */}
        {isCreator && (
          <DeleteEventButton
            eventId={event.id}
            eventTitle={event.title}
            onDeleted={onDeleted}
          />
        )}
      </div>
    </Card>
  );
}

