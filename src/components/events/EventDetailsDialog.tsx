/**
 * EventDetailsDialog - Modal dialog wrapper for EventDetailsView
 * 
 * Displays event details in a modal overlay.
 * Handles:
 * - Modal backdrop and closing
 * - Escape key handling
 * - Click-outside-to-close
 */

import { useEffect } from 'react';
import { EventDetailsView } from './EventDetailsView';

interface EventDetailsDialogProps {
  isOpen: boolean;
  eventId: string | null;
  currentUserId?: string;
  onClose: () => void;
  onEventDeleted?: () => void;
  onEventUpdated?: () => void;
}

export function EventDetailsDialog({ 
  isOpen, 
  eventId,
  currentUserId,
  onClose,
  onEventDeleted,
  onEventUpdated
}: EventDetailsDialogProps) {
  
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Don't render if not open or no eventId
  if (!isOpen || !eventId) return null;

  return (
    <div 
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <EventDetailsView 
          eventId={eventId}
          currentUserId={currentUserId}
          onClose={onClose}
          onEventDeleted={onEventDeleted}
          onEventUpdated={onEventUpdated}
        />
      </div>
    </div>
  );
}
