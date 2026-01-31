# GET /tasks - Endpoint Documentation

## ✅ Status Weryfikacji Bazy Danych

### Sprawdzone Komponenty

#### 1. Struktura Tabeli `tasks` ✅
**Plik:** `supabase/migrations/20260102120003_create_task_tables.sql`

Tabela zawiera wszystkie wymagane kolumny:
- `id` (UUID, primary key)
- `family_id` (UUID, denormalized dla RLS)
- `created_by`, `assigned_to`, `completed_by` (UUID references profiles)
- `title` (text, not null, min length > 0)
- `due_date` (timestamptz, nullable)
- `is_completed` (boolean, default false)
- `completed_at` (timestamptz)
- `is_private` (boolean, default false)
- `event_id` (UUID, nullable - dla AI tasks)
- `suggestion_id` (text - identyfikator reguły AI)
- `created_from_suggestion` (boolean - analytics flag)
- `created_at`, `updated_at`, `archived_at` (timestamptz)

**Ocena:** ✅ Pełna zgodność z wymogami API

#### 2. Indeksy Wydajnościowe ✅
**Pliki:** 
- `20260102120003_create_task_tables.sql`
- `20260129120000_add_tasks_performance_indexes.sql`

Utworzone indeksy:
```sql
-- Główny filtr rodziny i statusu ukończenia
idx_tasks_family_completed ON tasks(family_id, is_completed) 
  WHERE archived_at IS NULL

-- "My tasks" - zadania przypisane do mnie
idx_tasks_assigned_to ON tasks(assigned_to) 
  WHERE is_completed = false AND archived_at IS NULL

-- Zadania z konkretnego eventu
idx_tasks_event_id ON tasks(event_id)

-- Sortowanie po terminie
idx_tasks_due_date ON tasks(due_date) 
  WHERE archived_at IS NULL AND is_completed = false

-- Sortowanie rodzina + termin (DESC)
idx_tasks_family_due ON tasks(family_id, due_date DESC) 
  WHERE is_completed = false AND archived_at IS NULL

-- RLS performance boost
idx_tasks_family_id ON tasks(family_id)
```

**Ocena:** ✅ Doskonałe pokrycie wszystkich głównych use cases

**Rekomendacje dodatkowe** (opcjonalne, dla bardzo dużych zbiorów):
```sql
-- Sortowanie ASC z NULLS LAST (jeśli występują problemy z wydajnością)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_asc_nulls_last 
  ON tasks(family_id, due_date ASC NULLS LAST) 
  WHERE archived_at IS NULL;

-- Composite dla filtrowania assigned_to + is_completed
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_completed 
  ON tasks(assigned_to, is_completed, due_date) 
  WHERE archived_at IS NULL;
```

#### 3. Polityki RLS (Row Level Security) ✅
**Plik:** `supabase/migrations/20260102120006_enable_rls_policies.sql`

##### SELECT Policies
```sql
-- Wspólne zadania (is_private = false)
CREATE POLICY tasks_select_shared_authenticated ON tasks
  FOR SELECT TO authenticated
  USING (
    family_id::text = auth.jwt() ->> 'family_id'
    AND is_private = false
    AND archived_at IS NULL
  );

-- Prywatne zadania (is_private = true, tylko twórca)
CREATE POLICY tasks_select_own_private_authenticated ON tasks
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    AND is_private = true
    AND archived_at IS NULL
  );
```

**Ocena:** ✅ Bezpieczne, automatyczne filtrowanie per rodzina i prywatność

##### INSERT Policy
```sql
CREATE POLICY tasks_insert_authenticated ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id::text = auth.jwt() ->> 'family_id'
    AND created_by = auth.uid()
  );
```

**Ocena:** ✅ Wymusza poprawny family_id i created_by

##### UPDATE Policy
```sql
CREATE POLICY tasks_update_own_authenticated ON tasks
  FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() OR assigned_to = auth.uid())
    AND archived_at IS NULL
  );
```

**Ocena:** ✅ Twórca i assignee mogą edytować

##### DELETE Policy
```sql
CREATE POLICY tasks_delete_own_authenticated ON tasks
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
```

**Ocena:** ✅ Tylko twórca może usunąć (soft delete via archived_at)

---

## 📚 Dokumentacja Endpoint

### Przegląd

**Endpoint:** `GET /tasks`  
**Autentykacja:** Bearer Token (JWT) - **Wymagana**  
**Opis:** Pobiera listę zadań dla rodziny aktualnie zalogowanego użytkownika z zaawansowanym filtrowaniem, sortowaniem i paginacją.

**Główne funkcje:**
- ✅ Automatyczne filtrowanie przez RLS (family_id, is_private)
- ✅ 9 opcjonalnych parametrów zapytania
- ✅ Denormalizacja danych (display names, event titles)
- ✅ Paginacja z metadanymi (total, has_more)
- ✅ 3 opcje sortowania
- ✅ Wykluczenie zarchiwizowanych zadań

---

### Request

#### URL Structure
```
GET https://api.homehq.com/tasks?assigned_to=me&is_completed=false&limit=50
```

#### Headers
```http
Authorization: Bearer {access_token}
```

#### Query Parameters

| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `is_completed` | boolean | Nie | - | `true` lub `false` | Filtruj według statusu ukończenia |
| `is_private` | boolean | Nie | - | `true` lub `false` | Filtruj według widoczności (RLS nadal obowiązuje) |
| `assigned_to` | string | Nie | - | UUID lub `"me"` | Filtruj według osoby przypisanej. `"me"` = aktualny użytkownik |
| `due_before` | string | Nie | - | ISO 8601 datetime | Zadania z terminem przed tą datą (włącznie) |
| `due_after` | string | Nie | - | ISO 8601 datetime | Zadania z terminem po tej dacie (włącznie) |
| `event_id` | string | Nie | - | UUID | Zadania powiązane z konkretnym wydarzeniem |
| `limit` | integer | Nie | 100 | 1-500 | Maksymalna liczba zwracanych zadań |
| `offset` | integer | Nie | 0 | ≥ 0 | Liczba zadań do pominięcia (dla paginacji) |
| `sort` | string | Nie | `due_date_asc` | Enum (patrz poniżej) | Opcja sortowania |

**Opcje sortowania (`sort`):**
- `due_date_asc` - Zadania z najbliższym terminem pierwsze (NULL na końcu)
- `due_date_desc` - Zadania z najpóźniejszym terminem pierwsze (NULL na końcu)
- `created_at_desc` - Najnowsze zadania pierwsze

#### Request Examples

**1. Wszystkie moje niezakończone zadania:**
```bash
curl -X GET "https://api.homehq.com/tasks?assigned_to=me&is_completed=false" \
  -H "Authorization: Bearer {access_token}"
```

**2. Zadania do zrobienia w następnym tygodniu:**
```bash
curl -X GET "https://api.homehq.com/tasks?is_completed=false&due_after=2026-01-29T00:00:00Z&due_before=2026-02-05T23:59:59Z" \
  -H "Authorization: Bearer {access_token}"
```

**3. Wszystkie zadania z konkretnego wydarzenia:**
```bash
curl -X GET "https://api.homehq.com/tasks?event_id=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer {access_token}"
```

**4. Stronicowanie - druga strona (50 na stronę):**
```bash
curl -X GET "https://api.homehq.com/tasks?limit=50&offset=50&sort=created_at_desc" \
  -H "Authorization: Bearer {access_token}"
```

---

### Response

#### Success Response (200 OK)

**Structure:**
```typescript
{
  tasks: TaskWithDetails[];
  pagination: PaginationMeta;
}
```

**Full Example:**
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
      "title": "Buy groceries for dinner",
      "due_date": "2026-02-05T18:00:00Z",
      "is_completed": false,
      "completed_at": null,
      "completed_by": null,
      "completed_by_name": null,
      "is_private": false,
      "event_id": "e1234567-89ab-cdef-0123-456789abcdef",
      "event_title": "Family Dinner",
      "suggestion_id": null,
      "created_from_suggestion": false,
      "created_at": "2026-01-29T12:00:00Z",
      "updated_at": "2026-01-29T12:00:00Z",
      "archived_at": null
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "family_id": "f1234567-89ab-cdef-0123-456789abcdef",
      "created_by": "u9876543-21ba-fedc-3210-fedcba987654",
      "created_by_name": "Jane Smith",
      "assigned_to": "u1234567-89ab-cdef-0123-456789abcdef",
      "assigned_to_name": "John Smith",
      "title": "Book babysitter for Saturday",
      "due_date": "2026-02-01T20:00:00Z",
      "is_completed": false,
      "completed_at": null,
      "completed_by": null,
      "completed_by_name": null,
      "is_private": false,
      "event_id": "e2234567-89ab-cdef-0123-456789abcdef",
      "event_title": "Anniversary Celebration",
      "suggestion_id": "outing",
      "created_from_suggestion": true,
      "created_at": "2026-01-28T10:30:00Z",
      "updated_at": "2026-01-28T10:30:00Z",
      "archived_at": null
    }
  ],
  "pagination": {
    "total": 47,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

#### Empty Result (200 OK)
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

#### Error Responses

**400 Bad Request - Invalid Query Parameters**
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

**401 Unauthorized - Missing or Invalid Token**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

**500 Internal Server Error**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred while fetching tasks"
  }
}
```

---

## 💻 Przykłady Użycia

### React Component z Hook

```typescript
import { useTasks } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';

export function MyTasksList() {
  const { tasks, pagination, isLoading, error, refetch } = useTasks({
    assigned_to: 'me',
    is_completed: false,
    sort: 'due_date_asc',
    limit: 50
  });

  if (isLoading) {
    return <div>Loading tasks...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          My Tasks ({pagination?.total || 0})
        </h2>
        <button onClick={refetch} className="btn-primary">
          Refresh
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-gray-500">No tasks assigned to you</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
      )}

      {pagination?.has_more && (
        <button className="btn-secondary">
          Load more
        </button>
      )}
    </div>
  );
}
```

### Hook z Paginacją

```typescript
import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';

export function PaginatedTasksList() {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { tasks, pagination, isLoading } = useTasks({
    is_completed: false,
    limit: pageSize,
    offset: page * pageSize,
    sort: 'due_date_asc'
  });

  const totalPages = pagination 
    ? Math.ceil(pagination.total / pageSize) 
    : 0;

  return (
    <div>
      {/* Task list */}
      <ul>
        {tasks.map(task => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>

      {/* Pagination controls */}
      <div className="flex gap-2 mt-4">
        <button 
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </button>
        
        <span>
          Page {page + 1} of {totalPages}
        </span>
        
        <button 
          onClick={() => setPage(p => p + 1)}
          disabled={!pagination?.has_more}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### Filtrowanie z Formularzem

```typescript
import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';

export function TaskFilterView() {
  const [filters, setFilters] = useState({
    is_completed: false,
    assigned_to: 'me' as string,
    sort: 'due_date_asc' as const
  });

  const { tasks, isLoading } = useTasks(filters);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 space-x-2">
        <select
          value={filters.assigned_to}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            assigned_to: e.target.value 
          }))}
        >
          <option value="me">My Tasks</option>
          <option value="">All Tasks</option>
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            sort: e.target.value as any 
          }))}
        >
          <option value="due_date_asc">Due Date (Soonest)</option>
          <option value="due_date_desc">Due Date (Latest)</option>
          <option value="created_at_desc">Recently Created</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={filters.is_completed}
            onChange={(e) => setFilters(f => ({ 
              ...f, 
              is_completed: e.target.checked 
            }))}
          />
          Show Completed
        </label>
      </div>

      {/* Task list */}
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {tasks.map(task => (
            <li key={task.id}>
              {task.title} - {task.assigned_to_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Bezpośrednie Wywołanie Service

```typescript
import { createClient } from '@/db/supabase.client';
import { createTasksService } from '@/services/tasks.service';

async function fetchUpcomingTasks() {
  const supabase = createClient();
  
  // Authenticate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get user's family_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();
  
  if (!profile) throw new Error('Profile not found');

  // Fetch tasks
  const tasksService = createTasksService(supabase);
  const result = await tasksService.listTasks(
    {
      is_completed: false,
      due_after: new Date().toISOString(),
      due_before: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      sort: 'due_date_asc',
      limit: 100,
      offset: 0
    },
    user.id,
    profile.family_id
  );

  return result;
}
```

---

## 🔒 Bezpieczeństwo

### 1. Autentykacja
- **Mechanizm:** Bearer Token (JWT) z Supabase Auth
- **Wymagane:** Token musi być obecny w nagłówku `Authorization`
- **Walidacja:** Token jest weryfikowany przy każdym żądaniu
- **User Context:** `auth.uid()` ekstrahowany z JWT

### 2. Autoryzacja (RLS)
- **Family Isolation:** Użytkownik widzi tylko zadania ze swojej rodziny
- **Privacy Model:**
  - Wspólne zadania (`is_private=false`) → wszyscy członkowie rodziny
  - Prywatne zadania (`is_private=true`) → tylko twórca
- **Enforcement:** RLS policies działają na poziomie bazy danych (nie można ominąć)

### 3. Walidacja Danych Wejściowych
- **Schema:** Zod (`getTasksQuerySchema`)
- **Validations:**
  - UUID format dla `assigned_to`, `event_id`
  - ISO 8601 format dla `due_before`, `due_after`
  - Boolean transformation dla `is_completed`, `is_private`
  - Range constraints dla `limit` (1-500), `offset` (≥0)
  - Enum validation dla `sort`
- **Protection:** SQL Injection, Type Confusion, Buffer Overflow

### 4. Dane Wrażliwe
**NIE eksponowane:**
- Pełne dane użytkowników (tylko `display_name`)

**Eksponowane:**
- `family_id` - dla zachowania spójności z innymi endpointami
- `id` - potrzebne do edycji/szczegółów
- `created_by`, `assigned_to`, `completed_by` - UUIDs dla logiki aplikacji
- Display names - publicznie dostępne w rodzinie

### 5. Rate Limiting (Rekomendacja)
```typescript
// Przykładowa implementacja (do dodania na poziomie API Gateway)
const RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60000 // 1 minuta
};
```

---

## 🧪 Testy

### Unit Tests - TasksService

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TasksService } from '@/services/tasks.service';

describe('TasksService.listTasks', () => {
  it('should apply is_completed filter', async () => {
    const mockSupabase = createMockSupabase();
    const service = new TasksService(mockSupabase);

    await service.listTasks(
      { is_completed: false, limit: 100, offset: 0, sort: 'due_date_asc' },
      'user-123',
      'family-456'
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
    expect(mockSupabase.eq).toHaveBeenCalledWith('is_completed', false);
  });

  it('should transform "me" to user ID', async () => {
    const mockSupabase = createMockSupabase();
    const service = new TasksService(mockSupabase);

    await service.listTasks(
      { assigned_to: 'me', limit: 100, offset: 0, sort: 'due_date_asc' },
      'user-789',
      'family-456'
    );

    expect(mockSupabase.eq).toHaveBeenCalledWith('assigned_to', 'user-789');
  });

  it('should calculate has_more correctly', async () => {
    const mockSupabase = createMockSupabase({
      data: new Array(50).fill({}),
      count: 150
    });
    const service = new TasksService(mockSupabase);

    const result = await service.listTasks(
      { limit: 50, offset: 0, sort: 'due_date_asc' },
      'user-123',
      'family-456'
    );

    expect(result.pagination.has_more).toBe(true);
    expect(result.pagination.total).toBe(150);
  });
});
```

### Integration Tests

```typescript
describe('GET /tasks - Integration', () => {
  it('should return 401 without auth token', async () => {
    const response = await fetch('/tasks');
    expect(response.status).toBe(401);
  });

  it('should filter by family_id automatically (RLS)', async () => {
    const user1Tasks = await fetchTasksAsUser('user-1'); // family A
    const user2Tasks = await fetchTasksAsUser('user-2'); // family B

    expect(user1Tasks.tasks).not.toEqual(user2Tasks.tasks);
  });

  it('should hide private tasks from other users', async () => {
    // User A creates private task
    await createTask({ title: 'Private', is_private: true }, 'user-A');

    // User B (same family) shouldn't see it
    const tasksForUserB = await fetchTasksAsUser('user-B');
    const privateTask = tasksForUserB.tasks.find(t => t.title === 'Private');
    
    expect(privateTask).toBeUndefined();
  });
});
```

### E2E Test Scenarios

```typescript
describe('Tasks E2E', () => {
  it('should handle complete task workflow', async () => {
    // 1. Create task
    const created = await createTask({
      title: 'Test Task',
      due_date: '2026-02-01T12:00:00Z',
      assigned_to: userId,
      is_private: false
    });

    // 2. Verify it appears in list
    const { tasks } = await getTasks({ assigned_to: 'me' });
    expect(tasks.find(t => t.id === created.id)).toBeDefined();

    // 3. Complete task
    await updateTaskCompletion(created.id, true);

    // 4. Verify it's filtered out when is_completed=false
    const { tasks: incompleteTasks } = await getTasks({ 
      is_completed: false 
    });
    expect(incompleteTasks.find(t => t.id === created.id)).toBeUndefined();
  });
});
```

---

## 📊 Metryki Wydajności

### Target Performance

| Metryka | Target | Max Acceptable |
|---------|--------|----------------|
| Response Time (p50) | < 200ms | < 500ms |
| Response Time (p95) | < 500ms | < 1000ms |
| Response Time (p99) | < 1000ms | < 2000ms |
| Database Query Time | < 100ms | < 300ms |
| Payload Size | < 50KB | < 200KB |

### Monitoring Queries

```sql
-- Query performance analysis
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE family_id = 'uuid'
  AND is_completed = false
  AND archived_at IS NULL
ORDER BY due_date ASC NULLS LAST
LIMIT 100;

-- Index usage check
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'tasks'
ORDER BY idx_scan DESC;
```

---

## 🚀 Future Enhancements

### Short-term
- [ ] Bulk operations (mark all as completed)
- [ ] Full-text search w tytułach zadań
- [ ] Export do CSV/PDF

### Medium-term
- [ ] Real-time updates (WebSocket/Supabase Realtime)
- [ ] Filtering presets (zapisywanie ulubionych filtrów)
- [ ] Task templates

### Long-term
- [ ] Advanced analytics dashboard
- [ ] Recurring tasks (daily, weekly, monthly)
- [ ] Task dependencies (blocked by)

---

## 📝 Changelog

### 2026-01-29 - Initial Release
- ✅ GET /tasks endpoint implemented
- ✅ Comprehensive filtering (9 parameters)
- ✅ Pagination with metadata
- ✅ RLS policies active
- ✅ Performance indexes created
- ✅ React hooks (useTasks) available
- ✅ Full documentation

---

## 🆘 Support & Troubleshooting

### Common Issues

**Problem:** Tasks nie pojawiają się w liście  
**Solution:** Sprawdź RLS policies - czy user ma `family_id` w JWT? Czy zadania nie są `archived_at IS NOT NULL`?

**Problem:** Wolne zapytania przy dużej liczbie zadań  
**Solution:** Sprawdź EXPLAIN ANALYZE - czy używa odpowiednich indeksów? Rozważ zwiększenie `shared_buffers` w Postgres.

**Problem:** Pagination nie działa poprawnie  
**Solution:** Upewnij się, że `offset` i `limit` są poprawnie obliczone. `has_more = (offset + limit) < total`

### Debug Queries

```sql
-- Check user's family_id
SELECT id, family_id, display_name, role 
FROM profiles 
WHERE id = auth.uid();

-- Check visible tasks for current user
SELECT id, title, is_private, created_by, family_id
FROM tasks
WHERE archived_at IS NULL
  AND (
    (is_private = false AND family_id::text = auth.jwt() ->> 'family_id')
    OR
    (is_private = true AND created_by = auth.uid())
  );

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE tablename = 'tasks';
```

---

**Ostatnia aktualizacja:** 2026-01-29  
**Wersja:** 1.0.0  
**Status:** ✅ Production Ready
