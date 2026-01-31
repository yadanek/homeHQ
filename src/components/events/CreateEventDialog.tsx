/**
 * CreateEventDialog - Modal do tworzenia nowych wydarzeń
 * 
 * Wyświetla formularz tworzenia wydarzenia w dialogu.
 * Po utworzeniu wydarzenia automatycznie odświeża kalendarz.
 */

import { useState, useEffect, useCallback } from 'react';
import { useCreateEvent } from '@/hooks/useEvents';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AssigneePicker } from '@/components/family/AssigneePicker';
import type { CreateEventRequest, TaskSuggestion, SuggestionId, ProfileSummary } from '@/types';
import { X, Sparkles } from 'lucide-react';
import { DEV_MODE, MOCK_USER } from '@/lib/mockAuth';
import { createClient } from '@/db/supabase.client';

interface CreateEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultDate?: Date;
}

/**
 * Dialog component for creating events with AI suggestions
 */
export function CreateEventDialog({ 
  isOpen, 
  onClose, 
  onSuccess,
  defaultDate 
}: CreateEventDialogProps) {
  const { createEvent, isLoading, error, data, reset } = useCreateEvent();
  const { members } = useFamilyMembers();
  const { profile } = useAuth();
  
  // Debug: Log members when they change
  useEffect(() => {
    console.log('👨‍👩‍👧‍👦 CreateEventDialog - members loaded:', {
      membersCount: members?.length || 0,
      members: members
    });
  }, [members]);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(
    defaultDate 
      ? new Date(defaultDate).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [endTime, setEndTime] = useState(
    defaultDate 
      ? new Date(new Date(defaultDate).getTime() + 3600000).toISOString().slice(0, 16)
      : new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>([]);
  const [previewSuggestions, setPreviewSuggestions] = useState<TaskSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);

  // Load family profiles on mount
  useEffect(() => {
    const loadProfiles = async () => {
      if (!profile?.family_id) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, role, created_at')
          .eq('family_id', profile.family_id)
          .order('display_name');

        if (!error && data) {
          setProfiles(data);
        }
      } catch (err) {
        console.error('Failed to load family profiles:', err);
      }
    };

    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen, profile?.family_id]);

  // Pobierz AI suggestions gdy użytkownik wpisze tytuł
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!title.trim() || title.trim().length < 3) {
        setPreviewSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      
      try {
        const supabase = createClient();
        
        // In DEV mode, ensure we're signed in
        if (DEV_MODE) {
          console.log('[CreateEventDialog] DEV_MODE: Attempting sign-in with:', MOCK_USER.email);
          
          const signInResult = await supabase.auth.signInWithPassword({
            email: MOCK_USER.email,
            password: MOCK_USER.password,
          });
          
          console.log('[CreateEventDialog] DEV_MODE: Sign-in result:', {
            user: signInResult.data?.user?.id,
            session: signInResult.data?.session?.access_token ? 'Token exists' : 'No token',
            error: signInResult.error
          });
          
          if (signInResult.error) {
            console.error('[CreateEventDialog] DEV_MODE sign-in failed:', signInResult.error);
            setIsLoadingSuggestions(false);
            return;
          }
          
          console.log('[CreateEventDialog] DEV_MODE: Sign-in successful! Token:', 
            signInResult.data.session?.access_token?.substring(0, 50) + '...');
        }
        
        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.warn('[CreateEventDialog] User not authenticated, skipping AI suggestions. Error:', authError);
          setIsLoadingSuggestions(false);
          return;
        }
        
        console.log('[CreateEventDialog] User authenticated:', user.id);
        
        // Get current session to verify token
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('[CreateEventDialog] Current session:', {
          hasToken: !!sessionData.session?.access_token,
          tokenPreview: sessionData.session?.access_token?.substring(0, 50) + '...'
        });
        
        console.log('[CreateEventDialog] Invoking Edge Function with body:', {
          title: title.trim(),
          start_time: new Date(startTime).toISOString(),
          participant_ids: selectedParticipantIds,
          member_ids: selectedMemberIds,
          user_role: profile?.role || 'admin'
        });
        
        // Check what Authorization header will be sent
        const currentSession = await supabase.auth.getSession();
        console.log('[CreateEventDialog] Authorization header that will be sent:', 
          currentSession.data.session?.access_token ? 
            `Bearer ${currentSession.data.session.access_token.substring(0, 50)}...` : 
            'NO TOKEN'
        );
        
        const { data, error } = await supabase.functions.invoke(
          'analyze-event-for-suggestions',
          {
            body: {
              title: title.trim(),
              start_time: new Date(startTime).toISOString(),
              participant_ids: selectedParticipantIds,
              member_ids: selectedMemberIds,
              user_role: profile?.role || 'admin'
            }
          }
        );

        if (!error && data?.suggestions) {
          setPreviewSuggestions(data.suggestions);
        } else if (error) {
          console.error('[CreateEventDialog] AI suggestions error:', error);
        }
      } catch (err) {
        console.error('[CreateEventDialog] Failed to fetch suggestions:', err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    // Debounce - czekaj 500ms po przestaniu pisać
    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [title, startTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const request: CreateEventRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      is_private: isPrivate,
      participant_ids: selectedParticipantIds.length > 0 ? selectedParticipantIds : undefined,
      member_ids: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      accept_suggestions: acceptedSuggestions.length > 0 ? acceptedSuggestions as SuggestionId[] : undefined
    };

    console.log('🎯 CreateEventDialog - Submitting request:', {
      title: request.title,
      participant_ids: request.participant_ids,
      member_ids: request.member_ids,
      selectedMemberIds: selectedMemberIds,
      selectedMemberIdsLength: selectedMemberIds.length,
      members: members,
      membersLength: members?.length || 0
    });

    const result = await createEvent(request);
    
    if (result.success) {
      // First, trigger refresh (this will update the events list)
      // Wait for it to complete before closing
      if (onSuccess) {
        await Promise.resolve(onSuccess());
      }
      
      // Close dialog after short delay to show success message
      setTimeout(() => {
        handleClose();
      }, 800);
    }
  };

  const handleClose = useCallback(() => {
    reset();
    setTitle('');
    setDescription('');
    setSelectedParticipantIds([]);
    setSelectedMemberIds([]);
    setAcceptedSuggestions([]);
    setPreviewSuggestions([]);
    onClose();
  }, [reset, onClose]);

  const toggleSuggestion = (suggestionId: string) => {
    setAcceptedSuggestions(prev =>
      prev.includes(suggestionId)
        ? prev.filter(id => id !== suggestionId)
        : [...prev, suggestionId]
    );
  };

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, handleClose]);

  if (!isOpen) return null;

  return (
    <div 
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <Card 
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 id="dialog-title" className="text-2xl font-bold">Create New Event</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

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
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
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
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                placeholder="Add details about the event..."
              />
            </div>

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

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
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
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

            {/* Participants Section */}
            <div className="space-y-3 border-t pt-6">
              <Label className="text-base font-medium">Participants (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Select who will attend this event. This helps AI suggest relevant tasks.
              </p>
              
              {/* Family Accounts */}
              <AssigneePicker
                label="Family Accounts"
                options={profiles}
                selectionMode="multiple"
                value={selectedParticipantIds}
                onChange={setSelectedParticipantIds}
                currentUserId={profile?.id}
                showRole
              />
              
              {/* Family Members (without accounts) */}
              {members && members.length > 0 && (
                <div className="space-y-2 mt-3">
                  <div className="text-sm font-medium text-foreground">
                    Family Members ({members.length} available)
                  </div>
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
                        onCheckedChange={(checked) => {
                          console.log('📋 Member checkbox changed:', {
                            memberId: member.id,
                            memberName: member.name,
                            checked: checked,
                            currentSelectedMemberIds: selectedMemberIds
                          });
                          
                          if (checked) {
                            const newIds = [...selectedMemberIds, member.id];
                            setSelectedMemberIds(newIds);
                            console.log('✅ Member added, new selectedMemberIds:', newIds);
                          } else {
                            const newIds = selectedMemberIds.filter(id => id !== member.id);
                            setSelectedMemberIds(newIds);
                            console.log('❌ Member removed, new selectedMemberIds:', newIds);
                          }
                        }}
                      />
                      <span className="text-2xl" aria-hidden="true">
                        {member.is_admin ? '👤' : '👶'}
                      </span>
                      <span className="flex-1">
                        {member.name}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({member.is_admin ? 'Adult' : 'Child'})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              
              {/* Empty state */}
              {(!profiles || profiles.length === 0) && (!members || members.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-md">
                  No family members yet. You can add them in Family Hub.
                </div>
              )}
            </div>

            {/* AI Suggestions Preview */}
            {(previewSuggestions.length > 0 || isLoadingSuggestions) && (
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h3 className="text-lg font-semibold">
                    AI Task Suggestions
                  </h3>
                </div>
                
                {isLoadingSuggestions ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Analyzing event...
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Based on your event, we suggest these tasks:
                    </p>
                    <div className="space-y-3">
                      {previewSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.suggestion_id}
                          className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800"
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
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                  </>
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-400 font-medium">
                  {error.error.message}
                </p>
              </div>
            )}

            {/* Success Display */}
            {data?.event && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-800 dark:text-green-400 font-medium">
                  ✅ Event created successfully!
                </p>
                {data.created_tasks.length > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {data.created_tasks.length} task(s) created from suggestions
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6">
              {!data?.event ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Event'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      reset();
                      setTitle('');
                      setDescription('');
                      setAcceptedSuggestions([]);
                      setPreviewSuggestions([]);
                    }}
                  >
                    Create Another
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClose}
                  >
                    Close
                  </Button>
                </>
              )}
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

