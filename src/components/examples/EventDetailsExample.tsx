/**
 * EventDetailsExample - Example usage of EventDetailsView component
 * 
 * Demonstrates how to use the EventDetailsView component with different scenarios:
 * - Valid event ID
 * - Invalid event ID (400 error)
 * - Non-existent event (404 error)
 * - Forbidden access (403 error)
 * 
 * This component serves as both documentation and a testing playground
 * for the GET /events/:eventId endpoint implementation.
 */

import { useState } from 'react';
import { EventDetailsView } from '@/components/events/EventDetailsView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Example event IDs for testing different scenarios
 */
const EXAMPLE_EVENT_IDS = {
  // Replace these with actual test event IDs from your database
  valid: '123e4567-e89b-12d3-a456-426614174000',
  invalid: 'not-a-uuid',
  notFound: '00000000-0000-0000-0000-000000000000',
  forbidden: '11111111-1111-1111-1111-111111111111', // Private event from another user
};

export function EventDetailsExample() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Event Details View - Example & Testing</CardTitle>
          <CardDescription>
            Click on the buttons below to test different scenarios for the GET /events/:eventId endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Scenario Buttons */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Test Scenarios:</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setSelectedEventId(EXAMPLE_EVENT_IDS.valid)}
                variant="default"
              >
                Valid Event (200 OK)
              </Button>
              <Button
                onClick={() => setSelectedEventId(EXAMPLE_EVENT_IDS.invalid)}
                variant="secondary"
              >
                Invalid UUID (400 Bad Request)
              </Button>
              <Button
                onClick={() => setSelectedEventId(EXAMPLE_EVENT_IDS.notFound)}
                variant="secondary"
              >
                Not Found (404)
              </Button>
              <Button
                onClick={() => setSelectedEventId(EXAMPLE_EVENT_IDS.forbidden)}
                variant="secondary"
              >
                Forbidden (403)
              </Button>
              <Button
                onClick={() => setSelectedEventId(null)}
                variant="outline"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Custom Event ID Input */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Or enter a custom event ID:</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter event UUID..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedEventId(e.currentTarget.value);
                  }
                }}
              />
              <Button
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  setSelectedEventId(input.value);
                }}
              >
                Load Event
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Details Display */}
      {selectedEventId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Event Details</h2>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
              Event ID: {selectedEventId}
            </code>
          </div>
          <EventDetailsView
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
          />
        </div>
      )}

      {/* Documentation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Endpoint</h3>
            <code className="block bg-gray-100 p-2 rounded text-sm">
              GET /events/:eventId
            </code>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Response Codes</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li><strong>200 OK</strong> - Event found and user has access</li>
              <li><strong>400 Bad Request</strong> - Invalid UUID format</li>
              <li><strong>403 Forbidden</strong> - User doesn't have permission (different family or private event)</li>
              <li><strong>404 Not Found</strong> - Event doesn't exist or has been archived</li>
              <li><strong>500 Internal Server Error</strong> - Unexpected error occurred</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Security Features</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>✅ UUID format validation (fail-fast)</li>
              <li>✅ Row Level Security (RLS) enforcement at database level</li>
              <li>✅ Additional family_id verification (belt-and-suspenders)</li>
              <li>✅ Privacy check for private events</li>
              <li>✅ Archived events are excluded</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Usage Example</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
{`import { useEvent } from '@/hooks/useEvents';

function MyComponent() {
  const { event, isLoading, error, errorCode } = useEvent(eventId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!event) return <div>Event not found</div>;

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <div>Creator: {event.created_by_name}</div>
      <div>Participants: {event.participants.length}</div>
    </div>
  );
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


