/**
 * DTO (Data Transfer Object) and Command Model Types for HomeHQ API
 * 
 * This file contains all type definitions for API requests and responses,
 * derived from the database schema defined in database.types.ts
 */

import type { Tables, TablesInsert, TablesUpdate } from './db/database.types';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Pagination metadata for list endpoints
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Standard API error response format
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Authentication DTOs (Section 2.1)
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface RegisterResponse {
  user: AuthUser;
  session: AuthSession;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// LoginResponse is identical to RegisterResponse
export type LoginResponse = RegisterResponse;

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ============================================================================
// Families DTOs (Section 2.2)
// ============================================================================

export interface CreateFamilyRequest {
  name: string;
  display_name: string;
}

/**
 * Response for family creation including the creator's profile
 * Returned by POST /families
 */
export interface CreateFamilyResponse {
  id: string;
  name: string;
  created_at: string;
  profile: {
    id: string;
    family_id: string;
    role: string;
    display_name: string;
    created_at: string;
  };
}

/**
 * Profile summary for family member lists
 * Omits sensitive fields like family_id
 */
export type ProfileSummary = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'role' | 'created_at'
>;

/**
 * Family details with all members
 * Returned by GET /families/me
 */
export interface FamilyWithMembersResponse
  extends Pick<Tables<'families'>, 'id' | 'name' | 'created_at' | 'updated_at'> {
  members: ProfileSummary[];
}

export interface UpdateFamilyRequest {
  name: string;
}

export type UpdateFamilyResponse = Pick<
  Tables<'families'>,
  'id' | 'name' | 'updated_at'
>;

// ============================================================================
// Invitations DTOs (Section 2.3)
// ============================================================================

export interface CreateInvitationRequest {
  days_valid?: number; // Optional, defaults to 7
}

/**
 * Full invitation code details
 * Direct mapping to invitation_codes table
 */
export type InvitationCodeResponse = Tables<'invitation_codes'>;

/**
 * Invitation code with additional computed fields
 * Includes creator name and validity status
 */
export interface InvitationWithCreatorResponse
  extends Tables<'invitation_codes'> {
  created_by_name: string;
  is_valid: boolean;
}

export interface ListInvitationsResponse {
  invitations: InvitationWithCreatorResponse[];
}

export interface RedeemInvitationRequest {
  code: string;
  display_name: string;
}

export interface RedeemInvitationResponse {
  family_id: string;
  family_name: string;
  profile: {
    id: string;
    family_id: string;
    role: string;
    display_name: string;
    created_at: string;
  };
}

// ============================================================================
// Profiles DTOs (Section 2.4)
// ============================================================================

/**
 * Complete profile data
 * Direct mapping to profiles table
 */
export type ProfileResponse = Tables<'profiles'>;

export interface UpdateProfileRequest {
  display_name: string;
}

export type UpdateProfileResponse = Pick<
  Tables<'profiles'>,
  'id' | 'family_id' | 'role' | 'display_name' | 'updated_at'
>;

export interface ListProfilesResponse {
  profiles: ProfileSummary[];
}

// ============================================================================
// Events DTOs (Section 2.5)
// ============================================================================

/**
 * Event participant (can be profile or member)
 */
export interface EventParticipant {
  id: string;
  event_id: string;
  profile_id: string | null;  // ← zmienione z string na string | null
  member_id: string | null;   // ← NOWE
  created_at: string;
  // Joined data
  profile?: {
    id: string;
    display_name: string;
  } | null;
  member?: {          // ← NOWE
    id: string;
    name: string;
    is_admin: boolean;
  } | null;
}
/**
 * AI-generated task suggestion
 * Not persisted until user accepts
 */
export interface TaskSuggestion {
  suggestion_id: string; // 'birthday' | 'health' | 'outing' | 'travel'
  title: string;
  due_date: string | null;
  description?: string;
  accepted?: boolean; // Indicates if suggestion was converted to task
}

/**
 * Request to create a new event
 * participant_ids is an additional field not in the events table
 */
export interface CreateEventRequest
  extends Pick<
    TablesInsert<'events'>,
    'title' | 'description' | 'start_time' | 'end_time' | 'is_private'
  > {
  participant_ids?: string[];
  member_ids?: string[];        // ← NOWE
  accept_suggestions?: SuggestionId[]; // Array of suggestion IDs to convert to tasks
}

/**
 * Event with participants
 * Used in responses that include participant details
 */
export interface EventWithParticipants extends Tables<'events'> {
  participants: EventParticipant[];
}

/**
 * Response for event creation
 * Includes the event, AI-generated task suggestions, and created tasks
 */
export interface CreateEventResponse {
  event: EventWithParticipants;
  suggestions: TaskSuggestion[];
  created_tasks: TaskResponse[]; // Tasks created from accepted suggestions
}

/**
 * Request to analyze event for suggestions (preview mode)
 * Does not create the event
 */
export interface AnalyzeEventRequest {
  title: string;
  start_time: string;
  participant_ids?: string[];
}

export interface AnalyzeEventResponse {
  suggestions: TaskSuggestion[];
}

/**
 * Event with creator name and participants
 * Used in list and detail views
 */
export interface EventWithCreator
  extends Omit<Tables<'events'>, 'created_by'> {
  created_by: string;
  created_by_name: string;
  participants: EventParticipant[];
}

export interface ListEventsResponse {
  events: EventWithCreator[];
  pagination: PaginationMeta;
}

/**
 * Single event details
 * Same as EventWithCreator
 */
export type EventDetailsResponse = EventWithCreator;

/**
 * Request to update an event
 * All fields are optional (partial update)
 */
export interface UpdateEventRequest
  extends Partial<
    Pick<
      TablesUpdate<'events'>,
      'title' | 'description' | 'start_time' | 'end_time' | 'is_private'
    >
  > {
  participant_ids?: string[];
}

/**
 * Response after updating an event
 * Returns updated fields and participants
 */
export interface UpdateEventResponse
  extends Pick<
    Tables<'events'>,
    'id' | 'title' | 'description' | 'start_time' | 'end_time' | 'is_private' | 'updated_at'
  > {
  participants: EventParticipant[];
}

// ============================================================================
// Tasks DTOs (Section 2.6)
// ============================================================================

/**
 * Request to create a manual task
 */
export type CreateTaskRequest = Pick<
  TablesInsert<'tasks'>,
  'title' | 'due_date' | 'assigned_to' | 'is_private'
>;

/**
 * Complete task data
 * Direct mapping to tasks table
 */
export type TaskResponse = Tables<'tasks'>;

/**
 * Request to create task from AI suggestion
 * Tracks conversion for analytics (US-006 metric)
 */
export type CreateTaskFromSuggestionRequest = Pick<
  TablesInsert<'tasks'>,
  'title' | 'due_date' | 'is_private' | 'assigned_to' | 'event_id' | 'suggestion_id'
>;

/**
 * Task with related entity names
 * Includes denormalized fields for display
 */
export interface TaskWithDetails extends Tables<'tasks'> {
  created_by_name: string;
  assigned_to_name: string | null;
  completed_by_name: string | null;
  event_title: string | null;
}

export interface ListTasksResponse {
  tasks: TaskWithDetails[];
  pagination: PaginationMeta;
}

/**
 * Single task details
 * Same as TaskWithDetails
 */
export type TaskDetailsResponse = TaskWithDetails;

/**
 * Request to update a task
 * All fields are optional (partial update)
 */
export type UpdateTaskRequest = Partial<
  Pick<
    TablesUpdate<'tasks'>,
    'title' | 'due_date' | 'assigned_to' | 'is_completed'
  >
>;

/**
 * Response after updating a task
 * Returns key updated fields
 */
export type UpdateTaskResponse = Pick<
  Tables<'tasks'>,
  | 'id'
  | 'title'
  | 'due_date'
  | 'assigned_to'
  | 'is_completed'
  | 'completed_at'
  | 'completed_by'
  | 'updated_at'
>;

// ============================================================================
// Query Parameters Types
// ============================================================================

/**
 * Query parameters for GET /events
 */
export interface GetEventsQueryParams {
  start_date?: string; // ISO 8601 date
  end_date?: string; // ISO 8601 date
  is_private?: boolean;
  participant_id?: string; // UUID
  limit?: number; // default: 100, max: 500
  offset?: number; // default: 0
}

/**
 * Query parameters for GET /tasks
 */
export interface GetTasksQueryParams {
  is_completed?: boolean;
  is_private?: boolean;
  assigned_to?: string; // UUID or "me"
  due_before?: string; // ISO 8601 date
  due_after?: string; // ISO 8601 date
  event_id?: string; // UUID
  limit?: number; // default: 100, max: 500
  offset?: number; // default: 0
  sort?: 'due_date_asc' | 'due_date_desc' | 'created_at_desc'; // default: due_date_asc
}

/**
 * Query parameters for GET /families/me/invitations
 */
export interface GetInvitationsQueryParams {
  include_used?: boolean; // default: false
  include_expired?: boolean; // default: false
}

// ============================================================================
// Database Function Parameters
// ============================================================================

/**
 * Parameters for create_family_and_assign_admin function
 */
export interface CreateFamilyAndAssignAdminParams {
  user_id: string;
  family_name: string;
  user_display_name: string;
}

/**
 * Parameters for generate_invitation_code function
 */
export interface GenerateInvitationCodeParams {
  p_family_id: string;
  admin_id: string;
  days_valid?: number;
}

/**
 * Parameters for use_invitation_code function
 */
export interface UseInvitationCodeParams {
  p_code: string;
  user_id: string;
  user_display_name: string;
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

/**
 * Type guard to check if a value is a valid UUID
 */
export function isUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard to check if a value is a valid ISO 8601 date string
 */
export function isISO8601(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
}

/**
 * Type representing valid suggestion IDs from AI engine
 */
export type SuggestionId = 
  // Birthday events
  | 'birthday_invitations'
  | 'birthday_cake'
  | 'birthday_gifts'
  // School events
  | 'parent_teacher_meeting'
  | 'school_trip_food'
  | 'school_trip_clothes'
  | 'end_of_school_year_gift'
  | 'school_year_start_supplies'
  | 'school_year_start_books'
  | 'semester_end_celebration'
  | 'school_performance'
  | 'school_break_activities'
  // Date night / Outing
  | 'date_night_babysitter'
  | 'date_night_reservation'
  // Health
  | 'health_documents'
  // Travel
  | 'travel_pack'
  | 'travel_documents'
  // Holidays
  | 'christmas_gifts'
  | 'christmas_outfits'
  // Costume parties
  | 'costume_party'
  // Sports & Activities
  | 'swimming_bag'
  // Legacy IDs (for backward compatibility)
  | 'birthday'
  | 'health'
  | 'outing'
  | 'travel';

/**
 * Type representing valid user roles
 */
export type UserRole = 'admin' | 'member';

/**
 * Type representing valid task sort options
 */
export type TaskSortOption = 'due_date_asc' | 'due_date_desc' | 'created_at_desc';

// =============================================================================
// Family Members Types
// =============================================================================

/**
 * Family member without user account (e.g., children)
 */
export interface FamilyMember {
  id: string;
  family_id: string;
  name: string;
  is_admin: boolean;
  created_at: string;
}

/**
 * Request to create a family member
 */
export interface CreateFamilyMemberRequest {
  name: string;
  is_admin: boolean;
}

/**
 * Family member with creator info
 */
export interface FamilyMemberWithCreator extends FamilyMember {
  created_by_name: string;
}

/**
 * Unified participant (profile or member)
 */
export interface UnifiedParticipant {
  type: 'profile' | 'member';
  id: string;
  name: string;
  is_admin: boolean;
}

