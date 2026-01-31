# REST API Plan - HomeHQ

## Overview

This document defines the complete REST API specification for HomeHQ MVP, a family management application. The API is designed to work with Supabase backend services, leveraging Row Level Security (RLS) for multi-tenant data isolation and JWT-based authentication.

**Base URL:** `/api/v1`

**Tech Stack:** Vite + React 19 (frontend), Supabase (PostgreSQL + Auth + Edge Functions)

---

## 1. Resources

| Resource | Database Table | Description |
|----------|---------------|-------------|
| Families | `families` | Family hubs for multi-tenant isolation |
| Profiles | `profiles` | User profiles with family membership and roles |
| Invitations | `invitation_codes` | Family invitation codes with expiration |
| Events | `events` | Calendar events with binary visibility (Private/Shared) |
| Event Participants | `event_participants` | Many-to-many relationship between events and profiles |
| Tasks | `tasks` | Task feed (AI-generated and manual tasks) |

---

## 2. Endpoints

### 2.1. Authentication

#### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "display_name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid email format or password too weak
- `409 Conflict`: Email already registered

**Notes:**
- Handled by Supabase Auth
- After registration, user must create or join a family

---

#### POST /auth/login

Authenticate user and obtain session tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials

---

#### POST /auth/logout

Invalidate current session.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (204 No Content)**

---

#### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "refresh_token"
}
```

**Response (200 OK):**
```json
{
  "access_token": "new_jwt_token",
  "refresh_token": "new_refresh_token",
  "expires_in": 3600
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired refresh token

---

### 2.2. Families

#### POST /families

Create a new family hub and assign creator as admin.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "name": "Smith Family",
  "display_name": "John Smith"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "Smith Family",
  "created_at": "2026-01-02T12:00:00Z",
  "profile": {
    "id": "uuid",
    "family_id": "uuid",
    "role": "admin",
    "display_name": "John Smith",
    "created_at": "2026-01-02T12:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid family name (empty or whitespace only)
- `401 Unauthorized`: Missing or invalid token
- `409 Conflict`: User already belongs to a family

**Business Logic:**
- Calls database function `create_family_and_assign_admin()`
- Creator automatically receives `role = 'admin'`
- Syncs `family_id` to JWT metadata via trigger

**Validation:**
- `name`: Required, non-empty after trimming

---

#### GET /families/me

Get current user's family details.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Smith Family",
  "created_at": "2026-01-02T12:00:00Z",
  "updated_at": "2026-01-02T12:00:00Z",
  "members": [
    {
      "id": "uuid",
      "display_name": "John Smith",
      "role": "admin",
      "created_at": "2026-01-02T12:00:00Z"
    },
    {
      "id": "uuid",
      "display_name": "Jane Smith",
      "role": "member",
      "created_at": "2026-01-02T13:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: User not assigned to any family

**Notes:**
- Returns family data based on `family_id` in JWT metadata
- RLS policy ensures user can only see their own family

---

#### PATCH /families/me

Update current user's family details (admin only).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "name": "Updated Family Name"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Updated Family Name",
  "updated_at": "2026-01-02T14:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid name (empty or whitespace only)
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not admin

**Business Logic:**
- RLS policy checks if user has `role = 'admin'`
- Trigger automatically updates `updated_at` timestamp

**Validation:**
- `name`: Required, non-empty after trimming

---

### 2.3. Invitations

#### POST /families/me/invitations

Generate a new invitation code (admin only).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "days_valid": 7
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "code": "ABC12XYZ",
  "family_id": "uuid",
  "created_by": "uuid",
  "expires_at": "2026-01-09T12:00:00Z",
  "created_at": "2026-01-02T12:00:00Z",
  "used_at": null,
  "used_by": null
}
```

**Error Responses:**
- `400 Bad Request`: Invalid days_valid (must be 1-30)
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not admin

**Business Logic:**
- Calls database function `generate_invitation_code()`
- Code is 8-character alphanumeric generated using `pg_crypto`
- Default `days_valid` is 7 if not provided

**Validation:**
- `days_valid`: Optional, must be integer between 1 and 30

---

#### GET /families/me/invitations

List all invitation codes for current user's family (admin only).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `include_used`: boolean (default: false) - Include already-used codes
- `include_expired`: boolean (default: false) - Include expired codes

**Response (200 OK):**
```json
{
  "invitations": [
    {
      "id": "uuid",
      "code": "ABC12XYZ",
      "created_by": "uuid",
      "created_by_name": "John Smith",
      "expires_at": "2026-01-09T12:00:00Z",
      "created_at": "2026-01-02T12:00:00Z",
      "used_at": null,
      "used_by": null,
      "is_valid": true
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not admin

**Notes:**
- By default, only shows unused and non-expired codes
- RLS policy ensures only admins can query this table

---

#### POST /invitations/redeem

Redeem an invitation code and join a family.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "code": "ABC12XYZ",
  "display_name": "Jane Smith"
}
```

**Response (200 OK):**
```json
{
  "family_id": "uuid",
  "family_name": "Smith Family",
  "profile": {
    "id": "uuid",
    "family_id": "uuid",
    "role": "member",
    "display_name": "Jane Smith",
    "created_at": "2026-01-02T13:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid code format or display_name empty
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Code does not exist
- `409 Conflict`: User already belongs to a family
- `410 Gone`: Code has expired or already been used

**Business Logic:**
- Calls database function `use_invitation_code()`
- Validates code is not expired (`expires_at > now()`)
- Validates code is not used (`used_at IS NULL`)
- Creates profile with `role = 'member'`
- Updates invitation record with `used_at` and `used_by`
- Syncs `family_id` to JWT metadata

**Validation:**
- `code`: Required, exactly 8 characters
- `display_name`: Required, non-empty after trimming

---

### 2.4. Profiles

#### GET /profiles/me

Get current user's profile.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "family_id": "uuid",
  "role": "admin",
  "display_name": "John Smith",
  "created_at": "2026-01-02T12:00:00Z",
  "updated_at": "2026-01-02T12:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Profile not found (user not in family)

---

#### PATCH /profiles/me

Update current user's profile.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "display_name": "Johnny Smith"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "family_id": "uuid",
  "role": "admin",
  "display_name": "Johnny Smith",
  "updated_at": "2026-01-02T14:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid display_name (empty or whitespace only)
- `401 Unauthorized`: Missing or invalid token

**Business Logic:**
- Users can only update their own profile (enforced by RLS)
- Role changes are admin-only operations (not exposed via API)
- Trigger automatically updates `updated_at`

**Validation:**
- `display_name`: Required, non-empty after trimming

---

#### GET /profiles

List all profiles in current user's family.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "profiles": [
    {
      "id": "uuid",
      "display_name": "John Smith",
      "role": "admin",
      "created_at": "2026-01-02T12:00:00Z"
    },
    {
      "id": "uuid",
      "display_name": "Jane Smith",
      "role": "member",
      "created_at": "2026-01-02T13:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token

**Notes:**
- RLS policy ensures users only see profiles from their own family
- Used for participant selection in event creation

---

### 2.5. Events

#### POST /events

Create a new calendar event with optional bulk task creation from AI suggestions.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "title": "Dentist Appointment",
  "description": "Annual checkup for the kids",
  "start_time": "2026-01-15T10:00:00Z",
  "end_time": "2026-01-15T11:00:00Z",
  "is_private": false,
  "participant_ids": ["uuid1", "uuid2"],
  "accept_suggestions": ["health"]
}
```

**Response (201 Created):**
```json
{
  "event": {
    "id": "uuid",
    "family_id": "uuid",
    "created_by": "uuid",
    "title": "Dentist Appointment",
    "description": "Annual checkup for the kids",
    "start_time": "2026-01-15T10:00:00Z",
    "end_time": "2026-01-15T11:00:00Z",
    "is_private": false,
    "created_at": "2026-01-02T12:00:00Z",
    "updated_at": "2026-01-02T12:00:00Z",
    "archived_at": null,
    "participants": [
      {
        "id": "uuid1",
        "display_name": "Kid 1"
      },
      {
        "id": "uuid2",
        "display_name": "Kid 2"
      }
    ]
  },
  "suggestions": [
    {
      "suggestion_id": "health",
      "title": "Prepare medical documents",
      "due_date": "2026-01-14T10:00:00Z",
      "description": "Gather insurance cards and medical history",
      "accepted": true
    }
  ],
  "created_tasks": [
    {
      "id": "uuid",
      "title": "Prepare medical documents",
      "due_date": "2026-01-14T10:00:00Z",
      "is_completed": false,
      "is_private": false,
      "event_id": "uuid",
      "suggestion_id": "health",
      "created_from_suggestion": true,
      "created_at": "2026-01-02T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors (see validation section)
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Participant not in same family

**Business Logic:**
- Automatically sets `family_id` from JWT metadata
- Automatically sets `created_by` to current user
- Runs AI suggestion engine based on title keywords:
  - **Birthday** (keywords: birthday, bday) → "Buy a gift" (7 days before)
  - **Health** (keywords: doctor, dentist, clinic) → "Prepare medical documents" (1 day before)
  - **Outing** (keywords: cinema, date, dinner + admins only) → "Book a babysitter" (3 days before)
  - **Travel** (keywords: flight, trip, vacation) → "Pack bags" (2 days before)
- If `accept_suggestions` array provided, automatically creates tasks for selected suggestion IDs
- **Bulk Task Creation (NEW):**
  - Each accepted suggestion creates a task with `created_from_suggestion = true`
  - Tasks inherit `is_private` from event
  - Tasks are linked to event via `event_id`
  - All operations wrapped in database transaction for atomicity
  - If task creation fails, entire operation rolls back (event not created)
- If `is_private = true`, `participant_ids` must be empty or only contain creator
- Trigger validates all participants belong to same family

**Validation:**
- `title`: Required, 1-200 characters after trimming
- `start_time`: Required, valid ISO 8601 timestamp
- `end_time`: Required, must be after `start_time`
- `is_private`: Required, boolean
- `description`: Optional, string
- `participant_ids`: Optional, array of valid profile UUIDs
- `accept_suggestions`: Optional, array of suggestion IDs from AI engine response

---

#### POST /events/analyze

Analyze event title for AI task suggestions (preview mode, no event created).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "title": "Birthday party for Emma",
  "start_time": "2026-01-20T15:00:00Z",
  "participant_ids": ["uuid1", "uuid2"]
}
```

**Response (200 OK):**
```json
{
  "suggestions": [
    {
      "suggestion_id": "birthday",
      "title": "Buy a gift",
      "due_date": "2026-01-13T15:00:00Z",
      "description": "Purchase birthday present for Emma"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request (missing title or start_time)
- `401 Unauthorized`: Missing or invalid token

**Notes:**
- Used for real-time suggestions as user types in event creation form
- Does not persist any data to database
- Same AI rules as POST /events

---

#### GET /events

List calendar events for current user's family.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `start_date`: ISO 8601 date (filter events starting on or after this date)
- `end_date`: ISO 8601 date (filter events ending on or before this date)
- `is_private`: boolean (filter by visibility)
- `participant_id`: UUID (filter events with specific participant)
- `limit`: integer (default: 100, max: 500) - Pagination limit
- `offset`: integer (default: 0) - Pagination offset

**Response (200 OK):**
```json
{
  "events": [
    {
      "id": "uuid",
      "created_by": "uuid",
      "created_by_name": "John Smith",
      "title": "Dentist Appointment",
      "description": "Annual checkup",
      "start_time": "2026-01-15T10:00:00Z",
      "end_time": "2026-01-15T11:00:00Z",
      "is_private": false,
      "created_at": "2026-01-02T12:00:00Z",
      "updated_at": "2026-01-02T12:00:00Z",
      "participants": [
        {
          "id": "uuid",
          "display_name": "Kid 1"
        }
      ]
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "has_more": true
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid token

**Notes:**
- RLS policies automatically filter results:
  - Shared events: visible to all family members
  - Private events: visible only to creator
- Excludes archived events (`archived_at IS NULL`)
- Ordered by `start_time` ascending

---

#### GET /events/:eventId

Get a specific event by ID.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "family_id": "uuid",
  "created_by": "uuid",
  "created_by_name": "John Smith",
  "title": "Dentist Appointment",
  "description": "Annual checkup",
  "start_time": "2026-01-15T10:00:00Z",
  "end_time": "2026-01-15T11:00:00Z",
  "is_private": false,
  "created_at": "2026-01-02T12:00:00Z",
  "updated_at": "2026-01-02T12:00:00Z",
  "archived_at": null,
  "participants": [
    {
      "id": "uuid",
      "display_name": "Kid 1"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this event (wrong family or private)
- `404 Not Found`: Event does not exist or is archived

**Notes:**
- RLS ensures user can only access events in their family
- Private events only accessible by creator

---

   

---

#### DELETE /events/:eventId - ✅ IMPLEMENTED

Soft delete an event (archive).

**Implementation Status:** ✅ COMPLETED (2026-01-26)

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (204 No Content)**

**Error Responses:**
- `400 Bad Request`: Invalid UUID format
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not event creator
- `404 Not Found`: Event does not exist or already archived

**Business Logic:**
- Soft delete: sets `archived_at = now()`
- Only event creator can delete (enforced by RLS)
- Associated tasks remain (event_id set to NULL via ON DELETE SET NULL)
- Preserves data for analytics

**Implementation Details:**
- **Service Layer:** `EventsService.deleteEvent()` in `src/services/events.service.ts`
- **Action:** `deleteEvent()` in `src/actions/deleteEvent.ts`
- **Hook:** `useDeleteEvent()` in `src/hooks/useEvents.ts`
- **Optimistic UI:** `useEventsOptimistic()` in `src/hooks/useEvents.ts`
- **UI Component:** `DeleteEventButton` in `src/components/events/DeleteEventButton.tsx`

**Tested Scenarios:**
- ✅ Successful deletion by creator
- ✅ 400 Invalid UUID format
- ✅ 401 Unauthenticated access
- ✅ 403 Non-creator attempt
- ✅ 404 Event not found
- ✅ 404 Already archived event
- ✅ 500 Database error handling

**Security:**
- RLS policy: `events_delete_own_authenticated`
- JWT validation enforced
- Family isolation automatic
- Audit trail via `archived_at`

**Performance:**
- Single atomic UPDATE query with RETURNING
- Indexed on id (PK) and created_by
- Target p95: < 200ms

**Example Usage:**
```typescript
import { useDeleteEvent } from '@/hooks/useEvents';

function MyComponent() {
  const { deleteEvent, isDeleting, error } = useDeleteEvent();
  
  const handleDelete = async (eventId: string) => {
    const result = await deleteEvent(eventId);
    if (result.success) {
      // Handle success
    }
  };
}
```

---

### 2.6. Tasks

#### POST /tasks

Create a new manual task (not AI-generated).

**Implementation Status:** ✅ **COMPLETED**
- Service: `TasksService.createTask()` in `src/services/tasks.service.ts`
- Action: `createTask()` in `src/actions/createTask.ts`
- Hook: `useCreateTask()` in `src/hooks/useTasks.ts`
- Component: `CreateTaskDialog` in `src/components/tasks/CreateTaskDialog.tsx`
- Schema: `createTaskSchema` in `src/validations/tasks.schema.ts`
- Tests: `tests/services/tasks.service.createTask.test.ts`, `tests/validations/tasks.schema.createTask.test.ts`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```typescript
{
  title: string;           // Required: Task title (trimmed, min 1 char)
  due_date?: string;       // Optional: ISO 8601 datetime (e.g., "2026-01-05T18:00:00Z")
  assigned_to?: string;    // Optional: Profile UUID (must be in same family)
  is_private: boolean;     // Required: Privacy flag
}
```

**Example Request:**
```json
{
  "title": "Buy groceries",
  "due_date": "2026-01-05T18:00:00Z",
  "assigned_to": "550e8400-e29b-41d4-a716-446655440000",
  "is_private": false
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "family_id": "uuid",
  "created_by": "uuid",
  "assigned_to": "uuid",
  "title": "Buy groceries",
  "due_date": "2026-01-05T18:00:00Z",
  "is_completed": false,
  "completed_at": null,
  "completed_by": null,
  "is_private": false,
  "event_id": null,
  "suggestion_id": null,
  "created_from_suggestion": false,
  "created_at": "2026-01-02T12:00:00Z",
  "updated_at": "2026-01-02T12:00:00Z",
  "archived_at": null
}
```

**Error Responses:**

**400 Bad Request - Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title cannot be empty",
    "details": {
      "field": "title",
      "value": ""
    }
  }
}
```

**401 Unauthorized:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token"
  }
}
```

**403 Forbidden - User Profile Not Found:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "User profile not found"
  }
}
```

**403 Forbidden - Cross-Family Assignment:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot assign task to user outside your family",
    "details": {
      "assigned_to": "uuid"
    }
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Business Logic:**
- Automatically sets `family_id` from user's profile
- Automatically sets `created_by` to current user ID
- Manual tasks always have `event_id = NULL` and `created_from_suggestion = false`
- If `assigned_to` provided, validates that user is in same family
- Title is trimmed before validation

**Validation Rules:**
- `title`: **Required**, string, min 1 character after trimming
- `due_date`: **Optional**, must be valid ISO 8601 timestamp with timezone (e.g., `2026-01-05T18:00:00Z`)
- `assigned_to`: **Optional**, must be valid UUID v4 format
- `is_private`: **Required**, boolean (true/false)

**Security:**
- RLS Policy: `tasks_insert_authenticated` enforces family isolation
- User can only create tasks in their own family
- `assigned_to` validation prevents cross-family task assignment
- Private tasks only visible to creator

**Usage Example (React Hook):**
```typescript
import { useCreateTask } from '@/hooks/useTasks';

function MyComponent() {
  const { createTask, isLoading, error, data, reset } = useCreateTask();

  const handleCreateTask = async () => {
    const result = await createTask({
      title: "Buy groceries",
      due_date: "2026-01-05T18:00:00Z",
      assigned_to: null,
      is_private: false
    });

    if (result.success) {
      console.log('Task created:', result.data);
      reset();
    }
  };

  return (
    <div>
      {error && <ErrorDisplay error={error} />}
      {isLoading && <Spinner />}
      <button onClick={handleCreateTask}>Create Task</button>
    </div>
  );
}
```

**Usage Example (Dialog Component):**
```typescript
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';

function MyPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsDialogOpen(true)}>
        New Task
      </button>

      <CreateTaskDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => {
          // Refetch tasks or show notification
          console.log('Task created successfully!');
        }}
      />
    </>
  );
}
```

**Performance:**
- Average response time: ~100-150ms
- Database queries: 2-3 (profile fetch, optional assigned_to validation, insert)
- Indexes used: `idx_tasks_family_id`, `profiles PK`

**Related Endpoints:**
- `GET /tasks` - List all tasks with filters
- `PATCH /tasks/:id` - Update task
- `DELETE /tasks/:id` - Delete (archive) task
- `POST /tasks/from-suggestion` - Create task from AI suggestion

---

#### POST /tasks/from-suggestion

Create task from AI suggestion (tracks conversion for metrics). Alternative to bulk creation in POST /events.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "title": "Buy a gift",
  "due_date": "2026-01-13T15:00:00Z",
  "event_id": "uuid",
  "suggestion_id": "birthday",
  "is_private": false,
  "assigned_to": "uuid"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "family_id": "uuid",
  "created_by": "uuid",
  "assigned_to": "uuid",
  "title": "Buy a gift",
  "due_date": "2026-01-13T15:00:00Z",
  "is_completed": false,
  "is_private": false,
  "event_id": "uuid",
  "suggestion_id": "birthday",
  "created_from_suggestion": true,
  "created_at": "2026-01-02T12:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: event_id does not exist

**Business Logic:**
- Sets `created_from_suggestion = true` for analytics (US-006 metric)
- Inherits `is_private` from source event
- Links to source event via `event_id`
- Tracks AI rule via `suggestion_id` (birthday, health, outing, travel)

**Use Cases:**
- **Deferred acceptance:** User creates event without accepting suggestions, then adds tasks later
- **Post-event review:** User reviews event list and adds suggested tasks retroactively
- **Single suggestion:** User wants to add only one suggestion at a time

**Note:** For bulk task creation during event creation, use `accept_suggestions` field in POST /events instead.

**Validation:**
- `title`: Required
- `event_id`: Required, must exist and be accessible by user
- `suggestion_id`: Required, must be valid rule identifier
- `due_date`: Optional

---

#### GET /tasks

List tasks for current user's family.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `is_completed`: boolean (filter by completion status)
- `is_private`: boolean (filter by visibility)
- `assigned_to`: UUID (filter by assignee, "me" for current user)
- `due_before`: ISO 8601 date (tasks due before this date)
- `due_after`: ISO 8601 date (tasks due after this date)
- `event_id`: UUID (tasks linked to specific event)
- `limit`: integer (default: 100, max: 500)
- `offset`: integer (default: 0)
- `sort`: string (default: "due_date_asc", options: due_date_asc, due_date_desc, created_at_desc)

**Response (200 OK):**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "created_by": "uuid",
      "created_by_name": "John Smith",
      "assigned_to": "uuid",
      "assigned_to_name": "Jane Smith",
      "title": "Buy groceries",
      "due_date": "2026-01-05T18:00:00Z",
      "is_completed": false,
      "completed_at": null,
      "completed_by": null,
      "is_private": false,
      "event_id": null,
      "event_title": null,
      "suggestion_id": null,
      "created_from_suggestion": false,
      "created_at": "2026-01-02T12:00:00Z",
      "updated_at": "2026-01-02T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid token

**Notes:**
- RLS policies automatically filter:
  - Shared tasks: visible to all family members
  - Private tasks: visible only to creator
- Excludes archived tasks (`archived_at IS NULL`)
- Default sort: due_date ascending (tasks due soonest first)

---

#### GET /tasks/:taskId

Get a specific task by ID.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "family_id": "uuid",
  "created_by": "uuid",
  "created_by_name": "John Smith",
  "assigned_to": "uuid",
  "assigned_to_name": "Jane Smith",
  "title": "Buy groceries",
  "due_date": "2026-01-05T18:00:00Z",
  "is_completed": false,
  "completed_at": null,
  "completed_by": null,
  "completed_by_name": null,
  "is_private": false,
  "event_id": null,
  "suggestion_id": null,
  "created_from_suggestion": false,
  "created_at": "2026-01-02T12:00:00Z",
  "updated_at": "2026-01-02T12:00:00Z",
  "archived_at": null
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this task
- `404 Not Found`: Task does not exist

---

#### PATCH /tasks/:taskId

Update task (partial update).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "title": "Buy groceries and supplies",
  "due_date": "2026-01-06T18:00:00Z",
  "assigned_to": "uuid",
  "is_completed": true
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "Buy groceries and supplies",
  "due_date": "2026-01-06T18:00:00Z",
  "assigned_to": "uuid",
  "is_completed": true,
  "completed_at": "2026-01-02T14:30:00Z",
  "completed_by": "uuid",
  "updated_at": "2026-01-02T14:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not creator or assignee
- `404 Not Found`: Task does not exist

**Business Logic:**
- Creator and assignee can update tasks (RLS: `created_by = auth.uid() OR assigned_to = auth.uid()`)
- When `is_completed` changes to `true`, trigger automatically sets:
  - `completed_at = now()`
  - `completed_by = auth.uid()`
- Trigger updates `updated_at` timestamp
- All fields are optional

**Validation:**
- `title`: If provided, non-empty after trimming
- `due_date`: If provided, valid ISO 8601 timestamp
- `assigned_to`: If provided, must be in same family

---

#### DELETE /tasks/:taskId

Soft delete a task (archive).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (204 No Content)**

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not task creator
- `404 Not Found`: Task does not exist

**Business Logic:**
- Soft delete: sets `archived_at = now()`
- Only creator can delete task
- Preserves data for analytics

---

## 3. Authentication and Authorization

### 3.1. Authentication Mechanism

**Provider:** Supabase Auth

**Method:** JWT-based authentication with access and refresh tokens

**Token Storage:** 
- Access token stored in memory (React state/context)
- Refresh token stored in httpOnly cookie (managed by Supabase client)

**Token Lifecycle:**
- Access tokens expire after 1 hour
- Refresh tokens used to obtain new access tokens
- Automatic refresh handled by Supabase client library

**Headers:**
All protected endpoints require:
```
Authorization: Bearer {access_token}
```

---

### 3.2. Authorization Model

**Multi-Tenant Isolation:**
- `family_id` stored in JWT `raw_app_meta_data` for performance
- RLS policies use `auth.jwt() ->> 'family_id'` to filter data
- Users can only access data from their own family

**Role-Based Access:**

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to family data, can create invitations, update family details, view all shared content |
| **Member** | View shared content, manage own private content, create events and tasks |

**Visibility Rules (Binary Model):**

| Visibility | Creator | Other Family Members |
|------------|---------|---------------------|
| **Private** | Full access (CRUD) | No access |
| **Shared** | Full access (CRUD) | Read access, can complete tasks |

**RLS Policy Summary:**

- **families**: User can view own family, admin can update
- **profiles**: User can view family members, update own profile only
- **invitation_codes**: Admin only (create, view)
- **events**: 
  - Select: Shared events OR own private events
  - Insert: Must set self as creator
  - Update/Delete: Creator only
- **event_participants**: Visible for accessible events, creator can modify
- **tasks**:
  - Select: Shared tasks OR own private tasks
  - Insert: Must set self as creator
  - Update: Creator OR assignee
  - Delete: Creator only

---

### 3.3. JWT Metadata Sync

**Trigger:** `trg_sync_family_to_jwt` on profiles table

**Purpose:** Syncs `family_id` to JWT for RLS performance optimization

**Implementation:**
```sql
UPDATE auth.users
SET raw_app_meta_data = 
  COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('family_id', NEW.family_id::text)
WHERE id = NEW.id;
```

**Impact:** Eliminates JOIN to profiles table in RLS policies, improving query performance from O(n log n) to O(log n)

---

## 4. Validation and Business Logic

### 4.1. Validation Rules by Resource

#### Families
- `name`: Required, non-empty after trimming, max length not specified (reasonable limit: 100 chars)

#### Profiles
- `display_name`: Required, non-empty after trimming, max length not specified (reasonable limit: 100 chars)
- `role`: Must be 'admin' or 'member'

#### Invitation Codes
- `code`: Exactly 8 characters, alphanumeric, unique
- `days_valid`: Integer between 1 and 30
- Business rule: Code must not be expired or used to be redeemed

#### Events
- `title`: Required, 1-200 characters after trimming (enforced by CHECK constraint)
- `description`: Optional, reasonable max: 2000 characters
- `start_time`: Required, valid ISO 8601 timestamp
- `end_time`: Required, must be after `start_time` (enforced by CHECK constraint)
- `is_private`: Required, boolean
- `participant_ids`: Optional array, all UUIDs must reference profiles in same family

#### Tasks
- `title`: Required, non-empty after trimming, reasonable max: 500 characters
- `due_date`: Optional, valid ISO 8601 timestamp
- `assigned_to`: Optional, must reference profile in same family
- `is_completed`: Boolean
- `is_private`: Required, boolean

---

### 4.2. Business Logic Implementation

#### 4.2.1. Family Creation
**Function:** `create_family_and_assign_admin(user_id, family_name, user_display_name)`

**Process:**
1. Insert into `families` table
2. Insert into `profiles` with `role = 'admin'`
3. Trigger syncs `family_id` to JWT
4. Return family_id

**API Endpoint:** POST /families

---

#### 4.2.2. Invitation System
**Generation Function:** `generate_invitation_code(family_id, admin_id, days_valid)`

**Process:**
1. Verify admin_id has `role = 'admin'`
2. Generate 8-char code using `encode(gen_random_bytes(6), 'base64')`
3. Insert with `expires_at = now() + days_valid * interval '1 day'`
4. Return code

**Redemption Function:** `use_invitation_code(code, user_id, user_display_name)`

**Process:**
1. Find valid code (not expired, not used)
2. Insert user into profiles with `role = 'member'`
3. Update code with `used_at` and `used_by`
4. Trigger syncs family_id to JWT
5. Return family_id

**API Endpoints:** 
- POST /families/me/invitations
- POST /invitations/redeem

---

#### 4.2.3. AI Suggestion Engine
**Trigger:** Event creation (POST /events or POST /events/analyze)

**Rules:**
1. **Birthday Detection**
   - Keywords: "birthday", "bday" (case-insensitive)
   - Suggestion: "Buy a gift"
   - Timing: 7 days before event
   - suggestion_id: "birthday"

2. **Health Detection**
   - Keywords: "doctor", "dentist", "clinic" (case-insensitive)
   - Suggestion: "Prepare medical documents"
   - Timing: 1 day before event
   - suggestion_id: "health"

3. **Outing Detection**
   - Keywords: "cinema", "date", "dinner" (case-insensitive)
   - Condition: All participants must have `role = 'admin'`
   - Suggestion: "Book a babysitter"
   - Timing: 3 days before event
   - suggestion_id: "outing"

4. **Travel Detection**
   - Keywords: "flight", "trip", "vacation" (case-insensitive)
   - Suggestion: "Pack bags"
   - Timing: 2 days before event
   - suggestion_id: "travel"

**Implementation:**
- Execute in Supabase Edge Function (Deno/TypeScript)
- Return suggestions array in POST /events response
- Suggestions are not automatically created as tasks
- User must accept suggestion via POST /tasks/from-suggestion

**API Endpoints:**
- POST /events (creates event + returns suggestions)
- POST /events/analyze (preview suggestions only)

---

#### 4.2.4. Event Participant Management
**Trigger:** `trg_validate_participant_family` (BEFORE INSERT)

**Process:**
1. Validate profile belongs to same family as event
2. Raise exception if mismatch

**Trigger:** `trg_clean_participants_on_private` (AFTER UPDATE)

**Process:**
1. If `is_private` changes from false to true
2. Delete all participants for that event

**API Impact:** 
- PATCH /events/:eventId with `is_private = true` automatically removes participants
- POST /events and PATCH /events validate participants

---

#### 4.2.5. Task Completion Tracking
**Trigger:** `trg_set_task_completion_metadata` (BEFORE UPDATE)

**Process:**
1. If `is_completed` changes from false to true
2. Set `completed_at = now()`
3. Set `completed_by = auth.uid()`

**Analytics Support:**
- Enables tracking of task completion rates
- Identifies who completed tasks (accountability)

**API Endpoint:** PATCH /tasks/:taskId

---

#### 4.2.6. Soft Delete Pattern
**Implementation:** All deletions set `archived_at` timestamp

**Affected Resources:**
- Events (DELETE /events/:eventId)
- Tasks (DELETE /tasks/:taskId)

**Benefits:**
- Preserves data for analytics
- Enables "undo" functionality (future feature)
- Maintains referential integrity

**Query Impact:**
- All list endpoints include `WHERE archived_at IS NULL`
- Partial indexes optimize queries on active records

---

#### 4.2.7. Timestamp Management
**Trigger:** `trg_update_timestamp` (BEFORE UPDATE)

**Tables:** families, profiles, events, tasks

**Process:**
1. Automatically set `updated_at = now()` on every UPDATE

**Benefits:**
- Consistent audit trail
- No manual timestamp management in API code

---

#### 4.2.8. Bulk Task Creation from Suggestions
**Trigger:** POST /events with `accept_suggestions` field

**Implementation:** Supabase Edge Function with database transaction

**Process:**
1. Validate event data
2. Start database transaction
3. Create event record
4. Create event_participants records
5. For each suggestion_id in `accept_suggestions`:
   - Validate suggestion_id matches AI engine output
   - Create task with:
     - `event_id` = created event ID
     - `suggestion_id` = suggestion identifier
     - `created_from_suggestion = true`
     - `is_private` inherited from event
     - `family_id` inherited from event
     - `created_by` = current user
     - `due_date` calculated based on suggestion rule
6. Commit transaction
7. Return event + suggestions + created_tasks

**Transaction Safety:**
```typescript
// Pseudocode for Edge Function
try {
  await supabase.rpc('begin_transaction');
  
  // 1. Create event
  const event = await supabase.from('events').insert(eventData).single();
  
  // 2. Add participants
  await supabase.from('event_participants').insert(participants);
  
  // 3. Create tasks from accepted suggestions
  const tasksToCreate = acceptedSuggestions.map(suggestionId => ({
    event_id: event.id,
    suggestion_id: suggestionId,
    title: getSuggestionTitle(suggestionId),
    due_date: calculateDueDate(event.start_time, suggestionId),
    is_private: event.is_private,
    family_id: event.family_id,
    created_by: userId,
    created_from_suggestion: true
  }));
  
  const tasks = await supabase.from('tasks').insert(tasksToCreate);
  
  await supabase.rpc('commit_transaction');
  
  return { event, suggestions, created_tasks: tasks };
} catch (error) {
  await supabase.rpc('rollback_transaction');
  throw error;
}
```

**Benefits:**
- Atomicity: All-or-nothing creation
- Better UX: Single "Save" button
- Performance: Fewer HTTP round-trips
- Analytics: Accurate tracking of accepted suggestions

**Validation:**
- `accept_suggestions` must be array of valid suggestion IDs
- Each suggestion_id must match AI engine output for this event
- If validation fails, entire transaction rolls back

**API Endpoint:** POST /events

---

### 4.3. Error Handling Standards

All API endpoints follow consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "validation failure reason"
    }
  }
}
```

**Common HTTP Status Codes:**
- `200 OK`: Successful GET, PATCH
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Validation errors, malformed requests
- `401 Unauthorized`: Missing, invalid, or expired token
- `403 Forbidden`: Authenticated but not authorized (RLS policy denial)
- `404 Not Found`: Resource does not exist or not accessible
- `409 Conflict`: Resource conflict (e.g., email already registered)
- `410 Gone`: Resource has expired or been used (invitation codes)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

---

### 4.4. Rate Limiting

**Strategy:** Supabase built-in rate limiting

**Limits (recommended):**
- Authentication endpoints: 10 requests/minute per IP
- Read operations: 100 requests/minute per user
- Write operations: 30 requests/minute per user
- Invitation redemption: 5 requests/hour per IP

**Headers (informational):**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704204000
```

---

### 4.5. Pagination Standards

**Query Parameters:**
- `limit`: Number of records per page (default: 100, max: 500)
- `offset`: Number of records to skip (default: 0)

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "total": 250,
    "limit": 100,
    "offset": 0,
    "has_more": true
  }
}
```

**Applicable Endpoints:**
- GET /events
- GET /tasks

---

### 4.6. Filtering and Sorting

**Filtering:**
- Use query parameters matching field names
- Boolean fields: `true`, `false`
- Date ranges: `_before`, `_after` suffixes
- Special values: `me` for current user

**Sorting:**
- `sort` query parameter with predefined options
- Format: `{field}_{direction}` (e.g., `due_date_asc`)
- Default sort order specified per endpoint

---

## 5. Security Considerations

### 5.1. Data Access Control

**Principle:** Zero-trust architecture with defense in depth

**Layers:**
1. **Authentication:** Supabase Auth JWT validation
2. **Authorization:** Row Level Security policies at database level
3. **Application Logic:** Additional checks in Edge Functions
4. **Validation:** Input sanitization and constraint enforcement

### 5.2. SQL Injection Prevention

**Strategy:** Parameterized queries via Supabase client

**Implementation:** All database queries use prepared statements, never string concatenation

### 5.3. Cross-Family Data Leakage Prevention

**Strategy:** JWT metadata + RLS policies

**Verification:**
- All tables with `family_id` have RLS policies checking JWT
- Foreign key constraints prevent cross-family references
- Triggers validate participant family membership

### 5.4. Private Content Isolation

**Strategy:** Binary visibility + RLS policies

**Rules:**
- Private content only visible to creator
- Shared content visible to all family members
- RLS policies enforce at database level (cannot be bypassed)

### 5.5. Admin Privilege Escalation Prevention

**Strategy:** Role immutability via API

**Implementation:**
- Role changes not exposed via public API
- Admin role assignment only through family creation or database-level operations
- Invitation system only grants 'member' role

### 5.6. Invitation Code Security

**Generation:** Cryptographically secure random bytes (`pg_crypto`)

**Expiration:** Time-limited (configurable, default 7 days)

**Single-use:** Code marked as used after redemption

**Brute Force Protection:** Rate limiting on redemption endpoint

---

## 6. Analytics and Metrics Support

### 6.1. AI Suggestion Conversion Rate (US-006 Metric)

**Tracking Field:** `tasks.created_from_suggestion`

**Query:**
```sql
SELECT 
  suggestion_id,
  COUNT(*) FILTER (WHERE created_from_suggestion = true) * 100.0 / COUNT(*) as conversion_rate
FROM tasks
WHERE suggestion_id IS NOT NULL
  AND family_id = ?
GROUP BY suggestion_id;
```

**API Endpoint (future):** GET /analytics/suggestion-conversion

---

### 6.2. Task Completion Rate

**Tracking Fields:** `tasks.is_completed`, `tasks.completed_at`

**Query:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE is_completed = true) * 100.0 / COUNT(*) as completion_rate
FROM tasks
WHERE family_id = ?
  AND archived_at IS NULL
  AND created_at > now() - interval '30 days';
```

**API Endpoint (future):** GET /analytics/task-completion

---

### 6.3. Daily Active Users (DAU)

**Source:** Supabase Auth session logs

**Tracking:** User login events and session refreshes

**API Endpoint (future):** GET /analytics/dau

---

## 7. Future Enhancements (Post-MVP)

### 7.1. Unresolved Features from Planning
- **Calendar Import:** iCal/Google Calendar/Apple Calendar sync
- **Push Notifications:** Email and browser push for upcoming events/tasks
- **Mobile App:** React Native implementation
- **Specific People Sharing:** Beyond binary Private/Shared model
- **Custom Lists:** User-defined task categories/folders

### 7.2. Scalability Improvements
- **Database Partitioning:** Partition events/tasks by family_id if > 100K families
- **Read Replicas:** Separate analytics queries from transactional workload
- **Edge Caching:** Cache public family calendar views
- **WebSocket Support:** Real-time updates for family members

### 7.3. Advanced AI Features
- **LLM Integration:** OpenRouter.ai for context-aware suggestions
- **Natural Language Processing:** Extract event details from free-text input
- **Smart Scheduling:** Suggest optimal event times based on family calendar
- **Conflict Detection:** Warn about overlapping events

---

## 8. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Set up Supabase project and configure Auth
- [ ] Deploy database migrations (schema, functions, triggers, RLS policies)
- [ ] Generate TypeScript types from database schema
- [ ] Set up Supabase client in React app
- [ ] Implement authentication flow (register, login, logout, refresh)

### Phase 2: Family & Profile Management
- [ ] POST /families (family creation)
- [ ] GET /families/me (family details)
- [ ] PATCH /families/me (update family)
- [ ] POST /families/me/invitations (generate code)
- [ ] GET /families/me/invitations (list codes)
- [ ] POST /invitations/redeem (join family)
- [ ] GET /profiles/me (current user profile)
- [ ] PATCH /profiles/me (update profile)
- [ ] GET /profiles (list family members)

### Phase 3: Calendar & Events
- [ ] POST /events (create event with AI suggestions + bulk task creation)
- [ ] Implement transaction logic for atomic event+tasks creation
- [ ] POST /events/analyze (preview suggestions)
- [ ] GET /events (list with filters)
- [ ] GET /events/:eventId (single event)
- [ ] PATCH /events/:eventId (update event)
- [ ] DELETE /events/:eventId (archive event)
- [ ] Implement AI suggestion engine in Edge Function

### Phase 4: Tasks
- [ ] POST /tasks (manual task creation)
- [ ] POST /tasks/from-suggestion (track conversion)
- [x] GET /tasks (list with filters and pagination) ✅ **IMPLEMENTED** - See `.ai/api-get-tasks-documentation.md`
- [ ] GET /tasks/:taskId (single task)
- [ ] PATCH /tasks/:taskId (update task, mark complete)
- [ ] DELETE /tasks/:taskId (archive task)

### Phase 5: Testing & Deployment
- [ ] Write integration tests for all endpoints
- [ ] Test RLS policies with different user roles
- [ ] Load testing for pagination and filtering
- [ ] Security audit (OWASP Top 10)
- [ ] Deploy to production (Vercel frontend + Supabase backend)
- [ ] Set up monitoring and logging

---

## Appendix A: Database Functions Reference

### A.1. create_family_and_assign_admin
```typescript
// Supabase client call
const { data, error } = await supabase.rpc('create_family_and_assign_admin', {
  user_id: userId,
  family_name: 'Smith Family',
  user_display_name: 'John Smith'
});
```

### A.2. generate_invitation_code
```typescript
const { data, error } = await supabase.rpc('generate_invitation_code', {
  family_id: familyId,
  admin_id: adminId,
  days_valid: 7
});
```

### A.3. use_invitation_code
```typescript
const { data, error } = await supabase.rpc('use_invitation_code', {
  code: 'ABC12XYZ',
  user_id: userId,
  user_display_name: 'Jane Smith'
});
```

---

## Appendix B: Sample API Workflows

### B.1. New User Onboarding (Create Family)
1. POST /auth/register → Get JWT
2. POST /families → Create family hub, user becomes admin
3. POST /families/me/invitations → Generate invitation code
4. Share code with family members

### B.2. Join Existing Family
1. POST /auth/register → Get JWT
2. POST /invitations/redeem → Join family as member
3. GET /families/me → View family details
4. GET /profiles → See family members

### B.3. Create Event with Bulk Task Creation (Recommended)
1. POST /events/analyze → Preview suggestions as user types in form
2. User sees suggestions with checkboxes in event creation modal
3. User checks desired suggestions (e.g., "Prepare medical documents")
4. POST /events with `accept_suggestions: ["health"]` → Creates event + tasks atomically
5. Response includes both created event and tasks in `created_tasks` array
6. GET /tasks → View task feed with new tasks immediately visible

**Benefits:**
- Single save button for better UX
- Atomic transaction (all or nothing)
- Fewer HTTP requests
- Immediate task visibility

### B.4. Create Event with Deferred Task Addition
1. POST /events/analyze → Preview suggestions as user types
2. POST /events (without `accept_suggestions`) → Create event only
3. User later reviews event in calendar
4. POST /tasks/from-suggestion → User accepts suggestion retroactively
5. GET /tasks → View task feed with newly added task

**Use Cases:**
- User uncertain about which tasks to accept during event creation
- User wants to review calendar first
- Post-event task additions

### B.5. Complete Daily Tasks
1. GET /tasks?is_completed=false&sort=due_date_asc → View pending tasks
2. PATCH /tasks/:taskId { is_completed: true } → Mark task complete
3. Trigger automatically sets completed_at and completed_by

---

**Document Version:** 1.1.0  
**Last Updated:** 2026-01-04  
**Status:** Ready for Implementation

**Changelog:**
- v1.1.0 (2026-01-04): Added bulk task creation from AI suggestions in POST /events via `accept_suggestions` field
- v1.0.0 (2026-01-02): Initial API plan

