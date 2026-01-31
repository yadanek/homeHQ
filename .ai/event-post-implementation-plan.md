# API Endpoint Implementation Plan: POST /events

## 1. Przegląd punktu końcowego

Endpoint `POST /events` umożliwia tworzenie nowych wydarzeń kalendarzowych z opcjonalnym automatycznym generowaniem zadań na podstawie sugestii AI. Jest to kluczowy element funkcjonalności HomeHQ, który redukuje obciążenie mentalne rodziców poprzez automatyczne sugerowanie logistycznych zadań związanych z wydarzeniami rodzinnymi.

**Kluczowe funkcjonalności:**
- Tworzenie wydarzenia z walidacją danych wejściowych
- Automatyczna analiza tytułu wydarzenia przez silnik AI (keyword matching)
- Generowanie sugestii zadań na podstawie kontekstu wydarzenia
- Opcjonalne masowe tworzenie zadań z zaakceptowanych sugestii
- Zarządzanie uczestnikami wydarzenia (relacja M:M)
- Obsługa prywatności wydarzeń (binary visibility model)
- Atomowość operacji - transakcja obejmująca wydarzenie, uczestników i zadania

## 2. Szczegóły żądania

### HTTP Method & URL
```
POST /events
```

### Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Request Body Structure

```typescript
interface CreateEventRequest {
  title: string;                    // Required: 1-200 chars after trim
  description?: string;              // Optional: event details
  start_time: string;                // Required: ISO 8601 timestamp
  end_time: string;                  // Required: ISO 8601, must be > start_time
  is_private: boolean;               // Required: visibility flag
  participant_ids?: string[];        // Optional: array of profile UUIDs
  accept_suggestions?: string[];     // Optional: suggestion IDs to convert to tasks
}
```

### Example Request
```json
{
  "title": "Dentist Appointment",
  "description": "Annual checkup for the kids",
  "start_time": "2026-01-15T10:00:00Z",
  "end_time": "2026-01-15T11:00:00Z",
  "is_private": false,
  "participant_ids": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
  "accept_suggestions": ["health"]
}
```

### Parameters Description

| Parameter | Type | Required | Validation Rules |
|-----------|------|----------|------------------|
| `title` | string | Yes | 1-200 characters after trimming, non-empty |
| `description` | string | No | Any text, stored as-is |
| `start_time` | string | Yes | Valid ISO 8601 timestamp |
| `end_time` | string | Yes | Valid ISO 8601 timestamp, must be after `start_time` |
| `is_private` | boolean | Yes | true or false |
| `participant_ids` | string[] | No | Array of valid UUIDs, must belong to same family |
| `accept_suggestions` | string[] | No | Array of valid suggestion IDs: 'birthday', 'health', 'outing', 'travel' |

## 3. Wykorzystywane typy

### Request Types
```typescript
// From types.ts
interface CreateEventRequest extends Pick<
  TablesInsert<'events'>,
  'title' | 'description' | 'start_time' | 'end_time' | 'is_private'
> {
  participant_ids?: string[];
  accept_suggestions?: string[];  // NEW: not in current types.ts
}
```

### Response Types
```typescript
// From types.ts
interface CreateEventResponse {
  event: EventWithParticipants;
  suggestions: TaskSuggestion[];
  created_tasks: TaskResponse[];  // NEW: not in current types.ts
}

interface EventWithParticipants extends Tables<'events'> {
  participants: EventParticipant[];
}

interface EventParticipant {
  id: string;
  display_name: string;
}

interface TaskSuggestion {
  suggestion_id: string;
  title: string;
  due_date: string | null;
  description?: string;
  accepted?: boolean;  // NEW: indicates if suggestion was accepted
}

interface TaskResponse extends Tables<'tasks'> {
  // Full task object from database
}
```

### Zod Validation Schemas

```typescript
// To be created in src/lib/validations/events.ts
import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  description: z.string().optional(),
  start_time: z.string()
    .datetime({ message: 'Invalid ISO 8601 timestamp' }),
  end_time: z.string()
    .datetime({ message: 'Invalid ISO 8601 timestamp' }),
  is_private: z.boolean(),
  participant_ids: z.array(z.string().uuid()).optional(),
  accept_suggestions: z.array(z.enum(['birthday', 'health', 'outing', 'travel'])).optional()
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  { message: 'end_time must be after start_time', path: ['end_time'] }
).refine(
  (data) => {
    if (data.is_private && data.participant_ids && data.participant_ids.length > 1) {
      return false;
    }
    return true;
  },
  { message: 'Private events cannot have multiple participants', path: ['participant_ids'] }
);
```

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

```json
{
  "event": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "family_id": "660e8400-e29b-41d4-a716-446655440000",
    "created_by": "770e8400-e29b-41d4-a716-446655440000",
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
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "display_name": "Kid 1"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
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
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "family_id": "660e8400-e29b-41d4-a716-446655440000",
      "created_by": "770e8400-e29b-41d4-a716-446655440000",
      "title": "Prepare medical documents",
      "due_date": "2026-01-14T10:00:00Z",
      "assigned_to": null,
      "is_completed": false,
      "completed_at": null,
      "completed_by": null,
      "is_private": false,
      "event_id": "550e8400-e29b-41d4-a716-446655440000",
      "suggestion_id": "health",
      "created_from_suggestion": true,
      "created_at": "2026-01-02T12:00:00Z",
      "updated_at": "2026-01-02T12:00:00Z",
      "archived_at": null
    }
  ]
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": {
      "field": "title",
      "error": "Title must be 200 characters or less"
    }
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

#### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Participant does not belong to your family"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create event. Please try again."
  }
}
```

## 5. Przepływ danych

### High-Level Flow Diagram

```
┌──────────────┐
│   Client     │
│  (React 19)  │
└──────┬───────┘
       │ POST /events
       │ (Authorization: Bearer token)
       ▼
┌──────────────────────────────────────────────┐
│          API Route Handler                    │
│  (React 19 Action / API Route)               │
│                                               │
│  1. Extract JWT from Authorization header    │
│  2. Validate request with Zod schema         │
│  3. Extract user_id and family_id from JWT   │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│        Supabase Edge Function                 │
│      "create-event-with-suggestions"          │
│                                               │
│  4. Call AI suggestion engine                │
│     - Analyze event title for keywords       │
│     - Generate task suggestions              │
│  5. Return suggestions to API handler        │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│         Database Transaction                  │
│         (PostgreSQL with RLS)                 │
│                                               │
│  BEGIN TRANSACTION;                           │
│                                               │
│  6. INSERT INTO events                        │
│     - Set family_id from JWT                 │
│     - Set created_by from JWT                │
│     - RLS validates family membership        │
│                                               │
│  7. INSERT INTO event_participants            │
│     - Bulk insert participant records        │
│     - Trigger validates same-family check    │
│                                               │
│  8. INSERT INTO tasks (if accept_suggestions) │
│     - Create tasks from accepted suggestions │
│     - Set created_from_suggestion = true     │
│     - Link to event via event_id             │
│     - Inherit is_private from event          │
│                                               │
│  COMMIT;                                      │
│  (or ROLLBACK on any failure)                │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│        Fetch Complete Event Data              │
│                                               │
│  9. JOIN events with event_participants      │
│  10. JOIN with profiles for display_name     │
│  11. Fetch created tasks                     │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│       Format & Return Response                │
│                                               │
│  12. Build CreateEventResponse object        │
│      - event with participants               │
│      - suggestions with accepted flags       │
│      - created_tasks array                   │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│   Client     │
│  (201 Created)│
└──────────────┘
```

### Detailed Step-by-Step Flow

1. **Client Request**: React 19 Action sends POST request with validated form data
2. **Authentication**: API handler extracts and validates JWT token
3. **Input Validation**: Zod schema validates all request fields
4. **User Context Extraction**: Extract `user_id` and `family_id` from JWT metadata
5. **AI Suggestion Engine**: Call Edge Function to analyze event title and generate suggestions
6. **Database Transaction Start**: Begin atomic transaction
7. **Event Creation**: Insert event record with auto-populated `family_id` and `created_by`
8. **Participant Assignment**: Bulk insert into `event_participants` table
9. **Task Creation**: If `accept_suggestions` provided, create tasks from selected suggestions
10. **Transaction Commit**: Commit all changes or rollback on any failure
11. **Data Enrichment**: Fetch complete event with participants and created tasks
12. **Response Formatting**: Build standardized response object
13. **Return to Client**: Send 201 Created with complete data

### External Service Interactions

#### Supabase Edge Function (AI Suggestion Engine)

**Input:**
```typescript
{
  title: string;
  start_time: string;
  participant_ids?: string[];
  user_role?: 'admin' | 'member';
}
```

**Output:**
```typescript
{
  suggestions: TaskSuggestion[];
}
```

**AI Rules (Keyword Matching):**
- **Birthday** (`birthday`, `bday`) → "Buy a gift" (due: 7 days before event)
- **Health** (`doctor`, `dentist`, `clinic`) → "Prepare medical documents" (due: 1 day before)
- **Outing** (`cinema`, `date`, `dinner` + admin only) → "Book a babysitter" (due: 3 days before)
- **Travel** (`flight`, `trip`, `vacation`) → "Pack bags" (due: 2 days before)

## 6. Względy bezpieczeństwa

### 6.1 Uwierzytelnianie

**Mechanism**: JWT Bearer Token (Supabase Auth)
- Token musi być obecny w nagłówku `Authorization: Bearer {token}`
- Token walidowany przez Supabase middleware
- Wygasłe tokeny zwracają 401 Unauthorized

**Implementation**:
```typescript
// In API handler
const token = request.headers.get('Authorization')?.replace('Bearer ', '');
if (!token) {
  return new Response(JSON.stringify({
    error: { code: 'UNAUTHORIZED', message: 'Missing authentication token' }
  }), { status: 401 });
}

const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response(JSON.stringify({
    error: { code: 'UNAUTHORIZED', message: 'Invalid authentication token' }
  }), { status: 401 });
}
```

### 6.2 Autoryzacja

**Row Level Security (RLS) Policies**:

```sql
-- Policy for INSERT on events table
CREATE POLICY "Users can create events in their family"
ON events FOR INSERT
TO authenticated
WITH CHECK (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy for SELECT on events table
CREATE POLICY "Users can view events based on privacy"
ON events FOR SELECT
TO authenticated
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    is_private = false 
    OR created_by = auth.uid()
  )
);
```

**Participant Validation Trigger**:
```sql
-- Trigger to validate participants belong to same family
CREATE OR REPLACE FUNCTION validate_event_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.profile_id 
    AND family_id != (SELECT family_id FROM events WHERE id = NEW.event_id)
  ) THEN
    RAISE EXCEPTION 'Participant does not belong to event family';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_event_participants_family
  BEFORE INSERT OR UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION validate_event_participants();
```

### 6.3 Walidacja danych wejściowych

**Multi-Layer Validation**:

1. **Frontend (React)**: Basic validation for UX
2. **API Handler (Zod)**: Strict schema validation
3. **Database (Constraints)**: Final enforcement

**Key Validations**:
- Title length: 1-200 characters (prevents DoS via large strings)
- UUID format: Prevents SQL injection via malformed IDs
- Timestamp validity: Prevents invalid date attacks
- Private event constraints: Prevents privacy violations
- Suggestion ID whitelist: Prevents injection of arbitrary task templates

### 6.4 Zagrożenia i mitygacje

| Threat | Mitigation |
|--------|------------|
| **SQL Injection** | Supabase client uses parameterized queries |
| **Unauthorized family access** | RLS policies enforce family_id matching |
| **Cross-family participant injection** | Database trigger validates same-family membership |
| **Private event exposure** | Application-level validation + RLS policies |
| **Token theft** | HTTPS only, short token expiration, refresh token rotation |
| **DoS via large payloads** | Title length limit, pagination on participants |
| **Task injection** | Validate suggestion IDs against AI engine output |
| **Transaction race conditions** | Database-level ACID guarantees |

## 7. Obsługa błędów

### 7.1 Katalog błędów

| Error Code | HTTP Status | Scenario | User Message |
|------------|-------------|----------|--------------|
| `UNAUTHORIZED` | 401 | Missing/invalid JWT | "Authentication required. Please log in." |
| `INVALID_INPUT` | 400 | Validation failure | "Please check your input: {field_errors}" |
| `INVALID_TIME_RANGE` | 400 | end_time ≤ start_time | "Event end time must be after start time" |
| `INVALID_PRIVATE_EVENT` | 400 | Private event + multiple participants | "Private events can only have one participant" |
| `INVALID_PARTICIPANT` | 400 | Non-existent participant UUID | "One or more participants not found" |
| `FORBIDDEN` | 403 | Participant from different family | "Cannot add participants from other families" |
| `INVALID_SUGGESTION` | 400 | Unknown suggestion ID | "Invalid suggestion ID provided" |
| `AI_ENGINE_ERROR` | 500 | Edge function failure | "Unable to generate suggestions. Event created without suggestions." |
| `TRANSACTION_FAILED` | 500 | Database rollback | "Failed to create event. Please try again." |
| `INTERNAL_ERROR` | 500 | Unexpected error | "An error occurred. Please try again later." |

### 7.2 Error Response Format

**Standard Error Structure**:
```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

**Example with Validation Details**:
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": {
      "title": "Title must be 200 characters or less",
      "end_time": "end_time must be after start_time"
    }
  }
}
```

### 7.3 Error Handling Strategy

**Graceful Degradation**:
- If AI engine fails, create event without suggestions (partial success)
- Log error for monitoring but don't block user action
- Return 201 with empty suggestions array

**Transaction Rollback**:
- If task creation fails, rollback entire transaction
- Return 500 with clear error message
- Log complete error stack for debugging

**Error Logging**:
```typescript
// Log to Supabase logs (accessible in dashboard)
console.error('Event creation failed', {
  user_id: user.id,
  family_id: user.user_metadata.family_id,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

## 8. Rozważania dotyczące wydajności

### 8.1 Potencjalne wąskie gardła

1. **AI Suggestion Engine**: Edge Function call adds latency
   - **Impact**: +100-300ms per request
   - **Mitigation**: Implement caching for common keywords, use lightweight keyword matching

2. **Bulk Participant Inserts**: Multiple rows in `event_participants`
   - **Impact**: O(n) inserts where n = number of participants
   - **Mitigation**: Use batch insert with `INSERT INTO ... VALUES (...), (...), (...)`

3. **Task Creation from Suggestions**: Additional table writes
   - **Impact**: +50ms per task
   - **Mitigation**: Batch inserts within same transaction

4. **Data Enrichment Query**: JOIN across multiple tables
   - **Impact**: Proportional to number of participants
   - **Mitigation**: Use indexed foreign keys, limit max participants

### 8.2 Strategie optymalizacji

**Database Indexes**:
```sql
-- Already defined in schema
CREATE INDEX idx_events_family_start ON events(family_id, start_time) 
  WHERE archived_at IS NULL;
CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_profile ON event_participants(profile_id);
```

**Query Optimization**:
```typescript
// Fetch event with participants in single query
const { data: eventWithParticipants } = await supabase
  .from('events')
  .select(`
    *,
    participants:event_participants(
      profile:profiles(id, display_name)
    )
  `)
  .eq('id', eventId)
  .single();
```

**Batch Operations**:
```typescript
// Batch insert participants
await supabase
  .from('event_participants')
  .insert(
    participantIds.map(profileId => ({
      event_id: eventId,
      profile_id: profileId
    }))
  );
```

**Edge Function Caching**:
```typescript
// Cache suggestion templates in memory
const SUGGESTION_TEMPLATES = {
  birthday: { title: 'Buy a gift', days_before: 7 },
  health: { title: 'Prepare medical documents', days_before: 1 },
  // ...
};
```

### 8.3 Limity wydajnościowe

**Recommended Limits**:
- Max participants per event: **50** (reasonable for family gatherings)
- Max accepted suggestions: **10** (prevents excessive task creation)
- Request timeout: **30 seconds** (Edge Function + DB operations)
- Max event title length: **200 characters** (already in spec)

**Rate Limiting** (to be implemented at API Gateway level):
- 10 event creations per minute per user
- 100 event creations per hour per family

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie typów i schematów walidacji

**Pliki do utworzenia/modyfikacji:**
- `src/types.ts` - Dodać `accept_suggestions` do `CreateEventRequest`
- `src/types.ts` - Dodać `accepted` do `TaskSuggestion`
- `src/types.ts` - Dodać `created_tasks` array do `CreateEventResponse`
- `src/lib/validations/events.ts` - Utworzyć `createEventSchema` (Zod)

**Zadania:**
```typescript
// 1. Update CreateEventRequest type
export interface CreateEventRequest
  extends Pick<
    TablesInsert<'events'>,
    'title' | 'description' | 'start_time' | 'end_time' | 'is_private'
  > {
  participant_ids?: string[];
  accept_suggestions?: SuggestionId[];  // NEW
}

// 2. Update TaskSuggestion type
export interface TaskSuggestion {
  suggestion_id: string;
  title: string;
  due_date: string | null;
  description?: string;
  accepted?: boolean;  // NEW
}

// 3. Update CreateEventResponse type
export interface CreateEventResponse {
  event: EventWithParticipants;
  suggestions: TaskSuggestion[];
  created_tasks: TaskResponse[];  // NEW
}

// 4. Create Zod schema (as shown in section 3)
```

### Krok 2: Implementacja Edge Function dla AI Suggestion Engine

**Plik:** `supabase/functions/analyze-event-for-suggestions/index.ts`

**Zadania:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AnalyzeEventRequest {
  title: string;
  start_time: string;
  participant_ids?: string[];
  user_role?: 'admin' | 'member';
}

interface TaskSuggestion {
  suggestion_id: string;
  title: string;
  due_date: string;
  description?: string;
}

serve(async (req) => {
  try {
    const { title, start_time, user_role } = await req.json() as AnalyzeEventRequest;
    
    // Normalize title for keyword matching
    const titleLower = title.toLowerCase();
    const suggestions: TaskSuggestion[] = [];
    const eventDate = new Date(start_time);
    
    // Birthday keyword matching
    if (titleLower.includes('birthday') || titleLower.includes('bday')) {
      const dueDate = new Date(eventDate);
      dueDate.setDate(dueDate.getDate() - 7);
      suggestions.push({
        suggestion_id: 'birthday',
        title: 'Buy a gift',
        due_date: dueDate.toISOString(),
        description: 'Purchase birthday present'
      });
    }
    
    // Health keyword matching
    if (titleLower.includes('doctor') || titleLower.includes('dentist') || titleLower.includes('clinic')) {
      const dueDate = new Date(eventDate);
      dueDate.setDate(dueDate.getDate() - 1);
      suggestions.push({
        suggestion_id: 'health',
        title: 'Prepare medical documents',
        due_date: dueDate.toISOString(),
        description: 'Gather insurance cards and medical history'
      });
    }
    
    // Outing keyword matching (admins only)
    if (user_role === 'admin' && (
      titleLower.includes('cinema') || 
      titleLower.includes('date') || 
      titleLower.includes('dinner')
    )) {
      const dueDate = new Date(eventDate);
      dueDate.setDate(dueDate.getDate() - 3);
      suggestions.push({
        suggestion_id: 'outing',
        title: 'Book a babysitter',
        due_date: dueDate.toISOString(),
        description: 'Arrange childcare for the event'
      });
    }
    
    // Travel keyword matching
    if (titleLower.includes('flight') || titleLower.includes('trip') || titleLower.includes('vacation')) {
      const dueDate = new Date(eventDate);
      dueDate.setDate(dueDate.getDate() - 2);
      suggestions.push({
        suggestion_id: 'travel',
        title: 'Pack bags',
        due_date: dueDate.toISOString(),
        description: 'Prepare luggage and travel essentials'
      });
    }
    
    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI suggestion engine error:', error);
    return new Response(
      JSON.stringify({ 
        error: { code: 'AI_ENGINE_ERROR', message: error.message } 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

**Deploy:**
```bash
supabase functions deploy analyze-event-for-suggestions
```

### Krok 3: Utworzenie Database Triggers i Functions

**Plik:** `supabase/migrations/YYYYMMDDHHMMSS_event_triggers.sql`

**Zadania:**
```sql
-- 1. Trigger to validate event participants belong to same family
CREATE OR REPLACE FUNCTION validate_event_participants()
RETURNS TRIGGER AS $$
DECLARE
  event_family_id uuid;
BEGIN
  -- Get family_id from event
  SELECT family_id INTO event_family_id
  FROM events
  WHERE id = NEW.event_id;
  
  -- Check if participant belongs to same family
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.profile_id 
    AND family_id = event_family_id
  ) THEN
    RAISE EXCEPTION 'Participant does not belong to event family';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_event_participants_family
  BEFORE INSERT OR UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION validate_event_participants();

-- 2. Trigger to clean participants when event becomes private
CREATE OR REPLACE FUNCTION clean_participants_on_private()
RETURNS TRIGGER AS $$
BEGIN
  -- If event is being set to private, remove all participants except creator
  IF NEW.is_private = true AND OLD.is_private = false THEN
    DELETE FROM event_participants
    WHERE event_id = NEW.id
    AND profile_id != NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_private_event_participants
  AFTER UPDATE OF is_private ON events
  FOR EACH ROW EXECUTE FUNCTION clean_participants_on_private();

-- 3. Function to get event with participants
CREATE OR REPLACE FUNCTION get_event_with_participants(event_uuid uuid)
RETURNS json AS $$
  SELECT json_build_object(
    'id', e.id,
    'family_id', e.family_id,
    'created_by', e.created_by,
    'title', e.title,
    'description', e.description,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'is_private', e.is_private,
    'created_at', e.created_at,
    'updated_at', e.updated_at,
    'archived_at', e.archived_at,
    'participants', COALESCE(
      (
        SELECT json_agg(json_build_object('id', p.id, 'display_name', p.display_name))
        FROM event_participants ep
        JOIN profiles p ON p.id = ep.profile_id
        WHERE ep.event_id = e.id
      ),
      '[]'::json
    )
  )
  FROM events e
  WHERE e.id = event_uuid;
$$ LANGUAGE sql STABLE;
```

### Krok 4: Implementacja Service Layer

**Plik:** `src/services/eventService.ts`

**Zadania:**
```typescript
import type { SupabaseClient } from '../db/supabase.client';
import type { 
  CreateEventRequest, 
  CreateEventResponse,
  EventWithParticipants,
  TaskSuggestion 
} from '../types';

export class EventService {
  constructor(private supabase: SupabaseClient) {}
  
  async createEventWithSuggestions(
    request: CreateEventRequest,
    userId: string,
    familyId: string,
    userRole: 'admin' | 'member'
  ): Promise<CreateEventResponse> {
    // 1. Call AI suggestion engine
    const suggestions = await this.getAISuggestions(
      request.title,
      request.start_time,
      request.participant_ids,
      userRole
    );
    
    // 2. Start transaction
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
    
    if (eventError) throw eventError;
    
    try {
      // 3. Insert participants
      if (request.participant_ids && request.participant_ids.length > 0) {
        await this.addParticipants(event.id, request.participant_ids);
      }
      
      // 4. Create tasks from accepted suggestions
      const createdTasks = [];
      if (request.accept_suggestions && request.accept_suggestions.length > 0) {
        const acceptedSuggestions = suggestions.filter(s => 
          request.accept_suggestions!.includes(s.suggestion_id)
        );
        
        for (const suggestion of acceptedSuggestions) {
          const task = await this.createTaskFromSuggestion(
            suggestion,
            event.id,
            familyId,
            userId,
            request.is_private
          );
          createdTasks.push(task);
        }
      }
      
      // 5. Fetch complete event with participants
      const eventWithParticipants = await this.getEventWithParticipants(event.id);
      
      // 6. Mark accepted suggestions
      const suggestionsWithAccepted = suggestions.map(s => ({
        ...s,
        accepted: request.accept_suggestions?.includes(s.suggestion_id) || false
      }));
      
      return {
        event: eventWithParticipants,
        suggestions: suggestionsWithAccepted,
        created_tasks: createdTasks
      };
    } catch (error) {
      // Rollback: delete event (cascade will clean participants and tasks)
      await this.supabase.from('events').delete().eq('id', event.id);
      throw error;
    }
  }
  
  private async getAISuggestions(
    title: string,
    start_time: string,
    participant_ids?: string[],
    user_role?: 'admin' | 'member'
  ): Promise<TaskSuggestion[]> {
    try {
      const { data, error } = await this.supabase.functions.invoke(
        'analyze-event-for-suggestions',
        {
          body: { title, start_time, participant_ids, user_role }
        }
      );
      
      if (error) throw error;
      return data.suggestions;
    } catch (error) {
      console.error('AI suggestion engine failed:', error);
      return []; // Graceful degradation
    }
  }
  
  private async addParticipants(eventId: string, participantIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('event_participants')
      .insert(
        participantIds.map(profileId => ({
          event_id: eventId,
          profile_id: profileId
        }))
      );
    
    if (error) throw error;
  }
  
  private async createTaskFromSuggestion(
    suggestion: TaskSuggestion,
    eventId: string,
    familyId: string,
    createdBy: string,
    isPrivate: boolean
  ) {
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
        created_from_suggestion: true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  private async getEventWithParticipants(eventId: string): Promise<EventWithParticipants> {
    const { data, error } = await this.supabase
      .from('events')
      .select(`
        *,
        participants:event_participants(
          profile:profiles(id, display_name)
        )
      `)
      .eq('id', eventId)
      .single();
    
    if (error) throw error;
    
    // Transform nested structure
    return {
      ...data,
      participants: data.participants.map((p: any) => ({
        id: p.profile.id,
        display_name: p.profile.display_name
      }))
    };
  }
}
```

### Krok 5: Implementacja API Route Handler (React 19 Action)

**Plik:** `src/actions/createEvent.ts`

**Zadania:**
```typescript
'use server';

import { createClient } from '../db/supabase.client';
import { EventService } from '../services/eventService';
import { createEventSchema } from '../lib/validations/events';
import type { CreateEventRequest, CreateEventResponse, ApiError } from '../types';

export async function createEvent(
  formData: CreateEventRequest
): Promise<{ data?: CreateEventResponse; error?: ApiError }> {
  try {
    // 1. Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        error: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.'
          }
        }
      };
    }
    
    // 2. Validate input with Zod
    const validation = createEventSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      return {
        error: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Validation failed',
            details: fieldErrors
          }
        }
      };
    }
    
    // 3. Get user context
    const familyId = user.user_metadata?.family_id;
    const userRole = user.user_metadata?.role || 'member';
    
    if (!familyId) {
      return {
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'User does not belong to a family'
          }
        }
      };
    }
    
    // 4. Additional validation: private event constraints
    if (validation.data.is_private && 
        validation.data.participant_ids && 
        validation.data.participant_ids.length > 1) {
      return {
        error: {
          error: {
            code: 'INVALID_PRIVATE_EVENT',
            message: 'Private events cannot have multiple participants'
          }
        }
      };
    }
    
    // 5. Create event with service
    const eventService = new EventService(supabase);
    const result = await eventService.createEventWithSuggestions(
      validation.data,
      user.id,
      familyId,
      userRole
    );
    
    return { data: result };
    
  } catch (error: any) {
    console.error('Event creation error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Handle specific error types
    if (error.message?.includes('Participant does not belong')) {
      return {
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot add participants from other families'
          }
        }
      };
    }
    
    return {
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create event. Please try again.'
        }
      }
    };
  }
}
```

### Krok 6: Implementacja UI Component (React 19)

**Plik:** `src/components/CreateEventForm.tsx`

**Zadania:**
```typescript
import { useState, useOptimistic } from 'react';
import { createEvent } from '../actions/createEvent';
import type { CreateEventRequest, TaskSuggestion } from '../types';

export function CreateEventForm() {
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    
    const request: CreateEventRequest = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      start_time: formData.get('start_time') as string,
      end_time: formData.get('end_time') as string,
      is_private: formData.get('is_private') === 'true',
      participant_ids: formData.getAll('participant_ids') as string[],
      accept_suggestions: acceptedSuggestions
    };
    
    const result = await createEvent(request);
    
    if (result.error) {
      alert(result.error.error.message);
    } else {
      // Success! Redirect or show success message
      console.log('Event created:', result.data);
    }
    
    setIsLoading(false);
  }
  
  return (
    <form action={handleSubmit}>
      {/* Form fields */}
      <input name="title" type="text" required />
      <textarea name="description" />
      <input name="start_time" type="datetime-local" required />
      <input name="end_time" type="datetime-local" required />
      <input name="is_private" type="checkbox" />
      
      {/* Suggestion checkboxes */}
      {suggestions.map(suggestion => (
        <label key={suggestion.suggestion_id}>
          <input
            type="checkbox"
            checked={acceptedSuggestions.includes(suggestion.suggestion_id)}
            onChange={(e) => {
              if (e.target.checked) {
                setAcceptedSuggestions([...acceptedSuggestions, suggestion.suggestion_id]);
              } else {
                setAcceptedSuggestions(
                  acceptedSuggestions.filter(id => id !== suggestion.suggestion_id)
                );
              }
            }}
          />
          {suggestion.title} (due: {suggestion.due_date})
        </label>
      ))}
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
}
```

### Krok 7: Testy integracyjne

**Plik:** `tests/api/events-post.test.ts`

**Zadania:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('POST /events', () => {
  let supabase: any;
  let testUser: any;
  let testFamily: any;
  
  beforeAll(async () => {
    // Setup test environment
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    // ... create test user and family
  });
  
  afterAll(async () => {
    // Cleanup test data
  });
  
  it('should create event without participants', async () => {
    const request = {
      title: 'Team Meeting',
      start_time: '2026-02-01T10:00:00Z',
      end_time: '2026-02-01T11:00:00Z',
      is_private: false
    };
    
    const response = await createEvent(request);
    
    expect(response.data).toBeDefined();
    expect(response.data?.event.title).toBe('Team Meeting');
    expect(response.data?.participants).toHaveLength(0);
  });
  
  it('should generate health suggestions for doctor keyword', async () => {
    const request = {
      title: 'Doctor appointment',
      start_time: '2026-02-01T10:00:00Z',
      end_time: '2026-02-01T11:00:00Z',
      is_private: false
    };
    
    const response = await createEvent(request);
    
    expect(response.data?.suggestions).toContainEqual(
      expect.objectContaining({ suggestion_id: 'health' })
    );
  });
  
  it('should create tasks from accepted suggestions', async () => {
    const request = {
      title: 'Birthday party',
      start_time: '2026-02-01T15:00:00Z',
      end_time: '2026-02-01T17:00:00Z',
      is_private: false,
      accept_suggestions: ['birthday']
    };
    
    const response = await createEvent(request);
    
    expect(response.data?.created_tasks).toHaveLength(1);
    expect(response.data?.created_tasks[0].title).toBe('Buy a gift');
    expect(response.data?.created_tasks[0].suggestion_id).toBe('birthday');
  });
  
  it('should reject private event with multiple participants', async () => {
    const request = {
      title: 'Private meeting',
      start_time: '2026-02-01T10:00:00Z',
      end_time: '2026-02-01T11:00:00Z',
      is_private: true,
      participant_ids: ['uuid1', 'uuid2']
    };
    
    const response = await createEvent(request);
    
    expect(response.error).toBeDefined();
    expect(response.error?.error.code).toBe('INVALID_PRIVATE_EVENT');
  });
  
  it('should reject participants from different family', async () => {
    // Test cross-family participant validation
    // ... implementation
  });
  
  it('should rollback on task creation failure', async () => {
    // Test transaction atomicity
    // ... implementation
  });
});
```

### Krok 8: Dokumentacja i deployment

**Zadania:**
1. **Dokumentacja API**:
   - Dodać endpoint do OpenAPI/Swagger spec
   - Zaktualizować README z przykładami użycia
   
2. **Monitoring**:
   - Skonfigurować alerty dla błędów 500
   - Dodać metryki wydajności (latency tracking)
   
3. **Deployment**:
   ```bash
   # Deploy Edge Function
   supabase functions deploy analyze-event-for-suggestions
   
   # Run migrations
   supabase db push
   
   # Deploy frontend
   npm run build
   vercel deploy --prod
   ```

4. **Post-deployment verification**:
   - Wykonać smoke tests na produkcji
   - Zweryfikować RLS policies w Supabase dashboard
   - Sprawdzić logi Edge Functions

---

## Podsumowanie

Ten plan implementacji zapewnia kompleksowe wytyczne dla zespołu programistów do skutecznego wdrożenia endpointu `POST /events`. Kluczowe punkty:

✅ **Bezpieczeństwo**: Multi-layer security z RLS, triggers i walidacją Zod  
✅ **Wydajność**: Batch operations, indexed queries, graceful degradation  
✅ **Atomowość**: Database transactions zapewniają spójność danych  
✅ **Testowalność**: Comprehensive test suite z edge cases  
✅ **Maintainability**: Clean separation of concerns (service layer)  
✅ **Skalowanie**: Edge Functions przygotowane pod integrację z OpenRouter.ai  

**Czas implementacji**: ~5-7 dni roboczych  
**Priorytet**: Wysoki (core feature dla MVP)

