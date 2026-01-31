# API Endpoint Implementation Plan: GET /events/:eventId

## 1. Przegląd punktu końcowego

Endpoint **GET /events/:eventId** pobiera szczegółowe informacje o pojedynczym wydarzeniu (event) z kalendarza rodziny. Zwraca pełne dane eventu wraz z listą uczestników i nazwą twórcy. Endpoint respektuje zasady prywatności (RLS) - użytkownicy mogą pobierać tylko eventy z własnej rodziny, a prywatne eventy są dostępne wyłącznie dla ich twórców. Zarchiwizowane eventy są traktowane jako nieistniejące.

**Cel biznesowy:** Umożliwienie użytkownikom przeglądania szczegółów wydarzeń rodzinnych w celu lepszego planowania i koordynacji działań.

**Kluczowe funkcjonalności:**
- Pobranie pełnych danych eventu po ID
- Dołączenie listy uczestników (id + display_name)
- Dołączenie nazwy twórcy eventu (created_by_name)
- Automatyczna filtracja przez RLS (Row Level Security)
- Wykluczenie zarchiwizowanych eventów
- Kontrola dostępu do prywatnych eventów

---

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
GET /events/:eventId
```

### Parametry URL

**Wymagane:**
- `eventId` (string, UUID) - Identyfikator eventu do pobrania

### Nagłówki (Headers)

**Wymagane:**
```
Authorization: Bearer {access_token}
```

> **Uwaga:** Autoryzacja i walidacja JWT będą zaimplementowane w późniejszym terminie. Na razie zakładamy, że endpoint otrzyma `userId` i `familyId` jako parametry.

### Query Parameters
Brak

### Request Body
Brak (metoda GET)

### Przykład żądania

```http
GET /events/123e4567-e89b-12d3-a456-426614174000 HTTP/1.1
Host: api.homehq.app
```

---

## 3. Wykorzystywane typy

### Request Types
- Brak dedykowanego typu request (parametr URL)

### Response Types

**EventDetailsResponse** (z `types.ts`):
```typescript
export type EventDetailsResponse = EventWithCreator;
```

**EventWithCreator** (z `types.ts`):
```typescript
export interface EventWithCreator
  extends Omit<Tables<'events'>, 'created_by'> {
  created_by: string;
  created_by_name: string;
  participants: EventParticipant[];
}
```

Zawiera wszystkie pola z tabeli `events`:
- `id: string` (UUID)
- `family_id: string` (UUID)
- `created_by: string` (UUID)
- `title: string`
- `description: string | null`
- `start_time: string` (ISO 8601)
- `end_time: string` (ISO 8601)
- `is_private: boolean`
- `created_at: string` (ISO 8601)
- `updated_at: string` (ISO 8601)
- `archived_at: string | null` (ISO 8601)

Plus dodatkowe pola:
- `created_by_name: string` (display_name twórcy)
- `participants: EventParticipant[]` (lista uczestników)

**EventParticipant** (z `types.ts`):
```typescript
export type EventParticipant = Pick<Tables<'profiles'>, 'id' | 'display_name'>;
```

Zawiera:
- `id: string` (UUID profilu)
- `display_name: string` (nazwa wyświetlana)

**ApiError** (z `types.ts`):
```typescript
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Helper Types

**isUUID** (z `types.ts`):
```typescript
export function isUUID(value: string): boolean
```
Funkcja pomocnicza do walidacji formatu UUID.

---

## 4. Szczegóły odpowiedzi

### Sukces: 200 OK

**Content-Type:** `application/json`

**Body:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "family_id": "987fcdeb-51a2-43f7-b123-456789abcdef",
  "created_by": "456e7890-e12b-34d5-c678-901234567890",
  "created_by_name": "John Smith",
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
      "id": "111e2222-e33b-44d5-a666-777788889999",
      "display_name": "Kid 1"
    },
    {
      "id": "222e3333-e44b-55d6-b777-888899990000",
      "display_name": "Kid 2"
    }
  ]
}
```

### Błędy

#### 400 Bad Request
Nieprawidłowy format UUID w parametrze eventId.

```json
{
  "error": {
    "code": "INVALID_EVENT_ID",
    "message": "Event ID must be a valid UUID",
    "details": {
      "eventId": "invalid-format"
    }
  }
}
```

#### 403 Forbidden
Użytkownik nie ma dostępu do tego eventu (inna rodzina lub prywatny event innego użytkownika).

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this event",
    "details": {
      "reason": "Event is private and you are not the creator"
    }
  }
}
```

lub

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this event",
    "details": {
      "reason": "Event belongs to a different family"
    }
  }
}
```

#### 404 Not Found
Event nie istnieje lub został zarchiwizowany.

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found or has been archived"
  }
}
```

#### 500 Internal Server Error
Nieoczekiwany błąd serwera.

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "requestId": "req_123456789"
    }
  }
}
```

---

## 5. Przepływ danych

### Architektura warstwowa

```
Client (React Component)
    ↓
API Route Handler (/src/pages/api/events/[eventId].ts)
    ↓
Events Service (/src/lib/services/events.service.ts)
    ↓
Supabase Client (/src/db/supabase.client.ts)
    ↓
PostgreSQL Database (z RLS)
```

### Szczegółowy przepływ

#### 1. Request Handling (API Route)
```typescript
// /src/pages/api/events/[eventId].ts
export async function GET({ params, request }: APIContext) {
  // 1.1. Extract eventId from params
  // 1.2. Validate eventId format (UUID)
  // 1.3. Get user_id and family_id (autoryzacja w przyszłości)
  // 1.4. Call EventsService.getEventById()
  // 1.5. Return formatted response
}
```

#### 2. Service Layer (Events Service)
```typescript
// /src/lib/services/events.service.ts
export async function getEventById(
  eventId: string,
  userId: string,
  familyId: string
): Promise<EventDetailsResponse> {
  // 2.1. Query Supabase for event with eventId
  // 2.2. Include JOIN with profiles for created_by_name
  // 2.3. Include JOIN with event_participants + profiles for participants list
  // 2.4. Filter: archived_at IS NULL
  // 2.5. RLS automatically filters by family_id
  // 2.6. Check if event exists
  // 2.7. Additional check: if is_private, verify created_by === userId
  // 2.8. Transform and return data
}
```

#### 3. Database Query (Supabase)

**Główne zapytanie:**
```sql
SELECT 
  e.*,
  p.display_name as created_by_name
FROM events e
INNER JOIN profiles p ON e.created_by = p.id
WHERE e.id = $1
  AND e.archived_at IS NULL
  AND e.family_id = $2  -- enforced by RLS
LIMIT 1
```

**Zapytanie dla uczestników:**
```sql
SELECT 
  p.id,
  p.display_name
FROM event_participants ep
INNER JOIN profiles p ON ep.profile_id = p.id
WHERE ep.event_id = $1
ORDER BY p.display_name ASC
```

**Alternatywnie - jedno zapytanie z agregacją:**
```sql
SELECT 
  e.*,
  cp.display_name as created_by_name,
  COALESCE(
    json_agg(
      json_build_object('id', p.id, 'display_name', p.display_name)
      ORDER BY p.display_name
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'
  ) as participants
FROM events e
INNER JOIN profiles cp ON e.created_by = cp.id
LEFT JOIN event_participants ep ON e.id = ep.event_id
LEFT JOIN profiles p ON ep.profile_id = p.id
WHERE e.id = $1
  AND e.archived_at IS NULL
  AND e.family_id = $2
GROUP BY e.id, cp.display_name
LIMIT 1
```

#### 4. RLS Policy Enforcement

Supabase automatycznie aplikuje RLS policies dla tabeli `events`:

```sql
-- Policy: Users can read events in their family
CREATE POLICY "Users can read family events"
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
  AND archived_at IS NULL
);
```

#### 5. Response Formation

Service zwraca obiekt `EventDetailsResponse`:
```typescript
{
  ...eventData,
  created_by_name: creatorProfile.display_name,
  participants: participantsList
}
```

#### 6. Error Handling Flow

```
Validation Error → 400 Bad Request
    ↓
Event Not Found / Archived → 404 Not Found
    ↓
Privacy Check Failed → 403 Forbidden
    ↓
Family Mismatch (RLS) → 403 Forbidden
    ↓
Database Error → 500 Internal Server Error
```

> **Uwaga:** Autoryzacja (401 Unauthorized) będzie dodana w przyszłości.

---

## 6. Względy bezpieczeństwa

> **Uwaga:** Autentykacja JWT będzie zaimplementowana w późniejszym terminie.

### 6.1. Autoryzacja

**Row Level Security (RLS):**
- RLS policies w PostgreSQL automatycznie filtrują wyniki zapytań
- User może widzieć tylko eventy z własnej rodziny (`family_id`)
- Private eventy widoczne tylko dla twórcy (`created_by = auth.uid()`)
- Zarchiwizowane eventy są niewidoczne (`archived_at IS NULL`)

**Dodatkowa walidacja w aplikacji:**
```typescript
// After fetching event from database
if (!event) {
  return { status: 404, error: 'EVENT_NOT_FOUND' };
}

// Additional privacy check (belt and suspenders approach)
if (event.is_private && event.created_by !== userId) {
  return { 
    status: 403, 
    error: 'FORBIDDEN',
    reason: 'Event is private and you are not the creator'
  };
}

// Additional family check
if (event.family_id !== familyId) {
  return { 
    status: 403, 
    error: 'FORBIDDEN',
    reason: 'Event belongs to a different family'
  };
}
```

### 6.2. Walidacja danych wejściowych

**EventId validation:**
```typescript
import { isUUID } from '@/types';

if (!isUUID(eventId)) {
  return new Response(JSON.stringify({
    error: {
      code: 'INVALID_EVENT_ID',
      message: 'Event ID must be a valid UUID',
      details: { eventId }
    }
  }), { status: 400 });
}
```

### 6.3. Zapobieganie atakom

**SQL Injection:**
- Używanie parametryzowanych zapytań Supabase (automatyczne przez Supabase Client)
- Nigdy nie konkatenować wartości bezpośrednio do zapytań SQL

**IDOR (Insecure Direct Object Reference):**
- RLS policies zapewniają, że user może dostać tylko eventy z własnej rodziny
- Dodatkowa weryfikacja family_id w service layer

**Information Disclosure:**
- Różne błędy dla "not found" i "forbidden" mogą ujawnić istnienie eventu
- Rozważenie zwracania 404 dla obu przypadków (ale 403 jest bardziej precyzyjne dla UX)
- Nie ujawniać szczegółów błędów bazy danych w odpowiedzi

**Logging & Monitoring:**
- Logowanie wszystkich nieudanych prób dostępu (403, 404)
- Monitorowanie nietypowych wzorców żądań
- Nie logować wrażliwych danych

---

## 7. Obsługa błędów

### 7.1. Hierarchia błędów

Błędy są sprawdzane i zwracane w następującej kolejności (fail-fast approach):

```
1. Walidacja formatu eventId (UUID)
   ↓ FAIL → 400 Bad Request
   
2. Pobranie eventu z bazy
   ↓ FAIL → 404 Not Found
   
3. Sprawdzenie archived_at
   ↓ archived → 404 Not Found
   
4. Sprawdzenie family_id (RLS + dodatkowo)
   ↓ FAIL → 403 Forbidden
   
5. Sprawdzenie is_private + created_by
   ↓ FAIL → 403 Forbidden
   
SUCCESS → 200 OK
```

> **Uwaga:** Walidacja autoryzacji (401 Unauthorized) będzie dodana w przyszłości między krokami 1 i 2.

### 7.2. Szczegółowe scenariusze błędów

#### Błąd 400: Invalid Event ID Format

**Warunek:**
```typescript
!isUUID(eventId)
```

**Odpowiedź:**
```json
{
  "error": {
    "code": "INVALID_EVENT_ID",
    "message": "Event ID must be a valid UUID",
    "details": {
      "eventId": "abc123"
    }
  }
}
```

**Implementacja:**
```typescript
if (!isUUID(eventId)) {
  return new Response(
    JSON.stringify({
      error: {
        code: 'INVALID_EVENT_ID',
        message: 'Event ID must be a valid UUID',
        details: { eventId }
      }
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
```

#### Błąd 403: Forbidden Access

**Warunki:**
- Event należy do innej rodziny (family_id mismatch)
- Event jest prywatny i user nie jest twórcą

**Odpowiedź (inna rodzina):**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this event",
    "details": {
      "reason": "Event belongs to a different family"
    }
  }
}
```

**Odpowiedź (prywatny event):**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this event",
    "details": {
      "reason": "Event is private and you are not the creator"
    }
  }
}
```

**Implementacja:**
```typescript
// This should be mostly handled by RLS, but add belt-and-suspenders check
if (event.family_id !== userFamilyId) {
  console.warn(`Access denied: User ${userId} tried to access event ${eventId} from different family`);
  return {
    status: 403,
    body: {
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this event',
        details: { reason: 'Event belongs to a different family' }
      }
    }
  };
}

if (event.is_private && event.created_by !== userId) {
  console.warn(`Access denied: User ${userId} tried to access private event ${eventId}`);
  return {
    status: 403,
    body: {
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this event',
        details: { reason: 'Event is private and you are not the creator' }
      }
    }
  };
}
```

#### Błąd 404: Event Not Found

**Warunki:**
- Event o podanym ID nie istnieje w bazie
- Event jest zarchiwizowany (archived_at IS NOT NULL)
- RLS policy odfiltrował event (zwrócono null)

**Odpowiedź:**
```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found or has been archived"
  }
}
```

**Uwaga:** Celowo nie rozróżniamy "nie istnieje" vs "zarchiwizowany" vs "brak dostępu" w komunikacie, aby nie ujawniać informacji o istnieniu eventu.

**Implementacja:**
```typescript
const { data: event, error: dbError } = await supabase
  .from('events')
  .select(`
    *,
    created_by_profile:profiles!created_by(display_name),
    participants:event_participants(
      profile:profiles(id, display_name)
    )
  `)
  .eq('id', eventId)
  .is('archived_at', null)
  .single();

if (dbError || !event) {
  console.info(`Event not found or inaccessible: ${eventId}`);
  return {
    status: 404,
    body: {
      error: {
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found or has been archived'
      }
    }
  };
}
```

#### Błąd 500: Internal Server Error

**Warunki:**
- Nieoczekiwany błąd bazy danych
- Błąd sieciowy
- Błąd w logice aplikacji
- Timeout

**Odpowiedź:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "requestId": "req_abc123xyz"
    }
  }
}
```

**Implementacja:**
```typescript
try {
  // ... main logic
} catch (error) {
  console.error('Unexpected error in GET /events/:eventId:', error);
  
  // Log to error monitoring service (e.g., Sentry)
  // Sentry.captureException(error);
  
  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: {
          requestId: generateRequestId() // for tracking
        }
      }
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
```

### 7.3. Logging Strategy

**Co logować:**
- Wszystkie błędy 500 (z pełnym stack trace)
- Próby nieautoryzowanego dostępu (403)
- Próby dostępu do nieistniejących zasobów (404)
- Czas odpowiedzi dla celów performance monitoring

**Czego NIE logować:**
- Pełnych błędów bazy danych w odpowiedzi do klienta (information disclosure)
- Danych osobowych użytkowników (GDPR compliance)

**Poziomy logowania:**
```typescript
// ERROR - krytyczne błędy wymagające interwencji
console.error('Database connection failed:', error);

// WARN - potencjalne problemy, nieautoryzowany dostęp
console.warn(`User ${userId} attempted to access forbidden event ${eventId}`);

// INFO - normalne operacje
console.info(`Event ${eventId} fetched successfully by user ${userId}`);

// DEBUG - szczegółowe informacje dla development
console.debug('Query params:', { eventId, userId, familyId });
```

---

## 8. Rozważania dotyczące wydajności

### 8.1. Optymalizacja zapytań do bazy danych

**Problem:** Wykonywanie wielu zapytań (N+1 query problem)

**Rozwiązanie:** Użycie JOINów lub Supabase query builder z nested selects

```typescript
// ✅ GOOD - Single query with JOINs
const { data: event } = await supabase
  .from('events')
  .select(`
    *,
    created_by_profile:profiles!created_by(display_name),
    participants:event_participants(
      profile:profiles(id, display_name)
    )
  `)
  .eq('id', eventId)
  .is('archived_at', null)
  .single();

// ❌ BAD - Multiple queries (N+1 problem)
const event = await getEvent(eventId);
const creator = await getProfile(event.created_by);
const participants = await getEventParticipants(eventId);
```

**Indeksy bazy danych:**
Upewnić się, że istnieją następujące indeksy:
- `events.id` (PRIMARY KEY - automatyczny)
- `events.family_id` (dla RLS filtering)
- `events.archived_at` (dla filtrowania)
- `event_participants.event_id` (dla JOINa)
- `event_participants.profile_id` (dla JOINa)

### 8.2. Caching Strategy

**Response Caching:**
- Rozważyć cache na poziomie CDN/API Gateway dla publicznych eventów
- TTL: 5-10 minut
- Invalidacja cache przy update/delete eventu

```typescript
// Example with Cache-Control headers
return new Response(
  JSON.stringify(event),
  {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=300', // 5 minutes
      'ETag': generateETag(event)
    }
  }
);
```

**In-memory caching (opcjonalnie):**
- Dla często odczytywanych eventów
- Uwaga: Invalidacja cache przy zmianach
- Użycie Redis lub podobnego

### 8.3. Connection Pooling

- Supabase automatycznie zarządza connection pooling
- Upewnić się, że connection pool ma odpowiedni rozmiar
- Monitorować liczbę aktywnych połączeń

### 8.4. Response Size Optimization

**Kompresja:**
- Włączyć gzip/brotli compression na poziomie serwera
- Zredukować rozmiar response o 70-80%

**Pagination/Limiting:**
- Endpoint zwraca pojedynczy event (nie dotyczy)
- Dla listy uczestników: ograniczyć do 100 uczestników (edge case)

### 8.5. Query Performance Monitoring

**Metryki do śledzenia:**
- Database query time
- Total response time
- Cache hit rate (jeśli implementowane)
- Error rate

**Slow Query Logging:**
```typescript
const startTime = Date.now();

try {
  const event = await getEventById(eventId, userId, familyId);
  
  const duration = Date.now() - startTime;
  if (duration > 1000) {
    console.warn(`Slow query detected: GET /events/${eventId} took ${duration}ms`);
  }
  
  return event;
} catch (error) {
  const duration = Date.now() - startTime;
  console.error(`Query failed after ${duration}ms:`, error);
  throw error;
}
```

**Performance targets:**
- Database query: < 100ms (p95)
- Total response time: < 200ms (p95)
- Error rate: < 0.1%

### 8.6. Load Testing

**Scenariusze testowe:**
- Concurrent requests: 100 req/s
- Spike test: 500 req/s przez 10 sekund
- Soak test: 50 req/s przez 1 godzinę

**Narzędzia:**
- k6, Artillery, JMeter

---

## 9. Etapy wdrożenia

### Krok 1: Utworzenie struktury plików i typów

**Pliki do utworzenia/zmodyfikowania:**
- `/src/pages/api/events/[eventId].ts` - API route handler
- `/src/lib/services/events.service.ts` - Events service (jeśli nie istnieje)
- `/src/lib/utils/api-errors.ts` - Standardowe error helpers (opcjonalnie)

**Zadania:**
1. Utworzyć plik API route z podstawową strukturą
2. Zaimportować wymagane typy z `@/types`
3. Utworzyć EventsService (jeśli nie istnieje) z metodą `getEventById`

```typescript
// /src/pages/api/events/[eventId].ts
import type { APIContext } from 'astro';
import type { EventDetailsResponse, ApiError } from '@/types';
import { isUUID } from '@/types';
import { getSupabaseClient } from '@/db/supabase.client';
import { getEventById } from '@/lib/services/events.service';

export async function GET({ params, request }: APIContext) {
  // Implementation in next steps
}
```

---

### Krok 2: Implementacja walidacji parametrów

**Zadania:**
1. Ekstrakcja i walidacja `eventId` z URL params
2. Przygotowanie do integracji z autoryzacją (placeholder dla `userId` i `familyId`)

**Implementacja:**

```typescript
export async function GET({ params, request }: APIContext) {
  // 2.1. Validate eventId format
  const { eventId } = params;
  
  if (!eventId || !isUUID(eventId)) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'INVALID_EVENT_ID',
          message: 'Event ID must be a valid UUID',
          details: { eventId }
        }
      } as ApiError),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // 2.2. TODO: Get userId and familyId from auth (to be implemented)
  // For now, use placeholder or query parameters for testing
  const supabase = getSupabaseClient();
  const userId = 'placeholder-user-id'; // TODO: Get from auth
  const familyId = 'placeholder-family-id'; // TODO: Get from auth

  // Continue to step 3...
}
```

> **Uwaga:** Autoryzacja JWT będzie dodana w późniejszym terminie.

---

### Krok 3: Implementacja Events Service

**Zadania:**
1. Utworzyć funkcję `getEventById` w Events Service
2. Zaimplementować zapytanie Supabase z JOINami
3. Dodać walidację dostępu (RLS + dodatkowe sprawdzenia)
4. Transformacja danych do formatu `EventDetailsResponse`

**Implementacja:**

```typescript
// /src/lib/services/events.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventDetailsResponse, EventParticipant } from '@/types';

export async function getEventById(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  familyId: string
): Promise<EventDetailsResponse> {
  
  // 3.1. Query event with creator and participants
  const { data: eventData, error: queryError } = await supabase
    .from('events')
    .select(`
      id,
      family_id,
      created_by,
      title,
      description,
      start_time,
      end_time,
      is_private,
      created_at,
      updated_at,
      archived_at,
      creator:profiles!events_created_by_fkey (
        display_name
      ),
      event_participants (
        participant:profiles (
          id,
          display_name
        )
      )
    `)
    .eq('id', eventId)
    .is('archived_at', null)
    .single();

  // 3.2. Handle not found
  if (queryError || !eventData) {
    console.info(`Event not found or inaccessible: ${eventId}`, queryError);
    throw {
      status: 404,
      code: 'EVENT_NOT_FOUND',
      message: 'Event not found or has been archived'
    };
  }

  // 3.3. Additional family check (belt-and-suspenders)
  if (eventData.family_id !== familyId) {
    console.warn(`Family mismatch: User ${userId} tried to access event ${eventId} from different family`);
    throw {
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this event',
      details: { reason: 'Event belongs to a different family' }
    };
  }

  // 3.4. Additional privacy check
  if (eventData.is_private && eventData.created_by !== userId) {
    console.warn(`Privacy violation: User ${userId} tried to access private event ${eventId}`);
    throw {
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this event',
      details: { reason: 'Event is private and you are not the creator' }
    };
  }

  // 3.5. Transform data to EventDetailsResponse format
  const participants: EventParticipant[] = 
    eventData.event_participants?.map(ep => ({
      id: ep.participant.id,
      display_name: ep.participant.display_name
    })) || [];

  const response: EventDetailsResponse = {
    id: eventData.id,
    family_id: eventData.family_id,
    created_by: eventData.created_by,
    created_by_name: eventData.creator?.display_name || 'Unknown',
    title: eventData.title,
    description: eventData.description,
    start_time: eventData.start_time,
    end_time: eventData.end_time,
    is_private: eventData.is_private,
    created_at: eventData.created_at,
    updated_at: eventData.updated_at,
    archived_at: eventData.archived_at,
    participants
  };

  return response;
}
```

---

### Krok 4: Integracja Service z API Route

**Zadania:**
1. Wywołać `getEventById` z API route
2. Obsłużyć sukces (200) i błędy
3. Zwrócić sformatowaną odpowiedź

**Implementacja:**

```typescript
// /src/pages/api/events/[eventId].ts (continuation)
export async function GET({ params, request }: APIContext) {
  // ... Steps 2.1-2.2 (validation) ...

  try {
    // 4.1. Call service to get event
    const event = await getEventById(
      supabase,
      eventId,
      userId,  // From auth (placeholder for now)
      familyId // From auth (placeholder for now)
    );

    // 4.2. Return success response
    return new Response(
      JSON.stringify(event),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=300' // 5 min cache
        }
      }
    );

  } catch (error: any) {
    // 4.3. Handle service errors
    if (error.status && error.code) {
      // Known error from service
      return new Response(
        JSON.stringify({
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        } as ApiError),
        {
          status: error.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 4.4. Handle unexpected errors
    console.error('Unexpected error in GET /events/:eventId:', error);
    
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          details: {
            requestId: crypto.randomUUID()
          }
        }
      } as ApiError),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
```

---

### Krok 5: Weryfikacja RLS policies w bazie danych

**Zadania:**
1. Sprawdzić, czy RLS jest włączone dla tabeli `events`
2. Zweryfikować policies dla SELECT operations
3. Przetestować policies z różnymi userami

**SQL do weryfikacji:**

```sql
-- 5.1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'events';
-- Should return: rowsecurity = true

-- 5.2. List existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'events';

-- 5.3. Create/verify policy for SELECT
CREATE POLICY "Users can read family events"
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
  AND archived_at IS NULL
);
```

**Testy RLS:**
```sql
-- Test as User A (family 1, admin)
SET request.jwt.claims.sub = 'user-a-uuid';

-- Should return events from family 1 (shared + own private)
SELECT * FROM events WHERE family_id = 'family-1-uuid';

-- Should NOT return events from family 2
SELECT * FROM events WHERE family_id = 'family-2-uuid';

-- Test as User B (family 1, member)
SET request.jwt.claims.sub = 'user-b-uuid';

-- Should return shared events + own private events
SELECT * FROM events WHERE family_id = 'family-1-uuid';

-- Should NOT return User A's private events
SELECT * FROM events WHERE family_id = 'family-1-uuid' AND created_by = 'user-a-uuid' AND is_private = true;
```

---

### Krok 6: Utworzenie helper functions dla błędów (opcjonalnie)

**Zadania:**
1. Utworzyć helper functions dla standardowych odpowiedzi błędów
2. Zmniejszyć boilerplate w API routes

**Implementacja:**

```typescript
// /src/lib/utils/api-errors.ts
import type { ApiError } from '@/types';

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      error: { code, message, details }
    } as ApiError),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export const ApiErrors = {
  invalidEventId: (eventId: string) =>
    errorResponse(400, 'INVALID_EVENT_ID', 'Event ID must be a valid UUID', { eventId }),
  
  forbidden: (reason: string) =>
    errorResponse(403, 'FORBIDDEN', 'You do not have permission to access this event', { reason }),
  
  eventNotFound: () =>
    errorResponse(404, 'EVENT_NOT_FOUND', 'Event not found or has been archived'),
  
  internalError: () =>
    errorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred', {
      requestId: crypto.randomUUID()
    })
};
```

**Użycie w API route:**
```typescript
import { ApiErrors } from '@/lib/utils/api-errors';

if (!isUUID(eventId)) {
  return ApiErrors.invalidEventId(eventId);
}
```

---

### Krok 7: Weryfikacja bazy danych i optymalizacja

**Zadania:**
1. Zweryfikować RLS policies w bazie danych
2. Dodać niezbędne indeksy dla optymalizacji
3. Przetestować zapytania SQL

**7.1. Weryfikacja RLS policies:**

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'events';
-- Should return: rowsecurity = true

-- List existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'events';

-- Verify policy for SELECT exists
-- Policy should filter by family_id, is_private, and archived_at
```

**7.2. Dodanie indeksów (jeśli brakuje):**

```sql
-- Index for archived events filter
CREATE INDEX IF NOT EXISTS idx_events_archived_at 
ON events (archived_at) 
WHERE archived_at IS NULL;

-- Composite index for family + archived filtering
CREATE INDEX IF NOT EXISTS idx_events_family_archived 
ON events (family_id, archived_at) 
WHERE archived_at IS NULL;

-- Index for event_participants lookup
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id 
ON event_participants (event_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_profile_id 
ON event_participants (profile_id);
```

---

### Krok 8: Dokumentacja

**Zadania:**
1. Zaktualizować dokumentację API
2. Dodać komentarze JSDoc do kodu
3. Utworzyć changelog entry

**8.1. JSDoc comments:**

Dodać JSDoc komentarze do funkcji:

```typescript
/**
 * Retrieves a single event by ID with creator name and participants.
 * 
 * @param supabase - Authenticated Supabase client
 * @param eventId - UUID of the event to retrieve
 * @param userId - ID of the requesting user (for privacy check)
 * @param familyId - ID of the user's family (for access control)
 * 
 * @returns EventDetailsResponse object with full event data
 * 
 * @throws {404} Event not found or archived
 * @throws {403} User doesn't have access (different family or private event)
 * 
 * @example
 * const event = await getEventById(supabase, eventId, userId, familyId);
 * console.log(event.title, event.participants);
 */
export async function getEventById(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  familyId: string
): Promise<EventDetailsResponse> {
  // ...
}
```

**8.2. Changelog:**

```markdown
# Changelog

## [1.2.0] - 2026-01-23

### Added
- New endpoint: GET /events/:eventId
  - Retrieve single event with full details
  - Includes creator name and participant list
  - Respects RLS and privacy settings
  - Returns 404 for archived events

### Security
- Implemented privacy checks for private events
- Added family_id validation in service layer

### Performance
- Optimized event query with single JOIN-based query
- Added database indexes for archived_at filtering
```

---

## 9. Podsumowanie implementacji

### Kluczowe decyzje architektoniczne:

1. **Trójwarstwowa architektura**: Route → Service → Database
2. **RLS jako primary security**: Database-level access control z dodatkowymi sprawdzeniami aplikacyjnymi
3. **Single query optimization**: Używanie JOINów zamiast N+1 queries
4. **Fail-fast validation**: Early returns dla błędów walidacji
5. **Standardowe error responses**: Spójny format ApiError

### Metryki sukcesu:

- **Performance**: p95 response time < 200ms
- **Reliability**: Error rate < 0.1%
- **Security**: Zero unauthorized access incidents

### Do zaimplementowania w przyszłości:

1. **Autoryzacja JWT**: Walidacja Bearer token i ekstrakcja user_id/family_id
2. **Testowanie**: Unit testy dla service layer oraz integration testy dla API route
3. **Monitoring**: Performance tracking i error monitoring (np. Sentry)
4. **Caching**: Implementacja cache dla często odczytywanych eventów

---

**Dokument stworzony:** 2026-01-23  
**Wersja:** 1.1 (bez autoryzacji i testowania)  
**Endpoint:** GET /events/:eventId  
**Status:** Ready for implementation

