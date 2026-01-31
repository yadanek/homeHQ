# API Endpoint Implementation Plan: GET /tasks

## 1. Przegląd punktu końcowego

Endpoint **GET /tasks** służy do pobierania listy zadań dla rodziny aktualnie zalogowanego użytkownika. Zapewnia rozbudowane możliwości filtrowania, sortowania i paginacji, umożliwiając użytkownikom efektywne przeglądanie zadań według różnych kryteriów (status ukończenia, prywatność, osoba przypisana, terminy, powiązane wydarzenia).

**Kluczowe cechy:**
- Zwraca zadania z rodziny użytkownika z automatycznym filtrowaniem przez RLS
- Obsługuje 9 opcjonalnych parametrów zapytania do zaawansowanego filtrowania
- Zwraca zdenormalizowane dane (imiona twórców, osób przypisanych, ukończonych oraz tytuły wydarzeń)
- Implementuje paginację z metadanymi (total, limit, offset, has_more)
- Obsługuje trzy opcje sortowania
- Automatycznie wyklucza zarchiwizowane zadania

**Przypadki użycia:**
- Lista "Moje zadania" (filtr: `assigned_to=me`)
- Widok "Do zrobienia" (filtr: `is_completed=false`)
- Przegląd zadań związanych z konkretnym wydarzeniem (filtr: `event_id=xxx`)
- Dashboard administratora rodziny (bez filtrów prywatności - RLS obsługuje to automatycznie)

---

## 2. Szczegóły żądania

### Metoda HTTP
```
GET /tasks
```

### Struktura URL
```
https://api.homehq.com/tasks?assigned_to=me&is_completed=false&limit=50
```

### Headers
**Wymagane:**
- `Authorization: Bearer {access_token}` - Token JWT z Supabase Auth

### Query Parameters

| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `is_completed` | boolean | Nie | - | `true` lub `false` | Filtruj według statusu ukończenia |
| `is_private` | boolean | Nie | - | `true` lub `false` | Filtruj według widoczności (RLS nadal obowiązuje) |
| `assigned_to` | string | Nie | - | UUID lub `"me"` | Filtruj według osoby przypisanej. `"me"` = aktualny użytkownik |
| `due_before` | string | Nie | - | ISO 8601 date | Zadania z terminem przed tą datą |
| `due_after` | string | Nie | - | ISO 8601 date | Zadania z terminem po tej dacie |
| `event_id` | string | Nie | - | UUID | Zadania powiązane z konkretnym wydarzeniem |
| `limit` | integer | Nie | 100 | 1-500 | Maksymalna liczba zwracanych zadań |
| `offset` | integer | Nie | 0 | ≥ 0 | Liczba zadań do pominięcia (dla paginacji) |
| `sort` | string | Nie | `due_date_asc` | Enum | Opcje sortowania (patrz poniżej) |

**Opcje sortowania (`sort`):**
- `due_date_asc` - Zadania z najbliższym terminem pierwsze
- `due_date_desc` - Zadania z najpóźniejszym terminem pierwsze
- `created_at_desc` - Najnowsze zadania pierwsze

### Request Body
Brak (metoda GET)

### Przykładowe żądania

**1. Wszystkie niezakończone zadania przypisane do mnie:**
```
GET /tasks?assigned_to=me&is_completed=false
```

**2. Zadania do zrobienia w przyszłym tygodniu:**
```
GET /tasks?is_completed=false&due_after=2026-01-29T00:00:00Z&due_before=2026-02-05T23:59:59Z
```

**3. Wszystkie zadania związane z konkretnym wydarzeniem:**
```
GET /tasks?event_id=123e4567-e89b-12d3-a456-426614174000
```

**4. Stronicowanie - druga strona (50 na stronę):**
```
GET /tasks?limit=50&offset=50
```

---

## 3. Wykorzystywane typy

### Istniejące typy z `src/types.ts`

#### Query Parameters Interface
```typescript
// Linie 425-435
export interface GetTasksQueryParams {
  is_completed?: boolean;
  is_private?: boolean;
  assigned_to?: string; // UUID or "me"
  due_before?: string; // ISO 8601 date
  due_after?: string; // ISO 8601 date
  event_id?: string; // UUID
  limit?: number; // default: 100, max: 500
  offset?: number; // default: 0
  sort?: 'due_date_asc' | 'due_date_desc' | 'created_at_desc';
}
```

#### Task Response with Denormalized Fields
```typescript
// Linie 361-366
export interface TaskWithDetails extends Tables<'tasks'> {
  created_by_name: string;
  assigned_to_name: string | null;
  completed_by_name: string | null;
  event_title: string | null;
}
```

#### List Response Wrapper
```typescript
// Linie 368-371
export interface ListTasksResponse {
  tasks: TaskWithDetails[];
  pagination: PaginationMeta;
}
```

#### Pagination Metadata
```typescript
// Linie 17-22
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}
```

#### Error Response Format
```typescript
// Linie 27-33
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Nowe typy do utworzenia (jeśli potrzebne)

#### Zod Schema dla walidacji query params
```typescript
// W pliku api route handler lub validation utility

import { z } from 'zod';

const GetTasksQuerySchema = z.object({
  is_completed: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  
  is_private: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  
  assigned_to: z
    .string()
    .optional()
    .refine(
      val => !val || val === 'me' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
      { message: 'assigned_to must be a valid UUID or "me"' }
    ),
  
  due_before: z
    .string()
    .optional()
    .refine(
      val => !val || !isNaN(Date.parse(val)),
      { message: 'due_before must be a valid ISO 8601 date' }
    ),
  
  due_after: z
    .string()
    .optional()
    .refine(
      val => !val || !isNaN(Date.parse(val)),
      { message: 'due_after must be a valid ISO 8601 date' }
    ),
  
  event_id: z
    .string()
    .uuid({ message: 'event_id must be a valid UUID' })
    .optional(),
  
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 100))
    .refine(val => val >= 1 && val <= 500, {
      message: 'limit must be between 1 and 500',
    }),
  
  offset: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 0))
    .refine(val => val >= 0, {
      message: 'offset must be non-negative',
    }),
  
  sort: z
    .enum(['due_date_asc', 'due_date_desc', 'created_at_desc'])
    .optional()
    .default('due_date_asc'),
});

export type ValidatedGetTasksQuery = z.infer<typeof GetTasksQuerySchema>;
```

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```typescript
{
  "tasks": TaskWithDetails[],
  "pagination": PaginationMeta
}
```

#### Przykład:
```json
{
  "tasks": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "family_id": "f1234567-89ab-cdef-0123-456789abcdef",
      "created_by": "u1234567-89ab-cdef-0123-456789abcdef",
      "created_by_name": "John Smith",
      "assigned_to": "u9876543-21ba-fedc-3210-fedcba987654",
      "assigned_to_name": "Jane Smith",
      "title": "Buy groceries",
      "due_date": "2026-01-05T18:00:00Z",
      "is_completed": false,
      "completed_at": null,
      "completed_by": null,
      "completed_by_name": null,
      "is_private": false,
      "event_id": "e1234567-89ab-cdef-0123-456789abcdef",
      "event_title": "Family Dinner",
      "suggestion_id": null,
      "created_from_suggestion": false,
      "created_at": "2026-01-02T12:00:00Z",
      "updated_at": "2026-01-02T12:00:00Z",
      "archived_at": null
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

### Error Responses

#### 400 Bad Request - Nieprawidłowe parametry zapytania
```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMS",
    "message": "Invalid query parameters provided",
    "details": {
      "assigned_to": "assigned_to must be a valid UUID or \"me\"",
      "limit": "limit must be between 1 and 500"
    }
  }
}
```

#### 401 Unauthorized - Brak lub nieprawidłowy token
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

#### 500 Internal Server Error - Błąd serwera
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred while fetching tasks"
  }
}
```

---

## 5. Przepływ danych

### Architektura warstw

```
┌─────────────────┐
│  React Client   │ GET /tasks?assigned_to=me
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Route      │ src/pages/api/tasks/index.ts (jeśli używamy Astro API routes)
│  Handler        │ LUB bezpośrednie wywołanie z React Action
└────────┬────────┘
         │
         │ 1. Walidacja query params (Zod)
         │ 2. Ekstrakcja user_id z tokenu auth
         │
         ▼
┌─────────────────┐
│  TasksService   │ src/lib/tasks.service.ts
└────────┬────────┘
         │
         │ 3. Transformacja "me" → user_id
         │ 4. Budowa query Supabase z filtrami
         │ 5. Wykonanie query z joinami
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  PostgreSQL     │
│  + RLS          │
└────────┬────────┘
         │
         │ 6. RLS automatycznie filtruje:
         │    - Zadania tylko z family_id użytkownika
         │    - Prywatne zadania tylko dla twórcy
         │
         ▼
┌─────────────────┐
│  TasksService   │ 
└────────┬────────┘
         │
         │ 7. Obliczenie total count
         │ 8. Obliczenie has_more
         │ 9. Formatowanie response
         │
         ▼
┌─────────────────┐
│  API Response   │ 200 OK + JSON
└─────────────────┘
```

### Szczegółowy przepływ

#### Krok 1: Odbiór żądania
- Endpoint odbiera żądanie GET z query parameters
- Ekstrahuje token JWT z nagłówka Authorization

#### Krok 2: Walidacja autentykacji
```typescript
const supabase = createClient(req);
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return Response.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 }
  );
}
```

#### Krok 3: Walidacja query parameters
```typescript
const validationResult = GetTasksQuerySchema.safeParse(queryParams);

if (!validationResult.success) {
  return Response.json(
    {
      error: {
        code: 'INVALID_QUERY_PARAMS',
        message: 'Invalid query parameters provided',
        details: validationResult.error.flatten().fieldErrors,
      },
    },
    { status: 400 }
  );
}

const filters = validationResult.data;
```

#### Krok 4: Delegacja do TasksService
```typescript
const tasksService = new TasksService(supabase);
const result = await tasksService.listTasks(user.id, filters);
```

#### Krok 5: Budowa zapytania w TasksService
```typescript
// Bazowe zapytanie z joinami
let query = supabase
  .from('tasks')
  .select(
    `
    *,
    created_by_profile:profiles!tasks_created_by_fkey(display_name),
    assigned_to_profile:profiles!tasks_assigned_to_fkey(display_name),
    completed_by_profile:profiles!tasks_completed_by_fkey(display_name),
    event:events(title)
    `,
    { count: 'exact' }
  )
  .is('archived_at', null); // Wyklucz zarchiwizowane

// Zastosuj filtry
if (filters.is_completed !== undefined) {
  query = query.eq('is_completed', filters.is_completed);
}

if (filters.is_private !== undefined) {
  query = query.eq('is_private', filters.is_private);
}

if (filters.assigned_to) {
  const assigneeId = filters.assigned_to === 'me' ? userId : filters.assigned_to;
  query = query.eq('assigned_to', assigneeId);
}

if (filters.due_before) {
  query = query.lt('due_date', filters.due_before);
}

if (filters.due_after) {
  query = query.gt('due_date', filters.due_after);
}

if (filters.event_id) {
  query = query.eq('event_id', filters.event_id);
}

// Sortowanie
switch (filters.sort) {
  case 'due_date_desc':
    query = query.order('due_date', { ascending: false, nullsFirst: false });
    break;
  case 'created_at_desc':
    query = query.order('created_at', { ascending: false });
    break;
  case 'due_date_asc':
  default:
    query = query.order('due_date', { ascending: true, nullsFirst: false });
    break;
}

// Paginacja
query = query.range(filters.offset, filters.offset + filters.limit - 1);
```

#### Krok 6: Wykonanie zapytania i RLS
- Supabase automatycznie stosuje polityki RLS:
  - Użytkownik widzi tylko zadania ze swojej rodziny (`family_id`)
  - Prywatne zadania (`is_private=true`) widoczne tylko dla twórcy
  - Wspólne zadania (`is_private=false`) widoczne dla wszystkich członków rodziny

#### Krok 7: Transformacja danych
```typescript
const tasks: TaskWithDetails[] = data.map(task => ({
  ...task,
  created_by_name: task.created_by_profile?.display_name || 'Unknown',
  assigned_to_name: task.assigned_to_profile?.display_name || null,
  completed_by_name: task.completed_by_profile?.display_name || null,
  event_title: task.event?.title || null,
}));
```

#### Krok 8: Obliczenie metadanych paginacji
```typescript
const pagination: PaginationMeta = {
  total: count || 0,
  limit: filters.limit,
  offset: filters.offset,
  has_more: (filters.offset + filters.limit) < (count || 0),
};
```

#### Krok 9: Zwrócenie odpowiedzi
```typescript
return Response.json(
  {
    tasks,
    pagination,
  },
  { status: 200 }
);
```

### Interakcje z bazą danych

#### Zapytanie SQL (uproszczone, Supabase generuje to automatycznie):
```sql
SELECT 
  t.*,
  cp.display_name as created_by_name,
  ap.display_name as assigned_to_name,
  comp.display_name as completed_by_name,
  e.title as event_title
FROM tasks t
LEFT JOIN profiles cp ON t.created_by = cp.id
LEFT JOIN profiles ap ON t.assigned_to = ap.id
LEFT JOIN profiles comp ON t.completed_by = comp.id
LEFT JOIN events e ON t.event_id = e.id
WHERE 
  t.archived_at IS NULL
  AND t.family_id = (SELECT family_id FROM profiles WHERE id = auth.uid())
  AND (
    t.is_private = false 
    OR (t.is_private = true AND t.created_by = auth.uid())
  )
  -- Dodatkowe filtry z query params
ORDER BY t.due_date ASC NULLS LAST
LIMIT 100 OFFSET 0;
```

---

## 6. Względy bezpieczeństwa

### 1. Autentykacja

**Mechanizm:** Bearer Token (JWT) z Supabase Auth

**Implementacja:**
```typescript
const supabase = createClient(req);
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return Response.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 }
  );
}
```

**Wymagania:**
- Token musi być obecny w nagłówku `Authorization: Bearer {token}`
- Token musi być ważny (nie wygasły)
- Token musi pochodzić z Supabase Auth
- Użytkownik powiązany z tokenem musi istnieć

### 2. Autoryzacja - Row Level Security (RLS)

**Polityki RLS na tabeli `tasks`:**

```sql
-- Polityka SELECT: Użytkownik widzi zadania ze swojej rodziny
CREATE POLICY "Users can view family tasks"
ON tasks FOR SELECT
USING (
  family_id IN (
    SELECT family_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
  AND (
    -- Wspólne zadania widoczne dla wszystkich
    is_private = false
    OR
    -- Prywatne zadania widoczne tylko dla twórcy
    (is_private = true AND created_by = auth.uid())
  )
  AND archived_at IS NULL
);
```

**Automatyczne filtrowanie:**
- RLS działa na poziomie bazy danych, nie można go ominąć z aplikacji
- Użytkownik automatycznie nie widzi zadań z innych rodzin
- Prywatne zadania innych członków są niewidoczne
- Nie wymaga dodatkowej logiki w aplikacji

### 3. Walidacja danych wejściowych

**Zod Schema:** Wszystkie query parameters są walidowane przed wykonaniem zapytania

**Punkty walidacji:**
- UUID format dla `assigned_to`, `event_id`
- ISO 8601 format dla `due_before`, `due_after`
- Boolean values dla `is_completed`, `is_private`
- Integer constraints dla `limit` (1-500), `offset` (≥ 0)
- Enum validation dla `sort`

**Ochrona przed:**
- SQL Injection (Supabase używa parametryzowanych zapytań)
- Type confusion attacks
- Buffer overflow (limit constraints)
- Enumeration attacks (RLS ogranicza dane do rodziny użytkownika)

### 4. Ochrona danych wrażliwych

**Dane NIE eksponowane w odpowiedzi:**
- `family_id` - Może ujawnić strukturę systemu
  - **Uwaga:** Zgodnie z API spec (linie 1151-1167), `family_id` NIE jest w response
  - Tylko w GET /tasks/:taskId jest eksponowane (linie 1202-1223)
- Pełne dane użytkowników - Tylko `display_name` jest zwracane

**Dane eksponowane:**
- `id` zadania - Potrzebne do edycji/szczegółów
- `created_by`, `assigned_to`, `completed_by` - UUIDs potrzebne do logiki aplikacji
- Display names - Publicznie dostępne w rodzinie

### 5. Rate Limiting

**Zalecenia:**
- Implementacja na poziomie API Gateway (np. Vercel Edge Functions)
- Limit: 100 żądań / 1 minuta na użytkownika
- Odpowiedź przy przekroczeniu: `429 Too Many Requests`

**Implementacja (przykład):**
```typescript
// Middleware sprawdzający rate limit
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimiter.get(userId);
  
  if (!userLimit || userLimit.resetAt < now) {
    rateLimiter.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (userLimit.count >= 100) {
    return false;
  }
  
  userLimit.count++;
  return true;
}
```

### 6. Zabezpieczenia przed atakami

**CSRF (Cross-Site Request Forgery):**
- Chronione przez CORS policy
- API akceptuje tylko żądania z dozwolonych origin
- Token JWT w nagłówku (nie w cookie)

**XSS (Cross-Site Scripting):**
- Wszystkie dane są JSON-encoded
- React automatycznie escapuje dane w renderingu
- Brak HTML w odpowiedziach API

**Enumeration Attacks:**
- RLS ogranicza dane do rodziny użytkownika
- Nie można odczytać zadań innych rodzin testując różne ID
- 404 zwracany zarówno dla nieistniejących jak i niedostępnych zasobów

---

## 7. Obsługa błędów

### Typy błędów i odpowiedzi

#### 1. Błędy walidacji (400 Bad Request)

**Scenariusze:**
- Nieprawidłowy format UUID
- Nieprawidłowy format daty
- `limit` poza zakresem 1-500
- Ujemny `offset`
- Nieprawidłowa wartość `sort`
- Nieprawidłowy boolean value

**Przykład błędu:**
```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMS",
    "message": "Invalid query parameters provided",
    "details": {
      "assigned_to": "assigned_to must be a valid UUID or \"me\"",
      "limit": "limit must be between 1 and 500",
      "due_before": "due_before must be a valid ISO 8601 date"
    }
  }
}
```

**Logowanie:**
```typescript
console.warn('Query validation failed', {
  userId: user.id,
  errors: validationResult.error.flatten(),
  queryParams: req.query,
});
```

#### 2. Błędy autentykacji (401 Unauthorized)

**Scenariusze:**
- Brak nagłówka Authorization
- Token jest pusty
- Token jest nieprawidłowy
- Token wygasł
- Token nie może być zdekodowany

**Odpowiedź:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

**Logowanie:**
```typescript
console.warn('Authentication failed', {
  hasAuthHeader: !!req.headers.authorization,
  error: authError?.message,
});
```

#### 3. Błędy serwera (500 Internal Server Error)

**Scenariusze:**
- Błąd połączenia z bazą danych
- Timeout zapytania do bazy
- Niespodziewany błąd podczas przetwarzania
- Błąd w logice transformacji danych

**Odpowiedź:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred while fetching tasks"
  }
}
```

**Logowanie (szczegółowe):**
```typescript
console.error('Failed to fetch tasks', {
  userId: user.id,
  familyId: user.user_metadata?.family_id,
  filters,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString(),
});
```

#### 4. Pusta lista (200 OK, nie jest błędem)

**Scenariusz:**
- Użytkownik nie ma żadnych zadań spełniających kryteria
- Wszystkie zadania są zarchiwizowane

**Odpowiedź:**
```json
{
  "tasks": [],
  "pagination": {
    "total": 0,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

### Strategia obsługi błędów w kodzie

```typescript
export async function GET(req: Request) {
  try {
    // 1. Autentykacja
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // 2. Walidacja query params
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const validationResult = GetTasksQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      console.warn('Query validation failed', {
        userId: user.id,
        errors: validationResult.error.flatten(),
      });
      
      return Response.json(
        {
          error: {
            code: 'INVALID_QUERY_PARAMS',
            message: 'Invalid query parameters provided',
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    // 3. Wywołanie service
    const tasksService = new TasksService(supabase);
    const result = await tasksService.listTasks(user.id, validationResult.data);
    
    // 4. Sukces
    return Response.json(result, { status: 200 });
    
  } catch (error) {
    // 5. Nieoczekiwane błędy
    console.error('Failed to fetch tasks', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return Response.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while fetching tasks',
        },
      },
      { status: 500 }
    );
  }
}
```

### Logging Strategy

**Development (local):**
- Wszystkie błędy logowane do console z pełnymi szczegółami
- Stack traces włączone

**Production:**
- Błędy 500 logowane z kontekstem (userId, familyId, filters)
- Błędy 400/401 logowane jako warnings z ograniczonymi szczegółami
- Stack traces opcjonalnie wysyłane do zewnętrznego serwisu monitoringu (np. Sentry)

---

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

#### 1. Multiple JOINs (profiles x3 + events)

**Problem:**
- Zapytanie łączy tabele `tasks` z `profiles` 3 razy (creator, assignee, completer) i `events` 1 raz
- Może być wolne dla dużych rodzin z setkami zadań

**Optymalizacje:**
```sql
-- Indeksy na foreign keys (powinny już istnieć)
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_by ON tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks(event_id);

-- Composite index dla często używanych filtrów
CREATE INDEX IF NOT EXISTS idx_tasks_family_completed 
ON tasks(family_id, is_completed, due_date) 
WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_family_private 
ON tasks(family_id, is_private, due_date) 
WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_completed 
ON tasks(assigned_to, is_completed, due_date) 
WHERE archived_at IS NULL;
```

#### 2. COUNT(*) dla total pagination

**Problem:**
- `SELECT COUNT(*)` może być wolny dla dużych tabel
- Wykonywany przy każdym zapytaniu listowym

**Optymalizacje:**
- Użyj `{ count: 'exact' }` tylko gdy niezbędne
- Dla bardzo dużych zbiorów, rozważ przybliżony count lub cache
- Alternatywnie: Zwracaj tylko `has_more` bez `total` (jeśli UI nie wymaga exact count)

```typescript
// Opcja 1: Exact count (wolniejsza, ale dokładna)
const { data, count, error } = await query.count('exact');

// Opcja 2: Estimated count (szybsza, przybliżona) - Supabase nie wspiera, trzeba użyć raw SQL
const { data: countData } = await supabase.rpc('get_tasks_count_estimate', { 
  family_id: user.user_metadata.family_id 
});

// Opcja 3: Bez total count (najszybsza)
const { data, error } = await query.limit(limit + 1); // Pobierz +1 aby sprawdzić has_more
const has_more = data.length > limit;
const tasks = data.slice(0, limit);
```

#### 3. Sortowanie po due_date z NULL values

**Problem:**
- Zadania bez terminu (`due_date IS NULL`) mogą komplikować sortowanie

**Implementacja:**
```typescript
// Zawsze używaj nullsFirst/nullsLast dla jasności
query = query.order('due_date', { 
  ascending: true, 
  nullsFirst: false  // NULL na końcu listy
});
```

**Index z NULLS LAST:**
```sql
CREATE INDEX idx_tasks_due_date_nulls_last 
ON tasks(due_date NULLS LAST, created_at) 
WHERE archived_at IS NULL;
```

#### 4. Over-fetching data

**Problem:**
- API zwraca wszystkie kolumny z tabeli `tasks`, niektóre mogą nie być potrzebne

**Optymalizacja:**
- Select tylko potrzebne kolumny (ale API spec wymaga wszystkich pól TaskWithDetails)
- Dla bardzo dużych odpowiedzi, rozważ kompresję (gzip) na poziomie HTTP

### Strategie cache'owania

#### Client-side caching (React Query / SWR)

```typescript
// Użycie React Query do cache'owania po stronie klienta
import { useQuery } from '@tanstack/react-query';

function useTasks(filters: GetTasksQueryParams) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetchTasks(filters),
    staleTime: 30000, // Cache przez 30 sekund
    cacheTime: 5 * 60 * 1000, // Przechowuj w pamięci przez 5 minut
  });
}
```

#### Server-side caching

**Nie zalecane dla tego endpointu** - dane zadań często się zmieniają i powinny być świeże.

Jeśli konieczne:
- Cache per user + filters combination
- TTL: 10-30 sekund max
- Invalidate cache przy mutation (POST, PATCH, DELETE zadań)

### Limity wydajnościowe

| Metryka | Target | Max Acceptable |
|---------|--------|----------------|
| Response Time (p50) | < 200ms | < 500ms |
| Response Time (p95) | < 500ms | < 1000ms |
| Response Time (p99) | < 1000ms | < 2000ms |
| Database Query Time | < 100ms | < 300ms |
| Payload Size | < 50KB | < 200KB |

### Monitoring

**Metryki do śledzenia:**
- Query execution time w Supabase
- Total endpoint response time
- Number of returned tasks (avg, p95, p99)
- Error rate (4xx, 5xx)
- Cache hit rate (jeśli implementowane)

---

## 9. Etapy wdrożenia

### Faza 1: Setup i Dependencies

#### 1.1 Upewnij się, że typy są aktualne
- [ ] Sprawdź, czy `src/types.ts` zawiera wszystkie potrzebne typy:
  - `GetTasksQueryParams` (linie 425-435)
  - `TaskWithDetails` (linie 361-366)
  - `ListTasksResponse` (linie 368-371)
  - `PaginationMeta` (linie 17-22)
  - `ApiError` (linie 27-33)
- [ ] Jeśli brakuje, dodaj zgodnie z sekcją "3. Wykorzystywane typy"

#### 1.2 Utwórz strukturę plików
```
src/
├── pages/
│   └── api/
│       └── tasks/
│           └── index.ts          # API route handler (jeśli używasz Astro API routes)
├── lib/
│   ├── tasks.service.ts          # Business logic
│   └── validation/
│       └── tasks.validation.ts   # Zod schemas
└── types.ts                      # Już istnieje
```

### Faza 2: Implementacja walidacji (Zod Schema)

#### 2.1 Utwórz plik walidacji
**Plik:** `src/lib/validation/tasks.validation.ts`

```typescript
import { z } from 'zod';

/**
 * Zod schema dla walidacji query parameters endpointu GET /tasks
 */
export const GetTasksQuerySchema = z.object({
  is_completed: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean()),
  
  is_private: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean()),
  
  assigned_to: z
    .string()
    .optional()
    .refine(
      val => !val || val === 'me' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
      { message: 'assigned_to must be a valid UUID or "me"' }
    ),
  
  due_before: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: 'due_before must be a valid ISO 8601 date' }
    ),
  
  due_after: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: 'due_after must be a valid ISO 8601 date' }
    ),
  
  event_id: z
    .string()
    .uuid({ message: 'event_id must be a valid UUID' })
    .optional(),
  
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 100))
    .pipe(
      z.number()
        .int()
        .min(1, { message: 'limit must be at least 1' })
        .max(500, { message: 'limit must not exceed 500' })
    ),
  
  offset: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 0))
    .pipe(
      z.number()
        .int()
        .min(0, { message: 'offset must be non-negative' })
    ),
  
  sort: z
    .enum(['due_date_asc', 'due_date_desc', 'created_at_desc'], {
      errorMap: () => ({ 
        message: 'sort must be one of: due_date_asc, due_date_desc, created_at_desc' 
      }),
    })
    .optional()
    .default('due_date_asc'),
});

export type ValidatedGetTasksQuery = z.infer<typeof GetTasksQuerySchema>;
```

#### 2.2 Test walidacji
- [ ] Utwórz test unit dla schema walidacji
- [ ] Sprawdź wszystkie edge cases (invalid UUID, date formats, etc.)

### Faza 3: Implementacja TasksService

#### 3.1 Utwórz service layer
**Plik:** `src/lib/tasks.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/db/database.types';
import type { 
  TaskWithDetails, 
  ListTasksResponse, 
  PaginationMeta 
} from '@/types';
import type { ValidatedGetTasksQuery } from './validation/tasks.validation';

export class TasksService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Lista zadań z filtrami, sortowaniem i paginacją
   * RLS automatycznie filtruje według family_id i is_private
   */
  async listTasks(
    userId: string,
    filters: ValidatedGetTasksQuery
  ): Promise<ListTasksResponse> {
    // Bazowe zapytanie z joinami
    let query = this.supabase
      .from('tasks')
      .select(
        `
        *,
        created_by_profile:profiles!tasks_created_by_fkey(display_name),
        assigned_to_profile:profiles!tasks_assigned_to_fkey(display_name),
        completed_by_profile:profiles!tasks_completed_by_fkey(display_name),
        event:events(title)
        `,
        { count: 'exact' }
      )
      .is('archived_at', null); // Wyklucz zarchiwizowane

    // Zastosuj filtry
    if (filters.is_completed !== undefined) {
      query = query.eq('is_completed', filters.is_completed);
    }

    if (filters.is_private !== undefined) {
      query = query.eq('is_private', filters.is_private);
    }

    if (filters.assigned_to) {
      // Zamień "me" na rzeczywiste ID użytkownika
      const assigneeId = filters.assigned_to === 'me' ? userId : filters.assigned_to;
      query = query.eq('assigned_to', assigneeId);
    }

    if (filters.due_before) {
      query = query.lt('due_date', filters.due_before);
    }

    if (filters.due_after) {
      query = query.gt('due_date', filters.due_after);
    }

    if (filters.event_id) {
      query = query.eq('event_id', filters.event_id);
    }

    // Sortowanie
    switch (filters.sort) {
      case 'due_date_desc':
        query = query.order('due_date', { ascending: false, nullsFirst: false });
        break;
      case 'created_at_desc':
        query = query.order('created_at', { ascending: false });
        break;
      case 'due_date_asc':
      default:
        query = query.order('due_date', { ascending: true, nullsFirst: false });
        break;
    }

    // Paginacja
    query = query.range(filters.offset, filters.offset + filters.limit - 1);

    // Wykonaj zapytanie
    const { data, count, error } = await query;

    if (error) {
      console.error('Database query failed', {
        userId,
        filters,
        error: error.message,
        code: error.code,
      });
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    // Transformuj dane do TaskWithDetails
    const tasks: TaskWithDetails[] = (data || []).map(task => ({
      ...task,
      created_by_name: task.created_by_profile?.display_name || 'Unknown',
      assigned_to_name: task.assigned_to_profile?.display_name || null,
      completed_by_name: task.completed_by_profile?.display_name || null,
      event_title: task.event?.title || null,
    }));

    // Oblicz metadane paginacji
    const pagination: PaginationMeta = {
      total: count || 0,
      limit: filters.limit,
      offset: filters.offset,
      has_more: (filters.offset + filters.limit) < (count || 0),
    };

    return {
      tasks,
      pagination,
    };
  }
}
```

#### 3.2 Dodaj error handling w service
- [ ] Obsłuż błędy Supabase (connection, timeout, etc.)
- [ ] Loguj błędy z odpowiednim kontekstem
- [ ] Zwróć czytelne błędy do API handler

### Faza 4: Implementacja API Route Handler

#### 4.1 Utwórz endpoint handler
**Plik:** `src/pages/api/tasks/index.ts` (dla Astro)
LUB bezpośrednie wywołanie z React Server Action

```typescript
import type { APIRoute } from 'astro';
import { createClient } from '@/db/supabase.client';
import { TasksService } from '@/lib/tasks.service';
import { GetTasksQuerySchema } from '@/lib/validation/tasks.validation';

export const GET: APIRoute = async ({ request }) => {
  try {
    // 1. Autentykacja
    const supabase = createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required' 
          } 
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Walidacja query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const validationResult = GetTasksQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      console.warn('Query validation failed', {
        userId: user.id,
        errors: validationResult.error.flatten(),
        queryParams,
      });
      
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_QUERY_PARAMS',
            message: 'Invalid query parameters provided',
            details: validationResult.error.flatten().fieldErrors,
          },
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Wywołanie service
    const tasksService = new TasksService(supabase);
    const result = await tasksService.listTasks(user.id, validationResult.data);
    
    // 4. Sukces
    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    // 5. Nieoczekiwane błędy
    console.error('Failed to fetch tasks', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while fetching tasks',
        },
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
```

#### 4.2 Alternatywna implementacja - React Server Action
Jeśli używasz React 19 Actions zamiast Astro API routes:

**Plik:** `src/actions/tasks.actions.ts`

```typescript
'use server';

import { createClient } from '@/db/supabase.client';
import { TasksService } from '@/lib/tasks.service';
import { GetTasksQuerySchema } from '@/lib/validation/tasks.validation';
import type { ListTasksResponse, ApiError } from '@/types';

export async function getTasks(
  queryParams: Record<string, string>
): Promise<ListTasksResponse | ApiError> {
  try {
    // 1. Autentykacja
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
    }

    // 2. Walidacja
    const validationResult = GetTasksQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      console.warn('Query validation failed', {
        userId: user.id,
        errors: validationResult.error.flatten(),
      });
      
      return {
        error: {
          code: 'INVALID_QUERY_PARAMS',
          message: 'Invalid query parameters provided',
          details: validationResult.error.flatten().fieldErrors,
        },
      };
    }

    // 3. Service call
    const tasksService = new TasksService(supabase);
    const result = await tasksService.listTasks(user.id, validationResult.data);
    
    return result;
    
  } catch (error) {
    console.error('Failed to fetch tasks', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while fetching tasks',
      },
    };
  }
}
```

### Faza 5: Testy

#### 5.1 Unit Tests - TasksService
**Plik:** `src/lib/tasks.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let mockSupabase: any;
  let service: TasksService;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
    
    service = new TasksService(mockSupabase);
  });

  it('should build query with all filters', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });

    await service.listTasks('user-123', {
      is_completed: false,
      is_private: false,
      assigned_to: 'me',
      limit: 50,
      offset: 0,
      sort: 'due_date_asc',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
    expect(mockSupabase.eq).toHaveBeenCalledWith('is_completed', false);
    expect(mockSupabase.eq).toHaveBeenCalledWith('is_private', false);
    expect(mockSupabase.eq).toHaveBeenCalledWith('assigned_to', 'user-123');
  });

  it('should transform "me" to user ID', async () => {
    mockSupabase.select.mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });

    await service.listTasks('user-456', {
      assigned_to: 'me',
      limit: 100,
      offset: 0,
      sort: 'due_date_asc',
    });

    expect(mockSupabase.eq).toHaveBeenCalledWith('assigned_to', 'user-456');
  });

  it('should calculate has_more correctly', async () => {
    mockSupabase.select.mockResolvedValue({
      data: new Array(50).fill({}),
      count: 150,
      error: null,
    });

    const result = await service.listTasks('user-123', {
      limit: 50,
      offset: 0,
      sort: 'due_date_asc',
    });

    expect(result.pagination).toEqual({
      total: 150,
      limit: 50,
      offset: 0,
      has_more: true,
    });
  });
});
```

#### 5.2 Integration Tests - API Endpoint
**Plik:** `src/pages/api/tasks/index.test.ts`

Testy integracyjne powinny:
- [ ] Sprawdzić autentykację (401 bez tokenu)
- [ ] Sprawdzić walidację query params (400 dla invalid params)
- [ ] Sprawdzić filtrowanie przez RLS (użytkownik widzi tylko zadania swojej rodziny)
- [ ] Sprawdzić prywatne zadania (widoczne tylko dla twórcy)
- [ ] Sprawdzić sortowanie i paginację

#### 5.3 E2E Tests
- [ ] Utwórz scenariusze testowe pokrywające główne use cases
- [ ] Test: Lista "Moje zadania" (`assigned_to=me`)
- [ ] Test: Filtrowanie po dacie (`due_before`, `due_after`)
- [ ] Test: Paginacja (offset, limit)
- [ ] Test: Sortowanie (wszystkie 3 opcje)

### Faza 6: Optymalizacja bazy danych

#### 6.1 Utwórz indeksy
**Plik:** `supabase/migrations/YYYYMMDD_add_tasks_indexes.sql`

```sql
-- Index na family_id + is_completed + due_date (często używane razem)
CREATE INDEX IF NOT EXISTS idx_tasks_family_completed_due 
ON tasks(family_id, is_completed, due_date) 
WHERE archived_at IS NULL;

-- Index na family_id + is_private + due_date
CREATE INDEX IF NOT EXISTS idx_tasks_family_private_due 
ON tasks(family_id, is_private, due_date) 
WHERE archived_at IS NULL;

-- Index na assigned_to + is_completed (dla "Moje zadania")
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_completed 
ON tasks(assigned_to, is_completed, due_date) 
WHERE archived_at IS NULL;

-- Index na event_id (dla zadań powiązanych z wydarzeniem)
CREATE INDEX IF NOT EXISTS idx_tasks_event_id 
ON tasks(event_id) 
WHERE archived_at IS NULL AND event_id IS NOT NULL;

-- Index na due_date z NULLS LAST (dla sortowania)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_nulls_last 
ON tasks(family_id, due_date NULLS LAST) 
WHERE archived_at IS NULL;

-- Index na created_at (dla sortowania created_at_desc)
CREATE INDEX IF NOT EXISTS idx_tasks_created_at_desc 
ON tasks(family_id, created_at DESC) 
WHERE archived_at IS NULL;
```

#### 6.2 Sprawdź polityki RLS
```sql
-- Upewnij się, że polityka SELECT dla tasks istnieje i jest poprawna
-- (To powinno już być zaimplementowane w wcześniejszych migracjach)

-- SELECT: Użytkownik widzi zadania ze swojej rodziny
CREATE POLICY IF NOT EXISTS "Users can view family tasks"
ON tasks FOR SELECT
USING (
  family_id IN (
    SELECT family_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
  AND (
    is_private = false
    OR (is_private = true AND created_by = auth.uid())
  )
  AND archived_at IS NULL
);
```

### Faza 7: Dokumentacja

#### 7.1 Zaktualizuj API docs
- [ ] Upewnij się, że `.ai/api-plan.md` jest aktualny
- [ ] Dodaj przykłady curl/fetch do dokumentacji

#### 7.2 Dodaj inline documentation
- [ ] JSDoc comments w service methods
- [ ] Komentarze w Zod schema wyjaśniające walidację
- [ ] README w folderze API routes (jeśli używasz Astro)

### Faza 8: Frontend Integration

#### 8.1 Utwórz hook lub Action call
**Plik:** `src/hooks/useTasks.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import type { GetTasksQueryParams, ListTasksResponse } from '@/types';

async function fetchTasks(params: GetTasksQueryParams): Promise<ListTasksResponse> {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`/api/tasks?${searchParams.toString()}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch tasks');
  }

  return response.json();
}

export function useTasks(params: GetTasksQueryParams = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => fetchTasks(params),
    staleTime: 30000, // 30 sekund
    cacheTime: 5 * 60 * 1000, // 5 minut
  });
}
```

#### 8.2 Przykład użycia w komponencie
```typescript
import { useTasks } from '@/hooks/useTasks';

export function MyTasksList() {
  const { data, isLoading, error } = useTasks({
    assigned_to: 'me',
    is_completed: false,
    sort: 'due_date_asc',
  });

  if (isLoading) return <div>Loading tasks...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>My Tasks ({data.pagination.total})</h2>
      <ul>
        {data.tasks.map(task => (
          <li key={task.id}>
            {task.title} - Due: {task.due_date}
          </li>
        ))}
      </ul>
      {data.pagination.has_more && (
        <button>Load more</button>
      )}
    </div>
  );
}
```

### Faza 9: Deployment & Monitoring

#### 9.1 Pre-deployment checklist
- [ ] Wszystkie testy przechodzą (unit, integration, e2e)
- [ ] Linter nie pokazuje błędów
- [ ] TypeScript compiles bez errorsów
- [ ] Migracje bazy danych zostały uruchomione
- [ ] Environment variables są ustawione

#### 9.2 Deploy
- [ ] Deploy do środowiska staging
- [ ] Ręczny smoke test na staging
- [ ] Deploy do produkcji

#### 9.3 Post-deployment monitoring
- [ ] Sprawdź logi serwera pod kątem błędów
- [ ] Monitor response times (target: p95 < 500ms)
- [ ] Monitor error rate (target: < 1%)
- [ ] Sprawdź alerty Sentry/monitoring tool

#### 9.4 Performance baseline
- [ ] Zmierz początkową wydajność
- [ ] Zapisz metryki jako baseline do przyszłych porównań
- [ ] Ustaw alerty dla anomalii

---

## 10. Checklist - Podsumowanie

### Backend
- [ ] Typy TypeScript (GetTasksQueryParams, TaskWithDetails, ListTasksResponse)
- [ ] Zod schema walidacji (GetTasksQuerySchema)
- [ ] TasksService z metodą listTasks()
- [ ] API route handler (/api/tasks lub Server Action)
- [ ] Error handling (400, 401, 500)
- [ ] Logging (console.warn, console.error)

### Database
- [ ] Indeksy dla często używanych filtrów
- [ ] Polityki RLS dla tasks (SELECT)
- [ ] Migracje uruchomione na środowiskach

### Tests
- [ ] Unit tests dla TasksService
- [ ] Integration tests dla API endpoint
- [ ] E2E tests dla głównych use cases

### Frontend
- [ ] React Query hook (useTasks)
- [ ] Przykładowy komponent używający hooka
- [ ] Error handling w UI

### Documentation
- [ ] API docs zaktualizowane
- [ ] JSDoc comments w kodzie
- [ ] README w odpowiednich folderach

### Deployment
- [ ] Deploy na staging
- [ ] Smoke tests
- [ ] Deploy na production
- [ ] Monitoring setup

---

## 11. Potencjalne rozszerzenia (Future Work)

### Short-term
- **Soft deletes:** Zamiast usuwać zadania na stałe, ustawiać `archived_at`
- **Bulk operations:** Endpoint do masowego update'u zadań (np. mark all as completed)
- **Search:** Full-text search w tytułach zadań

### Medium-term
- **Real-time updates:** WebSocket/Supabase Realtime do live updates listy zadań
- **Export:** Export zadań do CSV/PDF
- **Filtering presets:** Zapisywanie ulubionych kombinacji filtrów

### Long-term
- **Advanced analytics:** Dashboard z statystykami ukończonych zadań
- **Recurring tasks:** Zadania cykliczne (daily, weekly, monthly)
- **Task templates:** Szablony zadań do szybkiego tworzenia

---

## 12. Kontakt i support

**W razie pytań lub problemów:**
- Sprawdź dokumentację API: `.ai/api-plan.md`
- Sprawdź dokumentację DB: `.ai/db-plan.md`
- Przejrzyj cursor rules: `.cursor/rules/backend.mdc`

**Potrzebujesz pomocy?**
- Uruchom testy, aby zidentyfikować problem
- Sprawdź logi Supabase dla szczegółów błędów DB
- Przejrzyj browser console dla błędów klienckich

---

**Ostatnia aktualizacja:** 2026-01-29  
**Wersja planu:** 1.0  
**Status:** Ready for implementation
