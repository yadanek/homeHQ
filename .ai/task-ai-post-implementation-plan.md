# API Endpoint Implementation Plan: POST /tasks/from-suggestion

## 1. Przegląd punktu końcowego

Endpoint **POST /tasks/from-suggestion** umożliwia uwierzytelnionym użytkownikom tworzenie zadań na podstawie sugestii AI wygenerowanych dla wcześniej utworzonych eventów. Jest to alternatywa dla akceptowania sugestii masowo podczas tworzenia eventu (`accept_suggestions` w POST /events).

**Kluczowe różnice od POST /tasks:**
- Wymaga `event_id` (źródłowy event kalendarzowy)
- Wymaga `suggestion_id` (identyfikator reguły AI)
- Automatycznie ustawia `created_from_suggestion = true` (dla analytics/metrics)
- Związany z konkretnym eventem kalendarza

**Główne przypadki użycia:**
1. **Deferred acceptance:** Użytkownik utworzył event bez akceptowania sugestii, później decyduje się dodać zadania
2. **Post-event review:** Użytkownik przegląda listę wcześniejszych eventów i retrospektywnie dodaje sugestie
3. **Single suggestion:** Użytkownik chce dodać tylko jedną wybraną sugestię zamiast wszystkich

**Metryki:**
- Wspiera pomiar conversion rate dla US-006 (ile sugestii AI zostało zaakceptowanych)
- `created_from_suggestion = true` pozwala śledzić skuteczność AI engine

---

## 2. Szczegóły żądania

### Metoda HTTP
```
POST /tasks/from-suggestion
```

### Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Struktura URL
```
/tasks/from-suggestion
```
Brak parametrów URL ani query params.

### Request Body

```typescript
{
  "title": string,            // Wymagane: tytuł zadania (min 1 znak po trim)
  "event_id": string,         // Wymagane: UUID eventu źródłowego
  "suggestion_id": string,    // Wymagane: 'birthday' | 'health' | 'outing' | 'travel'
  "is_private": boolean,      // Wymagane: dziedziczone z eventu (lub explicit)
  "due_date"?: string,        // Opcjonalne: ISO 8601 timestamp
  "assigned_to"?: string      // Opcjonalne: UUID profilu z tej samej rodziny
}
```

**Przykład żądania:**
```json
{
  "title": "Buy a gift",
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "suggestion_id": "birthday",
  "is_private": false,
  "due_date": "2026-01-13T15:00:00Z",
  "assigned_to": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Parametry

**Wymagane:**
- `title` (string): Tytuł zadania, min. 1 znak po trimming, max 500 znaków
- `event_id` (string): UUID eventu źródłowego, musi istnieć i być dostępny dla użytkownika
- `suggestion_id` (string): Identyfikator reguły AI, jeden z: `'birthday'`, `'health'`, `'outing'`, `'travel'`
- `is_private` (boolean): Flaga prywatności zadania (powinna odpowiadać eventowi)

**Opcjonalne:**
- `due_date` (string | null): Termin wykonania w ISO 8601 format (np. "2026-01-13T15:00:00Z")
- `assigned_to` (string | null): UUID profilu użytkownika z tej samej rodziny

---

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

Wszystkie typy już zdefiniowane w `src/types.ts`:

```typescript
// Request DTO (lines 352-355 w types.ts)
export type CreateTaskFromSuggestionRequest = Pick<
  TablesInsert<'tasks'>,
  'title' | 'due_date' | 'is_private' | 'assigned_to' | 'event_id' | 'suggestion_id'
>;

// Response DTO (line 346 w types.ts)
export type TaskResponse = Tables<'tasks'>;

// Error format (lines 27-33 w types.ts)
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Helper type (lines 499-500 w types.ts)
export type SuggestionId = 'birthday' | 'health' | 'outing' | 'travel';
```

### Validation Schema

**Nowy plik:** `src/validations/tasks.schema.ts` (dodanie nowego schematu)

```typescript
export const createTaskFromSuggestionSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty")
    .max(500, "Title cannot exceed 500 characters"),
  
  event_id: z
    .string({ required_error: "Event ID is required" })
    .uuid({ message: "Invalid UUID format for event_id" }),
  
  suggestion_id: z
    .enum(['birthday', 'health', 'outing', 'travel'], {
      errorMap: () => ({ message: "Invalid suggestion_id. Must be one of: birthday, health, outing, travel" })
    }),
  
  is_private: z
    .boolean({ required_error: "is_private is required" }),
  
  due_date: z
    .string()
    .datetime({ message: "Invalid date format. Expected ISO 8601" })
    .optional()
    .nullable(),
  
  assigned_to: z
    .string()
    .uuid({ message: "Invalid UUID format for assigned_to" })
    .optional()
    .nullable()
});

export type CreateTaskFromSuggestionInput = z.infer<typeof createTaskFromSuggestionSchema>;
```

### Database Types

```typescript
// Insert type dla tasks table
import type { TablesInsert } from '@/db/database.types';

const taskData: TablesInsert<'tasks'> = {
  family_id: string,              // z profilu użytkownika
  created_by: string,             // auth.uid()
  title: string,
  event_id: string,               // z requestu
  suggestion_id: string,          // z requestu
  is_private: boolean,            // z requestu
  created_from_suggestion: true,  // zawsze true dla tego endpointu
  due_date: string | null,
  assigned_to: string | null
};
```

---

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

```json
{
  "id": "uuid",
  "family_id": "uuid",
  "created_by": "uuid",
  "assigned_to": "uuid",
  "title": "Buy a gift",
  "due_date": "2026-01-13T15:00:00Z",
  "is_completed": false,
  "completed_at": null,
  "completed_by": null,
  "is_private": false,
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "suggestion_id": "birthday",
  "created_from_suggestion": true,
  "created_at": "2026-01-02T12:00:00Z",
  "updated_at": "2026-01-02T12:00:00Z",
  "archived_at": null
}
```

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid UUID format for event_id",
    "details": {
      "field": "event_id",
      "value": "invalid-uuid"
    }
  }
}
```

**Scenariusze 400:**
- Missing required fields (title, event_id, suggestion_id, is_private)
- Invalid UUID format (event_id, assigned_to)
- Invalid suggestion_id (nie jedna z 4 wartości)
- Invalid ISO 8601 date format (due_date)
- Empty title po trim
- Title przekracza 500 znaków
- Invalid boolean value (is_private)

#### 401 Unauthorized - Authentication Error

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token"
  }
}
```

**Scenariusze 401:**
- Brak nagłówka Authorization
- Nieprawidłowy/wygasły JWT token
- Token nie zawiera user ID

#### 403 Forbidden - Authorization Error

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

**Scenariusze 403:**
- Użytkownik nie ma profilu (brak family_id)
- Event należy do innej rodziny
- Event jest private a użytkownik nie jest twórcą
- assigned_to należy do innej rodziny

#### 404 Not Found - Resource Not Found

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Event not found or has been archived",
    "details": {
      "event_id": "uuid"
    }
  }
}
```

**Scenariusze 404:**
- event_id nie istnieje w bazie
- Event jest archived (soft delete)
- assigned_to profile nie istnieje

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "dbError": "Connection timeout" // tylko w development
    }
  }
}
```

**Scenariusze 500:**
- Błąd połączenia z bazą danych
- Nieoczekiwany błąd podczas insert
- RLS policy failure

---

## 5. Przepływ danych

### Diagram przepływu

```
1. HTTP Request (POST /tasks/from-suggestion)
   ↓
2. React Action (createTaskFromSuggestion)
   ↓ [Validation: Zod Schema]
   ↓
3. TasksService.createTaskFromSuggestion(input, userId)
   ↓
   ├─→ [Get user profile & family_id]
   │   ↓
   ├─→ [Validate event_id exists & accessible]
   │   ↓
   ├─→ [Validate assigned_to if provided]
   │   ↓
   ├─→ [Prepare task data with created_from_suggestion=true]
   │   ↓
   └─→ [Insert into tasks table via RLS]
       ↓
4. Database (PostgreSQL/Supabase)
   ↓ [RLS policies enforce family isolation]
   ↓ [Trigger: update updated_at timestamp]
   ↓
5. Return TaskResponse
   ↓
6. HTTP Response (201 Created)
```

### Krok po kroku

**Krok 1: Authentication & Authorization**
```typescript
// W React Action
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) return { success: false, error: UNAUTHORIZED };

// W Service
const { data: profile } = await supabase
  .from('profiles')
  .select('family_id')
  .eq('id', userId)
  .single();

if (!profile) return { error: FORBIDDEN };
```

**Krok 2: Input Validation**
```typescript
const validationResult = createTaskFromSuggestionSchema.safeParse(input);
if (!validationResult.success) {
  return { error: VALIDATION_ERROR };
}
```

**Krok 3: Event Validation**
```typescript
const { data: event } = await supabase
  .from('events')
  .select('family_id, is_private, created_by')
  .eq('id', input.event_id)
  .is('archived_at', null)
  .single();

if (!event) return { error: NOT_FOUND };
if (event.family_id !== profile.family_id) return { error: FORBIDDEN };

// Check private event access
if (event.is_private && event.created_by !== userId) {
  return { error: FORBIDDEN };
}

// Verify is_private consistency (optional warning or enforcement)
if (input.is_private !== event.is_private) {
  // Log warning or enforce inheritance
}
```

**Krok 4: Assigned User Validation (if provided)**
```typescript
if (input.assigned_to) {
  const { data: assignedProfile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', input.assigned_to)
    .single();

  if (!assignedProfile) return { error: NOT_FOUND };
  if (assignedProfile.family_id !== profile.family_id) {
    return { error: FORBIDDEN };
  }
}
```

**Krok 5: Task Creation**
```typescript
const taskData: TablesInsert<'tasks'> = {
  family_id: profile.family_id,
  created_by: userId,
  title: input.title,
  event_id: input.event_id,
  suggestion_id: input.suggestion_id,
  is_private: input.is_private,
  created_from_suggestion: true, // Analytics flag
  due_date: input.due_date || null,
  assigned_to: input.assigned_to || null
};

const { data, error } = await supabase
  .from('tasks')
  .insert(taskData)
  .select()
  .single();
```

### Interakcje z bazą danych

**Query 1: Get user profile**
```sql
SELECT family_id 
FROM profiles 
WHERE id = $1;
```

**Query 2: Validate event**
```sql
SELECT family_id, is_private, created_by 
FROM events 
WHERE id = $1 
  AND archived_at IS NULL;
```

**Query 3: Validate assigned_to (conditional)**
```sql
SELECT family_id 
FROM profiles 
WHERE id = $1;
```

**Query 4: Insert task**
```sql
INSERT INTO tasks (
  family_id, created_by, title, event_id, suggestion_id,
  is_private, created_from_suggestion, due_date, assigned_to
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;
```

**Estimated query count:** 3-4 queries per request
- 1 profile fetch (auth)
- 1 event validation
- 0-1 assigned_to validation (conditional)
- 1 task insert

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie (Authentication)

**Mechanizm:** Supabase Auth JWT token

```typescript
// Weryfikacja w React Action
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return {
    success: false,
    error: {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token'
      }
    }
  };
}
```

**Wymagania:**
- Bearer token w nagłówku Authorization
- Token musi być aktywny (nie wygasły)
- Token musi zawierać `user.id`

### 6.2. Autoryzacja (Authorization)

**Row Level Security (RLS) Policies:**

```sql
-- Tasks insert policy (zakłada family_id w JWT metadata)
CREATE POLICY "tasks_insert_own_family_authenticated"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
);

-- Tasks select policy (private vs shared)
CREATE POLICY "tasks_select_family_authenticated"
ON tasks FOR SELECT
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

**Walidacja family boundary:**
- Event musi należeć do tej samej rodziny co użytkownik
- assigned_to musi być w tej samej rodzinie
- RLS automatycznie wymusza family_id isolation

**Private event access:**
```typescript
// Tylko twórca może tworzyć zadania z private eventów
if (event.is_private && event.created_by !== userId) {
  return {
    error: {
      code: 'FORBIDDEN',
      message: 'Cannot create tasks from private events created by other users'
    }
  };
}
```

### 6.3. Walidacja danych wejściowych

**SQL Injection Prevention:**
- ✅ Supabase używa parametryzowanych zapytań (prepared statements)
- ✅ Wszystkie wartości są sanitized przez Supabase client

**XSS Prevention:**
- ✅ Zod validation zapewnia type safety
- ✅ React automatycznie escapuje output
- ⚠️ Uwaga: title może zawierać HTML entities - frontend musi używać proper escaping

**Data Type Validation:**
```typescript
// Zod enforces:
- UUID format dla event_id, assigned_to
- ISO 8601 format dla due_date
- Enum validation dla suggestion_id
- String length limits dla title
- Boolean type dla is_private
```

### 6.4. Data Privacy

**Private Tasks:**
```sql
-- RLS policy ensures private tasks only visible to creator
is_private = false OR created_by = auth.uid()
```

**Data Exposure:**
- TaskResponse NIE zawiera wrażliwych danych innych użytkowników
- family_id jest visible (required dla RLS context)
- User IDs są visible ale to UUID (nie email/password)

### 6.5. Rate Limiting

**Rekomendacje:**
- Implement rate limiting na poziomie API gateway (np. Supabase Edge Functions)
- Limit: 100 requests/minute per user
- Burst: 10 requests/second

**Implementacja (opcjonalna - Supabase Edge Function):**
```typescript
// W Edge Function
const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  max: 100 // requests per window
});

await rateLimiter.check(userId);
```

### 6.6. Audit Trail

**Tracking:**
- `created_at`: automatyczny timestamp
- `created_by`: zawsze ustawiony na auth.uid()
- `created_from_suggestion`: analytics flag (true dla tego endpointu)
- `suggestion_id`: które AI rule wygenerowało sugestię

**Logging:**
```typescript
console.log('[TasksService.createTaskFromSuggestion]', {
  userId,
  familyId: profile.family_id,
  eventId: input.event_id,
  suggestionId: input.suggestion_id,
  timestamp: new Date().toISOString()
});
```

---

## 7. Obsługa błędów

### 7.1. Error Hierarchy

```
TaskCreationError
├─ ValidationError (400)
│  ├─ Missing required field
│  ├─ Invalid format (UUID, date, enum)
│  ├─ Type mismatch
│  └─ Constraint violation (length, range)
├─ AuthenticationError (401)
│  ├─ Missing token
│  ├─ Invalid token
│  └─ Expired token
├─ AuthorizationError (403)
│  ├─ No profile/family
│  ├─ Cross-family access
│  └─ Private event access
├─ NotFoundError (404)
│  ├─ Event not found
│  ├─ Event archived
│  └─ Assignee not found
└─ InternalError (500)
   ├─ Database connection error
   ├─ RLS policy failure
   └─ Unexpected error
```

### 7.2. Szczegółowe scenariusze błędów

#### 400 - Validation Errors

**Scenario 1: Missing required field**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": {
      "field": "title",
      "issues": [/* Zod error details */]
    }
  }
}
```

**Scenario 2: Invalid UUID**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid UUID format for event_id",
    "details": {
      "field": "event_id",
      "value": "not-a-uuid"
    }
  }
}
```

**Scenario 3: Invalid suggestion_id**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid suggestion_id. Must be one of: birthday, health, outing, travel",
    "details": {
      "field": "suggestion_id",
      "value": "invalid_rule",
      "allowed": ["birthday", "health", "outing", "travel"]
    }
  }
}
```

**Scenario 4: Invalid date format**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format. Expected ISO 8601",
    "details": {
      "field": "due_date",
      "value": "2026-01-13"
    }
  }
}
```

**Scenario 5: Empty title**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title cannot be empty",
    "details": {
      "field": "title"
    }
  }
}
```

#### 401 - Authentication Errors

**Scenario 1: Missing token**
```typescript
// Request without Authorization header
return {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Missing or invalid authorization token'
  }
};
```

**Scenario 2: Invalid/expired token**
```typescript
const { error: authError } = await supabase.auth.getUser();
if (authError) {
  return {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization token'
    }
  };
}
```

#### 403 - Authorization Errors

**Scenario 1: User has no profile**
```typescript
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('family_id')
  .eq('id', userId)
  .single();

if (profileError || !profile) {
  return {
    error: {
      code: 'FORBIDDEN',
      message: 'User profile not found'
    }
  };
}
```

**Scenario 2: Event belongs to different family**
```typescript
if (event.family_id !== profile.family_id) {
  return {
    error: {
      code: 'FORBIDDEN',
      message: 'Cannot create task from event outside your family',
      details: { event_id: input.event_id }
    }
  };
}
```

**Scenario 3: Private event access denied**
```typescript
if (event.is_private && event.created_by !== userId) {
  return {
    error: {
      code: 'FORBIDDEN',
      message: 'Cannot create tasks from private events created by other users',
      details: { event_id: input.event_id }
    }
  };
}
```

**Scenario 4: Assigned user in different family**
```typescript
if (assignedProfile.family_id !== profile.family_id) {
  return {
    error: {
      code: 'FORBIDDEN',
      message: 'Cannot assign task to user outside your family',
      details: { assigned_to: input.assigned_to }
    }
  };
}
```

#### 404 - Not Found Errors

**Scenario 1: Event not found**
```typescript
const { data: event, error: eventError } = await supabase
  .from('events')
  .select('family_id, is_private, created_by')
  .eq('id', input.event_id)
  .is('archived_at', null)
  .single();

if (eventError || !event) {
  return {
    error: {
      code: 'NOT_FOUND',
      message: 'Event not found or has been archived',
      details: { event_id: input.event_id }
    }
  };
}
```

**Scenario 2: Assigned user not found**
```typescript
if (assignedError || !assignedProfile) {
  return {
    error: {
      code: 'NOT_FOUND',
      message: 'Assigned user not found',
      details: { assigned_to: input.assigned_to }
    }
  };
}
```

#### 500 - Internal Errors

**Scenario: Database error during insert**
```typescript
const { data, error: insertError } = await supabase
  .from('tasks')
  .insert(taskData)
  .select()
  .single();

if (insertError) {
  console.error('[TasksService.createTaskFromSuggestion] Database error:', insertError);
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' 
        ? { dbError: insertError.message } 
        : undefined
    }
  };
}
```

### 7.3. Error Logging Strategy

```typescript
// W Service layer
try {
  // Business logic
} catch (error) {
  // Log to console (development) lub Sentry (production)
  console.error('[TasksService.createTaskFromSuggestion] Unexpected error:', {
    error,
    userId,
    input,
    timestamp: new Date().toISOString()
  });

  // W production: send to Sentry
  if (process.env.NODE_ENV === 'production' && window.Sentry) {
    window.Sentry.captureException(error, {
      tags: { endpoint: 'POST /tasks/from-suggestion' },
      user: { id: userId },
      extra: { input }
    });
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  };
}
```

### 7.4. User-Facing Error Messages

**Best practices:**
- ✅ Używaj przyjaznych komunikatów dla użytkowników końcowych
- ✅ Szczegóły techniczne tylko w development mode
- ✅ Nie ujawniaj struktury bazy danych w komunikatach
- ✅ Podawaj actionable feedback (co użytkownik może zrobić)

**Przykład mapowania:**
```typescript
const userFriendlyMessages: Record<string, string> = {
  'VALIDATION_ERROR': 'Please check your input and try again.',
  'UNAUTHORIZED': 'Please log in to continue.',
  'FORBIDDEN': 'You don\'t have permission to perform this action.',
  'NOT_FOUND': 'The requested resource could not be found.',
  'INTERNAL_ERROR': 'Something went wrong. Please try again later.'
};
```

---

## 8. Rozważania dotyczące wydajności

### 8.1. Query Performance

**Database Queries per Request:**
1. Profile fetch: `SELECT family_id FROM profiles WHERE id = ?`
2. Event validation: `SELECT family_id, is_private, created_by FROM events WHERE id = ? AND archived_at IS NULL`
3. Assigned user validation (conditional): `SELECT family_id FROM profiles WHERE id = ?`
4. Task insert: `INSERT INTO tasks (...) VALUES (...) RETURNING *`

**Total queries:** 3-4 per request

**Estimated response time:**
- Optimistic: 80-120ms (all cached)
- Average: 150-200ms (1-2 cache misses)
- Pessimistic: 300-500ms (cold start, cross-region)

**Target SLA:** p95 < 300ms

### 8.2. Index Utilization

**Query 1: Profile fetch**
```sql
-- Uses: PRIMARY KEY index on profiles(id)
SELECT family_id FROM profiles WHERE id = $1;
```

**Query 2: Event validation**
```sql
-- Uses: PRIMARY KEY index on events(id)
-- Partial index: idx_events_family_start WHERE archived_at IS NULL
SELECT family_id, is_private, created_by 
FROM events 
WHERE id = $1 AND archived_at IS NULL;
```

**Query 3: Task insert**
```sql
-- Uses indexes:
-- - idx_tasks_family_completed on (family_id, is_completed)
-- - idx_tasks_event_id on event_id
INSERT INTO tasks (...) VALUES (...) RETURNING *;
```

**Rekomendacje:**
- ✅ Wszystkie niezbędne indexy już istnieją w schema
- ✅ Partial indexes optymalizują filtered queries
- ⚠️ Monitor query plans w Supabase Dashboard

### 8.3. Caching Strategy

**Database Connection Pooling:**
- Supabase automatycznie zarządza connection pool
- Recommended: używać single instance of SupabaseClient

**Client-side Caching:**
```typescript
// React Query dla cachowania list zadań
const { data: tasks } = useQuery({
  queryKey: ['tasks', familyId],
  queryFn: () => fetchTasks(),
  staleTime: 30000, // 30 seconds
  cacheTime: 300000 // 5 minutes
});

// Po utworzeniu zadania: invalidate cache
await createTaskFromSuggestion(data);
queryClient.invalidateQueries(['tasks']);
```

**Server-side Caching (opcjonalne):**
```typescript
// Supabase Edge Function z cache headers
return new Response(JSON.stringify(data), {
  headers: {
    'Cache-Control': 'private, max-age=60',
    'Content-Type': 'application/json'
  }
});
```

### 8.4. Optimistic UI Updates

**React 19 useOptimistic hook:**
```typescript
const [optimisticTasks, addOptimisticTask] = useOptimistic(
  tasks,
  (state, newTask) => [...state, newTask]
);

async function handleCreateTask(data: CreateTaskFromSuggestionRequest) {
  // Optimistic update
  const tempTask = {
    id: crypto.randomUUID(),
    ...data,
    created_at: new Date().toISOString(),
    is_completed: false,
    created_from_suggestion: true
  };
  
  addOptimisticTask(tempTask);
  
  // Actual API call
  const result = await createTaskFromSuggestion(data);
  
  if (!result.success) {
    // Rollback on error
    toast.error(result.error.message);
  }
}
```

**Benefits:**
- ✅ Instant UI feedback
- ✅ Lepsze UX (perceived performance)
- ✅ Automatic rollback on errors

### 8.5. Network Optimization

**Payload Size:**
- Request: ~200-300 bytes (JSON)
- Response: ~400-500 bytes (TaskResponse)
- Total: < 1KB per request

**Compression:**
```typescript
// Supabase automatycznie używa gzip/brotli compression
// Brak dodatkowej konfiguracji wymaganej
```

**Connection Reuse:**
- Supabase client używa HTTP/2
- Keep-alive connections enabled by default

### 8.6. Potential Bottlenecks

**1. Multiple sequential queries**
```typescript
// Problem: Sequential await calls
const profile = await getProfile(userId);
const event = await getEvent(eventId);
const assignedUser = await getAssignedUser(assignedTo);

// Solution: Use Promise.all for independent queries
const [profile, event, assignedUser] = await Promise.all([
  getProfile(userId),
  getEvent(eventId),
  assignedTo ? getAssignedUser(assignedTo) : Promise.resolve(null)
]);
```

**2. RLS policy evaluation**
- RLS policies są ewaluowane przy każdym query
- Optymalizacja: używaj JWT metadata dla family_id

**3. Database roundtrips**
- Każde query = 1 roundtrip do Supabase
- Latency: ~10-50ms per query (depending on region)
- Solution: Batch queries gdzie możliwe

### 8.7. Monitoring Recommendations

**Metrics to track:**
```typescript
// W production - integracja z monitoring (np. Sentry)
const startTime = performance.now();

try {
  const result = await createTaskFromSuggestion(data);
  
  const duration = performance.now() - startTime;
  
  // Log metrics
  analytics.track('task_created_from_suggestion', {
    duration,
    suggestionId: data.suggestion_id,
    hasAssignee: !!data.assigned_to,
    hasDueDate: !!data.due_date
  });
  
} catch (error) {
  // Track errors
  analytics.track('task_creation_error', {
    errorCode: error.code,
    suggestionId: data.suggestion_id
  });
}
```

**Dashboard metrics:**
- Request count per suggestion_id
- p50, p95, p99 response times
- Error rate by error code
- Conversion rate (suggestions created / suggestions shown)

---

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie validation schema

**Plik:** `src/validations/tasks.schema.ts` (edycja istniejącego pliku)

**Działanie:**
```typescript
// Dodaj na końcu pliku, po createTaskSchema

/**
 * Schema for POST /tasks/from-suggestion request body
 * 
 * Validates task creation from AI suggestion ensuring:
 * - Title is present and non-empty after trimming
 * - event_id is valid UUID and exists
 * - suggestion_id is one of 4 valid AI rules
 * - Due date is in valid ISO 8601 format if provided
 * - assigned_to is a valid UUID if provided
 * - is_private is explicitly provided as boolean
 */
export const createTaskFromSuggestionSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty")
    .max(500, "Title cannot exceed 500 characters"),
  
  event_id: z
    .string({ required_error: "Event ID is required" })
    .uuid({ message: "Invalid UUID format for event_id" }),
  
  suggestion_id: z
    .enum(['birthday', 'health', 'outing', 'travel'], {
      errorMap: () => ({ 
        message: "Invalid suggestion_id. Must be one of: birthday, health, outing, travel" 
      })
    }),
  
  is_private: z
    .boolean({ required_error: "is_private is required" }),
  
  due_date: z
    .string()
    .datetime({ message: "Invalid date format. Expected ISO 8601" })
    .optional()
    .nullable(),
  
  assigned_to: z
    .string()
    .uuid({ message: "Invalid UUID format for assigned_to" })
    .optional()
    .nullable()
});

/**
 * Inferred TypeScript type for task creation from suggestion input
 */
export type CreateTaskFromSuggestionInput = z.infer<typeof createTaskFromSuggestionSchema>;
```

**Weryfikacja:**
- [ ] Schema kompiluje się bez błędów TypeScript
- [ ] Export jest dostępny dla innych modułów
- [ ] Wszystkie 4 suggestion_id są w enum

---

### Krok 2: Implementacja Service Layer

**Plik:** `src/services/tasks.service.ts` (edycja istniejącej klasy)

**Działanie:**
```typescript
// Dodaj import
import { 
  createTaskFromSuggestionSchema, 
  type CreateTaskFromSuggestionInput 
} from '@/validations/tasks.schema';

// W klasie TasksService, dodaj nową metodę po createTask()

/**
 * Creates a task from an AI suggestion
 * 
 * This method is used when users accept AI-generated task suggestions
 * after event creation, either individually or retrospectively.
 * 
 * Key differences from createTask():
 * - Requires event_id and validates event accessibility
 * - Requires suggestion_id (AI rule identifier)
 * - Sets created_from_suggestion = true for analytics
 * - Validates is_private consistency with source event
 * 
 * @param input - Task creation data from suggestion
 * @param userId - Authenticated user ID from JWT
 * @returns Created task or error
 */
async createTaskFromSuggestion(
  input: CreateTaskFromSuggestionRequest,
  userId: string
): Promise<{ data?: TaskResponse; error?: ApiError }> {
  
  // === Step 1: Get user's profile and family_id ===
  const { data: profile, error: profileError } = await this.supabase
    .from('profiles')
    .select('family_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('[TasksService.createTaskFromSuggestion] Profile not found:', {
      userId,
      error: profileError
    });
    
    return {
      error: {
        error: {
          code: 'FORBIDDEN',
          message: 'User profile not found',
          details: { user_id: userId }
        }
      }
    };
  }

  // === Step 2: Validate event_id (must exist and be accessible) ===
  const { data: event, error: eventError } = await this.supabase
    .from('events')
    .select('family_id, is_private, created_by')
    .eq('id', input.event_id)
    .is('archived_at', null)
    .single();

  if (eventError || !event) {
    return {
      error: {
        error: {
          code: 'NOT_FOUND',
          message: 'Event not found or has been archived',
          details: { event_id: input.event_id }
        }
      }
    };
  }

  // === Step 3: Check event family boundary ===
  if (event.family_id !== profile.family_id) {
    return {
      error: {
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot create task from event outside your family',
          details: { event_id: input.event_id }
        }
      }
    };
  }

  // === Step 4: Check private event access ===
  if (event.is_private && event.created_by !== userId) {
    return {
      error: {
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot create tasks from private events created by other users',
          details: { event_id: input.event_id }
        }
      }
    };
  }

  // === Step 5: Validate assigned_to (if provided) ===
  if (input.assigned_to) {
    const { data: assignedProfile, error: assignedError } = await this.supabase
      .from('profiles')
      .select('family_id')
      .eq('id', input.assigned_to)
      .single();

    if (assignedError || !assignedProfile) {
      return {
        error: {
          error: {
            code: 'NOT_FOUND',
            message: 'Assigned user not found',
            details: { assigned_to: input.assigned_to }
          }
        }
      };
    }

    // Check if assigned user is in same family
    if (assignedProfile.family_id !== profile.family_id) {
      return {
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot assign task to user outside your family',
            details: { assigned_to: input.assigned_to }
          }
        }
      };
    }
  }

  // === Step 6: Prepare task data for insertion ===
  const taskData: TablesInsert<'tasks'> = {
    family_id: profile.family_id,
    created_by: userId,
    title: input.title,
    event_id: input.event_id,
    suggestion_id: input.suggestion_id,
    is_private: input.is_private,
    created_from_suggestion: true, // Analytics flag
    due_date: input.due_date || null,
    assigned_to: input.assigned_to || null
  };

  // === Step 7: Insert task into database ===
  const { data, error } = await this.supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('[TasksService.createTaskFromSuggestion] Database error:', error);
    return {
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: process.env.NODE_ENV === 'development' 
            ? { dbError: error.message } 
            : undefined
        }
      }
    };
  }

  // === Step 8: Log success for monitoring ===
  console.log('[TasksService.createTaskFromSuggestion] Task created:', {
    taskId: data.id,
    userId,
    eventId: input.event_id,
    suggestionId: input.suggestion_id,
    familyId: profile.family_id
  });

  // === Step 9: Return created task ===
  return { data };
}
```

**Weryfikacja:**
- [ ] Wszystkie edge cases obsłużone
- [ ] Error messages są user-friendly
- [ ] Logging jest informative
- [ ] TypeScript kompiluje się bez errors
- [ ] Metoda zwraca correct type

---

### Krok 3: Implementacja React Action

**Plik:** `src/actions/createTaskFromSuggestion.ts` (nowy plik)

**Działanie:**
```typescript
'use server';

import { createTaskFromSuggestionSchema } from '@/validations/tasks.schema';
import { TasksService } from '@/services/tasks.service';
import { createClient } from '@/db/supabase.client';
import type { CreateTaskFromSuggestionRequest, TaskResponse, ApiError } from '@/types';

/**
 * Result type for task creation from suggestion action
 */
export type CreateTaskFromSuggestionResult =
  | { success: true; data: TaskResponse }
  | { success: false; error: ApiError };

/**
 * Creates a new task from an AI suggestion
 * 
 * This React Server Action handles task creation from AI-generated suggestions
 * linked to calendar events. It's used when users accept suggestions after
 * event creation, either individually or retrospectively.
 * 
 * Authentication: Required (JWT token from Supabase Auth)
 * Authorization: User must belong to a family and have access to the source event
 * 
 * Process:
 * 1. Authenticate user and extract user ID
 * 2. Validate input with Zod schema
 * 3. Call TasksService to create task with event validation
 * 4. Return formatted response or error
 * 
 * Automatic field assignment:
 * - family_id: From user's profile
 * - created_by: Current user ID
 * - created_from_suggestion: true (analytics flag)
 * 
 * Error handling:
 * - 401: Missing or invalid authentication
 * - 400: Validation errors (invalid UUID, enum, date format)
 * - 403: Authorization errors (no profile, cross-family access, private event)
 * - 404: Resource not found (event archived, assigned user not found)
 * - 500: Unexpected server errors
 * 
 * @param request - Task creation request data from suggestion
 * @returns Promise resolving to success/error result
 * 
 * @example
 * ```typescript
 * const result = await createTaskFromSuggestion({
 *   title: 'Buy a gift',
 *   event_id: '550e8400-e29b-41d4-a716-446655440001',
 *   suggestion_id: 'birthday',
 *   is_private: false,
 *   due_date: '2026-01-13T15:00:00Z',
 *   assigned_to: '550e8400-e29b-41d4-a716-446655440000'
 * });
 * 
 * if (result.success) {
 *   console.log('Task created:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function createTaskFromSuggestion(
  request: CreateTaskFromSuggestionRequest
): Promise<CreateTaskFromSuggestionResult> {
  try {
    // === Step 1: Input Validation ===
    const validationResult = createTaskFromSuggestionSchema.safeParse(request);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return {
        success: false,
        error: {
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
            details: {
              field: firstError.path.join('.'),
              issues: validationResult.error.errors
            }
          }
        }
      };
    }

    const validatedData = validationResult.data;

    // === Step 2: Authentication ===
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization token'
          }
        }
      };
    }

    // === Step 3: Call Service Layer ===
    const tasksService = new TasksService(supabase);
    const result = await tasksService.createTaskFromSuggestion(validatedData, user.id);

    // === Step 4: Handle Service Response ===
    if (result.error) {
      return {
        success: false,
        error: result.error
      };
    }

    if (!result.data) {
      // Should never happen, but TypeScript safety
      return {
        success: false,
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Task created but no data returned'
          }
        }
      };
    }

    // === Step 5: Return Success ===
    return {
      success: true,
      data: result.data
    };

  } catch (error) {
    // === Unexpected error handling ===
    console.error('[createTaskFromSuggestion] Unexpected error:', error);

    // In production: send to Sentry or monitoring service
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: { action: 'createTaskFromSuggestion' },
        extra: { request }
      });
    }

    return {
      success: false,
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      }
    };
  }
}
```

**Weryfikacja:**
- [ ] Action kompiluje się bez błędów
- [ ] 'use server' directive na początku pliku
- [ ] Error handling covers all scenarios
- [ ] Proper logging w miejscach krytycznych
- [ ] TypeScript types są correct

---

### Krok 4: Implementacja Custom Hook

**Plik:** `src/hooks/useTasks.ts` (edycja istniejącego pliku)

**Działanie:**
```typescript
// Dodaj import
import { 
  createTaskFromSuggestion as createTaskFromSuggestionAction 
} from '@/actions/createTaskFromSuggestion';

// Dodaj na końcu pliku, po useCreateTask()

/**
 * Hook for creating tasks from AI suggestions
 * 
 * Provides functionality to create tasks from AI-generated suggestions
 * linked to calendar events, with automatic state management and error handling.
 * 
 * Features:
 * - Loading state management
 * - Error handling with user-friendly messages
 * - Automatic query invalidation on success
 * - TypeScript type safety
 * 
 * @returns Object with createFromSuggestion function, loading state, and error
 * 
 * @example
 * ```typescript
 * function AcceptSuggestionButton({ suggestion, eventId }) {
 *   const { createFromSuggestion, isCreating, error } = useCreateTaskFromSuggestion();
 *   
 *   const handleAccept = async () => {
 *     const result = await createFromSuggestion({
 *       title: suggestion.title,
 *       event_id: eventId,
 *       suggestion_id: suggestion.id,
 *       is_private: false,
 *       due_date: suggestion.due_date,
 *       assigned_to: null
 *     });
 *     
 *     if (result.success) {
 *       toast.success('Task created successfully!');
 *     }
 *   };
 *   
 *   return (
 *     <Button onClick={handleAccept} disabled={isCreating}>
 *       {isCreating ? 'Creating...' : 'Accept Suggestion'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useCreateTaskFromSuggestion() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Creates a task from an AI suggestion
   * 
   * @param data - Task creation data from suggestion
   * @returns Promise with success/error result
   */
  const createFromSuggestion = async (
    data: CreateTaskFromSuggestionRequest
  ): Promise<CreateTaskFromSuggestionResult> => {
    setIsCreating(true);
    setError(null);

    try {
      const result = await createTaskFromSuggestionAction(data);

      if (result.success) {
        // Invalidate tasks queries to refetch updated list
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
        
        // Optionally invalidate specific event's tasks
        if (data.event_id) {
          await queryClient.invalidateQueries({ 
            queryKey: ['tasks', { event_id: data.event_id }] 
          });
        }

        return result;
      } else {
        // Set user-friendly error message
        const errorMessage = result.error.error.message || 'Failed to create task';
        setError(errorMessage);
        return result;
      }
    } catch (err) {
      // Handle unexpected errors
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred';
      
      setError(errorMessage);
      
      return {
        success: false,
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: errorMessage
          }
        }
      };
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createFromSuggestion,
    isCreating,
    error,
    clearError: () => setError(null)
  };
}
```

**Weryfikacja:**
- [ ] Hook kompiluje się bez błędów
- [ ] Query invalidation działa poprawnie
- [ ] Loading states są zarządzane properly
- [ ] Error messages są user-friendly
- [ ] TypeScript types są exported correctly

---

### Krok 5: Implementacja UI Component

**Plik:** `src/components/tasks/AcceptSuggestionButton.tsx` (nowy plik)

**Działanie:**
```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateTaskFromSuggestion } from '@/hooks/useTasks';
import { toast } from 'sonner';
import type { TaskSuggestion } from '@/types';

interface AcceptSuggestionButtonProps {
  suggestion: TaskSuggestion;
  eventId: string;
  isPrivate: boolean;
  onSuccess?: () => void;
}

/**
 * Button component for accepting AI task suggestions
 * 
 * Allows users to create tasks from AI-generated suggestions
 * with one click. Provides loading state and error feedback.
 * 
 * @param suggestion - AI-generated task suggestion
 * @param eventId - Source event ID
 * @param isPrivate - Privacy flag inherited from event
 * @param onSuccess - Optional callback on successful creation
 */
export function AcceptSuggestionButton({
  suggestion,
  eventId,
  isPrivate,
  onSuccess
}: AcceptSuggestionButtonProps) {
  const { createFromSuggestion, isCreating, error } = useCreateTaskFromSuggestion();
  const [accepted, setAccepted] = useState(suggestion.accepted || false);

  const handleAccept = async () => {
    const result = await createFromSuggestion({
      title: suggestion.title,
      event_id: eventId,
      suggestion_id: suggestion.suggestion_id,
      is_private: isPrivate,
      due_date: suggestion.due_date || null,
      assigned_to: null // Can be extended to allow assignment
    });

    if (result.success) {
      setAccepted(true);
      toast.success('Task created successfully!');
      onSuccess?.();
    } else {
      toast.error(result.error.error.message);
    }
  };

  if (accepted) {
    return (
      <Button variant="outline" size="sm" disabled>
        ✓ Accepted
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleAccept} 
      disabled={isCreating}
      size="sm"
    >
      {isCreating ? 'Creating...' : 'Accept'}
    </Button>
  );
}
```

**Weryfikacja:**
- [ ] Component renderuje się poprawnie
- [ ] Loading state jest visible
- [ ] Toast notifications działają
- [ ] Accepted state jest persisted
- [ ] Error handling działa properly

---

### Krok 6: Testy jednostkowe

**Plik 1:** `tests/validations/tasks.schema.createTaskFromSuggestion.test.ts` (nowy plik)

**Działanie:**
```typescript
import { describe, it, expect } from 'vitest';
import { createTaskFromSuggestionSchema } from '@/validations/tasks.schema';

describe('createTaskFromSuggestionSchema', () => {
  const validData = {
    title: 'Buy a gift',
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    suggestion_id: 'birthday' as const,
    is_private: false,
    due_date: '2026-01-13T15:00:00Z',
    assigned_to: '550e8400-e29b-41d4-a716-446655440001'
  };

  describe('Valid inputs', () => {
    it('should accept valid full data', () => {
      const result = createTaskFromSuggestionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept minimal required fields', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        title: 'Task',
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        suggestion_id: 'health',
        is_private: true
      });
      expect(result.success).toBe(true);
    });

    it('should trim title whitespace', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: '  Trimmed Title  '
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Trimmed Title');
      }
    });

    it('should accept all valid suggestion_id values', () => {
      const suggestionIds = ['birthday', 'health', 'outing', 'travel'] as const;
      
      suggestionIds.forEach(id => {
        const result = createTaskFromSuggestionSchema.safeParse({
          ...validData,
          suggestion_id: id
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Invalid inputs - title', () => {
    it('should reject missing title', () => {
      const { title, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject empty title after trim', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: '   '
      });
      expect(result.success).toBe(false);
    });

    it('should reject title exceeding 500 characters', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        title: 'a'.repeat(501)
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - event_id', () => {
    it('should reject missing event_id', () => {
      const { event_id, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        event_id: 'not-a-uuid'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - suggestion_id', () => {
    it('should reject missing suggestion_id', () => {
      const { suggestion_id, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid suggestion_id value', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        suggestion_id: 'invalid_rule'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - due_date', () => {
    it('should reject invalid date format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        due_date: '2026-01-13'
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-ISO 8601 format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        due_date: '13/01/2026'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - assigned_to', () => {
    it('should reject invalid UUID format', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        assigned_to: 'not-a-uuid'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid inputs - is_private', () => {
    it('should reject missing is_private', () => {
      const { is_private, ...data } = validData;
      const result = createTaskFromSuggestionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean values', () => {
      const result = createTaskFromSuggestionSchema.safeParse({
        ...validData,
        is_private: 'true' // string instead of boolean
      });
      expect(result.success).toBe(false);
    });
  });
});
```

**Plik 2:** `tests/services/tasks.service.createTaskFromSuggestion.test.ts` (nowy plik)

**Działanie:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TasksService } from '@/services/tasks.service';
import type { CreateTaskFromSuggestionRequest } from '@/types';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn()
  }
};

describe('TasksService.createTaskFromSuggestion', () => {
  let tasksService: TasksService;
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const familyId = '550e8400-e29b-41d4-a716-446655440001';
  const eventId = '550e8400-e29b-41d4-a716-446655440002';

  const validRequest: CreateTaskFromSuggestionRequest = {
    title: 'Buy a gift',
    event_id: eventId,
    suggestion_id: 'birthday',
    is_private: false,
    due_date: '2026-01-13T15:00:00Z',
    assigned_to: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tasksService = new TasksService(mockSupabase as any);
  });

  describe('Success scenarios', () => {
    it('should create task successfully with all fields', async () => {
      // Mock profile fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: familyId },
              error: null
            })
          })
        })
      });

      // Mock event fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { 
                  family_id: familyId, 
                  is_private: false, 
                  created_by: userId 
                },
                error: null
              })
            })
          })
        })
      });

      // Mock insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                id: 'new-task-id', 
                ...validRequest,
                family_id: familyId,
                created_by: userId,
                created_from_suggestion: true
              },
              error: null
            })
          })
        })
      });

      const result = await tasksService.createTaskFromSuggestion(validRequest, userId);

      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.data?.created_from_suggestion).toBe(true);
    });
  });

  describe('Error scenarios - Profile', () => {
    it('should return FORBIDDEN when profile not found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      const result = await tasksService.createTaskFromSuggestion(validRequest, userId);

      expect(result.error?.error.code).toBe('FORBIDDEN');
      expect(result.data).toBeUndefined();
    });
  });

  describe('Error scenarios - Event', () => {
    it('should return NOT_FOUND when event does not exist', async () => {
      // Mock profile fetch (success)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: familyId },
              error: null
            })
          })
        })
      });

      // Mock event fetch (not found)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })
      });

      const result = await tasksService.createTaskFromSuggestion(validRequest, userId);

      expect(result.error?.error.code).toBe('NOT_FOUND');
    });

    it('should return FORBIDDEN when event belongs to different family', async () => {
      // Mock profile fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: familyId },
              error: null
            })
          })
        })
      });

      // Mock event fetch (different family)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { 
                  family_id: 'different-family-id', 
                  is_private: false, 
                  created_by: userId 
                },
                error: null
              })
            })
          })
        })
      });

      const result = await tasksService.createTaskFromSuggestion(validRequest, userId);

      expect(result.error?.error.code).toBe('FORBIDDEN');
      expect(result.error?.error.message).toContain('outside your family');
    });

    it('should return FORBIDDEN when accessing private event of another user', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440099';

      // Mock profile fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { family_id: familyId },
              error: null
            })
          })
        })
      });

      // Mock event fetch (private, different creator)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { 
                  family_id: familyId, 
                  is_private: true, 
                  created_by: otherUserId 
                },
                error: null
              })
            })
          })
        })
      });

      const result = await tasksService.createTaskFromSuggestion(validRequest, userId);

      expect(result.error?.error.code).toBe('FORBIDDEN');
      expect(result.error?.error.message).toContain('private events');
    });
  });

  // Add more test cases for assigned_to validation, database errors, etc.
});
```

**Weryfikacja:**
- [ ] Wszystkie testy passed
- [ ] Code coverage > 80%
- [ ] Edge cases są covered
- [ ] Error scenarios są tested
- [ ] Mocks działają poprawnie

---

### Krok 7: Integracja z istniejącym kodem

**Miejsca integracji:**

1. **Event Detail Page** - Wyświetlanie sugestii z możliwością akceptacji
```typescript
// src/components/events/EventDetailPage.tsx
import { AcceptSuggestionButton } from '@/components/tasks/AcceptSuggestionButton';

// W sekcji sugestii:
{suggestions.map((suggestion) => (
  <div key={suggestion.suggestion_id}>
    <h4>{suggestion.title}</h4>
    <AcceptSuggestionButton
      suggestion={suggestion}
      eventId={event.id}
      isPrivate={event.is_private}
      onSuccess={() => refetchSuggestions()}
    />
  </div>
))}
```

2. **Task List Component** - Filtrowanie zadań created_from_suggestion
```typescript
// Dodaj filter w useTasks hook
const { tasks } = useTasks({
  filters: {
    created_from_suggestion: true // Show only AI-generated tasks
  }
});
```

3. **Analytics Dashboard** - Tracking conversion rate
```typescript
// Compute metrics
const totalSuggestions = await countTotalSuggestions();
const acceptedSuggestions = await countTasks({ 
  created_from_suggestion: true 
});
const conversionRate = (acceptedSuggestions / totalSuggestions) * 100;
```

**Weryfikacja:**
- [ ] Event detail page pokazuje sugestie
- [ ] Accept button działa poprawnie
- [ ] Task list pokazuje nowe zadania
- [ ] Analytics metrics są accurate
- [ ] UI jest responsive i accessible

---

### Krok 8: Testowanie end-to-end

**Test Scenarios:**

1. **Happy path**: Utworzenie zadania z sugestii
2. **Error handling**: Invalid event_id
3. **Authorization**: Private event access
4. **Cross-family**: Cannot create task for other family's event
5. **Assigned user**: Task assignment validation

**Manual Testing Checklist:**
- [ ] Zaloguj się jako użytkownik
- [ ] Utwórz event z participants
- [ ] Wygeneruj AI suggestions
- [ ] Kliknij "Accept" na sugestię
- [ ] Zweryfikuj że task został utworzony z `created_from_suggestion = true`
- [ ] Sprawdź task list - nowe zadanie jest visible
- [ ] Spróbuj zaakceptować sugestię z eventu innej rodziny - expect 403
- [ ] Spróbuj zaakceptować sugestię z private eventu innego użytkownika - expect 403
- [ ] Zweryfikuj że analytics metrics są updated

---

### Krok 9: Dokumentacja

**Pliki do aktualizacji:**

1. **.ai/api-plan.md** - Dodaj status "COMPLETED" dla endpointu
2. **docs/api/tasks.md** - Dodaj dokumentację API
3. **CHANGELOG.md** - Dodaj entry dla nowej funkcjonalności
4. **README.md** - Zaktualizuj features list

**Weryfikacja:**
- [ ] Dokumentacja jest complete i accurate
- [ ] API examples są tested
- [ ] CHANGELOG jest updated
- [ ] README odzwierciedla new feature

---

### Krok 10: Deployment Checklist

**Pre-deployment:**
- [ ] Wszystkie testy passed (unit, integration, E2E)
- [ ] Code review completed
- [ ] TypeScript kompiluje się bez errors
- [ ] Linter passed bez warnings
- [ ] Performance metrics są acceptable (< 300ms p95)
- [ ] Security scan passed
- [ ] Database migrations (if any) są prepared

**Deployment Steps:**
1. Merge PR do main branch
2. Run CI/CD pipeline
3. Deploy do staging environment
4. Run smoke tests
5. Deploy do production
6. Monitor logs i metrics
7. Verify functionality w production

**Post-deployment:**
- [ ] Monitor error rates
- [ ] Check response times
- [ ] Verify analytics tracking
- [ ] Collect user feedback
- [ ] Update sprint board

---

## 10. Podsumowanie

Endpoint **POST /tasks/from-suggestion** jest kluczowym elementem feature'u AI-generated task suggestions, umożliwiając użytkownikom akceptowanie pojedynczych sugestii po utworzeniu eventu. 

**Kluczowe punkty:**
- ✅ Separate endpoint od POST /tasks dla lepszej separacji concerns
- ✅ Analytics flag `created_from_suggestion = true` dla metrics
- ✅ Comprehensive validation (event, family boundary, privacy)
- ✅ Strong security (RLS policies, JWT auth, family isolation)
- ✅ Performance optimized (indexed queries, < 300ms target)
- ✅ User-friendly error messages i clear documentation

**Next Steps:**
1. Implementuj zgodnie z krokami w sekcji 9
2. Testuj thoroughly (unit, integration, E2E)
3. Review z zespołem przed deployment
4. Monitor metrics po deployment (conversion rate, response times)
5. Iterate based on user feedback

**Related Endpoints:**
- `POST /events` - Bulk suggestion acceptance
- `GET /tasks` - List tasks with filtering
- `POST /tasks` - Manual task creation
- Edge Function: `analyze-event-for-suggestions` - AI suggestions generation

---

**Dokument wersja:** 1.0  
**Data utworzenia:** 2026-01-29  
**Autor:** AI Assistant  
**Status:** Ready for Implementation
