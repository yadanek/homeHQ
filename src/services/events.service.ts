/**
 * Events Service Layer
 * 
 * Provides business logic for managing calendar events.
 * Handles all database operations for events with proper RLS enforcement.
 */

import type { SupabaseClient } from '@/db/supabase.client';
import type {
  GetEventsQueryParams,
  ListEventsResponse,
  EventWithCreator,
  EventDetailsResponse,
  EventParticipant,
  PaginationMeta,
  CreateEventRequest,
  CreateEventResponse,
  EventWithParticipants,
  TaskSuggestion,
  TaskResponse,
  SuggestionId,
  UserRole,
  UpdateEventRequest,
  UpdateEventResponse
} from '@/types';
import { isUUID } from '@/types';
import { ServiceError } from '@/lib/utils/api-errors';

/**
 * Events Service class
 * 
 * Encapsulates all event-related business logic and database operations.
 * Uses Supabase client for database access with automatic RLS enforcement.
 */
export class EventsService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Retrieves a paginated list of events for the authenticated user's family
   * 
   * Automatically filters events based on RLS policies:
   * - Shared events visible to all family members
   * - Private events visible only to creator
   */
  async listEvents(
    params: GetEventsQueryParams,
    _userId: string,
    _familyId: string
  ): Promise<ListEventsResponse> {
    // Build base query with all necessary joins
    // Note: RLS policies automatically filter by family_id and privacy settings
    let query = this.supabase
      .from('events')
      .select(`
        id,
        created_by,
        family_id,
        title,
        description,
        start_time,
        end_time,
        is_private,
        created_at,
        updated_at,
        archived_at,
        created_by_profile:profiles!events_created_by_fkey(display_name),
        event_participants(
          id,
          event_id,
          profile_id,
          member_id,
          created_at,
          profile:profiles(id, display_name),
          member:family_members(id, name, is_admin)
        )
      `, { count: 'exact' })
      .is('archived_at', null)
      .order('start_time', { ascending: true });

    // Apply date range filters
    if (params.start_date) {
      query = query.gte('start_time', params.start_date);
    }

    if (params.end_date) {
      query = query.lte('end_time', params.end_date);
    }

    // Apply privacy filter
    if (params.is_private !== undefined) {
      query = query.eq('is_private', params.is_private);
    }

    // Handle participant filter (requires special handling)
    // First, get event IDs that have the specified participant
    if (params.participant_id) {
      const { data: participantEvents, error: participantError } = await this.supabase
        .from('event_participants')
        .select('event_id')
        .eq('profile_id', params.participant_id);

      if (participantError) {
        throw new Error(`Failed to fetch participant events: ${participantError.message}`);
      }

      if (participantEvents && participantEvents.length > 0) {
        const eventIds = participantEvents.map(ep => ep.event_id);
        query = query.in('id', eventIds);
      } else {
        // No events for this participant - return empty result
        return {
          events: [],
          pagination: {
            total: 0,
            limit: params.limit ?? 100,
            offset: params.offset ?? 0,
            has_more: false
          }
        };
      }
    }

    // Apply pagination
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    
    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1
    );

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    // Transform data to match EventWithCreator interface
    const events: EventWithCreator[] = (data || []).map(event => {
      // Extract participants from nested join (both profiles and members)
      const participants: EventParticipant[] = (event.event_participants || []).map((ep: any) => ({
        id: ep.id,
        event_id: ep.event_id,
        profile_id: ep.profile_id,
        member_id: ep.member_id,
        created_at: ep.created_at,
        profile: ep.profile,
        member: ep.member
      }));

      // Get creator name with fallback
      const createdByName = Array.isArray(event.created_by_profile)
        ? event.created_by_profile[0]?.display_name || 'Unknown'
        : event.created_by_profile?.display_name || 'Unknown';

      return {
        id: event.id,
        created_by: event.created_by,
        created_by_name: createdByName,
        family_id: event.family_id,
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        is_private: event.is_private,
        created_at: event.created_at,
        updated_at: event.updated_at,
        archived_at: event.archived_at,
        participants
      };
    });

    // Create pagination metadata
    const total = count || 0;
    const pagination: PaginationMeta = {
      total,
      limit,
      offset,
      has_more: total > offset + limit
    };

    return { events, pagination };
  }

  /**
   * Retrieves a single event by ID with enhanced security checks
   * 
   * Implements defense-in-depth approach:
   * 1. Validates UUID format (fail-fast)
   * 2. RLS policies automatically filter by family_id
   * 3. Additional application-level checks for family_id and privacy
   * 
   * RLS policies ensure the user can only access:
   * - Events in their family
   * - Shared events or their own private events
   * 
   * @param eventId - Event UUID
   * @param userId - ID of the requesting user (for privacy check)
   * @param familyId - ID of the user's family (for access control)
   * @returns Promise resolving to EventDetailsResponse
   * @throws {ServiceError} 400 if eventId is not a valid UUID
   * @throws {ServiceError} 404 if event not found or archived
   * @throws {ServiceError} 403 if user doesn't have access (different family or private event)
   * @throws {Error} If unexpected database error occurs
   * 
   * @example
   * ```typescript
   * const event = await eventsService.getEventById(eventId, userId, familyId);
   * console.log(event.title, event.participants);
   * ```
   */
  async getEventById(
    eventId: string,
    userId: string,
    familyId: string
  ): Promise<EventDetailsResponse> {
    // Step 1: Validate UUID format (fail-fast)
    if (!isUUID(eventId)) {
      console.warn(`Invalid event ID format: ${eventId}`);
      throw new ServiceError(
        400,
        'INVALID_EVENT_ID',
        'Event ID must be a valid UUID',
        { eventId }
      );
    }

    // Step 2: Query event with creator and participants (both profiles and members)
    // Note: RLS policies automatically filter by family_id and privacy settings
    const { data, error } = await this.supabase
      .from('events')
      .select(`
        id,
        created_by,
        family_id,
        title,
        description,
        start_time,
        end_time,
        is_private,
        created_at,
        updated_at,
        archived_at,
        created_by_profile:profiles!events_created_by_fkey(display_name),
        event_participants(
          id,
          event_id,
          profile_id,
          member_id,
          created_at,
          profile:profiles(id, display_name),
          member:family_members(id, name, is_admin)
        )
      `)
      .eq('id', eventId)
      .is('archived_at', null)
      .single();

    // Step 3: Handle not found or RLS filtered
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found or no access due to RLS
        console.info(`Event not found or inaccessible: ${eventId}`, { userId, familyId });
        throw new ServiceError(
          404,
          'EVENT_NOT_FOUND',
          'Event not found or has been archived'
        );
      }
      // Unexpected database error
      console.error(`Database error fetching event ${eventId}:`, error);
      throw new Error(`Failed to fetch event: ${error.message}`);
    }

    if (!data) {
      console.info(`Event not found: ${eventId}`);
      throw new ServiceError(
        404,
        'EVENT_NOT_FOUND',
        'Event not found or has been archived'
      );
    }

    // Step 4: Additional family_id check (belt-and-suspenders approach)
    // RLS should already filter this, but we double-check for security
    if (data.family_id !== familyId) {
      console.warn(
        `Family mismatch: User ${userId} (family ${familyId}) ` +
        `tried to access event ${eventId} from family ${data.family_id}`
      );
      throw new ServiceError(
        403,
        'FORBIDDEN',
        'You do not have permission to access this event',
        { reason: 'Event belongs to a different family' }
      );
    }

    // Step 5: Additional privacy check (belt-and-suspenders approach)
    // RLS should already filter this, but we double-check for security
    if (data.is_private && data.created_by !== userId) {
      console.warn(
        `Privacy violation: User ${userId} tried to access private event ${eventId} ` +
        `created by ${data.created_by}`
      );
      throw new ServiceError(
        403,
        'FORBIDDEN',
        'You do not have permission to access this event',
        { reason: 'Event is private and you are not the creator' }
      );
    }

    // Step 6: Transform data to EventDetailsResponse format
    // Include both profile and member participants
    console.log('🔍 Raw event data from DB:', {
      event_id: data.id,
      title: data.title,
      event_participants_raw: data.event_participants
    });

    const participants: EventParticipant[] = (data.event_participants || []).map((ep: any) => {
      console.log('👥 Processing participant:', {
        id: ep.id,
        profile_id: ep.profile_id,
        member_id: ep.member_id,
        profile: ep.profile,
        member: ep.member
      });
      
      return {
        id: ep.id,
        event_id: ep.event_id,
        profile_id: ep.profile_id,
        member_id: ep.member_id,
        created_at: ep.created_at,
        profile: ep.profile,
        member: ep.member
      };
    });

    console.log('✅ Transformed participants:', participants);

    const createdByName = Array.isArray(data.created_by_profile)
      ? data.created_by_profile[0]?.display_name || 'Unknown'
      : data.created_by_profile?.display_name || 'Unknown';

    const response: EventDetailsResponse = {
      id: data.id,
      created_by: data.created_by,
      created_by_name: createdByName,
      family_id: data.family_id,
      title: data.title,
      description: data.description,
      start_time: data.start_time,
      end_time: data.end_time,
      is_private: data.is_private,
      created_at: data.created_at,
      updated_at: data.updated_at,
      archived_at: data.archived_at,
      participants
    };

    console.info(`Event ${eventId} fetched successfully by user ${userId}`);
    return response;
  }

  /**
   * Creates a new event with AI-generated task suggestions
   * 
   * This is the core feature of HomeHQ - creates an event and automatically
   * generates logistical task suggestions based on AI analysis of the event title.
   * 
   * Process flow:
   * 1. Call AI suggestion engine (Edge Function)
   * 2. Create event record
   * 3. Add participants (if any)
   * 4. Create tasks from accepted suggestions
   * 5. Return complete event with suggestions and created tasks
   * 
   * Transaction handling:
   * - If any step fails after event creation, the event is deleted (rollback)
   * - AI engine failure is handled gracefully (event still created)
   * 
   * @param request - Event creation request with optional accepted suggestions
   * @param userId - ID of the user creating the event
   * @param familyId - ID of the user's family
   * @param userRole - Role of the user (affects AI suggestions)
   * @returns Promise resolving to CreateEventResponse
   * @throws {ServiceError} If validation fails or database operation fails
   * 
   * @example
   * ```typescript
   * const response = await eventsService.createEventWithSuggestions({
   *   title: "Doctor appointment",
   *   start_time: "2026-02-01T10:00:00Z",
   *   end_time: "2026-02-01T11:00:00Z",
   *   is_private: false,
   *   accept_suggestions: ['health']
   * }, userId, familyId, 'admin');
   * ```
   */
  async createEventWithSuggestions(
    request: CreateEventRequest,
    userId: string,
    familyId: string,
    userRole: UserRole
  ): Promise<CreateEventResponse> {
    console.info(`Creating event for user ${userId} in family ${familyId}`);

    // Step 1: Call AI suggestion engine (graceful degradation on failure)
    const suggestions = await this.getAISuggestions(
      request.title,
      request.start_time,
      request.participant_ids,
      userRole
    );

    // Step 2: Create event record
    const { data: event, error: eventError } = await this.supabase
      .from('events')
      .insert({
        family_id: familyId,
        created_by: userId,
        title: request.title,
        description: request.description,
        start_time: request.start_time,
        end_time: request.end_time,
        is_private: request.is_private
      })
      .select()
      .single();

    if (eventError) {
      console.error('Failed to create event:', eventError);
      throw new ServiceError(
        500,
        'EVENT_CREATION_FAILED',
        'Failed to create event. Please try again.',
        { error: eventError.message }
      );
    }

    if (!event) {
      throw new ServiceError(
        500,
        'EVENT_CREATION_FAILED',
        'Event was not created'
      );
    }

    try {
      // Step 3: Add participants (profiles and members)
      await this.addParticipants(
        event.id,
        request.participant_ids || [],
        request.member_ids || []
      );

      // Step 4: Create tasks from accepted suggestions
      const createdTasks: TaskResponse[] = [];
      if (request.accept_suggestions && request.accept_suggestions.length > 0) {
        const acceptedSuggestions = suggestions.filter(s =>
          request.accept_suggestions!.includes(s.suggestion_id as SuggestionId)
        );

        for (const suggestion of acceptedSuggestions) {
          const task = await this.createTaskFromSuggestion(
            suggestion,
            event.id,
            familyId,
            userId,
            request.is_private ?? false
          );
          createdTasks.push(task);
        }
      }

      // Step 5: Fetch complete event with participants
      const eventWithParticipants = await this.getEventWithParticipants(event.id);

      // Step 6: Mark accepted suggestions
      const suggestionsWithAccepted = suggestions.map(s => ({
        ...s,
        accepted: request.accept_suggestions?.includes(s.suggestion_id as SuggestionId) || false
      }));

      console.info(
        `Event ${event.id} created successfully with ${createdTasks.length} tasks`
      );

      return {
        event: eventWithParticipants,
        suggestions: suggestionsWithAccepted,
        created_tasks: createdTasks
      };
    } catch (error) {
      // Rollback: delete event (cascade will clean participants and tasks)
      console.error('Error during event creation, rolling back:', error);
      await this.supabase.from('events').delete().eq('id', event.id);
      throw error;
    }
  }

  /**
   * Calls AI suggestion engine to analyze event title
   * 
   * Uses Supabase Edge Function to generate task suggestions.
   * Implements graceful degradation - returns empty array on failure.
   * 
   * @private
   */
  private async getAISuggestions(
    title: string,
    start_time: string,
    participant_ids?: string[],
    user_role?: UserRole
  ): Promise<TaskSuggestion[]> {
    try {
      // Add timeout to prevent hanging requests (5 seconds max)
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('AI suggestions timeout')), 5000);
      });

      const invokePromise = this.supabase.functions.invoke(
        'analyze-event-for-suggestions',
        {
          body: {
            title,
            start_time,
            participant_ids,
            user_role
          }
        }
      );

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;

      if (error) {
        console.warn('AI suggestion engine error (graceful degradation):', error);
        return [];
      }

      return data?.suggestions || [];
    } catch (error) {
      console.warn('AI suggestion engine failed (graceful degradation):', error);
      return [];
    }
  }

  /**
   * Adds participants to an event
   * 
   * Performs bulk insert of event_participants records.
   * Database trigger validates that all participants belong to same family.
   * 
   * @private
   */
  /**
   * Add participants (profiles and members) to an event
   * Uses bulk insert for performance
   * 
   * @private
   */
  private async addParticipants(
    eventId: string,
    participantIds: string[] = [],
    memberIds: string[] = []
  ): Promise<void> {
    console.log('🔧 EventsService.addParticipants called:', {
      eventId,
      participantIds,
      memberIds,
      participantCount: participantIds.length,
      memberCount: memberIds.length
    });

    if (participantIds.length === 0 && memberIds.length === 0) {
      console.log('⚠️ No participants to add - skipping');
      return; // No participants to add
    }

    // Insert profile participants
    if (participantIds.length > 0) {
      console.log('➕ Adding profile participants:', participantIds);
      const { error: profileError } = await this.supabase
        .from('event_participants')
        .insert(
          participantIds.map(profileId => ({
            event_id: eventId,
            profile_id: profileId
          }))
        );

      if (profileError) {
        // Check if error is due to cross-family participant
        if (profileError.message.includes('same family')) {
          throw new ServiceError(
            403,
            'FORBIDDEN',
            'Cannot add participants from other families',
            { error: profileError.message }
          );
        }
        throw new ServiceError(
          500,
          'PARTICIPANT_INSERT_FAILED',
          'Failed to add profile participants to event',
          { error: profileError.message }
        );
      }
    }

    // Insert member participants
    if (memberIds.length > 0) {
      console.log('➕ Adding member participants:', memberIds);
      
      const insertData = memberIds.map(memberId => ({
        event_id: eventId,
        member_id: memberId
      }));
      
      console.log('📦 Insert data:', insertData);
      
      const { data, error: memberError } = await this.supabase
        .from('event_participants')
        .insert(insertData as any) // Type assertion needed due to Supabase generated types
        .select();

      if (memberError) {
        console.error('❌ Failed to add member participants:', memberError);
        throw new ServiceError(
          500,
          'PARTICIPANT_INSERT_FAILED',
          'Failed to add member participants to event',
          { error: memberError.message }
        );
      }
      
      console.log('✅ Member participants added successfully:', data);
    }
  }

  /**
   * Creates a task from an AI suggestion
   * 
   * Links the task to the event and marks it as created from suggestion
   * for analytics tracking (US-006 metric).
   * 
   * @private
   */
  private async createTaskFromSuggestion(
    suggestion: TaskSuggestion,
    eventId: string,
    familyId: string,
    createdBy: string,
    isPrivate: boolean
  ): Promise<TaskResponse> {
    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        family_id: familyId,
        created_by: createdBy,
        title: suggestion.title,
        due_date: suggestion.due_date,
        is_private: isPrivate,
        event_id: eventId,
        suggestion_id: suggestion.suggestion_id,
        created_from_suggestion: true,
        assigned_to: null,
        is_completed: false
      })
      .select()
      .single();

    if (error) {
      throw new ServiceError(
        500,
        'TASK_CREATION_FAILED',
        'Failed to create task from suggestion',
        { error: error.message }
      );
    }

    if (!data) {
      throw new ServiceError(
        500,
        'TASK_CREATION_FAILED',
        'Task was not created'
      );
    }

    return data;
  }

  /**
   * Retrieves event with all participants
   * 
   * Performs optimized query to fetch event and participants in single request.
   * 
   * @private
   */
  /**
   * Retrieves event with all participants (profiles and members)
   * 
   * Performs optimized query to fetch event and participants in single request.
   * Includes both profiles (users with accounts) and members (e.g., children without accounts).
   * 
   * @private
   */
  private async getEventWithParticipants(
    eventId: string
  ): Promise<EventWithParticipants> {
    const { data, error } = await this.supabase
      .from('events')
      .select(`
        *,
        event_participants(
          id,
          event_id,
          profile_id,
          member_id,
          created_at,
          profile:profiles(id, display_name),
          member:family_members(id, name, is_admin)
        )
      `)
      .eq('id', eventId)
      .single();

    if (error) {
      throw new ServiceError(
        500,
        'EVENT_FETCH_FAILED',
        'Failed to fetch event details',
        { error: error.message }
      );
    }

    if (!data) {
      throw new ServiceError(
        404,
        'EVENT_NOT_FOUND',
        'Event not found'
      );
    }

    // Transform nested structure to EventWithParticipants
    // Combine both profile and member participants
    const participants: EventParticipant[] = (data.event_participants || []).map((ep: any) => ({
      id: ep.id,
      event_id: ep.event_id,
      profile_id: ep.profile_id,
      member_id: ep.member_id,
      created_at: ep.created_at,
      profile: ep.profile,
      member: ep.member
    }));

    return {
      id: data.id,
      family_id: data.family_id,
      created_by: data.created_by,
      title: data.title,
      description: data.description,
      start_time: data.start_time,
      end_time: data.end_time,
      is_private: data.is_private,
      created_at: data.created_at,
      updated_at: data.updated_at,
      archived_at: data.archived_at,
      participants
    };
  }

  /**
   * Validates that all participant IDs belong to the specified family
   * 
   * Performs database query to check family membership for all provided participant IDs.
   * Returns array of invalid IDs (those not in the family or not found).
   * 
   * @param participantIds - Array of profile UUIDs to validate
   * @param familyId - Family UUID to check against
   * @returns Promise resolving to array of invalid participant IDs (empty if all valid)
   * @throws Error if database query fails
   * 
   * @example
   * ```typescript
   * const invalidIds = await eventsService.validateParticipantsInFamily(
   *   ['uuid1', 'uuid2'], 
   *   'family-uuid'
   * );
   * if (invalidIds.length > 0) {
   *   throw new Error('Some participants are not in family');
   * }
   * ```
   */
  async validateParticipantsInFamily(
    participantIds: string[],
    familyId: string
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('family_id', familyId)
      .in('id', participantIds);

    if (error) {
      console.error('Error validating participants:', error);
      throw new Error(`Failed to validate participants: ${error.message}`);
    }

    const validIds = (data || []).map(p => p.id);
    const invalidIds = participantIds.filter(id => !validIds.includes(id));
    
    return invalidIds;
  }

  /**
   * Gets user's family_id from their profile
   * 
   * Required for participant validation and access control checks.
   * 
   * @param userId - UUID of user
   * @returns Promise resolving to family_id or null if not found
   * @throws Error if database query fails
   */
  async getUserFamilyId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user family ID:', error);
      throw new Error(`Failed to fetch user family ID: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return data.family_id;
  }

  /**
   * Updates an existing event with partial data
   * 
   * Authorization: Only event creator can update (enforced by RLS)
   * 
   * Process flow:
   * 1. Validate UUID format
   * 2. Validate participants belong to family (if provided)
   * 3. Validate time range if only one time field is updated
   * 4. Extract participant_ids from update data (handled separately)
   * 5. Update event fields (RLS enforces created_by = auth.uid())
   * 6. Trigger automatically updates updated_at timestamp
   * 7. Trigger automatically cleans participants if is_private = true
   * 8. Update participants if provided
   * 9. Fetch and return updated event with participants
   * 
   * @param eventId - UUID of event to update
   * @param updateData - Partial event data to update
   * @param userId - ID of authenticated user (for logging)
   * @param familyId - Family ID from JWT (for participant validation)
   * @returns Promise resolving to UpdateEventResponse
   * @throws ServiceError with appropriate status code and message
   * 
   * @example
   * ```typescript
   * const updated = await eventsService.updateEvent(
   *   eventId, 
   *   { title: 'New Title', is_private: false },
   *   userId,
   *   familyId
   * );
   * console.log('Updated:', updated);
   * ```
   */
  async updateEvent(
    eventId: string,
    updateData: UpdateEventRequest,
    userId: string,
    familyId: string
  ): Promise<UpdateEventResponse> {
    // Step 1: Validate UUID format (fail-fast)
    if (!isUUID(eventId)) {
      console.warn(`Invalid event ID format: ${eventId}`);
      throw new ServiceError(
        400,
        'INVALID_EVENT_ID',
        'Event ID must be a valid UUID',
        { eventId }
      );
    }

    console.info(`Updating event ${eventId} by user ${userId}`);

    // Step 2: Validate participants belong to family (if provided)
    if (updateData.participant_ids && updateData.participant_ids.length > 0) {
      // Check if trying to add participants to private event
      if (updateData.is_private === true) {
        console.warn('Attempt to add participants to private event');
        throw new ServiceError(
          400,
          'INVALID_PRIVATE_EVENT',
          'Cannot add participants to private event',
          { participant_ids: 'Private events cannot have participants' }
        );
      }

      const invalidParticipants = await this.validateParticipantsInFamily(
        updateData.participant_ids,
        familyId
      );

      if (invalidParticipants.length > 0) {
        console.warn('Invalid participants detected:', invalidParticipants);
        throw new ServiceError(
          400,
          'INVALID_PARTICIPANTS',
          'Some participants do not belong to your family',
          { invalid_participant_ids: invalidParticipants }
        );
      }
    }

    // Step 3: Validate time range if only one time field is updated
    // (When both are updated, Zod schema already validates)
    if ((updateData.start_time && !updateData.end_time) || 
        (!updateData.start_time && updateData.end_time)) {
      // Need to fetch current event to check time range
      const { data: currentEvent, error: fetchError } = await this.supabase
        .from('events')
        .select('start_time, end_time')
        .eq('id', eventId)
        .is('archived_at', null)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching current event for time validation:', fetchError);
        throw new ServiceError(
          500,
          'DATABASE_ERROR',
          'Failed to validate time range',
          { technical: fetchError.message }
        );
      }

      if (!currentEvent) {
        console.warn(`Event not found during time validation: ${eventId}`);
        throw new ServiceError(
          404,
          'EVENT_NOT_FOUND',
          'Event not found or has been archived'
        );
      }

      // Check time range with new value and existing value
      const newStartTime = updateData.start_time 
        ? new Date(updateData.start_time)
        : new Date(currentEvent.start_time);
      const newEndTime = updateData.end_time
        ? new Date(updateData.end_time)
        : new Date(currentEvent.end_time);

      if (newEndTime <= newStartTime) {
        console.warn(`Invalid time range: end_time (${newEndTime.toISOString()}) must be after start_time (${newStartTime.toISOString()})`);
        throw new ServiceError(
          400,
          'INVALID_TIME_RANGE',
          'End time must be after start time',
          { 
            start_time: newStartTime.toISOString(),
            end_time: newEndTime.toISOString()
          }
        );
      }
    }

    // Step 4: Extract participant_ids (handled separately)
    const { participant_ids, ...eventUpdateData } = updateData;

    // Step 5: Update event (RLS enforces created_by = auth.uid())
    const { data: updatedEvent, error: updateError } = await this.supabase
      .from('events')
      .update(eventUpdateData)
      .eq('id', eventId)
      .is('archived_at', null)
      .select('id, created_by')
      .maybeSingle();

    // Step 6: Handle update errors
    if (updateError) {
      console.error('Database error during event update:', updateError);
      throw new ServiceError(
        500,
        'DATABASE_ERROR',
        'Failed to update event',
        { technical: updateError.message }
      );
    }

    // Step 7: Check if event was updated (distinguish not found vs forbidden)
    if (!updatedEvent) {
      // No rows updated - check why
      const { data: existingEvent, error: checkError } = await this.supabase
        .from('events')
        .select('id, created_by, archived_at')
        .eq('id', eventId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking event existence:', checkError);
        throw new ServiceError(
          500,
          'DATABASE_ERROR',
          'Failed to verify event status',
          { technical: checkError.message }
        );
      }

      if (!existingEvent) {
        // Event doesn't exist
        console.warn(`Event not found: ${eventId}`);
        throw new ServiceError(
          404,
          'EVENT_NOT_FOUND',
          'Event not found or has been archived'
        );
      }

      if (existingEvent.archived_at) {
        // Event is archived
        console.warn(`Event ${eventId} is archived`);
        throw new ServiceError(
          404,
          'EVENT_NOT_FOUND',
          'Event not found or has been archived'
        );
      }

      // Event exists but update was blocked = user is not creator
      console.warn(
        `User ${userId} attempted to update event ${eventId} but is not the creator`
      );
      throw new ServiceError(
        403,
        'FORBIDDEN',
        'You do not have permission to update this event',
        { reason: 'Only event creator can update events' }
      );
    }

    // Step 8: Update participants if provided
    if (participant_ids !== undefined) {
      await this.updateEventParticipants(eventId, participant_ids);
    }

    // Step 9: Fetch updated event with participants
    const response = await this.getEventForUpdateResponse(eventId);

    console.info(`Event ${eventId} updated successfully by user ${userId}`);
    return response;
  }

  /**
   * Replaces all participants for an event
   * 
   * Performs atomic delete + insert operation to replace participant list.
   * Empty array removes all participants.
   * 
   * @param eventId - UUID of event
   * @param participantIds - Array of profile UUIDs (empty array removes all)
   * @throws Error if database operation fails
   * 
   * @private
   */
  private async updateEventParticipants(
    eventId: string,
    participantIds: string[]
  ): Promise<void> {
    // Delete existing participants
    const { error: deleteError } = await this.supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting participants:', deleteError);
      throw new ServiceError(
        500,
        'PARTICIPANT_UPDATE_FAILED',
        'Failed to update participants',
        { error: deleteError.message }
      );
    }

    // Insert new participants (if any)
    if (participantIds.length > 0) {
      const participants = participantIds.map(profileId => ({
        event_id: eventId,
        profile_id: profileId
      }));

      const { error: insertError } = await this.supabase
        .from('event_participants')
        .insert(participants);

      if (insertError) {
        console.error('Error inserting participants:', insertError);
        throw new ServiceError(
          500,
          'PARTICIPANT_UPDATE_FAILED',
          'Failed to add participants',
          { error: insertError.message }
        );
      }
    }
  }

  /**
   * Retrieves event with participants for UpdateEventResponse
   * 
   * Fetches only the fields needed for update response (not full event).
   * Performs optimized query with single JOIN.
   * 
   * @param eventId - UUID of event
   * @returns Promise resolving to UpdateEventResponse
   * @throws ServiceError if event not found
   * 
   * @private
   */
  private async getEventForUpdateResponse(
    eventId: string
  ): Promise<UpdateEventResponse> {
    const { data, error } = await this.supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        start_time,
        end_time,
        is_private,
        updated_at,
        event_participants(
          id,
          event_id,
          profile_id,
          member_id,
          created_at,
          profile:profiles(id, display_name),
          member:family_members(id, name, is_admin)
        )
      `)
      .eq('id', eventId)
      .is('archived_at', null)
      .single();

    if (error || !data) {
      console.error('Error fetching updated event:', error);
      throw new ServiceError(
        500,
        'EVENT_FETCH_FAILED',
        'Failed to retrieve updated event',
        { error: error?.message }
      );
    }

    // Transform nested structure to UpdateEventResponse
    // Include both profile and member participants
    const participants: EventParticipant[] = (data.event_participants || []).map((ep: any) => ({
      id: ep.id,
      event_id: ep.event_id,
      profile_id: ep.profile_id,
      member_id: ep.member_id,
      created_at: ep.created_at,
      profile: ep.profile,
      member: ep.member
    }));

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      start_time: data.start_time,
      end_time: data.end_time,
      is_private: data.is_private,
      updated_at: data.updated_at,
      participants
    };
  }

  /**
   * Soft deletes an event by setting archived_at timestamp
   * 
   * Authorization: Only event creator can delete (enforced by RLS)
   * Side effects: Related tasks have event_id set to NULL
   * 
   * Implementation uses atomic operation with RETURNING clause for optimal performance.
   * RLS policies automatically enforce that only the event creator can perform deletion.
   * 
   * Process flow:
   * 1. Validate UUID format (fail-fast)
   * 2. Perform atomic UPDATE with archived_at = now()
   * 3. Check if update succeeded (0 rows = not found or forbidden)
   * 4. Distinguish between not found and forbidden cases
   * 
   * @param eventId - UUID of event to delete
   * @param userId - ID of authenticated user (for logging)
   * @throws ServiceError with appropriate status code and message
   * 
   * @example
   * ```typescript
   * await eventsService.deleteEvent(eventId, userId);
   * console.log('Event archived successfully');
   * ```
   */
  async deleteEvent(
    eventId: string,
    userId: string
  ): Promise<void> {
    // Step 1: Validate UUID format (fail-fast approach)
    if (!isUUID(eventId)) {
      console.warn(`Invalid event ID format: ${eventId}`);
      throw new ServiceError(
        400,
        'INVALID_EVENT_ID',
        'Event ID must be a valid UUID',
        { eventId }
      );
    }

    console.info(`Attempting to delete event ${eventId} by user ${userId}`);

    // Step 2: Perform soft delete with RETURNING clause for atomic operation
    // This reduces database round-trips from 2 to 1
    const { data, error } = await this.supabase
      .from('events')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', eventId)
      .is('archived_at', null)
      .select('id')
      .maybeSingle();

    // Step 3: Handle database errors
    if (error) {
      console.error('Database error during event deletion:', {
        eventId,
        userId,
        error: error.message
      });
      throw new ServiceError(
        500,
        'DATABASE_ERROR',
        'Failed to delete event',
        { technical: error.message }
      );
    }

    // Step 4: Distinguish between not found and forbidden
    if (!data) {
      // No rows were updated. This could mean:
      // 1. Event doesn't exist
      // 2. Event is already archived
      // 3. RLS blocked the operation (user is not the creator)
      
      // Check if event exists at all (without RLS filtering on created_by)
      const { data: existingEvent, error: checkError } = await this.supabase
        .from('events')
        .select('id, created_by, archived_at')
        .eq('id', eventId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking event existence:', checkError);
        throw new ServiceError(
          500,
          'DATABASE_ERROR',
          'Failed to verify event status',
          { technical: checkError.message }
        );
      }

      if (existingEvent) {
        if (existingEvent.archived_at) {
          // Event is already archived
          console.warn(`Event ${eventId} is already archived`);
          throw new ServiceError(
            404,
            'EVENT_NOT_FOUND',
            'Event not found or has been archived'
          );
        }
        
        // Event exists but RLS blocked it = user is not the creator
        console.warn(
          `User ${userId} attempted to delete event ${eventId} but is not the creator`
        );
        throw new ServiceError(
          403,
          'FORBIDDEN',
          'You do not have permission to delete this event',
          { reason: 'Only event creator can delete events' }
        );
      } else {
        // Event doesn't exist
        console.warn(`Event not found: ${eventId}`);
        throw new ServiceError(
          404,
          'EVENT_NOT_FOUND',
          'Event not found or has been archived'
        );
      }
    }

    // Success! Event was archived
    console.info(`Event ${eventId} archived successfully by user ${userId}`);
  }
}

/**
 * Factory function to create EventsService instance
 * 
 * @param supabase - Supabase client instance
 * @returns New EventsService instance
 */
export function createEventsService(supabase: SupabaseClient): EventsService {
  return new EventsService(supabase);
}

