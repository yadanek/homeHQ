/**
 * EditEventForm Component
 * 
 * Form component for editing existing events with validation and error handling.
 * 
 * Features:
 * - Pre-populated form fields with current event data
 * - Participant selection from family members
 * - Date/time validation
 * - Loading states
 * - Error handling
 * - Cancel functionality
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { updateEvent } from '@/actions/updateEvent';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { EventDetailsResponse, UpdateEventRequest } from '@/types';

interface EditEventFormProps {
  event: EventDetailsResponse;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Form component for editing events
 */
export function EditEventForm({ event, onSuccess, onCancel }: EditEventFormProps) {
  const { members, isLoading: loadingMembers } = useFamilyMembers();
  
  // Form state - initialized with current event values
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [startTime, setStartTime] = useState(
    format(new Date(event.start_time), "yyyy-MM-dd'T'HH:mm")
  );
  const [endTime, setEndTime] = useState(
    format(new Date(event.end_time), "yyyy-MM-dd'T'HH:mm")
  );
  const [isPrivate, setIsPrivate] = useState(event.is_private);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    event.participants.map(p => p.member_id || p.profile_id).filter(Boolean) as string[]
  );
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate form
  const validateForm = (): boolean => {
    // Check title
    if (!title.trim()) {
      setValidationError('Title is required');
      return false;
    }

    // Check dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime())) {
      setValidationError('Invalid start time');
      return false;
    }
    
    if (isNaN(end.getTime())) {
      setValidationError('Invalid end time');
      return false;
    }
    
    if (end <= start) {
      setValidationError('End time must be after start time');
      return false;
    }

    setValidationError(null);
    return true;
  };

  // Clear validation error when inputs change
  useEffect(() => {
    if (validationError) {
      setValidationError(null);
    }
  }, [title, startTime, endTime, isPrivate, selectedParticipants, validationError]);

  // Auto-clear participants when event becomes private
  useEffect(() => {
    if (isPrivate && selectedParticipants.length > 0) {
      setSelectedParticipants([]);
    }
  }, [isPrivate, selectedParticipants.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Build update request - only include changed fields
      const updateData: UpdateEventRequest = {};
      
      if (title.trim() !== event.title) {
        updateData.title = title.trim();
      }
      
      const newDescription = description.trim();
      if (newDescription !== (event.description || '')) {
        updateData.description = newDescription || undefined;
      }
      
      const newStartTime = new Date(startTime).toISOString();
      if (newStartTime !== event.start_time) {
        updateData.start_time = newStartTime;
      }
      
      const newEndTime = new Date(endTime).toISOString();
      if (newEndTime !== event.end_time) {
        updateData.end_time = newEndTime;
      }
      
      if (isPrivate !== event.is_private) {
        updateData.is_private = isPrivate;
      }
      
      // Check if participants changed
      const currentParticipantIds = event.participants
        .map(p => p.member_id || p.profile_id)
        .filter(Boolean) as string[];
      
      const participantsChanged = 
        selectedParticipants.length !== currentParticipantIds.length ||
        !selectedParticipants.every(id => currentParticipantIds.includes(id));
      
      if (participantsChanged) {
        updateData.participant_ids = selectedParticipants;
      }

      // If nothing changed, just close
      if (Object.keys(updateData).length === 0) {
        onCancel?.();
        return;
      }

      // Call update action
      const result = await updateEvent(event.id, updateData);

      if (!result.success) {
        setError(result.error.error.message);
        return;
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <h2 className="text-2xl font-bold mb-6">Edit Event</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="edit-title">Event Title *</Label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 mt-1"
              placeholder="e.g., Doctor appointment"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 mt-1"
              placeholder="Add details about the event..."
            />
          </div>

          {/* Start Time */}
          <div>
            <Label htmlFor="edit-startTime">Start Time *</Label>
            <input
              id="edit-startTime"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 mt-1"
            />
          </div>

          {/* End Time */}
          <div>
            <Label htmlFor="edit-endTime">End Time *</Label>
            <input
              id="edit-endTime"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 mt-1"
            />
          </div>

          {/* Private Checkbox */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-isPrivate"
                checked={isPrivate}
                onCheckedChange={(checked) => setIsPrivate(checked === true)}
              />
              <Label htmlFor="edit-isPrivate" className="cursor-pointer">
                Make this event private (visible only to you)
              </Label>
            </div>
            {isPrivate && event.participants.length > 0 && (
              <p className="text-xs text-amber-600 ml-6">
                Note: Making this event private will remove all participants
              </p>
            )}
          </div>

          {/* Participants */}
          {!isPrivate && members.length > 0 && (
            <div>
              <Label className="mb-3 block">Participants</Label>
              {loadingMembers ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading family members...</span>
                </div>
              ) : (
                <div className="space-y-2 border rounded-md p-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`participant-${member.id}`}
                        checked={selectedParticipants.includes(member.id)}
                        onCheckedChange={() => toggleParticipant(member.id)}
                      />
                      <Label
                        htmlFor={`participant-${member.id}`}
                        className="cursor-pointer flex items-center gap-2"
                      >
                        <span aria-hidden="true">
                          {member.is_admin ? '👤' : '👶'}
                        </span>
                        {member.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">{validationError}</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
