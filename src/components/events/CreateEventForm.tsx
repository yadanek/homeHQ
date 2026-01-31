/**
 * CreateEventForm Component
 * 
 * Example form component demonstrating how to use useCreateEvent hook
 * for creating events with AI-generated task suggestions.
 * 
 * Features:
 * - Form validation
 * - AI suggestion preview and selection
 * - Loading states
 * - Error handling
 * - Success feedback
 */

import { useState, useEffect } from 'react';
import { useCreateEvent } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { CreateEventRequest, TaskSuggestion } from '@/types';

interface CreateEventFormProps {
  onSuccess?: (eventId: string) => void;
  onCancel?: () => void;
}

/**
 * Form component for creating events
 * 
 * @example
 * ```tsx
 * <CreateEventForm
 *   onSuccess={(eventId) => navigate(`/events/${eventId}`)}
 *   onCancel={() => navigate('/calendar')}
 * />
 * ```
 */
export function CreateEventForm({ onSuccess, onCancel }: CreateEventFormProps) {
  const { createEvent, isLoading, error, data } = useCreateEvent();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>([]);

  // Handle successful event creation
  useEffect(() => {
    if (data?.event) {
      onSuccess?.(data.event.id);
    }
  }, [data, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const request: CreateEventRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      is_private: isPrivate,
      accept_suggestions: acceptedSuggestions.length > 0 ? acceptedSuggestions as any : undefined
    };

    await createEvent(request);
  };

  const toggleSuggestion = (suggestionId: string) => {
    setAcceptedSuggestions(prev =>
      prev.includes(suggestionId)
        ? prev.filter(id => id !== suggestionId)
        : [...prev, suggestionId]
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Create New Event</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Event Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Doctor appointment, Birthday party"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Add details about the event..."
            />
          </div>

          {/* Start Time */}
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium mb-2">
              Start Time *
            </label>
            <input
              id="startTime"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium mb-2">
              End Time *
            </label>
            <input
              id="endTime"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Private Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPrivate"
              checked={isPrivate}
              onCheckedChange={(checked) => setIsPrivate(checked === true)}
            />
            <label htmlFor="isPrivate" className="text-sm font-medium cursor-pointer">
              Make this event private (visible only to you)
            </label>
          </div>

          {/* AI Suggestions Preview */}
          {data?.suggestions && data.suggestions.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">
                🤖 AI Task Suggestions
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Based on your event, we suggest these tasks:
              </p>
              <div className="space-y-3">
                {data.suggestions.map((suggestion: TaskSuggestion) => (
                  <div
                    key={suggestion.suggestion_id}
                    className="flex items-start space-x-3 p-3 bg-gray-50 rounded-md"
                  >
                    <Checkbox
                      id={`suggestion-${suggestion.suggestion_id}`}
                      checked={acceptedSuggestions.includes(suggestion.suggestion_id)}
                      onCheckedChange={() => toggleSuggestion(suggestion.suggestion_id)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`suggestion-${suggestion.suggestion_id}`}
                        className="font-medium cursor-pointer"
                      >
                        {suggestion.title}
                      </label>
                      {suggestion.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {suggestion.description}
                        </p>
                      )}
                      {suggestion.due_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Due: {new Date(suggestion.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800 font-medium">
                {error.error.message}
              </p>
              {error.error.details && (
                <pre className="text-xs text-red-600 mt-2 overflow-auto">
                  {JSON.stringify(error.error.details, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Success Display */}
          {data?.event && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800 font-medium">
                ✅ Event created successfully!
              </p>
              {data.created_tasks.length > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  {data.created_tasks.length} task(s) created from suggestions
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}


