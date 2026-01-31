# API Endpoint Implementation Plan: PATCH /events/:eventId

## 1. Przegląd punktu końcowego

**Endpoint**: `PATCH /events/:eventId`

**Cel**: Aktualizacja istniejącego eventu kalendarza w systemie HomeHQ. Endpoint umożliwia częściową aktualizację (partial update) pól eventu oraz zarządzanie listą uczestników. Tylko twórca eventu może go modyfikować, co jest wymuszane przez Row Level Security (RLS) w Supabase.

**Kluczowe funkcje**:
- Partial update - wszystkie pola request body są opcjonalne
- Zarządzanie uczestnikami poprzez zastępowanie całej listy
- Automatyczne czyszczenie uczestników gdy event staje się prywatny
- Walidacja, że uczestnicy należą do tej samej rodziny co event
- Automatyczna aktualizacja pola `updated_at` przez trigger bazodanowy

---

## 2. Szczegóły żądania

### Metoda HTTP
`PATCH`

### Struktura URL
```
/events/:eventId
```

### Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Path Parameters

**Wymagane**:
- `eventId` (string, UUID) - Unikalny identyfikator eventu do aktualizacji

### Request Body

**Wszystkie pola opcjonalne** (partial update):

```typescript
{
  title?: string;              // Tytuł eventu (1-200 znaków po trim)
  description?: string;         // Opcjonalny opis eventu
  start_time?: string;          // ISO 8601 timestamp
  end_time?: string;            // ISO 8601 timestamp (musi być > start_time)
  is_private?: boolean;         // Flaga prywatności (false = Shared, true = Private)
  participant_ids?: string[];   // Lista UUID uczestników (zastępuje całą listę)
}
```

**Przykład żądania**:
```json
{
  "title": "Updated Dentist Appointment",
  "description": "Rescheduled checkup",
  "start_time": "2026-01-16T10:00:00Z",
  "end_time": "2026-01-16T11:00:00Z",
  "is_private": false,
  "participant_ids": ["uuid1", "uuid2"]
}
```

---

## 3. Wykorzystywane typy

### Request Types
```typescript
// z src/types.ts (linie 293-301)
interface UpdateEventRequest extends Partial<
  Pick<
    TablesUpdate<'events'>,
    'title' | 'description' | 'start_time' | 'end_time' | 'is_private'
  >
> {
  participant_ids?: string[];
}
```

### Response Types
```typescript
// z src/types.ts (linie 307-313)
interface UpdateEventResponse extends Pick<
  Tables<'events'>,
  'id' | 'title' | 'description' | 'start_time' | 'end_time' | 'is_private' | 'updated_at'
> {
  participants: EventParticipant[];
}

// z src/types.ts (linia 208)
type EventParticipant = Pick<Tables<'profiles'>, 'id' | 'display_name'>;
```

### Error Type
```typescript
// z src/types.ts (linie 27-33)
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Updated Dentist Appointment",
  "description": "Rescheduled checkup",
  "start_time": "2026-01-16T10:00:00Z",
  "end_time": "2026-01-16T11:00:00Z",
  "is_private": false,
  "updated_at": "2026-01-26T14:30:00Z",
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
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request data",
    "details": {
      "title": "Title must be between 1 and 200 characters",
      "end_time": "End time must be after start time"
    }
  }
}
```

**Przypadki**:
- Niepoprawny format UUID dla `eventId`
- Niepoprawne dane w request body (walidacja Zod)
- `end_time` <= `start_time`
- Uczestnicy (`participant_ids`) spoza rodziny
- Tytuł pusty lub dłuższy niż 200 znaków

#### 401 Unauthorized
```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing or invalid authentication token"
  }
}
```

**Przypadki**:
- Brak header `Authorization`
- Niepoprawny lub wygasły token

#### 403 Forbidden
```json
{
  "error": {
    "code": "forbidden",
    "message": "You are not authorized to update this event"
  }
}
```

**Przypadki**:
- Użytkownik nie jest twórcą eventu (RLS policy zablokuje operację)

#### 404 Not Found
```json
{
  "error": {
    "code": "not_found",
    "message": "Event not found"
  }
}
```

**Przypadki**:
- Event o podanym ID nie istnieje
- Event jest zarchiwizowany (`archived_at IS NOT NULL`)

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "internal_error",
    "message": "An unexpected error occurred"
  }
}
```

**Przypadki**:
- Błąd bazy danych
- Nieoczekiwany wyjątek w kodzie

---

## 5. Przepływ danych

### Architektura
```
Client (React 19)
    ↓ [React Action with useOptimistic]
API Route Handler (/events/:eventId PATCH)
    ↓ [JWT verification via Supabase Auth]
Validation Layer (Zod schema)
    ↓ [Validate UpdateEventRequest]
Event Service (business logic)
    ↓ [updateEvent function]
Supabase Database (PostgreSQL)
    → events table [UPDATE with RLS check]
    → event_participants table [DELETE old + INSERT new]
    → profiles table [JOIN for participant names]
    ↓ [Trigger: update_updated_at_column]
    ↓ [Trigger: clean_participants_on_private (if applicable)]
Event Service
    ↓ [getEventWithParticipants]
API Route Handler
    ↓ [UpdateEventResponse]
Client
```

### Szczegółowy przepływ

1. **Request Reception**
   - Klient wysyła PATCH request z Bearer token
   - API handler ekstrahuje `eventId` z path params
   - API handler parsuje request body

2. **Authentication & Authorization**
   - Supabase SDK weryfikuje JWT token
   - Ekstrahuje `user_id` z `auth.uid()`
   - Pobiera `family_id` z tabeli `profiles` dla danego `user_id`

3. **Input Validation**
   - Walidacja Zod schema dla `UpdateEventRequest`
   - Walidacja, że `eventId` jest poprawnym UUID
   - Walidacja, że `end_time` > `start_time` (jeśli oba podane)
   - Walidacja długości `title` (1-200 znaków)

4. **Business Logic Checks**
   - Sprawdzenie, czy event istnieje i nie jest zarchiwizowany
   - RLS automatycznie sprawdza `created_by = auth.uid()`
   - Jeśli podano `participant_ids`, sprawdzenie czy wszyscy należą do `family_id`

5. **Database Update - Events Table**
   - UPDATE events SET ... WHERE id = eventId
   - RLS policy wymusza `created_by = auth.uid()`
   - Trigger `update_updated_at_column` automatycznie ustawia `updated_at`
   - Jeśli `is_private` zmienia się na `true`, trigger `clean_participants_on_private` usuwa uczestników

6. **Database Update - Participants**
   - Jeśli podano `participant_ids`:
     - DELETE FROM event_participants WHERE event_id = eventId
     - INSERT INTO event_participants (event_id, profile_id) VALUES ...
   - Jeśli nie podano, uczestnicy pozostają niezmienieni

7. **Response Construction**
   - Query do pobrania zaktualizowanego eventu
   - JOIN z event_participants i profiles dla pełnych danych uczestników
   - Konstrukcja `UpdateEventResponse`

8. **Return to Client**
   - 200 OK z UpdateEventResponse
   - Klient aktualizuje UI (useOptimistic w React 19)

---

## 6. Względy bezpieczeństwa

### 1. Uwierzytelnianie (Authentication)
- **JWT Token Validation**: Każde żądanie musi zawierać ważny Bearer token
- **Supabase Auth**: Automatyczna weryfikacja tokenu przez Supabase SDK
- **Token Expiry**: Obsługa wygasłych tokenów (401 Unauthorized)

### 2. Autoryzacja (Authorization)
- **RLS Policy**: Krytyczna warstwa zabezpieczeń
  ```sql
  -- Policy dla UPDATE na events
  CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  USING (created_by = auth.uid());
  ```
- Tylko twórca eventu (`created_by = auth.uid()`) może go aktualizować
- RLS automatycznie blokuje próby aktualizacji cudzych eventów (403 Forbidden)

### 3. Family Isolation
- **Participant Validation**: Wszyscy uczestnicy muszą należeć do tej samej `family_id` co event
- **Query Validation**:
  ```sql
  SELECT COUNT(*) FROM profiles 
  WHERE id = ANY(participant_ids) 
    AND family_id = event.family_id
  ```
- Jeśli liczba nie zgadza się, zwróć 400 Bad Request

### 4. Input Sanitization
- **Zod Validation**: Wszystkie inputy przechodzą przez Zod schema
- **SQL Injection Protection**: Supabase SDK używa parametrized queries
- **XSS Prevention**: Sanityzacja stringów (title, description) przed zapisem
- **UUID Validation**: Weryfikacja formatu UUID dla `eventId` i `participant_ids`

### 5. Privacy Controls
- **Private Event Logic**: 
  - Gdy `is_private = true`, trigger automatycznie usuwa uczestników
  - Frontend powinien blokować dodawanie uczestników do prywatnych eventów
  - Backend validation: jeśli `is_private = true` i `participant_ids` podane, zwróć błąd

### 6. Rate Limiting (Rekomendacja)
- Implementacja rate limiting na poziomie Supabase Edge Functions lub reverse proxy
- Limit: np. 100 żądań/minutę per użytkownika

### 7. Audit Trail
- Pole `updated_at` automatycznie śledzi ostatnią modyfikację
- Opcjonalnie: przechowywanie historii zmian w osobnej tabeli `event_history`

---

## 7. Obsługa błędów

### Error Handling Strategy

#### 1. Validation Errors (400 Bad Request)

**Scenario**: Niepoprawny format UUID dla eventId
```typescript
if (!isUUID(eventId)) {
  return Response.json({
    error: {
      code: 'validation_error',
      message: 'Invalid event ID format',
      details: { eventId: 'Must be a valid UUID' }
    }
  }, { status: 400 });
}
```

**Scenario**: Nieprawidłowe dane w request body
```typescript
const validationResult = UpdateEventRequestSchema.safeParse(body);
if (!validationResult.success) {
  return Response.json({
    error: {
      code: 'validation_error',
      message: 'Invalid request data',
      details: validationResult.error.flatten().fieldErrors
    }
  }, { status: 400 });
}
```

**Scenario**: end_time <= start_time
```typescript
if (end_time && start_time && new Date(end_time) <= new Date(start_time)) {
  return Response.json({
    error: {
      code: 'validation_error',
      message: 'End time must be after start time',
      details: { end_time: 'Must be after start_time' }
    }
  }, { status: 400 });
}
```

**Scenario**: Uczestnicy spoza rodziny
```typescript
const invalidParticipants = await validateParticipantsInFamily(
  participant_ids, 
  familyId
);
if (invalidParticipants.length > 0) {
  return Response.json({
    error: {
      code: 'validation_error',
      message: 'Some participants do not belong to your family',
      details: { invalid_participant_ids: invalidParticipants }
    }
  }, { status: 400 });
}
```

#### 2. Authentication Errors (401 Unauthorized)

**Scenario**: Brak tokenu lub niepoprawny token
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return Response.json({
    error: {
      code: 'unauthorized',
      message: 'Missing or invalid authentication token'
    }
  }, { status: 401 });
}
```

#### 3. Authorization Errors (403 Forbidden)

**Scenario**: Użytkownik próbuje zaktualizować cudzy event
```typescript
// RLS automatycznie zablokuje UPDATE, więc:
const { data, error } = await supabase
  .from('events')
  .update(updateData)
  .eq('id', eventId)
  .select()
  .single();

if (error && error.code === 'PGRST116') { // No rows returned
  return Response.json({
    error: {
      code: 'forbidden',
      message: 'You are not authorized to update this event'
    }
  }, { status: 403 });
}
```

#### 4. Not Found Errors (404 Not Found)

**Scenario**: Event nie istnieje lub jest zarchiwizowany
```typescript
const { data: event, error } = await supabase
  .from('events')
  .select('id, archived_at')
  .eq('id', eventId)
  .is('archived_at', null)
  .single();

if (error || !event) {
  return Response.json({
    error: {
      code: 'not_found',
      message: 'Event not found'
    }
  }, { status: 404 });
}
```

#### 5. Internal Server Errors (500)

**Scenario**: Nieoczekiwany błąd bazy danych
```typescript
try {
  // ... database operations
} catch (error) {
  console.error('Unexpected error in PATCH /events/:eventId:', error);
  return Response.json({
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred'
    }
  }, { status: 500 });
}
```

### Error Logging
```typescript
// Dla błędów 500, loguj szczegóły
console.error({
  timestamp: new Date().toISOString(),
  endpoint: 'PATCH /events/:eventId',
  eventId,
  userId: user.id,
  error: error.message,
  stack: error.stack
});
```

---

## 8. Rozważania dotyczące wydajności

### 1. Database Query Optimization

**Problem**: Multiple queries dla update + participants
**Rozwiązanie**: Użycie transakcji
```typescript
const { data, error } = await supabase.rpc('update_event_with_participants', {
  p_event_id: eventId,
  p_update_data: updateData,
  p_participant_ids: participant_ids
});
```

**Alternatywnie**: Batch operations
```typescript
// 1. Update event
// 2. Delete old participants
// 3. Insert new participants
// Wszystko w ramach jednej transakcji
```

### 2. Index Usage

**Wykorzystane indeksy**:
- Primary key index on `events.id` (automatic) - dla WHERE id = eventId
- Index on `event_participants.event_id` - dla DELETE/INSERT uczestników
- Index on `profiles.family_id` - dla walidacji uczestników

### 3. Caching Strategy

**Event Data**: 
- Cache invalidation po każdym UPDATE
- Use Supabase Realtime dla live updates (opcjonalnie)

**Participant Validation**:
- Cache listę członków rodziny w pamięci (TTL: 5 minut)
- Redukuje queries dla walidacji participant_ids

### 4. N+1 Query Prevention

**Problem**: Pobieranie nazwisk uczestników po kolei
**Rozwiązanie**: Single JOIN query
```sql
SELECT 
  e.*,
  COALESCE(
    json_agg(
      json_build_object('id', p.id, 'display_name', p.display_name)
    ) FILTER (WHERE ep.profile_id IS NOT NULL),
    '[]'
  ) as participants
FROM events e
LEFT JOIN event_participants ep ON ep.event_id = e.id
LEFT JOIN profiles p ON p.id = ep.profile_id
WHERE e.id = $1
GROUP BY e.id;
```

### 5. Partial Update Efficiency

**Advantage**: Tylko zmienione pola są wysyłane i aktualizowane
**Implementation**: 
```typescript
// Tylko pola obecne w request body są przekazywane do UPDATE
const updateData = Object.fromEntries(
  Object.entries(validatedData).filter(([_, v]) => v !== undefined)
);
```

### 6. Trigger Optimization

**Trigger `update_updated_at_column`**: 
- Lekki trigger, tylko ustawia timestamp
- Działa na poziomie row (FOR EACH ROW)

**Trigger `clean_participants_on_private`**:
- Uruchamia się tylko gdy `is_private` zmienia się na `true`
- Conditional trigger dla minimalizacji overhead

### 7. Response Size Optimization

**Tylko niezbędne pola w response**:
- Event: tylko zmienione pola + updated_at
- Participants: tylko id + display_name (nie cała tabela profiles)

### 8. Connection Pooling

**Supabase**: Automatyczny connection pooling
**Best Practice**: Reuse Supabase client instance

### Performance Targets
- **Response Time**: < 200ms dla typowego update (95th percentile)
- **Database Queries**: Maximum 3 queries (1 update, 1 delete, 1 insert/select)
- **Payload Size**: < 5KB dla typowego response

---

## 9. Etapy wdrożenia

### Fase 1: Przygotowanie (Setup)

#### Krok 1.1: Przegląd istniejącej infrastruktury
- [ ] Sprawdź, czy istnieje service dla eventów (`src/lib/events.service.ts` lub podobny)
- [ ] Sprawdź istniejące Zod schemas w projekcie
- [ ] Zidentyfikuj pattern dla innych endpointów PATCH w projekcie
- [ ] Sprawdź konfigurację Supabase client (`src/db/supabase.client.ts`)

#### Krok 1.2: Weryfikacja RLS policies
- [ ] Sprawdź policy dla UPDATE na tabeli `events`:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'events' AND cmd = 'UPDATE';
  ```
- [ ] Upewnij się, że policy wymusza `created_by = auth.uid()`
- [ ] Przetestuj policy ręcznie w Supabase Dashboard

#### Krok 1.3: Weryfikacja triggerów
- [ ] Sprawdź trigger `update_updated_at_column` na tabeli `events`
- [ ] Sprawdź trigger `clean_participants_on_private` na tabeli `events`
- [ ] Jeśli nie istnieją, utwórz je zgodnie z db-plan.md

---

### Fase 2: Walidacja i typy (Validation & Types)

#### Krok 2.1: Utworzenie Zod schema dla request validation
**Plik**: `src/lib/validations/event.validation.ts` (lub podobny)

```typescript
import { z } from 'zod';

export const UpdateEventRequestSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title must not be empty')
    .max(200, 'Title must not exceed 200 characters')
    .optional(),
  
  description: z.string().optional().nullable(),
  
  start_time: z.string()
    .datetime({ message: 'Invalid ISO 8601 timestamp' })
    .optional(),
  
  end_time: z.string()
    .datetime({ message: 'Invalid ISO 8601 timestamp' })
    .optional(),
  
  is_private: z.boolean().optional(),
  
  participant_ids: z.array(z.string().uuid('Invalid UUID format'))
    .optional()
}).refine((data) => {
  // Jeśli oba są podane, end_time musi być > start_time
  if (data.start_time && data.end_time) {
    return new Date(data.end_time) > new Date(data.start_time);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['end_time']
});

export type UpdateEventRequestValidated = z.infer<typeof UpdateEventRequestSchema>;
```

#### Krok 2.2: Weryfikacja typów w types.ts
- [ ] Upewnij się, że `UpdateEventRequest` i `UpdateEventResponse` są poprawnie zdefiniowane
- [ ] Sprawdź, czy typy są zgodne z Zod schema
- [ ] Zweryfikuj export wszystkich potrzebnych typów

---

### Fase 3: Service Layer (Business Logic)

#### Krok 3.1: Utworzenie/rozszerzenie Event Service
**Plik**: `src/lib/services/event.service.ts` (lub podobny)

```typescript
import { SupabaseClient } from '@/db/supabase.client';
import { UpdateEventRequest, UpdateEventResponse } from '@/types';

export class EventService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Validates that all participant IDs belong to the specified family
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

    if (error) throw error;

    const validIds = data.map(p => p.id);
    const invalidIds = participantIds.filter(id => !validIds.includes(id));
    
    return invalidIds;
  }

  /**
   * Updates an event (RLS enforces created_by = auth.uid())
   */
  async updateEvent(
    eventId: string,
    updateData: Partial<UpdateEventRequest>
  ): Promise<{ success: boolean; error?: string }> {
    // Remove participant_ids from updateData (handled separately)
    const { participant_ids, ...eventUpdateData } = updateData;

    const { error } = await this.supabase
      .from('events')
      .update(eventUpdateData)
      .eq('id', eventId)
      .is('archived_at', null);

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'not_found_or_forbidden' };
      }
      throw error;
    }

    return { success: true };
  }

  /**
   * Replaces all participants for an event
   */
  async updateEventParticipants(
    eventId: string,
    participantIds: string[]
  ): Promise<void> {
    // Delete existing participants
    const { error: deleteError } = await this.supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) throw deleteError;

    // Insert new participants
    if (participantIds.length > 0) {
      const participants = participantIds.map(profileId => ({
        event_id: eventId,
        profile_id: profileId
      }));

      const { error: insertError } = await this.supabase
        .from('event_participants')
        .insert(participants);

      if (insertError) throw insertError;
    }
  }

  /**
   * Gets event with participants for response
   */
  async getEventWithParticipants(eventId: string): Promise<UpdateEventResponse | null> {
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
        event_participants (
          profile:profiles (
            id,
            display_name
          )
        )
      `)
      .eq('id', eventId)
      .is('archived_at', null)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      start_time: data.start_time,
      end_time: data.end_time,
      is_private: data.is_private,
      updated_at: data.updated_at,
      participants: data.event_participants.map(ep => ({
        id: ep.profile.id,
        display_name: ep.profile.display_name
      }))
    };
  }

  /**
   * Gets user's family_id
   */
  async getUserFamilyId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return data.family_id;
  }
}
```

---

### Fase 4: API Route Handler

#### Krok 4.1: Utworzenie route handler
**Plik**: `src/pages/api/events/[eventId].ts` (lub pattern zgodny z projektem)

```typescript
import type { APIRoute } from 'astro';
import { createClient } from '@/db/supabase.client';
import { UpdateEventRequestSchema } from '@/lib/validations/event.validation';
import { EventService } from '@/lib/services/event.service';
import { isUUID } from '@/types';
import type { ApiError, UpdateEventResponse } from '@/types';

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    // Step 1: Extract eventId from path params
    const { eventId } = params;
    
    if (!eventId || !isUUID(eventId)) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'validation_error',
            message: 'Invalid event ID format',
            details: { eventId: 'Must be a valid UUID' }
          }
        } as ApiError),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Initialize Supabase client with user's token
    const supabase = createClient(request, cookies);
    
    // Step 3: Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'unauthorized',
            message: 'Missing or invalid authentication token'
          }
        } as ApiError),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateEventRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'validation_error',
            message: 'Invalid request data',
            details: validationResult.error.flatten().fieldErrors
          }
        } as ApiError),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData = validationResult.data;
    
    // Step 5: Get user's family_id
    const eventService = new EventService(supabase);
    const familyId = await eventService.getUserFamilyId(user.id);
    
    if (!familyId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'forbidden',
            message: 'User profile not found'
          }
        } as ApiError),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Validate participants belong to family (if provided)
    if (updateData.participant_ids && updateData.participant_ids.length > 0) {
      // Check if trying to add participants to private event
      if (updateData.is_private === true) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'Cannot add participants to private event',
              details: { participant_ids: 'Private events cannot have participants' }
            }
          } as ApiError),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const invalidParticipants = await eventService.validateParticipantsInFamily(
        updateData.participant_ids,
        familyId
      );

      if (invalidParticipants.length > 0) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'Some participants do not belong to your family',
              details: { invalid_participant_ids: invalidParticipants }
            }
          } as ApiError),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 7: Update event
    const updateResult = await eventService.updateEvent(eventId, updateData);
    
    if (!updateResult.success) {
      if (updateResult.error === 'not_found_or_forbidden') {
        // Could be 404 or 403, check if event exists
        const { data: eventCheck } = await supabase
          .from('events')
          .select('id, created_by')
          .eq('id', eventId)
          .is('archived_at', null)
          .single();

        if (!eventCheck) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'not_found',
                message: 'Event not found'
              }
            } as ApiError),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              error: {
                code: 'forbidden',
                message: 'You are not authorized to update this event'
              }
            } as ApiError),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Step 8: Update participants if provided
    if (updateData.participant_ids !== undefined) {
      await eventService.updateEventParticipants(
        eventId,
        updateData.participant_ids
      );
    }

    // Step 9: Fetch updated event with participants
    const updatedEvent = await eventService.getEventWithParticipants(eventId);
    
    if (!updatedEvent) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'internal_error',
            message: 'Failed to retrieve updated event'
          }
        } as ApiError),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 10: Return success response
    return new Response(
      JSON.stringify(updatedEvent as UpdateEventResponse),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in PATCH /events/:eventId:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'An unexpected error occurred'
        }
      } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

---

### Fase 5: Frontend Integration (React 19 Action)

#### Krok 5.1: Utworzenie React Action dla update
**Plik**: `src/hooks/useUpdateEvent.ts`

```typescript
import { useOptimistic } from 'react';
import type { UpdateEventRequest, UpdateEventResponse } from '@/types';

export function useUpdateEvent() {
  const [optimisticEvent, setOptimisticEvent] = useOptimistic<UpdateEventResponse | null>(null);

  async function updateEvent(eventId: string, data: UpdateEventRequest): Promise<UpdateEventResponse> {
    // Optimistic update
    setOptimisticEvent(prev => prev ? { ...prev, ...data } : null);

    const response = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    const result = await response.json();
    return result;
  }

  return { updateEvent, optimisticEvent };
}
```

#### Krok 5.2: Przykład komponentu z formularzem
**Plik**: `src/components/events/UpdateEventDialog.tsx`

```typescript
import { useUpdateEvent } from '@/hooks/useUpdateEvent';
import { useState } from 'react';
import type { UpdateEventRequest } from '@/types';

export function UpdateEventDialog({ eventId, onSuccess }: Props) {
  const { updateEvent } = useUpdateEvent();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    try {
      const updateData: UpdateEventRequest = {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        // ... inne pola
      };

      const result = await updateEvent(eventId, updateData);
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      {/* Form fields */}
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Updating...' : 'Update Event'}
      </button>
    </form>
  );
}
```

---

### Fase 6: Testing

#### Krok 6.1: Unit Tests dla Service Layer
**Plik**: `src/lib/services/event.service.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventService } from './event.service';

describe('EventService', () => {
  describe('validateParticipantsInFamily', () => {
    it('should return empty array when all participants are in family', async () => {
      // Mock Supabase client
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({
                data: [{ id: 'uuid1' }, { id: 'uuid2' }],
                error: null
              }))
            }))
          }))
        }))
      };

      const service = new EventService(mockSupabase as any);
      const invalidIds = await service.validateParticipantsInFamily(
        ['uuid1', 'uuid2'],
        'family-id'
      );

      expect(invalidIds).toEqual([]);
    });

    it('should return invalid IDs when participants are not in family', async () => {
      // ... test implementation
    });
  });

  // More tests...
});
```

#### Krok 6.2: Integration Tests dla API Route
**Plik**: `src/pages/api/events/[eventId].test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@/db/supabase.client';

describe('PATCH /events/:eventId', () => {
  let authToken: string;
  let eventId: string;

  beforeEach(async () => {
    // Setup: Create test user, family, and event
    // Get auth token
  });

  it('should update event successfully', async () => {
    const response = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Updated Title',
        is_private: false
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.title).toBe('Updated Title');
  });

  it('should return 401 when unauthorized', async () => {
    const response = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' })
    });

    expect(response.status).toBe(401);
  });

  it('should return 403 when user is not event creator', async () => {
    // Create another user and try to update
    // ...
  });

  it('should return 400 for invalid data', async () => {
    const response = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        end_time: '2026-01-01T10:00:00Z',
        start_time: '2026-01-01T11:00:00Z' // end before start
      })
    });

    expect(response.status).toBe(400);
  });

  // More tests...
});
```

#### Krok 6.3: Manual Testing Checklist

**Happy Path**:
- [ ] Update only title
- [ ] Update multiple fields at once
- [ ] Update with new participants
- [ ] Update with empty participants array
- [ ] Change is_private from false to true (verify participants removed)

**Error Cases**:
- [ ] Invalid eventId UUID
- [ ] Missing auth token
- [ ] Expired auth token
- [ ] Try to update someone else's event (403)
- [ ] Try to update non-existent event (404)
- [ ] end_time before start_time (400)
- [ ] Title too long (400)
- [ ] Invalid participant UUIDs (400)
- [ ] Participants from different family (400)
- [ ] Add participants to private event (400)

**Edge Cases**:
- [ ] Update with same data (idempotent)
- [ ] Update archived event (404)
- [ ] Concurrent updates (last write wins)
- [ ] Very large description (test limits)

---

### Fase 7: Database Verification

#### Krok 7.1: Verify RLS Policies
```sql
-- Test as event creator
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid"}';

UPDATE events 
SET title = 'Updated' 
WHERE id = 'event-uuid';
-- Should succeed

-- Test as different user
SET LOCAL request.jwt.claims TO '{"sub": "different-user-uuid"}';

UPDATE events 
SET title = 'Updated' 
WHERE id = 'event-uuid';
-- Should fail (0 rows updated)
```

#### Krok 7.2: Verify Triggers
```sql
-- Test update_updated_at_column trigger
UPDATE events SET title = 'New Title' WHERE id = 'event-uuid';
SELECT updated_at FROM events WHERE id = 'event-uuid';
-- Should show current timestamp

-- Test clean_participants_on_private trigger
UPDATE events SET is_private = true WHERE id = 'event-uuid';
SELECT COUNT(*) FROM event_participants WHERE event_id = 'event-uuid';
-- Should be 0
```

---

### Fase 8: Documentation & Deployment

#### Krok 8.1: Update API Documentation
- [ ] Add PATCH /events/:eventId to API documentation
- [ ] Include request/response examples
- [ ] Document all error codes
- [ ] Add Postman/Thunder Client collection

#### Krok 8.2: Update TypeScript Documentation
- [ ] Add JSDoc comments to all service methods
- [ ] Document validation rules
- [ ] Add usage examples in comments

#### Krok 8.3: Code Review Checklist
- [ ] All types properly defined
- [ ] Zod validation comprehensive
- [ ] RLS policies tested
- [ ] Error handling complete
- [ ] Logging implemented
- [ ] Tests passing
- [ ] No hardcoded values
- [ ] No console.logs (except errors)

#### Krok 8.4: Deployment
- [ ] Merge to main branch
- [ ] Deploy to staging
- [ ] Run integration tests on staging
- [ ] Monitor error logs
- [ ] Deploy to production
- [ ] Monitor production metrics

---

## 10. Checklist końcowy

### Pre-Implementation
- [ ] Przeczytać cały plan implementacji
- [ ] Zrozumieć przepływ danych
- [ ] Przygotować środowisko deweloperskie
- [ ] Zweryfikować dostęp do Supabase Dashboard

### Implementation
- [ ] Utworzyć Zod schema dla walidacji
- [ ] Zaimplementować EventService
- [ ] Utworzyć API route handler
- [ ] Zaimplementować React hook
- [ ] Dodać obsługę błędów
- [ ] Napisać testy

### Verification
- [ ] Przetestować wszystkie happy paths
- [ ] Przetestować wszystkie error cases
- [ ] Zweryfikować RLS policies
- [ ] Sprawdzić wydajność (< 200ms response time)
- [ ] Code review

### Deployment
- [ ] Zaktualizować dokumentację
- [ ] Deploy do staging
- [ ] Integration tests na staging
- [ ] Deploy do production
- [ ] Monitoring

---

## Notatki końcowe

### Potential Improvements (Future)
1. **Database Function**: Utworzyć funkcję PostgreSQL `update_event_with_participants` dla atomowej operacji
2. **Caching**: Implementować Redis cache dla event data
3. **Webhooks**: Dodać webhooks dla external integrations (np. Google Calendar sync)
4. **Audit Log**: Przechowywać historię zmian w tabeli `event_history`
5. **Rate Limiting**: Implementować rate limiting na poziomie Edge Function
6. **Real-time Updates**: Wykorzystać Supabase Realtime dla live synchronizacji

### Common Pitfalls
1. **Forgetting RLS**: Zawsze testuj z różnymi użytkownikami
2. **N+1 Queries**: Używaj JOINs zamiast pętli
3. **Missing Validation**: Waliduj również na backendzie, nie tylko frontendzie
4. **Poor Error Messages**: Zwracaj szczegółowe błędy dla lepszego UX
5. **Hardcoded Values**: Używaj environment variables dla konfiguracji

### Support Resources
- Supabase Documentation: https://supabase.com/docs
- Zod Documentation: https://zod.dev
- React 19 Actions: https://react.dev/reference/react/useOptimistic
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html


