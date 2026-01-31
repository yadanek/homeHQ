# API Endpoint Implementation Plan: POST /tasks

## 1. Przegląd punktu końcowego

Endpoint **POST /tasks** umożliwia uwierzytelnionym użytkownikom tworzenie nowych ręcznych zadań (nie wygenerowanych przez AI) w kontekście ich rodziny. Zadanie może być przypisane do dowolnego członka rodziny oraz może mieć opcjonalny termin wykonania. System automatycznie:
- Przypisuje `family_id` z JWT metadata użytkownika
- Ustawia `created_by` na ID aktualnego użytkownika
- Ustawia `event_id = NULL` i `created_from_suggestion = false` (typowe dla zadań ręcznych)

**Główne przypadki użycia:**
- Rodzic tworzy listę zakupów dla współmałżonka
- Administrator przypisuje zadania domowe do dzieci
- Użytkownik tworzy osobistą przypominkę (is_private = true)

---

## 2. Szczegóły żądania

### Metoda HTTP
```
POST /tasks
```

### Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Struktura URL
```
/tasks
```
Brak parametrów URL ani query params.

### Request Body

```typescript
{
  "title": string,           // Wymagane: tytuł zadania (nie może być pusty po trim)
  "due_date"?: string,       // Opcjonalne: termin w formacie ISO 8601
  "assigned_to"?: string,    // Opcjonalne: UUID profilu (musi być w tej samej rodzinie)
  "is_private": boolean      // Wymagane: czy zadanie jest prywatne
}
```

**Przykład żądania:**
```json
{
  "title": "Buy groceries",
  "due_date": "2026-01-05T18:00:00Z",
  "assigned_to": "550e8400-e29b-41d4-a716-446655440000",
  "is_private": false
}
```

### Parametry

**Wymagane:**
- `title` (string): Tytuł zadania, min. 1 znak po trimming
- `is_private` (boolean): Flaga prywatności zadania

**Opcjonalne:**
- `due_date` (string | null): Termin wykonania w ISO 8601 timestamp
- `assigned_to` (string | null): UUID profilu użytkownika z tej samej rodziny

---

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

```typescript
// Request
import type { CreateTaskRequest } from '@/types';
// = Pick<TablesInsert<'tasks'>, 'title' | 'due_date' | 'assigned_to' | 'is_private'>

// Response
import type { TaskResponse } from '@/types';
// = Tables<'tasks'>

// Error
import type { ApiError } from '@/types';
```

### Zod Schema (walidacja)

```typescript
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty"),
  due_date: z
    .string()
    .datetime({ message: "Invalid date format. Expected ISO 8601" })
    .optional()
    .nullable(),
  assigned_to: z
    .string()
    .uuid({ message: "Invalid UUID format for assigned_to" })
    .optional()
    .nullable(),
  is_private: z
    .boolean({ required_error: "is_private is required" })
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

### Database Types

Z `database.types.ts`:
```typescript
TablesInsert<'tasks'> // Typ dla INSERT do tabeli tasks
Tables<'tasks'>        // Typ pełnego rekordu tasks
```

---

## 4. Szczegóły odpowiedzi

### Sukces (201 Created)

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

### Błędy

**400 Bad Request - Walidacja**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": {
      "field": "title",
      "value": ""
    }
  }
}
```

**401 Unauthorized**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token"
  }
}
```

**403 Forbidden**
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

**500 Internal Server Error**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## 5. Przepływ danych

### Diagram przepływu

```
Client (React Component)
    ↓ [Form Submit]
React 19 Action (createTaskAction)
    ↓ [Zod Validation]
Tasks Service (tasksService.ts)
    ↓ [Business Logic + Family Check]
Supabase Client
    ↓ [RLS Check: auth.uid() + family_id]
PostgreSQL Database (tasks table)
    ↓ [INSERT with generated fields]
Return TaskResponse
    ↓ [Success 201]
Client (Update UI / Optimistic UI)
```

### Krok po kroku

1. **Frontend Form Submit**
   - Użytkownik wypełnia formularz i klika "Create Task"
   - React 19 Action (`createTaskAction`) jest wywoływana z danymi formularza

2. **Walidacja Input (Zod)**
   - Schema `createTaskSchema` waliduje dane wejściowe
   - Jeśli walidacja fail → zwróć 400 z szczegółami błędu
   - Jeśli success → przejdź dalej

3. **Ekstrakcja JWT Metadata**
   - Pobierz `user.id` z `auth.getUser()`
   - Pobierz `family_id` z `profiles` table dla `user.id`
   - Jeśli brak profilu → zwróć 403 "User profile not found"

4. **Walidacja Biznesowa (assigned_to)**
   - Jeśli `assigned_to` jest podane:
     - Query: `SELECT family_id FROM profiles WHERE id = assigned_to`
     - Sprawdź czy `family_id` zgadza się z rodziną użytkownika
     - Jeśli nie → zwróć 403 "Cannot assign task to user outside your family"

5. **Konstrukcja obiektu INSERT**
   ```typescript
   const taskData: TablesInsert<'tasks'> = {
     family_id: userFamilyId,
     created_by: userId,
     title: validatedData.title,
     due_date: validatedData.due_date || null,
     assigned_to: validatedData.assigned_to || null,
     is_private: validatedData.is_private,
     event_id: null,
     suggestion_id: null,
     created_from_suggestion: false
   };
   ```

6. **Insert do bazy danych**
   ```typescript
   const { data, error } = await supabase
     .from('tasks')
     .insert(taskData)
     .select()
     .single();
   ```

7. **RLS Policy Check (automatyczny)**
   - Supabase sprawdza RLS policy dla INSERT:
     - `auth.uid() = created_by`
     - `family_id` w tasks = `family_id` w profile użytkownika
   - Jeśli fail → PostgreSQL zwróci błąd, tłumaczymy na 403

8. **Zwrot odpowiedzi**
   - Success: 201 Created z pełnym obiektem `TaskResponse`
   - Error: odpowiedni kod statusu z `ApiError`

### Interakcje z bazą danych

**Główne zapytanie:**
```sql
INSERT INTO tasks (
  family_id, created_by, title, due_date, 
  assigned_to, is_private, event_id, 
  suggestion_id, created_from_suggestion
) VALUES (
  $1, $2, $3, $4, $5, $6, NULL, NULL, false
) RETURNING *;
```

**Pomocnicze zapytanie (walidacja assigned_to):**
```sql
SELECT family_id FROM profiles WHERE id = $1;
```

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie (Authentication)

- **JWT Bearer Token** jest wymagany w nagłówku `Authorization`
- Token musi być ważny (nie wygasły)
- Supabase automatycznie weryfikuje token i ustawia `auth.uid()`

**Implementacja:**
```typescript
// W React 19 Action lub API route
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return {
    error: {
      code: "UNAUTHORIZED",
      message: "Missing or invalid authorization token"
    }
  };
}
```

### 6.2. Autoryzacja (Authorization)

**Row Level Security (RLS) Policies:**

Tabela `tasks` musi mieć następujące RLS policies:

```sql
-- Policy dla INSERT
CREATE POLICY "Users can create tasks in their family"
ON tasks
FOR INSERT
TO authenticated
WITH CHECK (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
  AND created_by = auth.uid()
);
```

**Dodatkowa walidacja biznesowa:**
- Sprawdzenie czy `assigned_to` (jeśli podane) należy do tej samej rodziny
- To NIE jest egzekwowane przez RLS, musi być w logice aplikacji

### 6.3. Walidacja danych wejściowych

**Ochrona przed atakami:**
- **SQL Injection**: Mitigowane przez Supabase parametryzowane zapytania
- **XSS**: Sanityzacja przez Zod `.trim()` i walidacja typów
- **Type Coercion Attacks**: Ścisłe typy TypeScript + Zod

**Zod Schema zapewnia:**
- Type safety
- Trimming białych znaków
- Walidację formatów (UUID, ISO 8601)
- Wymagalność pól

### 6.4. Izolacja rodzin

**Krytyczne:** System MUSI zapobiegać:
- Tworzeniu zadań w obcych rodzinach
- Przypisywaniu zadań do użytkowników z innych rodzin
- Odczytywaniu zadań z innych rodzin

**Mechanizmy ochrony:**
1. `family_id` automatycznie z profilu użytkownika (nie z inputu)
2. RLS policy sprawdza zgodność `family_id`
3. Walidacja `assigned_to` w logice biznesowej

### 6.5. Prywatność zadań

- Pole `is_private` kontroluje widoczność zadania
- RLS policy dla SELECT musi respektować `is_private`:
  - Admin widzi wszystkie zadania rodziny
  - Member widzi tylko publiczne zadania + swoje prywatne

---

## 7. Obsługa błędów

### 7.1. Katalog błędów

| Kod | Typ błędu | Komunikat | Kiedy występuje |
|-----|-----------|-----------|-----------------|
| 400 | VALIDATION_ERROR | "Title is required" | Pole `title` jest puste lub brak |
| 400 | VALIDATION_ERROR | "Invalid date format. Expected ISO 8601" | `due_date` nie jest ISO 8601 |
| 400 | VALIDATION_ERROR | "Invalid UUID format for assigned_to" | `assigned_to` nie jest UUID |
| 401 | UNAUTHORIZED | "Missing or invalid authorization token" | Brak/nieprawidłowy JWT |
| 403 | FORBIDDEN | "User profile not found" | Użytkownik nie ma profilu |
| 403 | FORBIDDEN | "Cannot assign task to user outside your family" | `assigned_to` z innej rodziny |
| 403 | FORBIDDEN | "RLS policy violation" | RLS policy blocked INSERT |
| 500 | INTERNAL_ERROR | "An unexpected error occurred" | Błąd bazy danych lub serwera |

### 7.2. Struktura obsługi błędów

```typescript
// W tasksService.ts
export async function createTask(
  input: CreateTaskInput
): Promise<{ data?: TaskResponse; error?: ApiError }> {
  
  // 1. Walidacja Zod
  const validationResult = createTaskSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: validationResult.error.errors[0].message,
        details: { issues: validationResult.error.errors }
      }
    };
  }

  // 2. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid authorization token"
      }
    };
  }

  // 3. Get user's family_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      error: {
        code: "FORBIDDEN",
        message: "User profile not found"
      }
    };
  }

  // 4. Validate assigned_to (if provided)
  if (validationResult.data.assigned_to) {
    const { data: assignedProfile, error: assignedError } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', validationResult.data.assigned_to)
      .single();

    if (assignedError || !assignedProfile) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "Assigned user not found",
          details: { assigned_to: validationResult.data.assigned_to }
        }
      };
    }

    if (assignedProfile.family_id !== profile.family_id) {
      return {
        error: {
          code: "FORBIDDEN",
          message: "Cannot assign task to user outside your family",
          details: { assigned_to: validationResult.data.assigned_to }
        }
      };
    }
  }

  // 5. Insert task
  const taskData: TablesInsert<'tasks'> = {
    family_id: profile.family_id,
    created_by: user.id,
    title: validationResult.data.title,
    due_date: validationResult.data.due_date || null,
    assigned_to: validationResult.data.assigned_to || null,
    is_private: validationResult.data.is_private,
    event_id: null,
    suggestion_id: null,
    created_from_suggestion: false
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('Database error creating task:', error);
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        details: { dbError: error.message }
      }
    };
  }

  return { data };
}
```

### 7.3. Error Logging

- **Console errors** dla błędów serwera (500)
- **Szczegółowe logi** w Supabase Dashboard
- **User-friendly messages** zwracane do klienta
- **Nie ujawniać** szczegółów implementacji w komunikatach błędów

---

## 8. Rozważania dotyczące wydajności

### 8.1. Potencjalne wąskie gardła

1. **Walidacja assigned_to**
   - Wymaga dodatkowego query do `profiles`
   - Może być wąskie gardło jeśli często używane

2. **RLS Policy Evaluation**
   - Supabase sprawdza policy przy każdym INSERT
   - Subquery do `profiles` dla `family_id`

3. **Indexy bazy danych**
   - `profiles.id` (PK) - już zindeksowany
   - `profiles.family_id` - może wymagać indexu
   - `tasks.family_id` - może wymagać indexu

### 8.2. Strategie optymalizacji

**Optymalizacja 1: Cache family_id w JWT**
```typescript
// Zamiast query do profiles, użyj metadata z JWT
const familyId = user.user_metadata?.family_id;
```
⚠️ Uwaga: wymaga aktualizacji JWT metadata przy tworzeniu profilu

**Optymalizacja 2: Index na profiles.family_id**
```sql
CREATE INDEX idx_profiles_family_id ON profiles(family_id);
```

**Optymalizacja 3: Combined query dla assigned_to check**
```typescript
// Zamiast dwóch osobnych zapytań, użyj jednego:
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, family_id')
  .in('id', [user.id, assignedToId]);
// Porównaj family_id w pamięci
```

**Optymalizacja 4: React 19 Optimistic UI**
```typescript
// W komponencie React
const [optimisticTasks, addOptimisticTask] = useOptimistic(
  tasks,
  (state, newTask) => [...state, newTask]
);

// Przy submit formularza
const handleSubmit = async (formData) => {
  // 1. Natychmiast update UI
  addOptimisticTask({
    id: crypto.randomUUID(),
    ...formData,
    created_at: new Date().toISOString()
  });

  // 2. Wyślij request
  const result = await createTaskAction(formData);
  
  // 3. React automatycznie sync po otrzymaniu odpowiedzi
};
```

### 8.3. Metryki wydajności (target)

- **Response time**: < 200ms (p95)
- **Database query time**: < 50ms
- **Validation time**: < 10ms
- **Concurrent requests**: 100+ req/s (z connection pooling)

### 8.4. Monitoring

**Kluczowe metryki:**
- Czas odpowiedzi endpoint
- Liczba błędów 500
- Liczba błędów walidacji (400/403)
- Database connection pool usage

**Narzędzia:**
- Supabase Dashboard (query analytics)
- Application logs (console.time/timeEnd)
- Error tracking (np. Sentry)

---

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie typów i schematów

**Plik: `src/schemas/taskSchemas.ts`** (nowy)
```typescript
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  due_date: z.string().datetime().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  is_private: z.boolean()
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

**Weryfikacja:**
- [ ] Typy poprawnie importowane z `database.types.ts`
- [ ] Schema kompiluje się bez błędów TypeScript

---

### Krok 2: Implementacja serwisu zadań

**Plik: `src/services/tasksService.ts`** (nowy lub rozszerzenie istniejącego)

```typescript
import { createTaskSchema, type CreateTaskInput } from '@/schemas/taskSchemas';
import type { TaskResponse, ApiError } from '@/types';
import type { TablesInsert } from '@/db/database.types';
import { supabase } from '@/db/supabase.client';

export async function createTask(
  input: CreateTaskInput
): Promise<{ data?: TaskResponse; error?: ApiError }> {
  
  // 1. Walidacja Zod
  const validationResult = createTaskSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: validationResult.error.errors[0].message,
        details: { issues: validationResult.error.errors }
      }
    };
  }

  const validatedData = validationResult.data;

  // 2. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid authorization token"
      }
    };
  }

  // 3. Get user's family_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile fetch error:', profileError);
    return {
      error: {
        code: "FORBIDDEN",
        message: "User profile not found"
      }
    };
  }

  // 4. Validate assigned_to (if provided)
  if (validatedData.assigned_to) {
    const { data: assignedProfile, error: assignedError } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', validatedData.assigned_to)
      .single();

    if (assignedError || !assignedProfile) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "Assigned user not found",
          details: { assigned_to: validatedData.assigned_to }
        }
      };
    }

    if (assignedProfile.family_id !== profile.family_id) {
      return {
        error: {
          code: "FORBIDDEN",
          message: "Cannot assign task to user outside your family",
          details: { assigned_to: validatedData.assigned_to }
        }
      };
    }
  }

  // 5. Prepare task data
  const taskData: TablesInsert<'tasks'> = {
    family_id: profile.family_id,
    created_by: user.id,
    title: validatedData.title,
    due_date: validatedData.due_date || null,
    assigned_to: validatedData.assigned_to || null,
    is_private: validatedData.is_private,
    event_id: null,
    suggestion_id: null,
    created_from_suggestion: false
  };

  // 6. Insert into database
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('Database error creating task:', error);
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        details: process.env.NODE_ENV === 'development' ? { dbError: error.message } : undefined
      }
    };
  }

  return { data };
}
```

**Weryfikacja:**
- [ ] Wszystkie edge cases obsłużone (patrz sekcja 7.2)
- [ ] Error messages są user-friendly
- [ ] Console.error tylko dla błędów serwera
- [ ] Early returns dla wszystkich warunków błędów

---

### Krok 3: Utworzenie React 19 Action

**Plik: `src/actions/taskActions.ts`** (nowy)

```typescript
'use server';

import { createTask } from '@/services/tasksService';
import { revalidatePath } from 'next/cache'; // jeśli używasz Next.js
import type { CreateTaskInput } from '@/schemas/taskSchemas';
import type { TaskResponse, ApiError } from '@/types';

export async function createTaskAction(
  input: CreateTaskInput
): Promise<{ data?: TaskResponse; error?: ApiError }> {
  const result = await createTask(input);

  if (result.data) {
    // Revalidate cache (opcjonalne, zależy od strategii cache)
    // revalidatePath('/tasks');
  }

  return result;
}
```

**Uwaga:** Jeśli nie używasz Next.js App Router, możesz wywołać `createTask` bezpośrednio z komponentu.

**Weryfikacja:**
- [ ] Action poprawnie oznaczone jako 'use server' (jeśli Next.js)
- [ ] Zwraca zgodny typ z serwisem

---

### Krok 4: Implementacja komponentu formularza React

**Plik: `src/components/CreateTaskForm.tsx`** (nowy)

```typescript
'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { useFormStatus } from 'react-dom';
import { createTaskAction } from '@/actions/taskActions';
import type { CreateTaskInput } from '@/schemas/taskSchemas';
import type { TaskResponse } from '@/types';

interface CreateTaskFormProps {
  onSuccess?: (task: TaskResponse) => void;
  familyMembers?: Array<{ id: string; display_name: string }>;
}

export function CreateTaskForm({ onSuccess, familyMembers = [] }: CreateTaskFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const input: CreateTaskInput = {
      title: formData.get('title') as string,
      due_date: formData.get('due_date') as string || null,
      assigned_to: formData.get('assigned_to') as string || null,
      is_private: formData.get('is_private') === 'true'
    };

    startTransition(async () => {
      const result = await createTaskAction(input);

      if (result.error) {
        setError(result.error.message);
      } else if (result.data) {
        onSuccess?.(result.data);
        event.currentTarget.reset();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-800 p-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Task Title *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          className="mt-1 block w-full rounded border-gray-300"
        />
      </div>

      <div>
        <label htmlFor="due_date" className="block text-sm font-medium">
          Due Date
        </label>
        <input
          type="datetime-local"
          id="due_date"
          name="due_date"
          className="mt-1 block w-full rounded border-gray-300"
        />
      </div>

      <div>
        <label htmlFor="assigned_to" className="block text-sm font-medium">
          Assign To
        </label>
        <select
          id="assigned_to"
          name="assigned_to"
          className="mt-1 block w-full rounded border-gray-300"
        >
          <option value="">Unassigned</option>
          {familyMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            name="is_private"
            value="true"
            className="rounded border-gray-300"
          />
          <span className="ml-2 text-sm">Private task</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create Task'}
      </button>
    </form>
  );
}
```

**Weryfikacja:**
- [ ] Formularz używa React 19 useTransition dla non-blocking UI
- [ ] Error handling wyświetla user-friendly messages
- [ ] Disabled state podczas pending
- [ ] Reset formularza po sukcesie

---

### Krok 5: Weryfikacja RLS Policies

**Sprawdź czy istnieją następujące policies na tabeli `tasks`:**

```sql
-- SELECT policy (read)
CREATE POLICY "Users can view tasks in their family"
ON tasks
FOR SELECT
TO authenticated
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    is_private = false 
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);

-- INSERT policy
CREATE POLICY "Users can create tasks in their family"
ON tasks
FOR INSERT
TO authenticated
WITH CHECK (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- UPDATE policy (dla przyszłego endpointa)
CREATE POLICY "Users can update tasks they created or are assigned to"
ON tasks
FOR UPDATE
TO authenticated
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
  AND (created_by = auth.uid() OR assigned_to = auth.uid())
)
WITH CHECK (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
);

-- DELETE policy (dla przyszłego endpointa)
CREATE POLICY "Users can delete tasks they created"
ON tasks
FOR DELETE
TO authenticated
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE id = auth.uid()
  )
  AND created_by = auth.uid()
);
```

**Jeśli policies nie istnieją, utwórz migrację:**

**Plik: `supabase/migrations/YYYYMMDD_tasks_rls_policies.sql`**

```sql
-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies (jak powyżej)
```

**Weryfikacja:**
- [ ] RLS enabled na tabeli tasks
- [ ] Wszystkie 4 policies utworzone (SELECT, INSERT, UPDATE, DELETE)
- [ ] Policies testowane ręcznie w Supabase SQL Editor

---

### Krok 6: Utworzenie indexów dla wydajności

**Plik: `supabase/migrations/YYYYMMDD_tasks_indexes.sql`**

```sql
-- Index dla RLS policy sprawdzającego family_id
CREATE INDEX IF NOT EXISTS idx_tasks_family_id 
ON tasks(family_id);

-- Index dla queries filtrujących po assigned_to
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to 
ON tasks(assigned_to) 
WHERE assigned_to IS NOT NULL;

-- Index dla queries sortujących po due_date
CREATE INDEX IF NOT EXISTS idx_tasks_due_date 
ON tasks(due_date) 
WHERE due_date IS NOT NULL;

-- Index dla queries filtrujących incomplete tasks
CREATE INDEX IF NOT EXISTS idx_tasks_completed 
ON tasks(is_completed, due_date);

-- Composite index dla family tasks queries
CREATE INDEX IF NOT EXISTS idx_tasks_family_due 
ON tasks(family_id, due_date DESC) 
WHERE is_completed = false;
```

**Weryfikacja:**
- [ ] Indexy utworzone bez błędów
- [ ] Query plan pokazuje użycie indexów (`EXPLAIN ANALYZE`)
- [ ] Testowe queries wykonują się < 50ms

---

### Krok 7: Testy jednostkowe serwisu

**Plik: `src/services/__tests__/tasksService.test.ts`** (nowy)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTask } from '../tasksService';
import { supabase } from '@/db/supabase.client';

// Mock Supabase
vi.mock('@/db/supabase.client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  }
}));

describe('tasksService.createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return validation error for empty title', async () => {
    const result = await createTask({
      title: '',
      is_private: false
    });

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toContain('Title');
  });

  it('should return unauthorized error when user not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated')
    });

    const result = await createTask({
      title: 'Test task',
      is_private: false
    });

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('UNAUTHORIZED');
  });

  it('should return forbidden error when assigned_to is in different family', async () => {
    const mockUser = { id: 'user-1' };
    const mockUserProfile = { family_id: 'family-1' };
    const mockAssignedProfile = { family_id: 'family-2' };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn()
            .mockResolvedValueOnce({ data: mockUserProfile, error: null })
            .mockResolvedValueOnce({ data: mockAssignedProfile, error: null })
        } as any;
      }
      return {} as any;
    });

    const result = await createTask({
      title: 'Test task',
      assigned_to: 'user-2',
      is_private: false
    });

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(result.error?.message).toContain('outside your family');
  });

  it('should successfully create task', async () => {
    const mockUser = { id: 'user-1' };
    const mockProfile = { family_id: 'family-1' };
    const mockTask = {
      id: 'task-1',
      family_id: 'family-1',
      created_by: 'user-1',
      title: 'Test task',
      is_private: false,
      // ... other fields
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        } as any;
      }
      if (table === 'tasks') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockTask, error: null })
        } as any;
      }
      return {} as any;
    });

    const result = await createTask({
      title: 'Test task',
      is_private: false
    });

    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe('Test task');
    expect(result.error).toBeUndefined();
  });
});
```

**Weryfikacja:**
- [ ] Wszystkie testy przechodzą
- [ ] Coverage > 80% dla tasksService.ts
- [ ] Edge cases pokryte testami

---

### Krok 8: Testy integracyjne (E2E)

**Plik: `tests/e2e/tasks.spec.ts`** (nowy)

```typescript
import { test, expect } from '@playwright/test';

test.describe('POST /tasks', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Login i uzyskanie tokena
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    const body = await response.json();
    authToken = body.session.access_token;
  });

  test('should create task successfully', async ({ request }) => {
    const response = await request.post('/api/tasks', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'E2E Test Task',
        due_date: '2026-12-31T23:59:59Z',
        is_private: false
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.title).toBe('E2E Test Task');
    expect(body.is_completed).toBe(false);
  });

  test('should return 400 for empty title', async ({ request }) => {
    const response = await request.post('/api/tasks', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: '',
        is_private: false
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should return 401 without auth token', async ({ request }) => {
    const response = await request.post('/api/tasks', {
      data: {
        title: 'Test',
        is_private: false
      }
    });

    expect(response.status()).toBe(401);
  });

  test('should return 403 when assigning to user from different family', async ({ request }) => {
    // Assuming 'other-family-user-id' is a user in different family
    const response = await request.post('/api/tasks', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: 'Test',
        assigned_to: 'other-family-user-id',
        is_private: false
      }
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.message).toContain('outside your family');
  });
});
```

**Weryfikacja:**
- [ ] Wszystkie testy E2E przechodzą
- [ ] Testy uruchamiają się na środowisku staging/test
- [ ] Cleanup testowych danych po testach

---

### Krok 9: Dokumentacja API

**Aktualizuj plik: `.ai/api-plan.md`**

Upewnij się, że sekcja POST /tasks jest zgodna z implementacją.

**Dodatkowo utwórz OpenAPI spec (opcjonalne):**

**Plik: `docs/openapi.yaml`**

```yaml
/tasks:
  post:
    summary: Create a new manual task
    tags:
      - Tasks
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - title
              - is_private
            properties:
              title:
                type: string
                minLength: 1
                example: "Buy groceries"
              due_date:
                type: string
                format: date-time
                example: "2026-01-05T18:00:00Z"
              assigned_to:
                type: string
                format: uuid
                example: "550e8400-e29b-41d4-a716-446655440000"
              is_private:
                type: boolean
                example: false
    responses:
      '201':
        description: Task created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Task'
      '400':
        description: Validation error
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApiError'
      '401':
        description: Unauthorized
      '403':
        description: Forbidden (assigned_to not in same family)
      '500':
        description: Internal server error
```

**Weryfikacja:**
- [ ] Dokumentacja aktualna z implementacją
- [ ] Przykłady request/response poprawne
- [ ] OpenAPI spec validuje się (np. przez Swagger Editor)

---

### Krok 10: Deployment i monitoring

**Przed wdrożeniem:**
- [ ] Wszystkie testy jednostkowe przechodzą
- [ ] Wszystkie testy E2E przechodzą
- [ ] Linter bez błędów (`npm run lint`)
- [ ] TypeScript bez błędów (`npm run type-check`)
- [ ] RLS policies zweryfikowane manualnie
- [ ] Indexy utworzone na production DB

**Po wdrożeniu:**
- [ ] Smoke test na production
- [ ] Monitoring Supabase Dashboard:
  - Query performance
  - Error rate
  - Response times
- [ ] Alert dla error rate > 5%
- [ ] Alert dla p95 response time > 500ms

**Rollback plan:**
- Jeśli critical errors → rollback deploymentu
- Jeśli RLS issues → disable endpoint tymczasowo
- Backup bazy danych przed migracjami

---

## 10. Checklist przed oznaczeniem jako Done

### Funkcjonalność
- [ ] Endpoint tworzy zadanie z poprawnymi wartościami
- [ ] `family_id` automatycznie z profilu użytkownika
- [ ] `created_by` automatycznie na current user
- [ ] `event_id` i `suggestion_id` są NULL
- [ ] `created_from_suggestion` jest false
- [ ] Walidacja `assigned_to` działa poprawnie

### Bezpieczeństwo
- [ ] JWT authentication wymagane
- [ ] RLS policies egzekwowane
- [ ] Nie można przypisać zadania do użytkownika z innej rodziny
- [ ] Nie można utworzyć zadania w obcej rodzinie
- [ ] Input sanitization przez Zod

### Error Handling
- [ ] 400 dla błędów walidacji
- [ ] 401 dla braku autentykacji
- [ ] 403 dla naruszeń autoryzacji
- [ ] 500 dla błędów serwera
- [ ] User-friendly error messages
- [ ] Console.error dla błędów serwera

### Wydajność
- [ ] Response time < 200ms (p95)
- [ ] Indexy na kluczowych kolumnach
- [ ] Brak N+1 queries
- [ ] React optimistic UI zaimplementowane

### Testy
- [ ] Unit tests dla serwisu (coverage > 80%)
- [ ] E2E tests dla happy path
- [ ] E2E tests dla error cases
- [ ] RLS policies przetestowane manualnie

### Dokumentacja
- [ ] API plan zaktualizowany
- [ ] OpenAPI spec utworzony (opcjonalne)
- [ ] Code comments dla złożonej logiki
- [ ] README zaktualizowany (jeśli potrzebne)

### DevOps
- [ ] Migrations uruchomione na staging i production
- [ ] Monitoring skonfigurowane
- [ ] Alerty ustawione
- [ ] Rollback plan zdefiniowany

---

## 11. Przydatne komendy

### Development
```bash
# Uruchom dev server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

### Supabase
```bash
# Uruchom lokalne środowisko
npx supabase start

# Utwórz nową migrację
npx supabase migration new tasks_rls_policies

# Push migracjido remote
npx supabase db push

# Reset lokalnej bazy (UWAGA: usuwa dane)
npx supabase db reset

# Generuj TypeScript types z bazy
npx supabase gen types typescript --local > src/db/database.types.ts
```

### Database
```sql
-- Test RLS policy (execute w Supabase SQL Editor)
-- Najpierw ustaw auth context:
SELECT auth.uid(); -- powinno zwrócić NULL jeśli nie zalogowany

-- Test INSERT policy
INSERT INTO tasks (family_id, created_by, title, is_private)
VALUES (
  (SELECT family_id FROM profiles WHERE id = auth.uid()),
  auth.uid(),
  'Test task',
  false
);

-- Test SELECT policy
SELECT * FROM tasks WHERE family_id = (
  SELECT family_id FROM profiles WHERE id = auth.uid()
);
```

---

## 12. Troubleshooting

### Problem: "User profile not found" (403)
**Przyczyna:** Użytkownik nie ma profilu w tabeli `profiles`

**Rozwiązanie:**
1. Sprawdź czy profil istnieje: `SELECT * FROM profiles WHERE id = 'user-id'`
2. Jeśli nie, utwórz profil podczas rejestracji lub przez trigger

### Problem: "Cannot assign task to user outside your family" (403)
**Przyczyna:** `assigned_to` UUID należy do użytkownika z innej rodziny

**Rozwiązanie:**
1. Zweryfikuj `family_id` obu użytkowników
2. Upewnij się że frontend wysyła poprawne UUID

### Problem: RLS policy violation (500/403)
**Przyczyna:** RLS policy blokuje INSERT

**Rozwiązanie:**
1. Sprawdź czy RLS policies są poprawnie skonfigurowane
2. Zweryfikuj czy `auth.uid()` jest ustawiony
3. Debug: tymczasowo wyłącz RLS i zobacz czy INSERT działa

### Problem: Slow response times (> 500ms)
**Przyczyna:** Brak indexów lub N+1 queries

**Rozwiązanie:**
1. Uruchom `EXPLAIN ANALYZE` na queries
2. Dodaj brakujące indexy
3. Sprawdź czy assigned_to validation nie robi zbędnych queries

### Problem: Validation errors not showing in UI
**Przyczyna:** Error handling w komponencie React

**Rozwiązanie:**
1. Sprawdź czy `result.error` jest poprawnie obsługiwane
2. Debug: console.log result w handleSubmit
3. Upewnij się że error state jest wyświetlany w UI

---

## 13. Appendix: Przykładowe curl commands

### Sukces (201)
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "due_date": "2026-01-05T18:00:00Z",
    "is_private": false
  }'
```

### Validation Error (400)
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "",
    "is_private": false
  }'
```

### Unauthorized (401)
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "is_private": false
  }'
```

### Cross-family assignment (403)
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "assigned_to": "OTHER_FAMILY_USER_UUID",
    "is_private": false
  }'
```

---

## 14. Referencje

- **Supabase RLS Documentation**: https://supabase.com/docs/guides/auth/row-level-security
- **React 19 Actions**: https://react.dev/reference/react/useActionState
- **Zod Documentation**: https://zod.dev
- **PostgreSQL Indexing**: https://www.postgresql.org/docs/current/indexes.html
- **API Design Best Practices**: https://restfulapi.net/

---

**Koniec planu implementacji**

Data utworzenia: 2026-01-29  
Wersja: 1.0  
Autor: AI Architecture Team  
Status: Ready for Implementation
