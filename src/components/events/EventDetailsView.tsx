/**
 * EventDetailsView - Detailed view of a single event
 * 
 * Displays complete event information including:
 * - Event title, description, date/time
 * - Creator information
 * - Participant list
 * - Privacy indicator
 * 
 * Supports edit mode for event creators:
 * - Toggle between view and edit modes
 * - Full form for updating event details
 * 
 * Handles various states:
 * - Loading state with skeleton
 * - Error states (404, 403, 400, 500)
 * - Success state with full event details
 */

import { useState } from 'react';
import { Lock, Users, Calendar, Clock, AlertCircle, XCircle, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { useEvent } from '@/hooks/useEvents';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteEventButton } from '@/components/events/DeleteEventButton';
import { EditEventForm } from '@/components/events/EditEventForm';

interface EventDetailsViewProps {
  eventId: string;
  currentUserId?: string;
  onClose?: () => void;
  onEventDeleted?: () => void;
  onEventUpdated?: () => void;
}

/**
 * Loading skeleton component
 */
function EventDetailsSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

/**
 * Error display component with specific error handling
 */
interface ErrorDisplayProps {
  errorCode: string | null;
  errorMessage: string | null;
  onRetry: () => void;
  onClose?: () => void;
}

function ErrorDisplay({ errorCode, errorMessage, onRetry, onClose }: ErrorDisplayProps) {
  // Determine error type and customize message
  const getErrorDetails = () => {
    switch (errorCode) {
      case 'INVALID_EVENT_ID':
        return {
          icon: <AlertCircle className="w-12 h-12 text-yellow-500" />,
          title: 'Invalid Event ID',
          description: 'The event ID format is not valid. Please check the URL.',
          showRetry: false
        };
      case 'EVENT_NOT_FOUND':
        return {
          icon: <XCircle className="w-12 h-12 text-gray-400" />,
          title: 'Event Not Found',
          description: 'This event does not exist or has been archived.',
          showRetry: false
        };
      case 'FORBIDDEN':
        return {
          icon: <Lock className="w-12 h-12 text-red-500" />,
          title: 'Access Denied',
          description: errorMessage || 'You do not have permission to view this event.',
          showRetry: false
        };
      case 'UNAUTHORIZED':
        return {
          icon: <AlertCircle className="w-12 h-12 text-orange-500" />,
          title: 'Authentication Required',
          description: 'Please log in to view this event.',
          showRetry: false
        };
      default:
        return {
          icon: <AlertCircle className="w-12 h-12 text-red-500" />,
          title: 'Error Loading Event',
          description: errorMessage || 'An unexpected error occurred while loading the event.',
          showRetry: true
        };
    }
  };

  const errorDetails = getErrorDetails();

  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
        {errorDetails.icon}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {errorDetails.title}
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            {errorDetails.description}
          </p>
        </div>
        <div className="flex gap-2">
          {errorDetails.showRetry && (
            <Button onClick={onRetry} variant="default">
              Try Again
            </Button>
          )}
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main EventDetailsView component
 */
export function EventDetailsView({ 
  eventId, 
  currentUserId,
  onClose,
  onEventDeleted,
  onEventUpdated
}: EventDetailsViewProps) {
  const { event, isLoading, error, errorCode, refetch } = useEvent(eventId);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Check if current user is the event creator
  const isCreator = currentUserId && event?.created_by === currentUserId;

  // Handle successful edit
  const handleEditSuccess = () => {
    setIsEditMode(false);
    refetch(); // Reload event data to show updated values
    onEventUpdated?.(); // Notify parent to refresh
  };

  // Handle cancel edit
  const handleEditCancel = () => {
    setIsEditMode(false);
  };

  // Loading state
  if (isLoading) {
    return <EventDetailsSkeleton />;
  }

  // Error state
  if (error || errorCode) {
    return (
      <ErrorDisplay
        errorCode={errorCode}
        errorMessage={error}
        onRetry={refetch}
        onClose={onClose}
      />
    );
  }

  // No event (shouldn't happen if error handling is correct)
  if (!event) {
    return (
      <ErrorDisplay
        errorCode="EVENT_NOT_FOUND"
        errorMessage="Event not found"
        onRetry={refetch}
        onClose={onClose}
      />
    );
  }

  // Show edit form if in edit mode and user is creator
  if (isEditMode && isCreator) {
    return (
      <EditEventForm
        event={event}
        onSuccess={handleEditSuccess}
        onCancel={handleEditCancel}
      />
    );
  }

  // Format dates
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const isSameDay = format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd');

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl">{event.title}</CardTitle>
              {event.is_private && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Private
                </Badge>
              )}
            </div>
            <CardDescription>
              Created by {event.created_by_name}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isCreator && (
              <Button
                onClick={() => setIsEditMode(true)}
                variant="outline"
                size="sm"
                aria-label="Edit event"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
            {onClose && (
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                aria-label="Close event details"
              >
                ×
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Date and Time Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-medium">
                {format(startDate, 'EEEE, MMMM d, yyyy')}
              </div>
              {!isSameDay && (
                <div className="text-sm text-gray-600">
                  to {format(endDate, 'EEEE, MMMM d, yyyy')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-700">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <div>
              <span className="font-medium">
                {format(startDate, 'h:mm a')}
              </span>
              <span className="text-gray-600"> - </span>
              <span className="font-medium">
                {format(endDate, 'h:mm a')}
              </span>
              {!isSameDay && (
                <span className="text-sm text-gray-600 ml-1">
                  (next day)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description Section */}
        {event.description && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Description
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        {/* Participants Section */}
        {event.participants.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Participants ({event.participants.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {event.participants.map((participant) => {
                // Handle both profiles (with accounts) and members (without accounts)
                const displayName = participant.profile?.display_name || participant.member?.name || 'Unknown';
                const isAdmin = participant.member?.is_admin ?? true; // Profiles are admins by default
                
                return (
                  <Badge
                    key={participant.id}
                    variant="outline"
                    className="px-3 py-1"
                  >
                    {participant.member && (
                      <span className="mr-1" aria-hidden="true">
                        {isAdmin ? '👤' : '👶'}
                      </span>
                    )}
                    {displayName}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata Section */}
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div>
              Created: {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
            </div>
            {event.updated_at !== event.created_at && (
              <div>
                Updated: {format(new Date(event.updated_at), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </div>
        </div>

        {/* Delete Button - Only visible to creator */}
        {isCreator && (
          <div className="pt-4 border-t border-gray-200">
            <DeleteEventButton
              eventId={event.id}
              eventTitle={event.title}
              onDeleted={() => {
                onEventDeleted?.();
                onClose?.();
              }}
              variant="destructive"
              size="default"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}


