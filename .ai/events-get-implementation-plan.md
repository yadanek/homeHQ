# API Endpoint Implementation Plan: GET /events

## 1. Przegląd punktu końcowego

**Cel**: Pobranie listy wydarzeń kalendarzowych dla rodziny bieżącego użytkownika.

**Funkcjonalność**:
- Umożliwia filtrowanie wydarzeń według zakresu dat, widoczności (prywatne/współdzielone), uczestników
- Obsługuje paginację wyników z konfigurowalnymi limitami
- Automatycznie wymusza zasady widoczności za pomocą RLS (Row Level Security):
  - Współdzielone wydarzenia widoczne dla wszystkich członków rodziny
  - Prywatne wydarzenia widoczne tylko dla twórcy
- Wyklucza zarchiwizowane wydarzenia
- Zwraca wydarzenia posortowane chronologicznie (start_time rosnąco)
- Zawiera informacje o twórcy i uczestnikach każdego wydarzenia

**Metoda HTTP**: GET

**Ścieżka**: `/events`

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
GET /events?start_date={ISO_DATE}&end_date={ISO_DATE}&is_private={BOOLEAN}&participant_id={UUID}&limit={INTEGER}&offset={INTEGER}
```

### Nagłówki

**Wymagane:**
- `Authorization: Bearer {access_token}` - JWT token z claims zawierającymi `family_id`

**Opcjonalne:**
- `Content-Type: application/json`

### Parametry zapytania (Query Parameters)

**Wszystkie parametry są opcjonalne:**

| Parametr | Typ | Domyślna | Opis | Walidacja |
|----------|-----|----------|------|-----------|
| `start_date` | string | - | Filtruj wydarzenia rozpoczynające się w tej dacie lub później | ISO 8601 date format |
| `end_date` | string | - | Filtruj wydarzenia kończące się w tej dacie lub wcześniej | ISO 8601 date format |
| `is_private` | boolean | - | Filtruj według widoczności (true = prywatne, false = współdzielone) | `true` lub `false` |
| `participant_id` | string | - | Filtruj wydarzenia z konkretnym uczestnikiem | Valid UUID |
| `limit` | integer | 100 | Liczba wyników na stronę | 1-500 |
| `offset` | integer | 0 | Liczba rekordów do pominięcia (dla paginacji) | >= 0 |

### Request Body
Brak - endpoint GET nie przyjmuje body.

## 3. Wykorzystywane typy

### Z pliku `types.ts`:

**Query Parameters:**
```typescript
export interface GetEventsQueryParams {
  start_date?: string; // ISO 8601 date
  end_date?: string; // ISO 8601 date
  is_private?: boolean;
  participant_id?: string; // UUID
  limit?: number; // default: 100, max: 500
  offset?: number; // default: 0
}
```

**Response Types:**
```typescript
export interface ListEventsResponse {
  events: EventWithCreator[];
  pagination: PaginationMeta;
}

export interface EventWithCreator extends Omit<Tables<'events'>, 'created_by'> {
  created_by: string;
  created_by_name: string;
  participants: EventParticipant[];
}

export type EventParticipant = Pick<Tables<'profiles'>, 'id' | 'display_name'>;

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}
```

**Error Response:**
```typescript
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Zod Schema dla walidacji (do utworzenia):

```typescript
// src/lib/validations/events.schema.ts
import { z } from 'zod';

export const getEventsQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  is_private: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  participant_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: "start_date must be before or equal to end_date",
    path: ["start_date"],
  }
);
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

**Content-Type**: `application/json`

**Struktura**:
```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "created_by": "660e8400-e29b-41d4-a716-446655440001",
      "created_by_name": "Jan Kowalski",
      "family_id": "770e8400-e29b-41d4-a716-446655440002",
      "title": "Wizyta u dentysty",
      "description": "Coroczny przegląd",
      "start_time": "2026-01-15T10:00:00Z",
      "end_time": "2026-01-15T11:00:00Z",
      "is_private": false,
      "created_at": "2026-01-02T12:00:00Z",
      "updated_at": "2026-01-02T12:00:00Z",
      "archived_at": null,
      "participants": [
        {
          "id": "880e8400-e29b-41d4-a716-446655440003",
          "display_name": "Dziecko 1"
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

### Błędy

**400 Bad Request** - Nieprawidłowe parametry zapytania
```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMS",
    "message": "Invalid query parameters",
    "details": {
      "start_date": "Invalid ISO 8601 date format"
    }
  }
}
```

**401 Unauthorized** - Brak lub nieprawidłowy token
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

**500 Internal Server Error** - Błąd serwera
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

## 5. Przepływ danych

### High-Level Flow:

```
1. Client Request
   ↓
2. API Route Handler (/src/pages/api/events.ts)
   ↓
3. Extract & Validate JWT (auth middleware)
   ↓
4. Parse & Validate Query Parameters (Zod schema)
   ↓
5. Events Service Layer
   ↓
6. Supabase Query with RLS
   ↓
7. Database (PostgreSQL)
   ↓
8. Format Response
   ↓
9. Return JSON to Client
```

### Detailed Flow:

#### Krok 1: Walidacja autoryzacji
- Wyodrębnij Bearer token z nagłówka `Authorization`
- Zweryfikuj token za pomocą Supabase Auth
- Wyodrębnij `user_id` i `family_id` z JWT claims
- Jeśli brak tokenu lub nieprawidłowy → zwróć 401

#### Krok 2: Walidacja parametrów zapytania
- Parse query parameters z URL
- Waliduj używając `getEventsQuerySchema`
- Jeśli walidacja nie powiodła się → zwróć 400 z detalami błędu
- Zastosuj wartości domyślne (limit=100, offset=0)

#### Krok 3: Budowanie zapytania Supabase
```typescript
let query = supabase
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
      profile:profiles(id, display_name)
    )
  `)
  .is('archived_at', null)
  .order('start_time', { ascending: true });
```

#### Krok 4: Aplikacja filtrów
- **start_date**: `.gte('start_time', start_date)`
- **end_date**: `.lte('end_time', end_date)`
- **is_private**: `.eq('is_private', is_private)`
- **participant_id**: Wymagane dodatkowe zapytanie przez `event_participants` table

#### Krok 5: Paginacja
- Pobierz total count: `query.count()`
- Zastosuj limit i offset: `.range(offset, offset + limit - 1)`
- Oblicz `has_more`: `total > offset + limit`

#### Krok 6: RLS Enforcement (automatyczny)
Supabase automatycznie stosuje RLS policies:
- Policy `events_select_shared`: Filtruje shared events dla family_id
- Policy `events_select_own_private`: Filtruje private events dla created_by

#### Krok 7: Formatowanie danych
- Transformuj wyniki Supabase do formatu `EventWithCreator[]`
- Mapuj `created_by_profile.display_name` → `created_by_name`
- Mapuj `event_participants` → `participants[]`
- Utwórz obiekt `PaginationMeta`

#### Krok 8: Zwrócenie odpowiedzi
- Status 200 OK
- Body: `ListEventsResponse`

## 6. Względy bezpieczeństwa

### Uwierzytelnianie (Authentication)
- **Bearer Token Required**: Każde żądanie musi zawierać ważny JWT token
- **Token Validation**: Weryfikacja za pomocą `supabase.auth.getUser()`
- **Token Expiration**: Sprawdzenie czy token nie wygasł
- **Error Handling**: Zwróć 401 dla missing/invalid/expired tokens

### Autoryzacja (Authorization)
- **RLS Policies**: Supabase automatycznie wymusza zasady dostępu:
  - Użytkownik widzi tylko wydarzenia ze swojej rodziny (`family_id`)
  - Użytkownik widzi wszystkie shared events
  - Użytkownik widzi tylko własne private events
- **JWT Claims**: Token musi zawierać `family_id` w claims
- **No Manual Filtering**: Nie implementuj ręcznej filtracji - zaufaj RLS

### Walidacja danych wejściowych
- **Zod Schema**: Strict validation wszystkich query parameters
- **SQL Injection Protection**: Używanie Supabase client (parameterized queries)
- **Type Safety**: TypeScript zapewnia type checking w compile time
- **UUID Validation**: Sprawdzenie formatu UUID dla `participant_id`
- **Date Validation**: ISO 8601 format enforcement
- **Range Validation**: Limit 1-500, offset >= 0

### Prywatność danych
- **No Sensitive Data**: Endpoint nie eksponuje wrażliwych danych
- **Profile IDs**: Uczestnicy pokazani tylko jako `id` i `display_name`
- **RLS Compliance**: Zgodność z GDPR przez RLS enforcement

### Rate Limiting (Future Enhancement)
- Rozważ implementację w produkcji
- Sugerowany limit: 100 requests/minute per user
- Zwróć 429 Too Many Requests jeśli przekroczony

## 7. Obsługa błędów

### Hierarchia obsługi błędów:
1. **Walidacja parametrów** (najwyższy priorytet)
2. **Autoryzacja**
3. **Logika biznesowa**
4. **Błędy bazy danych**
5. **Nieoczekiwane błędy** (najniższy priorytet)

### Szczegółowe scenariusze:

#### 400 Bad Request - Invalid Query Parameters

**Przyczyny:**
- Nieprawidłowy format daty ISO 8601
- Nieprawidłowy format UUID
- `limit` poza zakresem 1-500
- `offset` < 0
- `start_date` po `end_date`
- `is_private` nie jest boolean

**Response:**
```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMS",
    "message": "Invalid query parameters",
    "details": {
      "limit": "Must be between 1 and 500",
      "start_date": "Must be a valid ISO 8601 date"
    }
  }
}
```

**Implementacja:**
```typescript
try {
  const validatedParams = getEventsQuerySchema.parse(queryParams);
} catch (error) {
  if (error instanceof z.ZodError) {
    return Response.json({
      error: {
        code: 'INVALID_QUERY_PARAMS',
        message: 'Invalid query parameters',
        details: error.flatten().fieldErrors
      }
    }, { status: 400 });
  }
}
```

#### 401 Unauthorized - Authentication Failed

**Przyczyny:**
- Brak nagłówka `Authorization`
- Token nieprawidłowy lub wygasły
- Brak `family_id` w JWT claims
- Token został odwołany

**Response:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

**Implementacja:**
```typescript
const authHeader = request.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return Response.json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid authentication token'
    }
  }, { status: 401 });
}

const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) {
  return Response.json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token'
    }
  }, { status: 401 });
}
```

#### 500 Internal Server Error - Server Issues

**Przyczyny:**
- Błąd połączenia z bazą danych
- Błąd Supabase client
- Nieoczekiwany wyjątek w kodzie
- Timeout zapytania

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Implementacja:**
```typescript
try {
  // ... main logic
} catch (error) {
  console.error('Unexpected error in GET /events:', error);
  return Response.json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  }, { status: 500 });
}
```

### Error Logging Strategy

**Development:**
- Log pełne stack traces do konsoli
- Include request details (user_id, query params)

**Production:**
- Log tylko essential error info
- Użyj zewnętrznego serwisu (np. Sentry)
- Nie eksponuj internal details w response

```typescript
function logError(error: Error, context: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.error('Error:', error);
    console.error('Context:', context);
  } else {
    // Send to error tracking service
    // Sentry.captureException(error, { extra: context });
  }
}
```

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła:

#### 1. Zapytania N+1 (N+1 Query Problem)
**Problem**: Pobieranie uczestników dla każdego wydarzenia osobno

**Rozwiązanie**: 
- Użyj Supabase `.select()` z nested relationships
- Pobierz wszystkie dane w jednym zapytaniu
```typescript
.select(`
  *,
  created_by_profile:profiles!events_created_by_fkey(display_name),
  event_participants(profile:profiles(id, display_name))
`)
```

#### 2. Duże zbiory wyników
**Problem**: Pobieranie tysięcy wydarzeń bez paginacji

**Rozwiązanie**:
- Wymuszenie limitu (max 500)
- Domyślny limit 100
- Paginacja przez offset
- **Future enhancement**: Cursor-based pagination dla lepszej wydajności

#### 3. Złożone filtry
**Problem**: Filtrowanie przez `participant_id` wymaga JOIN

**Rozwiązanie**:
- Indeks na `event_participants.profile_id`
- Indeks na `event_participants.event_id`
```sql
CREATE INDEX idx_event_participants_profile_id ON event_participants(profile_id);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
```

#### 4. Total Count Query
**Problem**: `COUNT(*)` może być wolny dla dużych tabel

**Rozwiązanie**:
- Wykonaj count query osobno tylko gdy potrzebny
- Rozważ caching dla często używanych filtrów
- **Alternative**: Zwróć `has_more` bez `total` dla lepszej wydajności

```typescript
// Option 1: With total (slower)
const { count } = await query.count();

// Option 2: Without total (faster)
const results = await query.range(offset, offset + limit); // Get limit+1 items
const has_more = results.length > limit;
```

### Strategie optymalizacji:

#### 1. Indeksy bazy danych (Database Indexes)
```sql
-- Na tabeli events
CREATE INDEX idx_events_family_id_start_time ON events(family_id, start_time);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_is_private ON events(is_private);
CREATE INDEX idx_events_archived_at ON events(archived_at) WHERE archived_at IS NULL;

-- Na tabeli event_participants
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_profile_id ON event_participants(profile_id);
```

#### 2. Query Optimization
- **Select tylko potrzebne kolumny** - nie używaj `SELECT *` w production
- **Use RLS effectively** - pozwól Supabase/PostgreSQL optymalizować filtry
- **Limit range queries** - zawsze używaj offset + limit

#### 3. Caching Strategy (Future)
- Cache wyniki dla common filters (np. "events this month")
- Invalidate cache przy CREATE/UPDATE/DELETE operations
- Use Redis lub podobne dla distributed caching
- **MVP**: Skip caching - premature optimization

#### 4. Response Size Optimization
- Kompresja GZIP (zwykle obsługiwane przez hosting)
- Minimize JSON payload (nie zwracaj zbędnych pól)
- Consider pagination size trade-offs (więcej = mniej requestów, mniej = szybsze response)

### Monitoring wydajności:

**Metryki do monitorowania:**
- Average response time
- 95th percentile response time
- Query execution time
- Database connection pool usage
- Error rate

**Narzędzia:**
- Supabase Dashboard (query performance)
- Browser DevTools (Network tab)
- Lighthouse (dla całej aplikacji)

## 9. Etapy wdrożenia

### Faza 1: Setup i przygotowanie środowiska

#### 1.1. Utworzenie struktury plików
```
src/
├── pages/
│   └── api/
│       └── events/
│           └── index.ts (GET handler)
├── lib/
│   ├── validations/
│   │   └── events.schema.ts (Zod schemas)
│   ├── services/
│   │   └── events.service.ts (Business logic)
│   └── utils/
│       ├── auth.utils.ts (JWT extraction/validation)
│       └── response.utils.ts (Response formatters)
```

#### 1.2. Instalacja zależności (jeśli brakuje)
```bash
npm install zod
npm install @supabase/supabase-js
```

### Faza 2: Implementacja walidacji

#### 2.1. Utworzenie Zod schema
**Plik**: `src/lib/validations/events.schema.ts`

```typescript
import { z } from 'zod';

export const getEventsQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  is_private: z.enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),
  participant_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: "start_date must be before or equal to end_date",
    path: ["start_date"],
  }
);

export type GetEventsQueryParams = z.infer<typeof getEventsQuerySchema>;
```

### Faza 3: Implementacja utility functions

#### 3.1. Auth utilities
**Plik**: `src/lib/utils/auth.utils.ts`

```typescript
import type { SupabaseClient } from '../db/supabase.client';

export async function extractAndValidateUser(
  authHeader: string | null,
  supabase: SupabaseClient
) {
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authentication token'
      },
      status: 401
    };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token'
      },
      status: 401
    };
  }

  // Extract family_id from JWT claims or user metadata
  const familyId = user.user_metadata?.family_id;
  if (!familyId) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'User is not associated with a family'
      },
      status: 401
    };
  }

  return {
    user,
    familyId,
    error: null,
    status: 200
  };
}
```

#### 3.2. Response utilities
**Plik**: `src/lib/utils/response.utils.ts`

```typescript
import type { ApiError } from '../../types';

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): Response {
  const statusMap: Record<string, number> = {
    'INVALID_QUERY_PARAMS': 400,
    'UNAUTHORIZED': 401,
    'NOT_FOUND': 404,
    'INTERNAL_SERVER_ERROR': 500,
  };

  const status = statusMap[code] || 500;
  const body: ApiError = {
    error: { code, message, details }
  };

  return Response.json(body, { status });
}

export function createSuccessResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}
```

### Faza 4: Implementacja Events Service

#### 4.1. Events Service
**Plik**: `src/lib/services/events.service.ts`

```typescript
import type { SupabaseClient } from '../db/supabase.client';
import type {
  GetEventsQueryParams,
  ListEventsResponse,
  EventWithCreator,
  EventParticipant,
  PaginationMeta
} from '../../types';

export class EventsService {
  constructor(private supabase: SupabaseClient) {}

  async listEvents(
    params: GetEventsQueryParams,
    userId: string,
    familyId: string
  ): Promise<ListEventsResponse> {
    // Build base query
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
          profile:profiles(id, display_name)
        )
      `, { count: 'exact' })
      .is('archived_at', null)
      .order('start_time', { ascending: true });

    // Apply filters
    if (params.start_date) {
      query = query.gte('start_time', params.start_date);
    }

    if (params.end_date) {
      query = query.lte('end_time', params.end_date);
    }

    if (params.is_private !== undefined) {
      query = query.eq('is_private', params.is_private);
    }

    // Handle participant filter (requires special handling)
    if (params.participant_id) {
      // First, get event IDs that have this participant
      const { data: participantEvents } = await this.supabase
        .from('event_participants')
        .select('event_id')
        .eq('profile_id', params.participant_id);

      if (participantEvents && participantEvents.length > 0) {
        const eventIds = participantEvents.map(ep => ep.event_id);
        query = query.in('id', eventIds);
      } else {
        // No events for this participant - return empty result
        return {
          events: [],
          pagination: {
            total: 0,
            limit: params.limit,
            offset: params.offset,
            has_more: false
          }
        };
      }
    }

    // Apply pagination
    const { data, error, count } = await query.range(
      params.offset,
      params.offset + params.limit - 1
    );

    if (error) {
      throw error;
    }

    // Transform data
    const events: EventWithCreator[] = (data || []).map(event => ({
      id: event.id,
      created_by: event.created_by,
      created_by_name: event.created_by_profile?.display_name || 'Unknown',
      family_id: event.family_id,
      title: event.title,
      description: event.description,
      start_time: event.start_time,
      end_time: event.end_time,
      is_private: event.is_private,
      created_at: event.created_at,
      updated_at: event.updated_at,
      archived_at: event.archived_at,
      participants: (event.event_participants || [])
        .map(ep => ep.profile)
        .filter(Boolean)
        .map(profile => ({
          id: profile.id,
          display_name: profile.display_name
        }))
    }));

    // Create pagination metadata
    const total = count || 0;
    const pagination: PaginationMeta = {
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: total > params.offset + params.limit
    };

    return { events, pagination };
  }
}
```

### Faza 5: Implementacja API Route Handler

#### 5.1. GET /events handler
**Plik**: `src/pages/api/events/index.ts`

```typescript
import type { APIRoute } from 'astro';
import { createClient } from '../../../db/supabase.client';
import { getEventsQuerySchema } from '../../../lib/validations/events.schema';
import { EventsService } from '../../../lib/services/events.service';
import { extractAndValidateUser } from '../../../lib/utils/auth.utils';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response.utils';
import { z } from 'zod';

export const GET: APIRoute = async ({ request }) => {
  try {
    // 1. Initialize Supabase client
    const supabase = createClient();

    // 2. Validate authentication
    const authHeader = request.headers.get('Authorization');
    const authResult = await extractAndValidateUser(authHeader, supabase);

    if (authResult.error) {
      return createErrorResponse(
        authResult.error.code,
        authResult.error.message
      );
    }

    const { user, familyId } = authResult;

    // 3. Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      start_date: url.searchParams.get('start_date') || undefined,
      end_date: url.searchParams.get('end_date') || undefined,
      is_private: url.searchParams.get('is_private') || undefined,
      participant_id: url.searchParams.get('participant_id') || undefined,
      limit: url.searchParams.get('limit') || '100',
      offset: url.searchParams.get('offset') || '0',
    };

    let validatedParams;
    try {
      validatedParams = getEventsQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          'INVALID_QUERY_PARAMS',
          'Invalid query parameters',
          error.flatten().fieldErrors
        );
      }
      throw error;
    }

    // 4. Fetch events using service
    const eventsService = new EventsService(supabase);
    const result = await eventsService.listEvents(
      validatedParams,
      user.id,
      familyId
    );

    // 5. Return success response
    return createSuccessResponse(result);

  } catch (error) {
    console.error('Unexpected error in GET /events:', error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred'
    );
  }
};
```

### Faza 6: Testy manualne

#### 6.1. Test Cases

**Test 1: Basic fetch without filters**
```bash
curl -X GET 'http://localhost:4321/api/events' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
Expected: 200 OK, lista wydarzeń

**Test 2: Filter by date range**
```bash
curl -X GET 'http://localhost:4321/api/events?start_date=2026-01-01T00:00:00Z&end_date=2026-01-31T23:59:59Z' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
Expected: 200 OK, wydarzenia w styczniu 2026

**Test 3: Filter by privacy**
```bash
curl -X GET 'http://localhost:4321/api/events?is_private=false' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
Expected: 200 OK, tylko shared events

**Test 4: Pagination**
```bash
curl -X GET 'http://localhost:4321/api/events?limit=10&offset=0' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
Expected: 200 OK, pierwsze 10 wydarzeń

**Test 5: Invalid date format**
```bash
curl -X GET 'http://localhost:4321/api/events?start_date=invalid-date' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
Expected: 400 Bad Request

**Test 6: Missing authorization**
```bash
curl -X GET 'http://localhost:4321/api/events'
```
Expected: 401 Unauthorized

**Test 7: Limit > 500**
```bash
curl -X GET 'http://localhost:4321/api/events?limit=600' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
Expected: 400 Bad Request

**Test 8: start_date after end_date**
```bash
curl -X GET 'http://localhost:4321/api/events?start_date=2026-12-31T00:00:00Z&end_date=2026-01-01T00:00:00Z' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
Expected: 400 Bad Request

### Faza 7: Testy jednostkowe (Unit Tests)

#### 7.1. Test schema walidacji
**Plik**: `src/lib/validations/__tests__/events.schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getEventsQuerySchema } from '../events.schema';

describe('getEventsQuerySchema', () => {
  it('should accept valid parameters', () => {
    const result = getEventsQuerySchema.parse({
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-01-31T23:59:59Z',
      is_private: 'false',
      limit: '50',
      offset: '0'
    });

    expect(result).toMatchObject({
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-01-31T23:59:59Z',
      is_private: false,
      limit: 50,
      offset: 0
    });
  });

  it('should reject invalid date format', () => {
    expect(() => {
      getEventsQuerySchema.parse({ start_date: 'invalid' });
    }).toThrow();
  });

  it('should reject limit > 500', () => {
    expect(() => {
      getEventsQuerySchema.parse({ limit: '600' });
    }).toThrow();
  });

  it('should reject negative offset', () => {
    expect(() => {
      getEventsQuerySchema.parse({ offset: '-1' });
    }).toThrow();
  });

  it('should reject start_date after end_date', () => {
    expect(() => {
      getEventsQuerySchema.parse({
        start_date: '2026-12-31T00:00:00Z',
        end_date: '2026-01-01T00:00:00Z'
      });
    }).toThrow();
  });
});
```

### Faza 8: Dokumentacja

#### 8.1. JSDoc comments
Dodaj szczegółowe komentarze do wszystkich publicznych funkcji:

```typescript
/**
 * Retrieves a paginated list of events for the authenticated user's family.
 * 
 * Automatically filters events based on RLS policies:
 * - Shared events visible to all family members
 * - Private events visible only to creator
 * 
 * @param params - Query parameters for filtering and pagination
 * @param userId - Authenticated user's ID
 * @param familyId - User's family ID from JWT claims
 * @returns Promise resolving to ListEventsResponse with events and pagination metadata
 * @throws {Error} If database query fails
 * 
 * @example
 * ```typescript
 * const result = await eventsService.listEvents(
 *   { limit: 50, offset: 0, is_private: false },
 *   'user-uuid',
 *   'family-uuid'
 * );
 * ```
 */
async listEvents(
  params: GetEventsQueryParams,
  userId: string,
  familyId: string
): Promise<ListEventsResponse>
```

#### 8.2. README update
Zaktualizuj dokumentację API w głównym README lub oddzielnym pliku API docs.

### Faza 9: Code Review Checklist

Przed mergowaniem do main branch, sprawdź:

- [ ] Wszystkie typy są poprawnie zaimportowane z `types.ts`
- [ ] Zod schema waliduje wszystkie wymagane przypadki
- [ ] RLS policies są prawidłowo skonfigurowane w bazie
- [ ] Indexy bazy danych są utworzone dla performance
- [ ] Error handling obejmuje wszystkie edge cases
- [ ] Response format zgodny ze specyfikacją
- [ ] Testy manualne przeszły pomyślnie
- [ ] Kod jest czytelny i dobrze udokumentowany
- [ ] Brak hardcoded values (używaj config/env vars)
- [ ] Security best practices są przestrzegane
- [ ] TypeScript nie ma błędów kompilacji
- [ ] Linter nie ma ostrzeżeń

### Faza 10: Deployment

#### 10.1. Pre-deployment checklist
- [ ] Upewnij się, że wszystkie environment variables są ustawione
- [ ] Sprawdź czy Supabase RLS policies są aktywne w production
- [ ] Zweryfikuj connection limits dla database
- [ ] Skonfiguruj monitoring i alerting

#### 10.2. Database migrations
```sql
-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_events_family_id_start_time 
  ON events(family_id, start_time);

CREATE INDEX IF NOT EXISTS idx_events_archived_at 
  ON events(archived_at) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_participants_event_id 
  ON event_participants(event_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_profile_id 
  ON event_participants(profile_id);
```

#### 10.3. Deploy to production
```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod

# Or push to GitHub (if using GitHub Actions)
git push origin main
```

#### 10.4. Post-deployment verification
- [ ] Test endpoint w production environment
- [ ] Sprawdź response times w Vercel Analytics
- [ ] Zweryfikuj Supabase query performance
- [ ] Monitor error rates

---

## Podsumowanie

Ten plan implementacji zapewnia kompleksowe wytyczne dla zespołu programistów do wdrożenia endpointu GET /events. Kluczowe aspekty:

1. **Bezpieczeństwo**: RLS policies zapewniają automatyczną filtrację danych
2. **Walidacja**: Zod schemas gwarantują poprawność danych wejściowych
3. **Wydajność**: Optymalizacja zapytań i indeksy bazy danych
4. **Testowalność**: Separation of concerns przez service layer
5. **Maintainability**: Czysta architektura i dobra dokumentacja

Plan może być realizowany etapami, z priorytetem na core functionality (fazy 1-5), a następnie tests i optimizations (fazy 6-10).


