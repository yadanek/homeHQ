# API Endpoint Implementation Plan: DELETE /events/:eventId

## 1. Przegląd punktu końcowego

Endpoint DELETE /events/:eventId realizuje operację miękkiego usunięcia (soft delete) wydarzenia kalendarza poprzez ustawienie znacznika czasu `archived_at`. Jest to kluczowa operacja zapewniająca zachowanie danych analitycznych przy jednoczesnym ukryciu wydarzeń przed użytkownikami.

**Kluczowe cechy:**
- Soft delete zamiast hard delete (zachowanie danych do analizy)
- Autoryzacja oparta na twórcy wydarzenia (tylko twórca może usunąć)
- Powiązane zadania zachowują referencje (event_id → NULL przez CASCADE)
- Respektuje polityki RLS Supabase
- Kompatybilne z React 19 Actions

## 2. Szczegóły żądania

### Metoda HTTP
```
DELETE
```

### Struktura URL
```
/events/:eventId
```

### Nagłówki
```
Authorization: Bearer {access_token}
```

### Parametry

**Wymagane (Path Parameters):**
- `eventId` (string, UUID): Unikalny identyfikator wydarzenia do usunięcia

**Opcjonalne:**
- Brak

**Request Body:**
- Brak (DELETE nie wymaga body)

### Walidacja parametrów

```typescript
// Walidacja UUID
if (!isUUID(eventId)) {
  return 400 Bad Request {
    code: 'INVALID_EVENT_ID',
    message: 'Event ID must be a valid UUID'
  }
}
```

## 3. Wykorzystywane typy

### Istniejące typy (src/types.ts)

```typescript
// Brak dedykowanego request/response DTO dla DELETE
// Używamy tylko ApiError dla obsługi błędów

import type { ApiError } from '@/types';
import { isUUID } from '@/types';
```

### Nowy typ wyniku (Either pattern)

```typescript
// src/actions/deleteEvent.ts
export type DeleteEventResult =
  | { success: true }
  | { success: false; error: ApiError };
```

**Uzasadnienie:** 
- 204 No Content nie zwraca danych, więc success zawiera tylko flagę
- Wzorzec Either zapewnia type-safe error handling
- Kompatybilne z istniejącym pattern używanym w createEvent

## 4. Szczegóły odpowiedzi

### Sukces (204 No Content)

```http
HTTP/1.1 204 No Content
```

**Brak body** - zgodnie ze standardem REST dla 204

### Błędy

#### 400 Bad Request - Nieprawidłowy UUID

```json
{
  "error": {
    "code": "INVALID_EVENT_ID",
    "message": "Event ID must be a valid UUID",
    "details": {
      "eventId": "invalid-uuid"
    }
  }
}
```

#### 401 Unauthorized - Brak autoryzacji

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please log in."
  }
}
```

#### 403 Forbidden - Brak uprawnień

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to delete this event",
    "details": {
      "reason": "Only event creator can delete events"
    }
  }
}
```

#### 404 Not Found - Wydarzenie nie istnieje

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found or has been archived"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "requestId": "uuid"
    }
  }
}
```

## 5. Przepływ danych

### Diagram sekwencji

```
Client                Action               Service              Database
  |                     |                     |                     |
  |--DELETE /events/:id-|                     |                     |
  |                     |                     |                     |
  |                     |--auth.getUser()-----|                     |
  |                     |<---User/Error------|                     |
  |                     |                     |                     |
  |                     |--validate UUID------|                     |
  |                     |                     |                     |
  |                     |--get family_id-----|                     |
  |                     |                     |                     |
  |                     |--service.deleteEvent()                   |
  |                     |                     |                     |
  |                     |                     |--SELECT event------|
  |                     |                     |<--Event/null-------|
  |                     |                     |                     |
  |                     |                     |--UPDATE archived_at-|
  |                     |                     |<--Success/Error----|
  |                     |                     |                     |
  |                     |<--Result------------|                     |
  |<--204 No Content----|                     |                     |
```

### Krok po kroku

1. **Uwierzytelnienie** (Action layer)
   - Walidacja JWT token przez Supabase Auth
   - DEV_MODE: użycie mock user
   - Ekstrakcja `user.id`, `family_id`, `role` z JWT metadata

2. **Walidacja wejścia** (Action layer)
   - Sprawdzenie formatu UUID dla `eventId`
   - Early return przy nieprawidłowym formacie

3. **Weryfikacja uprawnień** (Service layer + RLS)
   - Service sprawdza istnienie wydarzenia
   - RLS policy `events_delete_own_authenticated` wymusza `created_by = auth.uid()`
   - Zwraca 404 jeśli wydarzenie nie istnieje lub jest już archiwalne

4. **Soft delete** (Service layer)
   - UPDATE events SET archived_at = now() WHERE id = eventId
   - Trigger CASCADE automatycznie ustawia event_id = NULL w tasks

5. **Zwrot wyniku** (Action layer)
   - Success: `{ success: true }`
   - Error: `{ success: false, error: ApiError }`

### Interakcje z bazą danych

#### Query 1: Weryfikacja istnienia i uprawnień
```sql
SELECT id, created_by, family_id, archived_at
FROM events
WHERE id = $1
  AND archived_at IS NULL;
```

**RLS automatycznie filtruje:**
- Tylko wydarzenia z `created_by = auth.uid()` (policy: events_delete_own_authenticated)

#### Query 2: Soft delete
```sql
UPDATE events
SET archived_at = now()
WHERE id = $1
  AND archived_at IS NULL;
```

**RLS automatycznie wymusza:**
- `created_by = auth.uid()`
- Jeśli 0 rows affected → zwraca 403 Forbidden

#### Efekt uboczny: Tasks CASCADE
```sql
-- Automatycznie wykonane przez ON DELETE SET NULL
-- (mimo że używamy UPDATE, trigger może obsłużyć archiwizację)
UPDATE tasks
SET event_id = NULL
WHERE event_id = $1;
```

**Uwaga:** Faktyczna implementacja CASCADE dla soft delete wymaga custom triggera lub ręcznego update w service layer.

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnienie

**JWT Token Validation:**
```typescript
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return { success: false, error: UNAUTHORIZED };
}
```

**DEV_MODE Support:**
```typescript
if (DEV_MODE) {
  user = MOCK_USER; // Predefined mock user with family_id
}
```

### 6.2. Autoryzacja

**Row Level Security (RLS):**
```sql
CREATE POLICY events_delete_own_authenticated
  ON events
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
```

**Service Layer Check:**
```typescript
// Explicit check before delete for better error messages
const { data: event } = await supabase
  .from('events')
  .select('id, created_by, archived_at')
  .eq('id', eventId)
  .single();

if (!event) {
  throw new ServiceError(404, 'EVENT_NOT_FOUND', 'Event not found');
}

if (event.archived_at) {
  throw new ServiceError(404, 'EVENT_NOT_FOUND', 'Event already archived');
}

// RLS will still enforce created_by = auth.uid() on UPDATE
```

### 6.3. Izolacja rodzin

**Family-level isolation:**
- RLS policies automatycznie filtrują po `family_id` z JWT
- Użytkownik nie może usunąć wydarzeń z innych rodzin
- Nawet jeśli zna UUID wydarzenia z innej rodziny

### 6.4. Audit Trail

**Zachowanie danych:**
- Soft delete ustawia `archived_at` zamiast usuwania rekordu
- Zachowuje kompletną historię dla analityki
- Możliwość przyszłej funkcji "undo"
- Utrzymuje integralność referencyjną

### 6.5. Rate Limiting (Przyszła implementacja)

**Zalecenia:**
- Implementacja rate limiting na poziomie Supabase Edge Functions
- Limit: 10 delete operations per minute per user
- Zabezpieczenie przed atakami DoS

## 7. Obsługa błędów

### 7.1. Hierarchia błędów

```
┌─────────────────────────────────────┐
│  Client Error (4xx)                  │
├─────────────────────────────────────┤
│ 400: Invalid UUID format             │
│ 401: Missing/invalid authentication  │
│ 403: Not event creator               │
│ 404: Event not found/archived        │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  Server Error (5xx)                  │
├─────────────────────────────────────┤
│ 500: Database connection failure     │
│ 500: Unexpected error                │
└─────────────────────────────────────┘
```

### 7.2. Szczegółowe scenariusze

#### Scenariusz 1: Nieprawidłowy UUID

**Warunek:** `eventId` nie jest poprawnym UUID

**Kod:** 400 Bad Request

**Implementacja:**
```typescript
if (!isUUID(eventId)) {
  return {
    success: false,
    error: {
      error: {
        code: 'INVALID_EVENT_ID',
        message: 'Event ID must be a valid UUID',
        details: { eventId }
      }
    }
  };
}
```

**Logging:**
```typescript
console.warn(`Invalid event ID format: ${eventId}`);
```

#### Scenariusz 2: Brak uwierzytelnienia

**Warunek:** Brak JWT token lub token wygasł

**Kod:** 401 Unauthorized

**Implementacja:**
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  console.warn('Unauthenticated delete attempt');
  return {
    success: false,
    error: {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.'
      }
    }
  };
}
```

#### Scenariusz 3: Brak uprawnień (nie jesteś twórcą)

**Warunek:** RLS policy blokuje UPDATE (user nie jest created_by)

**Kod:** 403 Forbidden

**Detekcja:** Jeśli UPDATE zwraca 0 rows affected, ale wydarzenie istnieje

**Implementacja:**
```typescript
// W EventsService.deleteEvent()
const { count } = await supabase
  .from('events')
  .update({ archived_at: new Date().toISOString() })
  .eq('id', eventId)
  .eq('archived_at', null);

if (count === 0) {
  // Sprawdź czy wydarzenie w ogóle istnieje
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .is('archived_at', null)
    .maybeSingle();

  if (existingEvent) {
    // Istnieje, ale RLS zablokowało = nie jesteś twórcą
    throw new ServiceError(
      403,
      'FORBIDDEN',
      'You do not have permission to delete this event',
      { reason: 'Only event creator can delete events' }
    );
  } else {
    // Nie istnieje lub już archiwalne
    throw new ServiceError(404, 'EVENT_NOT_FOUND', 'Event not found or has been archived');
  }
}
```

#### Scenariusz 4: Wydarzenie nie istnieje

**Warunek:** `eventId` nie istnieje w bazie lub jest już archived

**Kod:** 404 Not Found

**Implementacja:**
```typescript
if (!event || event.archived_at) {
  throw new ServiceError(404, 'EVENT_NOT_FOUND', 'Event not found or has been archived');
}
```

**Logging:**
```typescript
console.warn(`Event not found: ${eventId}`);
```

#### Scenariusz 5: Błąd bazy danych

**Warunek:** Connection timeout, database down, etc.

**Kod:** 500 Internal Server Error

**Implementacja:**
```typescript
catch (error: any) {
  console.error('Database error during event deletion:', {
    eventId,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  return {
    success: false,
    error: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete event. Please try again.',
        details: {
          requestId: crypto.randomUUID()
        }
      }
    }
  };
}
```

### 7.3. Logging Strategy

**Console Levels:**

```typescript
// INFO: Successful operations
console.info(`Event ${eventId} archived by user ${userId}`);

// WARN: Client errors (4xx)
console.warn('Invalid UUID format:', eventId);
console.warn('Unauthorized delete attempt');
console.warn('Forbidden delete attempt:', { eventId, userId });

// ERROR: Server errors (5xx)
console.error('Event deletion error:', { error, stack, eventId });
```

**Structured Logging:**
```typescript
{
  level: 'error',
  timestamp: '2026-01-26T12:00:00Z',
  operation: 'deleteEvent',
  eventId: 'uuid',
  userId: 'uuid',
  familyId: 'uuid',
  error: 'error message',
  stack: 'stack trace'
}
```

## 8. Rozważania dotyczące wydajności

### 8.1. Optymalizacje zapytań

**Single Query Approach:**
```typescript
// Zamiast SELECT + UPDATE, użyj RETURNING clause
const { data, error } = await supabase
  .from('events')
  .update({ archived_at: new Date().toISOString() })
  .eq('id', eventId)
  .is('archived_at', null)
  .select('id')
  .maybeSingle();

if (!data) {
  // Nie znaleziono lub RLS zablokowało
}
```

**Korzyści:**
- Redukcja round-trips do bazy (1 zamiast 2)
- Atomic operation
- Mniejsze opóźnienie

### 8.2. Indeksy

**Istniejące indeksy (z migracji):**

```sql
-- Primary key index (automatic)
CREATE UNIQUE INDEX events_pkey ON events(id);

-- Partial index for active events
CREATE INDEX idx_events_family_start 
  ON events(family_id, start_time) 
  WHERE archived_at IS NULL;

-- Index for creator queries
CREATE INDEX idx_events_created_by 
  ON events(created_by);
```

**Optymalizacja dla DELETE:**
- Index na `id` (PK) zapewnia O(log n) lookup
- Index na `created_by` wspiera RLS policy check
- Partial index `WHERE archived_at IS NULL` przyspiesza sprawdzanie już archiwalnych

### 8.3. Connection Pooling

**Supabase:**
- Automatyczne connection pooling przez Supavisor
- Domyślnie: max 15 connections per user
- Persistent connections redukują overhead

### 8.4. Soft Delete Maintenance

**Problem:** Z czasem `archived_at IS NULL` może stać się kosztowne przy dużej liczbie archiwalnych wydarzeń.

**Rozwiązania:**

1. **Partial Indexes (już zaimplementowane):**
```sql
WHERE archived_at IS NULL
```

2. **Periodic Cleanup (przyszła implementacja):**
```sql
-- Cron job: usuń wydarzenia archiwalne starsze niż 2 lata
DELETE FROM events
WHERE archived_at < now() - interval '2 years';
```

3. **Partitioning (dla bardzo dużych dataset):**
```sql
-- Partition by archived status
CREATE TABLE events_active PARTITION OF events
  FOR VALUES IN (false);
  
CREATE TABLE events_archived PARTITION OF events
  FOR VALUES IN (true);
```

### 8.5. Metryki wydajności

**Target SLA:**
- p50: < 50ms
- p95: < 200ms
- p99: < 500ms

**Monitoring:**
```typescript
const startTime = performance.now();

// ... delete operation ...

const duration = performance.now() - startTime;
console.info(`Event deletion completed in ${duration}ms`);

if (duration > 500) {
  console.warn('Slow delete operation:', { eventId, duration });
}
```

## 9. Etapy wdrożenia

### Krok 1: Dodanie metody do EventsService

**Plik:** `src/services/events.service.ts`

**Implementacja:**

```typescript
/**
 * Soft deletes an event by setting archived_at timestamp
 * 
 * Authorization: Only event creator can delete (enforced by RLS)
 * Side effects: Related tasks have event_id set to NULL
 * 
 * @param eventId - UUID of event to delete
 * @param userId - ID of authenticated user (for logging)
 * @param familyId - Family ID from JWT (for logging)
 * @throws ServiceError with appropriate status code
 */
async deleteEvent(
  eventId: string,
  userId: string,
  familyId: string
): Promise<void> {
  // Validate UUID format
  if (!isUUID(eventId)) {
    throw new ServiceError(
      400,
      'INVALID_EVENT_ID',
      'Event ID must be a valid UUID',
      { eventId }
    );
  }

  // Perform soft delete with RETURNING clause for atomic operation
  const { data, error } = await this.supabase
    .from('events')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', eventId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

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

  if (!data) {
    // Event not found or already archived
    // Check if it exists but RLS blocked it
    const { data: existingEvent } = await this.supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle();

    if (existingEvent) {
      // Exists but RLS blocked = not creator
      throw new ServiceError(
        403,
        'FORBIDDEN',
        'You do not have permission to delete this event',
        { reason: 'Only event creator can delete events' }
      );
    } else {
      // Doesn't exist or already archived
      throw new ServiceError(
        404,
        'EVENT_NOT_FOUND',
        'Event not found or has been archived'
      );
    }
  }

  console.info(`Event ${eventId} archived by user ${userId}`);
}
```

**Testy jednostkowe:**

```typescript
// src/services/events.service.test.ts
describe('EventsService.deleteEvent', () => {
  it('should successfully delete own event', async () => {
    // Arrange
    const eventId = 'valid-uuid';
    const userId = 'creator-uuid';
    
    // Act & Assert
    await expect(
      eventsService.deleteEvent(eventId, userId, familyId)
    ).resolves.toBeUndefined();
  });

  it('should throw 403 when deleting other user event', async () => {
    // Arrange
    const eventId = 'other-user-event-uuid';
    
    // Act & Assert
    await expect(
      eventsService.deleteEvent(eventId, userId, familyId)
    ).rejects.toThrow(ServiceError);
  });

  it('should throw 404 when event not found', async () => {
    // Arrange
    const eventId = 'non-existent-uuid';
    
    // Act & Assert
    await expect(
      eventsService.deleteEvent(eventId, userId, familyId)
    ).rejects.toThrow(ServiceError);
  });

  it('should throw 400 for invalid UUID', async () => {
    // Arrange
    const eventId = 'invalid-uuid';
    
    // Act & Assert
    await expect(
      eventsService.deleteEvent(eventId, userId, familyId)
    ).rejects.toThrow(ServiceError);
  });
});
```

---

### Krok 2: Utworzenie React 19 Server Action

**Plik:** `src/actions/deleteEvent.ts`

**Implementacja:**

```typescript
/**
 * React 19 Server Action: deleteEvent
 * 
 * Handles event soft deletion with authentication and authorization.
 * Implements comprehensive validation and error handling.
 * 
 * This is the primary API endpoint for DELETE /events/:eventId functionality.
 */

import { createClient } from '@/db/supabase.client';
import { EventsService } from '@/services/events.service';
import { DEV_MODE, createMockSupabaseClient, MOCK_USER } from '@/lib/mockAuth';
import type { ApiError } from '@/types';
import { isUUID } from '@/types';

/**
 * Result type for deleteEvent action
 * Follows Either pattern for type-safe error handling
 */
export type DeleteEventResult =
  | { success: true }
  | { success: false; error: ApiError };

/**
 * Deletes an event (soft delete)
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must be event creator
 * 
 * Process:
 * 1. Authenticate user and extract context
 * 2. Validate eventId format
 * 3. Call EventsService to delete event
 * 4. Return formatted response or error
 * 
 * Error handling:
 * - 401: Missing or invalid authentication
 * - 400: Invalid event ID format
 * - 403: User is not event creator
 * - 404: Event not found or already archived
 * - 500: Unexpected server errors
 * 
 * @param eventId - UUID of event to delete
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```tsx
 * // In a React component
 * import { deleteEvent } from '@/actions/deleteEvent';
 * 
 * function DeleteEventButton({ eventId }: { eventId: string }) {
 *   const handleDelete = async () => {
 *     const result = await deleteEvent(eventId);
 *     if (result.success) {
 *       console.log('Event deleted successfully');
 *     } else {
 *       console.error('Error:', result.error);
 *     }
 *   };
 *   
 *   return <button onClick={handleDelete}>Delete</button>;
 * }
 * ```
 */
export async function deleteEvent(
  eventId: string
): Promise<DeleteEventResult> {
  try {
    // Step 1: Validate eventId format early
    if (!isUUID(eventId)) {
      console.warn(`Invalid event ID format: ${eventId}`);
      return {
        success: false,
        error: {
          error: {
            code: 'INVALID_EVENT_ID',
            message: 'Event ID must be a valid UUID',
            details: { eventId }
          }
        }
      };
    }

    // Step 2: Get authenticated user (or mock in dev mode)
    const supabase = DEV_MODE ? createMockSupabaseClient() : createClient();
    
    let user;
    let authError = null;
    
    if (DEV_MODE) {
      console.log('🔧 DEV MODE: Using mock authentication');
      user = MOCK_USER;
    } else {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      authError = result.error;
    }

    if (authError || !user) {
      console.warn('Unauthenticated delete attempt');
      return {
        success: false,
        error: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.'
          }
        }
      };
    }

    // Step 3: Get user context from JWT metadata (or mock)
    let familyId;
    
    if (DEV_MODE) {
      familyId = MOCK_USER.user_metadata.family_id;
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      familyId = user.user_metadata?.family_id || session?.user?.user_metadata?.family_id;
    }

    if (!familyId) {
      console.warn(`User ${user.id} attempted to delete event without family`);
      return {
        success: false,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'You must join a family before deleting events'
          }
        }
      };
    }

    // Step 4: Delete event with service layer
    const eventsService = new EventsService(supabase);
    await eventsService.deleteEvent(eventId, user.id, familyId);

    console.info(
      `Event deleted successfully: ${eventId} by user ${user.id}`
    );

    return {
      success: true
    };
  } catch (error: any) {
    // Step 5: Handle service layer errors
    console.error('Event deletion error:', {
      eventId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Handle ServiceError (from service layer)
    if (error.status && error.code) {
      return {
        success: false,
        error: {
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        }
      };
    }

    // Generic internal error
    return {
      success: false,
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete event. Please try again.',
          details: {
            technical: error.message
          }
        }
      }
    };
  }
}
```

**Testy integracyjne:**

```typescript
// src/actions/deleteEvent.test.ts
describe('deleteEvent action', () => {
  it('should delete event and return success', async () => {
    const result = await deleteEvent('valid-event-uuid');
    expect(result.success).toBe(true);
  });

  it('should return 400 for invalid UUID', async () => {
    const result = await deleteEvent('invalid-uuid');
    expect(result.success).toBe(false);
    expect(result.error?.error.code).toBe('INVALID_EVENT_ID');
  });

  it('should return 401 for unauthenticated request', async () => {
    // Mock unauthenticated state
    const result = await deleteEvent('valid-uuid');
    expect(result.success).toBe(false);
    expect(result.error?.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 403 for non-creator', async () => {
    // Mock different user
    const result = await deleteEvent('other-user-event-uuid');
    expect(result.success).toBe(false);
    expect(result.error?.error.code).toBe('FORBIDDEN');
  });

  it('should return 404 for non-existent event', async () => {
    const result = await deleteEvent('non-existent-uuid');
    expect(result.success).toBe(false);
    expect(result.error?.error.code).toBe('EVENT_NOT_FOUND');
  });
});
```

---

### Krok 3: Dodanie hooka useDeleteEvent do useEvents

**Plik:** `src/hooks/useEvents.ts`

**Implementacja:**

```typescript
/**
 * Hook for deleting an event (soft delete)
 * 
 * Provides loading state, error handling, and reset functionality.
 * Compatible with optimistic UI updates using useOptimistic.
 * 
 * @returns Object with deleteEvent function and state
 * 
 * @example
 * ```tsx
 * function EventCard({ event }) {
 *   const { deleteEvent, isDeleting, error } = useDeleteEvent();
 *   
 *   const handleDelete = async () => {
 *     const result = await deleteEvent(event.id);
 *     if (result.success) {
 *       toast.success('Event deleted');
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handleDelete} disabled={isDeleting}>
 *       {isDeleting ? 'Deleting...' : 'Delete'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDeleteEvent() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const deleteEvent = async (eventId: string): Promise<DeleteEventResult> => {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteEventAction(eventId);
      
      if (!result.success) {
        setError(result.error);
      }
      
      return result;
    } catch (err: any) {
      const genericError: ApiError = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      };
      setError(genericError);
      return { success: false, error: genericError };
    } finally {
      setIsDeleting(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return {
    deleteEvent,
    isDeleting,
    error,
    reset
  };
}
```

**Integracja z istniejącym hookiem:**

```typescript
// src/hooks/useEvents.ts - export additional hook
export { useDeleteEvent };

// Usage in components
import { useDeleteEvent } from '@/hooks/useEvents';
```

---

### Krok 4: Dodanie supportu dla optimistic UI (opcjonalne)

**Plik:** `src/hooks/useEvents.ts`

**Rozszerzenie useEvents z optimistic update:**

```typescript
/**
 * Hook with optimistic UI support for event deletion
 * 
 * Uses React 19's useOptimistic for instant UI feedback
 * 
 * @example
 * ```tsx
 * function EventList() {
 *   const { events, deleteEventOptimistic } = useEventsOptimistic();
 *   
 *   const handleDelete = async (eventId: string) => {
 *     // UI updates immediately
 *     const result = await deleteEventOptimistic(eventId);
 *     
 *     if (!result.success) {
 *       // Rollback is automatic
 *       toast.error('Failed to delete');
 *     }
 *   };
 *   
 *   return events.map(event => (
 *     <EventCard key={event.id} event={event} onDelete={handleDelete} />
 *   ));
 * }
 * ```
 */
export function useEventsOptimistic() {
  const { events, isLoading, error, refetch } = useEvents();
  const [optimisticEvents, setOptimisticEvents] = useOptimistic(
    events,
    (state, deletedId: string) => state.filter(e => e.id !== deletedId)
  );

  const deleteEventOptimistic = async (eventId: string) => {
    // Optimistically remove from UI
    setOptimisticEvents(eventId);
    
    // Perform actual deletion
    const result = await deleteEventAction(eventId);
    
    if (result.success) {
      // Refetch to sync with server
      await refetch();
    } else {
      // Rollback happens automatically
      await refetch();
    }
    
    return result;
  };

  return {
    events: optimisticEvents,
    isLoading,
    error,
    deleteEventOptimistic,
    refetch
  };
}
```

---

### Krok 5: Utworzenie przykładowego komponentu UI

**Plik:** `src/components/events/DeleteEventButton.tsx`

**Implementacja:**

```typescript
/**
 * DeleteEventButton Component
 * 
 * Provides a button with confirmation dialog for deleting events.
 * Includes loading state and error handling.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDeleteEvent } from '@/hooks/useEvents';
import { toast } from 'sonner';

interface DeleteEventButtonProps {
  eventId: string;
  eventTitle: string;
  onDeleted?: () => void;
}

export function DeleteEventButton({
  eventId,
  eventTitle,
  onDeleted
}: DeleteEventButtonProps) {
  const { deleteEvent, isDeleting, error } = useDeleteEvent();
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    const result = await deleteEvent(eventId);
    
    if (result.success) {
      toast.success('Event deleted successfully');
      setIsOpen(false);
      onDeleted?.();
    } else {
      toast.error(result.error.error.message);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will archive the event "{eventTitle}". This action can be undone by contacting support.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Event'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

### Krok 6: Dodanie testów E2E (opcjonalne)

**Plik:** `e2e/events-delete.spec.ts`

**Implementacja:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Delete Event', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to events
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should delete own event successfully', async ({ page }) => {
    // Navigate to event details
    await page.click('[data-testid="event-card-1"]');
    
    // Click delete button
    await page.click('[data-testid="delete-event-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify success message
    await expect(page.locator('text=Event deleted successfully')).toBeVisible();
    
    // Verify redirect to events list
    await expect(page).toHaveURL('/events');
    
    // Verify event no longer in list
    await expect(page.locator('[data-testid="event-card-1"]')).not.toBeVisible();
  });

  test('should show error when deleting other user event', async ({ page }) => {
    // Try to delete event created by another user
    await page.goto('/events/other-user-event-id');
    await page.click('[data-testid="delete-event-button"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify error message
    await expect(
      page.locator('text=You do not have permission to delete this event')
    ).toBeVisible();
  });

  test('should show error for non-existent event', async ({ page }) => {
    await page.goto('/events/non-existent-uuid');
    await page.click('[data-testid="delete-event-button"]');
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(
      page.locator('text=Event not found or has been archived')
    ).toBeVisible();
  });
});
```

---

### Krok 7: Aktualizacja dokumentacji

**Plik 1:** `.ai/api-plan.md`

**Dodaj sekcję:**

```markdown
#### DELETE /events/:eventId - Implementation Status: ✅ COMPLETED

**Implementation Details:**
- Service Layer: `EventsService.deleteEvent()`
- Action: `src/actions/deleteEvent.ts`
- Hook: `useDeleteEvent()` in `src/hooks/useEvents.ts`
- UI Component: `DeleteEventButton.tsx`

**Tested Scenarios:**
- ✅ Successful deletion by creator
- ✅ 400 Invalid UUID format
- ✅ 401 Unauthenticated access
- ✅ 403 Non-creator attempt
- ✅ 404 Event not found
- ✅ 500 Database error handling

**Security:**
- RLS policy: `events_delete_own_authenticated`
- JWT validation enforced
- Family isolation automatic

**Performance:**
- Single atomic UPDATE query with RETURNING
- Indexed on id (PK) and created_by
- Target p95: < 200ms
```

**Plik 2:** `PROJECT-STATUS.md`

**Dodaj do PHASE log:**

```markdown
### 📦 FAZA X: DELETE Event Endpoint (Krok X)

#### X.1 Service Layer ✅
**Plik**: `src/services/events.service.ts`

**Nowa metoda**: `deleteEvent(eventId, userId, familyId)`

**Funkcjonalności**:
- ✅ Soft delete (archived_at)
- ✅ RLS enforcement
- ✅ ServiceError handling
- ✅ UUID validation
- ✅ Atomic operation with RETURNING

#### X.2 React 19 Action ✅
**Plik**: `src/actions/deleteEvent.ts`

**Funkcjonalności**:
- ✅ JWT Authentication
- ✅ UUID validation
- ✅ User context extraction
- ✅ Error handling z kodami HTTP
- ✅ Either pattern
- ✅ DEV_MODE support

#### X.3 React Hook ✅
**Plik**: `src/hooks/useEvents.ts`

**Nowy hook**: `useDeleteEvent()`

**Funkcjonalności**:
- ✅ Loading state
- ✅ Error handling
- ✅ Reset function
- ✅ Type-safe results

#### X.4 UI Component ✅
**Plik**: `src/components/events/DeleteEventButton.tsx`

**Funkcjonalności**:
- ✅ Confirmation dialog
- ✅ Loading state
- ✅ Error display
- ✅ Toast notifications
- ✅ Accessibility (ARIA)

**Status**: ✅ Gotowe do użycia
```

---

### Krok 8: Weryfikacja i deployment

**Checklist przed merge:**

```markdown
## Pre-Merge Checklist

### Code Quality
- [ ] TypeScript kompiluje bez błędów
- [ ] ESLint passing (0 errors)
- [ ] Prettier formatting applied
- [ ] No console.log in production code (use console.info/warn/error)

### Testing
- [ ] Unit tests dla EventsService.deleteEvent() passing
- [ ] Integration tests dla deleteEvent action passing
- [ ] Manual testing w DEV_MODE
- [ ] Manual testing z prawdziwą bazą (staging)

### Security
- [ ] RLS policies verified
- [ ] JWT validation tested
- [ ] Family isolation verified
- [ ] No sensitive data in logs

### Documentation
- [ ] API plan updated
- [ ] PROJECT-STATUS.md updated
- [ ] JSDoc comments complete
- [ ] Example usage provided

### Performance
- [ ] Query uses RETURNING (single round-trip)
- [ ] Indexes verified
- [ ] No N+1 queries
- [ ] Loading states implemented

### UX
- [ ] Confirmation dialog works
- [ ] Error messages user-friendly
- [ ] Success feedback provided
- [ ] Keyboard navigation works
```

**Deployment steps:**

```bash
# 1. Run tests
npm run test

# 2. Lint code
npm run lint

# 3. Type check
npm run type-check

# 4. Build
npm run build

# 5. Deploy to staging
vercel deploy --env staging

# 6. Smoke test on staging
# - Test successful deletion
# - Test 403 error
# - Test 404 error

# 7. Deploy to production
vercel deploy --prod

# 8. Monitor logs
vercel logs --follow
```

---

## 10. Podsumowanie

### Kluczowe decyzje implementacyjne

1. **Soft Delete**: Zachowanie danych przez `archived_at` zamiast hard delete
2. **RLS Security**: Wykorzystanie policies Supabase zamiast ręcznych sprawdzeń
3. **Either Pattern**: Type-safe error handling z `DeleteEventResult`
4. **Atomic Operation**: Single UPDATE z RETURNING dla performance
5. **ServiceError**: Strukturalne błędy z HTTP status codes
6. **DEV_MODE**: Support dla mock authentication podczas developmentu

### Wpływ na system

**Zmodyfikowane pliki:**
- `src/services/events.service.ts` - dodano `deleteEvent()`
- `src/hooks/useEvents.ts` - dodano `useDeleteEvent()`

**Nowe pliki:**
- `src/actions/deleteEvent.ts` - główna logika endpointu
- `src/components/events/DeleteEventButton.tsx` - UI component

**Brak zmian w bazie:**
- RLS policies już istnieją
- Trigger dla `archived_at` już istnieje
- Żadne migracje nie są wymagane

### Zgodność z architekturą

✅ **React 19 Actions**: Pełne wsparcie dla Actions pattern  
✅ **TypeScript 5**: Ścisłe typowanie na każdym poziomie  
✅ **Supabase RLS**: Automatyczna autoryzacja na poziomie bazy  
✅ **Zod Validation**: UUID validation przez helper functions  
✅ **Error Handling**: Early returns i guard clauses  
✅ **Shadcn/ui**: AlertDialog dla confirmation  
✅ **Optimistic UI**: Opcjonalne wsparcie przez `useOptimistic`

### Metryki sukcesu

**Funkcjonalność:**
- ✅ Tylko twórca może usunąć wydarzenie
- ✅ Soft delete zachowuje dane
- ✅ Zadania zachowują referencje (event_id → NULL)
- ✅ Błędy są jasne i actionable

**Performance:**
- Target: p95 < 200ms
- Single query z RETURNING
- Indexed queries

**Security:**
- RLS enforcement
- JWT validation
- Family isolation
- Audit trail (archived_at)

**UX:**
- Confirmation dialog
- Loading states
- Clear error messages
- Keyboard accessible

---

## Załączniki

### A. Pełna struktura plików

```
homeHQ/
├── src/
│   ├── actions/
│   │   ├── createEvent.ts (existing)
│   │   └── deleteEvent.ts (NEW)
│   ├── services/
│   │   └── events.service.ts (MODIFIED - add deleteEvent)
│   ├── hooks/
│   │   └── useEvents.ts (MODIFIED - add useDeleteEvent)
│   ├── components/
│   │   └── events/
│   │       ├── CreateEventDialog.tsx (existing)
│   │       └── DeleteEventButton.tsx (NEW)
│   ├── types.ts (existing - no changes)
│   └── lib/
│       └── utils/
│           └── api-errors.ts (existing - no changes)
└── supabase/
    └── migrations/
        └── 20260102120006_enable_rls_policies.sql (existing)
```

### B. Type Definitions Reference

```typescript
// Input
eventId: string // Must be valid UUID

// Output (Success)
{ success: true }

// Output (Error)
{
  success: false;
  error: {
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    }
  }
}

// Error Codes
'INVALID_EVENT_ID'      // 400
'UNAUTHORIZED'          // 401
'FORBIDDEN'             // 403
'EVENT_NOT_FOUND'       // 404
'INTERNAL_ERROR'        // 500
```

### C. Przykład użycia w aplikacji

```tsx
// Example: Event detail page with delete button
import { useEvent } from '@/hooks/useEvents';
import { DeleteEventButton } from '@/components/events/DeleteEventButton';
import { useRouter } from 'next/navigation';

export function EventDetailPage({ eventId }: { eventId: string }) {
  const { event, isLoading } = useEvent(eventId);
  const router = useRouter();

  if (isLoading) return <Spinner />;
  if (!event) return <NotFound />;

  const handleDeleted = () => {
    router.push('/events');
  };

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      
      {/* Show delete button only for creator */}
      {event.created_by === currentUserId && (
        <DeleteEventButton
          eventId={event.id}
          eventTitle={event.title}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
```

### D. Monitoring i Alerting

**Zalecane metryki:**

```typescript
// Success rate
const successRate = (successful_deletes / total_delete_attempts) * 100;
// Target: > 95%

// Error distribution
const errorBreakdown = {
  INVALID_EVENT_ID: 2%,
  UNAUTHORIZED: 1%,
  FORBIDDEN: 5%,
  EVENT_NOT_FOUND: 10%,
  INTERNAL_ERROR: < 1%
};

// Performance
const p95_latency = 180; // ms
// Target: < 200ms

// Volume
const deletes_per_day = 50;
// Monitor for sudden spikes (potential abuse)
```

**Alert triggers:**
- Error rate > 10% for 5 minutes → PagerDuty
- p95 latency > 500ms for 10 minutes → Slack alert
- Delete volume > 1000/hour → Rate limiting review

---

## Pytania i odpowiedzi

**Q: Czy soft delete wpływa na wydajność zapytań?**  
A: Nie, dzięki partial index `WHERE archived_at IS NULL` wszystkie zapytania na aktywnych wydarzeniach są szybkie. Archiwalne wydarzenia są pomijane na poziomie indeksu.

**Q: Co się dzieje z uczestnikami wydarzenia po usunięciu?**  
A: Rekordy w `event_participants` są usuwane przez `ON DELETE CASCADE`. To nie wpływa na profil użytkowników, tylko na powiązanie z wydarzeniem.

**Q: Czy można przywrócić usunięte wydarzenie?**  
A: Technicznie tak - wystarczy ustawić `archived_at = NULL`. Funkcjonalność "undelete" można dodać w przyszłości jako admin feature.

**Q: Jak long przechowujemy archiwalne wydarzenia?**  
A: Obecnie bez limitu. Zalecana implementacja: cron job usuwający wydarzenia starsze niż 2 lata (hard delete).

**Q: Czy DELETE /events/:eventId usuwa również zadania?**  
A: Nie. Zadania mają `ON DELETE SET NULL`, więc ich `event_id` staje się `NULL`, ale zadania pozostają. To pozwala zachować historię zadań nawet po usunięciu wydarzenia.

---

**Koniec dokumentu**


