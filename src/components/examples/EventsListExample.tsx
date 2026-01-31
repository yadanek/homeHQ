/**
 * Example Component: Events List
 * 
 * Demonstrates how to use the useEvents hook to display a list of calendar events
 * with filtering, pagination, and error handling.
 * 
 * This is a reference implementation showing best practices for:
 * - Using the useEvents hook
 * - Handling loading and error states
 * - Implementing filters and pagination
 * - Displaying event data
 */

import { useState } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export function EventsListExample() {
  const [showPrivate, setShowPrivate] = useState<boolean | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;

  // Use the useEvents hook with filters and pagination
  const { events, pagination, isLoading, error, refetch } = useEvents({
    is_private: showPrivate,
    limit: pageSize,
    offset: currentPage * pageSize,
    // Optional: Add date range filter
    // start_date: '2026-01-01T00:00:00Z',
    // end_date: '2026-12-31T23:59:59Z',
  });

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4">
        <Card className="p-6 border-destructive">
          <p className="text-destructive font-medium">Error loading events</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </Card>
        <Button onClick={refetch} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Handle empty state
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">No events found</p>
        {showPrivate !== undefined && (
          <Button
            onClick={() => setShowPrivate(undefined)}
            variant="outline"
            className="mt-4"
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-2">
        <Button
          onClick={() => setShowPrivate(undefined)}
          variant={showPrivate === undefined ? 'default' : 'outline'}
          size="sm"
        >
          All Events
        </Button>
        <Button
          onClick={() => setShowPrivate(false)}
          variant={showPrivate === false ? 'default' : 'outline'}
          size="sm"
        >
          Shared Only
        </Button>
        <Button
          onClick={() => setShowPrivate(true)}
          variant={showPrivate === true ? 'default' : 'outline'}
          size="sm"
        >
          Private Only
        </Button>
        <Button onClick={refetch} variant="ghost" size="sm">
          Refresh
        </Button>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.map((event) => (
          <Card key={event.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{event.title}</h3>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="text-muted-foreground">
                    {format(new Date(event.start_time), 'PPp')}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-muted-foreground">
                    {format(new Date(event.end_time), 'PPp')}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-muted-foreground">
                    Created by: {event.created_by_name}
                  </span>
                  {event.is_private && (
                    <span className="px-2 py-0.5 bg-muted rounded text-xs">
                      Private
                    </span>
                  )}
                </div>
                {event.participants.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Participants: </span>
                    {event.participants.map((p) => p.display_name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {pagination.offset + 1} to{' '}
            {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
            {pagination.total} events
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <Button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!pagination.has_more}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

