/**
 * EventCard - pojedyncze wydarzenie w kalendarzu
 * Implementuje color coding (niebieski = prywatny, zielony = rodzinny)
 * Pokazuje lock icon dla wydarzeń prywatnych (US-004)
 */

import { Lock, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { EventWithCreator } from '@/types';
import { getEventColorClasses, truncateText } from '@/utils/calendarTransformers';
import { isPastDate } from '@/utils/dateHelpers';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: EventWithCreator;
  onClick: (eventId: string) => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const startTime = new Date(event.start_time);
  const isPast = isPastDate(startTime);
  const colorClasses = getEventColorClasses(event.is_private);

  // Show max 3 participants, +N for overflow
  const maxVisibleParticipants = 3;
  const visibleParticipants = event.participants.slice(0, maxVisibleParticipants);
  const overflowCount = event.participants.length - maxVisibleParticipants;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation(); // Prevent calendar day click
        onClick(event.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick(event.id);
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        'w-full text-left p-1 rounded border transition-shadow hover:shadow-sm cursor-pointer',
        colorClasses,
        isPast && 'opacity-60'
      )}
      aria-label={`Event: ${event.title}`}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          {/* Time badge */}
          <div className="text-[10px] font-medium">
            {format(startTime, 'h:mm a')}
          </div>

          {/* Title - compact */}
          <div className="font-medium text-xs leading-tight">
            {truncateText(event.title, 20)}
          </div>

          {/* Participants - hidden on small screens or when many */}
          {event.participants.length > 0 && event.participants.length <= 2 && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] mt-0.5">
              <Users className="w-2.5 h-2.5" />
              <span>
                {visibleParticipants.map((p) => p.display_name).join(', ')}
                {overflowCount > 0 && ` +${overflowCount}`}
              </span>
            </div>
          )}
        </div>

        {/* Lock icon for private events (US-004) */}
        {event.is_private && (
          <Lock
            className="w-3 h-3 flex-shrink-0"
            aria-label="Private event"
          />
        )}
      </div>
    </div>
  );
}

