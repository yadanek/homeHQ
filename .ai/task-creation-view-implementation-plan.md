# Plan Implementacji Widoku: Task Creation Modal

## 1. Przegląd

Task Creation Modal to modalny formularz umożliwiający użytkownikowi ręczne tworzenie zadań (nie powiązanych z wydarzeniami kalendarzowymi). Modal jest wywoływany z poziomu Dashboard poprzez kliknięcie przycisku "+" w prawym panelu zadań. Użytkownik może określić tytuł zadania, opcjonalny termin wykonania, przypisać zadanie do członka rodziny oraz ustawić widoczność (prywatne lub współdzielone). Implementacja wykorzystuje React 19 z Optimistic UI dla natychmiastowej reakcji interfejsu oraz Shadcn/ui dla komponentów modal i form.

**Cel biznesowy**: Umożliwienie rodzinie tworzenia zadań ręcznych jako uzupełnienie zadań generowanych automatycznie przez AI, zgodnie z User Story US-005 (widok wszystkich zadań) oraz założeniami MVP z PRD (moduł Task Feed).

## 2. Routing widoku

Modal nie jest osobnym routem, ale nakładką na istniejący Dashboard. Kontrola widoczności odbywa się przez query parameter lub state zarządzany przez komponent Dashboard:

**Opcja 1 (Query Parameter)**:
```
/dashboard?modal=create-task
```

**Opcja 2 (State Management - zalecane dla SPA)**:
```typescript
// W komponencie Dashboard
const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
```

**Zalecenie**: Użycie state management (Opcja 2) dla lepszej wydajności i prostszej integracji z Optimistic UI. Query parameter może być użyty jako enhancement dla deep linking.

## 3. Struktura komponentów

```
Dashboard (istniejący)
└── TaskCreationModal (nowy główny komponent modala)
    ├── Dialog (Shadcn/ui component)
    │   ├── DialogOverlay
    │   └── DialogContent
    │       ├── DialogHeader
    │       │   ├── DialogTitle ("Create Task")
    │       │   └── DialogClose (X button)
    │       ├── TaskForm (formularz wewnątrz modala)
    │       │   ├── FormField: TaskTitleInput
    │       │   ├── FormField: TaskDueDatePicker
    │       │   ├── FormField: TaskAssigneePicker
    │       │   └── FormField: TaskVisibilityToggle
    │       ├── ErrorDisplay (warunkowo, jeśli error)
    │       └── DialogFooter
    │           ├── Button: Cancel
    │           └── Button: Create Task (submit)
```

**Dodatkowe komponenty pomocnicze**:
- `useCreateTask` - custom hook do obsługi logiki tworzenia zadania
- `taskFormValidation` - funkcja walidująca dane formularza (Zod schema)

## 4. Szczegóły komponentów

### 4.1. TaskCreationModal

**Opis komponentu**: Główny kontener modala, zarządzający stanem formularza, wywołaniem API oraz interakcją z rodzicem (Dashboard). Wykorzystuje Shadcn/ui Dialog dla warstwy modal overlay i accessibility.

**Główne elementy**:
- `Dialog` (Shadcn/ui) - wrapper zapewniający modal overlay, focus trap, ESC handling
- `DialogContent` - białe tło z zaokrąglonymi rogami, zawierające cały formularz
- `DialogHeader` - nagłówek z tytułem "Create Task" i przyciskiem zamknięcia
- `TaskForm` - właściwy formularz z polami input
- `DialogFooter` - stopka z przyciskami Cancel i Create Task

**Obsługiwane zdarzenia**:
- `onClose()` - zamknięcie modala bez zapisywania (trigger: Cancel, X, ESC, click outside)
- `onSuccess(task: TaskResponse)` - callback po pomyślnym utworzeniu zadania
- `onOpenChange(open: boolean)` - callback z Shadcn Dialog do kontroli stanu otwarcia

**Warunki walidacji**: Komponent deleguje walidację do `TaskForm` i `useCreateTask` hook

**Typy**:
- `TaskCreationModalProps` (interface propsów)
- `CreateTaskRequest` (DTO dla API)
- `TaskResponse` (odpowiedź z API)
- `ApiError` (struktura błędu z API)
- `ProfileSummary[]` (lista członków rodziny)

**Propsy (interface komponentu)**:
```typescript
interface TaskCreationModalProps {
  isOpen: boolean;                        // kontrola widoczności modala
  onClose: () => void;                    // callback przy zamknięciu
  onSuccess?: (task: TaskResponse) => void; // callback po sukcesie (optional)
  familyMembers: ProfileSummary[];        // lista członków rodziny do assignowania
  currentUserId: string;                  // ID aktualnego użytkownika (domyślny assignee)
}
```

---

### 4.2. TaskForm

**Opis komponentu**: Formularz zawierający wszystkie pola do wprowadzania danych zadania. Zarządza lokalnym stanem formularza, walidacją w czasie rzeczywistym (opcjonalnie) oraz wywołaniem submit. Wykorzystuje React 19 `useTransition` dla non-blocking UI.

**Główne elementy**:
- `<form>` - HTML form element z onSubmit handler
- `FormField` (Shadcn/ui) wrappers dla każdego pola:
  - `TaskTitleInput` - input text
  - `TaskDueDatePicker` - input datetime-local
  - `TaskAssigneePicker` - select dropdown
  - `TaskVisibilityToggle` - switch/checkbox
- `ErrorDisplay` - div z komunikatem błędu (conditional rendering)
- Submit button - disabled podczas isPending

**Obsługiwane zdarzenia**:
- `onSubmit(e: FormEvent)` - submit formularza, wywołuje createTaskAction
- `onChange` na każdym polu - aktualizacja lokalnego stanu formularza

**Warunki walidacji**:
- **title**: wymagane, minimum 1 znak po trim, sprawdzane przy onBlur i submit
- **due_date**: opcjonalne, format ISO 8601, konwersja z datetime-local
- **assigned_to**: opcjonalne, UUID z listy familyMembers, domyślnie currentUserId
- **is_private**: wymagane boolean, domyślnie `false` (Shared)

**Typy**:
- `TaskFormProps` (props od rodzica)
- `TaskFormData` (lokalny stan formularza)
- `CreateTaskRequest` (po konwersji przed wysłaniem do API)

**Propsy**:
```typescript
interface TaskFormProps {
  onSubmit: (data: CreateTaskRequest) => Promise<void>;
  familyMembers: ProfileSummary[];
  currentUserId: string;
  isPending: boolean;           // czy request w trakcie
  error: string | null;         // komunikat błędu do wyświetlenia
}
```

---

### 4.3. TaskTitleInput

**Opis komponentu**: Pole tekstowe do wprowadzania tytułu zadania. Auto-focus przy otwarciu modala. Wyświetla błąd walidacji jeśli pusty po blur lub submit.

**Główne elementy**:
- `<Label>` (Shadcn/ui) - "Task Title" z gwiazdką (*)
- `<Input>` (Shadcn/ui) - type="text", required, autoFocus
- `<FormMessage>` (Shadcn/ui) - komunikat błędu walidacji (conditional)

**Obsługiwane zdarzenia**:
- `onChange(e)` - aktualizacja value w formData
- `onBlur()` - trigger walidacji (czy nie pusty)

**Warunki walidacji**:
- Nie może być pusty (required)
- Minimum 1 znak po trim()
- Komunikat błędu: "Title is required"

**Typy**:
- `string` (value)
- `string | undefined` (error message)

**Propsy**:
```typescript
interface TaskTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}
```

---

### 4.4. TaskDueDatePicker

**Opis komponentu**: Pole do wyboru daty i czasu wykonania zadania. Opcjonalne (można zostawić puste). Wykorzystuje natywny HTML5 datetime-local input, który konwertuje wartość na ISO 8601 przed wysłaniem.

**Główne elementy**:
- `<Label>` (Shadcn/ui) - "Due Date & Time"
- `<Input>` (Shadcn/ui) - type="datetime-local"
- `<FormDescription>` (Shadcn/ui) - "Optional. Tasks without dates go to 'No Due Date' section."

**Obsługiwane zdarzenia**:
- `onChange(e)` - aktualizacja value, konwersja na ISO 8601

**Warunki walidacji**:
- Opcjonalne (może być null/undefined)
- Jeśli podane, musi być w formacie datetime-local (natywna walidacja przeglądarki)
- Konwersja do ISO 8601 przed wysłaniem: `new Date(localValue).toISOString()`

**Typy**:
- `string | null` (value w formacie ISO 8601)
- `string` (lokalny value w formacie datetime-local dla inputa)

**Propsy**:
```typescript
interface TaskDueDatePickerProps {
  value: string | null;        // ISO 8601 lub null
  onChange: (value: string | null) => void;
  error?: string;
}
```

**Uwaga implementacyjna**: datetime-local input nie przyjmuje ISO 8601 bezpośrednio. Wymagana konwersja:
```typescript
// Dla value inputa:
const localValue = value ? value.slice(0, 16) : ''; // "2026-01-05T18:00"
// Dla onChange:
const isoValue = localValue ? new Date(localValue).toISOString() : null;
```

---

### 4.5. TaskAssigneePicker

**Opis komponentu**: Dropdown do wyboru członka rodziny, któremu zadanie ma być przypisane. Domyślnie ustawiony na aktualnego użytkownika. Pokazuje display_name każdego członka rodziny.

**Główne elementy**:
- `<Label>` (Shadcn/ui) - "Assign to"
- `<Select>` (Shadcn/ui) - dropdown z listą familyMembers
- `<SelectTrigger>` - przycisk otwierający dropdown
- `<SelectContent>` - lista opcji
- `<SelectItem>` dla każdego członka - wyświetla display_name, value to UUID

**Obsługiwane zdarzenia**:
- `onValueChange(value: string)` - zmiana wybranego assignee (UUID)

**Warunki walidacji**:
- Opcjonalne (może być null, choć domyślnie ustawione na current user)
- Wartość musi być UUID z listy familyMembers (implicitly validated przez opcje select)
- Backend sprawdza czy UUID jest z tej samej rodziny

**Typy**:
- `string | null` (UUID)
- `ProfileSummary[]` (lista opcji)

**Propsy**:
```typescript
interface TaskAssigneePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  familyMembers: ProfileSummary[];
  currentUserId: string;        // dla domyślnej wartości
}
```

---

### 4.6. TaskVisibilityToggle

**Opis komponentu**: Switch/toggle do wyboru widoczności zadania: Private (tylko dla mnie) vs Shared (cała rodzina). Domyślnie ustawiony na Shared (is_private = false), zgodnie z PRD i UI plan.

**Główne elementy**:
- `<Label>` (Shadcn/ui) - "Visibility"
- `<Switch>` (Shadcn/ui) - toggle button
- `<span>` - tekst opisujący aktualny stan: "Private" lub "Shared"
- `<FormDescription>` - wyjaśnienie: "Private tasks are visible only to you. Shared tasks are visible to all family members."

**Obsługiwane zdarzenia**:
- `onCheckedChange(checked: boolean)` - zmiana wartości is_private

**Warunki walidacji**:
- Wymagane boolean (zawsze ma wartość, nie może być null)
- Domyślnie `false` (Shared)

**Typy**:
- `boolean` (is_private)

**Propsy**:
```typescript
interface TaskVisibilityToggleProps {
  value: boolean;              // is_private
  onChange: (value: boolean) => void;
}
```

---

### 4.7. ErrorDisplay

**Opis komponentu**: Komponent warunkowy wyświetlający komunikat błędu z API. Renderowany tylko gdy `error !== null`. Stylowany jako alert z czerwonym tłem.

**Główne elementy**:
- `<Alert>` (Shadcn/ui) - variant="destructive"
- `<AlertTitle>` - "Error"
- `<AlertDescription>` - {error}

**Obsługiwane zdarzenia**: brak (tylko display)

**Typy**:
- `string | null` (error message)

**Propsy**:
```typescript
interface ErrorDisplayProps {
  error: string | null;
}
```

## 5. Typy

### 5.1. Istniejące typy (z `src/types.ts`)

```typescript
// DTO dla request do API
export type CreateTaskRequest = Pick<
  TablesInsert<'tasks'>,
  'title' | 'due_date' | 'assigned_to' | 'is_private'
>;
// Struktura:
// {
//   title: string;
//   due_date?: string;        // ISO 8601
//   assigned_to?: string;     // UUID
//   is_private: boolean;
// }

// Odpowiedź z API (pełny obiekt task)
export type TaskResponse = Tables<'tasks'>;
// Struktura (z database.types.ts):
// {
//   id: string;
//   family_id: string;
//   created_by: string;
//   assigned_to: string | null;
//   title: string;
//   due_date: string | null;
//   is_completed: boolean;
//   completed_at: string | null;
//   completed_by: string | null;
//   is_private: boolean;
//   event_id: string | null;
//   suggestion_id: string | null;
//   created_from_suggestion: boolean;
//   created_at: string;
//   updated_at: string;
//   archived_at: string | null;
// }

// Struktura błędu z API
export interface ApiError {
  error: {
    code: string;              // np. "VALIDATION_ERROR", "UNAUTHORIZED"
    message: string;           // user-friendly message
    details?: Record<string, unknown>;
  };
}

// Profil członka rodziny (dla dropdown assignee)
export type ProfileSummary = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'role' | 'created_at'
>;
// Struktura:
// {
//   id: string;                // UUID
//   display_name: string;      // np. "John Smith"
//   role: string;              // "admin" | "member"
//   created_at: string;
// }
```

### 5.2. Nowe typy (do utworzenia w komponencie lub osobnym pliku)

```typescript
// Props głównego komponentu modala
export interface TaskCreationModalProps {
  isOpen: boolean;                          // czy modal jest otwarty
  onClose: () => void;                      // callback przy zamknięciu
  onSuccess?: (task: TaskResponse) => void; // callback po utworzeniu zadania
  familyMembers: ProfileSummary[];          // lista członków rodziny
  currentUserId: string;                    // UUID aktualnego użytkownika
}

// Lokalny stan formularza (przed konwersją na CreateTaskRequest)
export interface TaskFormData {
  title: string;
  due_date: string | null;     // ISO 8601 lub null
  assigned_to: string | null;  // UUID lub null
  is_private: boolean;
}

// Props formularza
export interface TaskFormProps {
  onSubmit: (data: CreateTaskRequest) => Promise<void>;
  familyMembers: ProfileSummary[];
  currentUserId: string;
  isPending: boolean;
  error: string | null;
}

// Typ zwracany z custom hooka useCreateTask
export interface UseCreateTaskReturn {
  createTask: (data: CreateTaskRequest) => Promise<TaskResponse | undefined>;
  isPending: boolean;
  error: string | null;
  reset: () => void;           // resetowanie stanu error
}

// Props dla poszczególnych pól formularza (opisane w sekcji 4)
export interface TaskTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export interface TaskDueDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

export interface TaskAssigneePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  familyMembers: ProfileSummary[];
  currentUserId: string;
}

export interface TaskVisibilityToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export interface ErrorDisplayProps {
  error: string | null;
}
```

### 5.3. Zod Schema (walidacja)

Zgodnie z task-post-implementation-plan.md, frontend powinien używać tego samego Zod schema co backend:

```typescript
// src/schemas/taskSchemas.ts (nowy plik)
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

## 6. Zarządzanie stanem

### 6.1. State w komponencie TaskCreationModal

```typescript
const TaskCreationModal: React.FC<TaskCreationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  familyMembers,
  currentUserId
}) => {
  // Stan formularza
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    due_date: null,
    assigned_to: currentUserId,  // domyślnie current user
    is_private: false            // domyślnie Shared
  });

  // Hook do obsługi tworzenia zadania
  const { createTask, isPending, error, reset } = useCreateTask();

  // Reset formularza przy zamknięciu modala
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '',
        due_date: null,
        assigned_to: currentUserId,
        is_private: false
      });
      reset();
    }
  }, [isOpen, currentUserId, reset]);

  // Handler submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const task = await createTask(formData);
      if (task) {
        onSuccess?.(task);
        onClose();
      }
    } catch (error) {
      // Błąd już obsłużony w useCreateTask (error state)
    }
  };

  // ...
};
```

### 6.2. Custom Hook: useCreateTask

Hook zarządzający logiką wywołania API, stanem pending i błędów:

```typescript
// src/hooks/useCreateTask.ts (nowy plik)
import { useState, useTransition } from 'react';
import { createTaskAction } from '@/actions/taskActions';
import type { CreateTaskRequest, TaskResponse } from '@/types';
import { createTaskSchema } from '@/schemas/taskSchemas';

export function useCreateTask() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const createTask = async (
    data: CreateTaskRequest
  ): Promise<TaskResponse | undefined> => {
    // Reset error state
    setError(null);

    // Walidacja po stronie frontendu (przed wysłaniem)
    const validation = createTaskSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      setError(firstError.message);
      throw new Error(firstError.message);
    }

    return new Promise((resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await createTaskAction(validation.data);
          
          if (result.error) {
            setError(result.error.message);
            reject(new Error(result.error.message));
          } else if (result.data) {
            resolve(result.data);
          }
        } catch (err) {
          const message = err instanceof Error 
            ? err.message 
            : 'An unexpected error occurred';
          setError(message);
          reject(err);
        }
      });
    });
  };

  const reset = () => {
    setError(null);
  };

  return { createTask, isPending, error, reset };
}
```

### 6.3. React 19 Action

```typescript
// src/actions/taskActions.ts (nowy plik)
'use server'; // jeśli Next.js, w przypadku Vite SPA pomijamy

import { createTask } from '@/services/tasksService';
import type { CreateTaskRequest, TaskResponse, ApiError } from '@/types';

export async function createTaskAction(
  input: CreateTaskRequest
): Promise<{ data?: TaskResponse; error?: ApiError }> {
  return await createTask(input);
}
```

**Uwaga**: W przypadku Vite SPA (bez Next.js), `taskActions.ts` będzie bezpośrednio wywoływać `tasksService.ts` bez dyrektywy `'use server'`.

### 6.4. Optimistic UI (opcjonalnie w Dashboard)

Jeśli Dashboard używa Optimistic UI dla natychmiastowej aktualizacji listy zadań:

```typescript
// W komponencie Dashboard
const [tasks, setTasks] = useState<TaskResponse[]>([]);
const [optimisticTasks, addOptimisticTask] = useOptimistic(
  tasks,
  (state, newTask: TaskResponse) => [newTask, ...state]
);

const handleTaskCreated = (newTask: TaskResponse) => {
  // Optimistic update (natychmiastowe dodanie do UI)
  addOptimisticTask(newTask);
  
  // React 19 automatycznie zsynchronizuje po otrzymaniu rzeczywistej odpowiedzi
};

// Przekazanie do modala
<TaskCreationModal
  onSuccess={handleTaskCreated}
  // ...
/>
```

## 7. Integracja API

### 7.1. Endpoint: POST /tasks

**URL**: `/api/tasks` (lub `/tasks` w zależności od konfiguracji Supabase)

**Method**: POST

**Headers**:
```typescript
{
  'Authorization': `Bearer ${access_token}`,
  'Content-Type': 'application/json'
}
```

**Request Body** (typ: `CreateTaskRequest`):
```typescript
{
  title: string;           // Wymagane, min 1 znak po trim
  due_date?: string;       // Opcjonalne, ISO 8601
  assigned_to?: string;    // Opcjonalne, UUID członka rodziny
  is_private: boolean;     // Wymagane, domyślnie false
}
```

**Response Success (201 Created)** (typ: `TaskResponse`):
```typescript
{
  id: string;
  family_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  due_date: string | null;
  is_completed: false;
  completed_at: null;
  completed_by: null;
  is_private: boolean;
  event_id: null;
  suggestion_id: null;
  created_from_suggestion: false;
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
  archived_at: null;
}
```

**Response Error** (typ: `ApiError`):
```typescript
// 400 Bad Request
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Title is required",
    details: { field: "title", value: "" }
  }
}

// 401 Unauthorized
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid authorization token"
  }
}

// 403 Forbidden
{
  error: {
    code: "FORBIDDEN",
    message: "Cannot assign task to user outside your family"
  }
}

// 500 Internal Server Error
{
  error: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred"
  }
}
```

### 7.2. Implementacja Service Layer

```typescript
// src/services/tasksService.ts (implementacja zgodnie z task-post-implementation-plan.md)
import { createTaskSchema } from '@/schemas/taskSchemas';
import type { CreateTaskRequest, TaskResponse, ApiError } from '@/types';
import type { TablesInsert } from '@/db/database.types';
import { supabase } from '@/lib/supabaseClient';

export async function createTask(
  input: CreateTaskRequest
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
    return {
      error: {
        code: "FORBIDDEN",
        message: "User profile not found"
      }
    };
  }

  // 4. Validate assigned_to (jeśli podane)
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
        message: "An unexpected error occurred"
      }
    };
  }

  return { data };
}
```

## 8. Interakcje użytkownika

### 8.1. Otwarcie modala

**Trigger**: Użytkownik klika przycisk "+" w prawym panelu Dashboard

**Przepływ**:
1. Dashboard ustawia `isCreateTaskModalOpen = true`
2. TaskCreationModal renderuje się z `isOpen={true}`
3. Dialog overlay pojawia się z animacją fade-in
4. Focus automatycznie przenosi się na pole `title` (autoFocus)
5. Formularz inicjalizowany z domyślnymi wartościami:
   - title: ""
   - due_date: null
   - assigned_to: currentUserId
   - is_private: false

**Expected UI State**:
- Modal wycentrowany na ekranie
- Overlay przyciemnia tło
- Pole title ma focus (widoczny kursor)
- Submit button aktywny (nie disabled)
- Brak komunikatów błędów

---

### 8.2. Wpisywanie tytułu

**Trigger**: Użytkownik pisze w polu "Task Title"

**Przepływ**:
1. Każdy znak wywołuje `onChange` handler
2. `setFormData({ ...formData, title: e.target.value })`
3. Value inputa aktualizuje się natychmiast (controlled component)

**Expected UI State**:
- Tekst pojawia się w polu w czasie rzeczywistym
- Brak opóźnienia (nie throttled)
- Jeśli poprzednio był błąd walidacji "Title is required", powinien zniknąć po wpisaniu pierwszego znaku

---

### 8.3. Wybór daty wykonania

**Trigger**: Użytkownik klika na pole "Due Date & Time"

**Przepływ**:
1. Natywny picker datetime-local otwiera się (wygląd zależy od przeglądarki)
2. Użytkownik wybiera datę i czas
3. `onChange` handler konwertuje lokalny format na ISO 8601:
   ```typescript
   const isoDate = localValue ? new Date(localValue).toISOString() : null;
   setFormData({ ...formData, due_date: isoDate });
   ```
4. Input zamyka się, wyświetla wybraną datę w lokalnym formacie

**Expected UI State**:
- Wyświetlana data w formacie lokalnym użytkownika (np. "01/05/2026, 6:00 PM" w US)
- Pole może być puste (opcjonalne)
- FormDescription widoczny: "Optional. Tasks without dates go to 'No Due Date' section."

---

### 8.4. Wybór osoby przypisanej

**Trigger**: Użytkownik klika na dropdown "Assign to"

**Przepływ**:
1. Select rozwija listę opcji (Shadcn SelectContent)
2. Wyświetlane są `display_name` wszystkich familyMembers
3. Użytkownik klika na wybraną osobę
4. `onValueChange(memberId)` aktualizuje formData:
   ```typescript
   setFormData({ ...formData, assigned_to: memberId });
   ```
5. Trigger wyświetla wybraną osobę

**Expected UI State**:
- Domyślnie wybrany current user (display_name aktualnego użytkownika)
- Lista alfabetycznie posortowana (opcjonalnie)
- Każdy członek z display_name widocznym
- Po wyborze dropdown zamyka się

---

### 8.5. Toggle widoczności

**Trigger**: Użytkownik klika na Switch "Visibility"

**Przepływ**:
1. `onCheckedChange(checked)` wywołany z nową wartością
2. ```typescript
   setFormData({ ...formData, is_private: checked });
   ```
3. Switch wizualnie przełącza się (animacja Shadcn)
4. Tekst obok zmienia się: "Private" gdy checked, "Shared" gdy unchecked

**Expected UI State**:
- Domyślnie unchecked (Shared)
- Switch z animacją przesunięcia
- FormDescription wyjaśnia różnicę między Private i Shared

---

### 8.6. Submit formularza (sukces)

**Trigger**: Użytkownik klika "Create Task"

**Przepływ**:
1. `handleSubmit(e)` wywołany, `e.preventDefault()`
2. Walidacja frontend (Zod schema):
   - Jeśli fail → wyświetlenie błędu, przerwanie (patrz 8.8)
3. `createTask(formData)` wywołany
4. `isPending = true` (z useTransition)
5. Submit button: disabled, tekst zmienia się na "Creating..." + spinner
6. Request POST /tasks wysłany do API
7. **Optimistic UI** (jeśli zaimplementowane): zadanie natychmiast pojawia się w Dashboard Task Feed
8. Response 201 otrzymana z TaskResponse
9. `onSuccess(taskResponse)` callback wywołany
10. Dashboard aktualizuje listę zadań (lub potwierdza optimistic update)
11. `onClose()` wywołany
12. Modal zamyka się z animacją fade-out
13. (Opcjonalnie) Toast notification: "Task created successfully"

**Expected UI State**:
- Podczas pending:
  - Submit button disabled, "Creating..." + spinner
  - Użytkownik nie może zamknąć modala (opcjonalnie można zablokować)
- Po sukcesie:
  - Modal zamknięty
  - Nowe zadanie widoczne w Dashboard Task Feed (na górze lub w odpowiedniej sekcji)
  - Focus wraca do Dashboard

---

### 8.7. Zamknięcie modala bez zapisywania

**Trigger**: Użytkownik klika:
- Przycisk "Cancel" w DialogFooter
- Przycisk "X" w DialogHeader
- Klawisz ESC
- Click poza modalem (na overlay)

**Przepływ**:
1. `onClose()` callback wywołany
2. Dashboard ustawia `isCreateTaskModalOpen = false`
3. Modal zamyka się z animacją fade-out
4. (Opcjonalnie) Jeśli formularz ma niezapisane dane:
   - Pokazać dialog potwierdzenia: "Discard changes?"
   - Jeśli confirm → zamknięcie
   - Jeśli cancel → pozostanie w modalu

**Expected UI State**:
- Modal znika
- Overlay znika
- Focus wraca do elementu, który otworzył modal (przycisk "+")
- Dane formularza są resetowane (przy kolejnym otwarciu puste)

---

### 8.8. Submit formularza (błąd walidacji)

**Trigger**: Użytkownik klika "Create Task" z pustym title

**Przepływ**:
1. `handleSubmit(e)` wywołany
2. Walidacja Zod: `title.trim().length === 0`
3. `setError("Title is required")`
4. ErrorDisplay renderuje się z komunikatem
5. Focus przenosi się na pole title (dla lepszego UX)
6. Submit NIE jest wysyłany do API

**Expected UI State**:
- Modal pozostaje otwarty
- ErrorDisplay widoczny na górze formularza lub pod polem title:
  - Czerwone tło (Alert destructive)
  - Komunikat: "Title is required"
- Pole title podświetlone czerwoną ramką (error state)
- Submit button ponownie aktywny (nie disabled)

---

### 8.9. Submit formularza (błąd API)

**Trigger**: API zwraca błąd (np. 403 Forbidden, 500 Internal Error)

**Przepływ**:
1. Submit wysłany, request w trakcie (isPending = true)
2. Response z error:
   ```typescript
   {
     error: {
       code: "FORBIDDEN",
       message: "Cannot assign task to user outside your family"
     }
   }
   ```
3. `setError(result.error.message)`
4. `isPending = false`
5. ErrorDisplay renderuje komunikat błędu
6. **Optimistic UI rollback** (jeśli zastosowane): zadanie usuwane z listy

**Expected UI State**:
- Modal pozostaje otwarty
- ErrorDisplay widoczny z komunikatem z API
- Submit button aktywny (użytkownik może spróbować ponownie)
- Jeśli błąd dotyczy konkretnego pola (np. assigned_to), opcjonalnie podświetlić to pole

## 9. Warunki i walidacja

### 9.1. Walidacja po stronie frontendu (przed wysłaniem do API)

#### 9.1.1. Pole: title

**Komponent**: TaskTitleInput

**Warunki**:
- **Required**: wartość nie może być pusta
- **Min length**: minimum 1 znak po wykonaniu `trim()`
- **Type**: string

**Kiedy walidować**:
- **onBlur**: sprawdzić czy nie pusta, wyświetlić błąd jeśli tak
- **onSubmit**: zawsze sprawdzić przed wysłaniem

**Komunikaty błędów**:
- Jeśli puste po trim: "Title is required"
- Jeśli tylko whitespace: "Title cannot be empty"

**Wpływ na UI**:
- Błąd walidacji → czerwona ramka wokół inputa
- FormMessage z komunikatem błędu pod polem
- Submit button pozostaje aktywny, ale submit jest blokowany

**Implementacja**:
```typescript
// W komponencie TaskTitleInput
const [localError, setLocalError] = useState<string | undefined>();

const handleBlur = () => {
  if (value.trim().length === 0) {
    setLocalError("Title is required");
  } else {
    setLocalError(undefined);
  }
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  onChange(e.target.value);
  // Clear error gdy użytkownik zaczyna pisać
  if (localError) setLocalError(undefined);
};
```

---

#### 9.1.2. Pole: due_date

**Komponent**: TaskDueDatePicker

**Warunki**:
- **Optional**: może być null/undefined
- **Format**: jeśli podane, musi być ISO 8601 datetime
- **Type**: string (ISO 8601) lub null

**Kiedy walidować**:
- **onChange**: konwersja z datetime-local do ISO 8601
- **onSubmit**: sprawdzenie formatu (Zod schema)

**Komunikaty błędów**:
- Jeśli nieprawidłowy format: "Invalid date format. Expected ISO 8601"
- (Opcjonalnie) Jeśli data w przeszłości: "Due date cannot be in the past"

**Wpływ na UI**:
- Natywny datetime-local input ma wbudowaną walidację przeglądarki
- Jeśli błąd konwersji (rzadkie): wyświetlić FormMessage

**Implementacja**:
```typescript
// W komponencie TaskDueDatePicker
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const localValue = e.target.value; // format: "2026-01-05T18:00"
  
  if (!localValue) {
    onChange(null);
    return;
  }
  
  try {
    const isoValue = new Date(localValue).toISOString();
    onChange(isoValue);
  } catch (error) {
    console.error('Invalid date format:', error);
    // Opcjonalnie ustaw error state
  }
};

// Dla value inputa (konwersja z ISO 8601 do datetime-local)
const localValue = value ? value.slice(0, 16) : '';
```

---

#### 9.1.3. Pole: assigned_to

**Komponent**: TaskAssigneePicker

**Warunki**:
- **Optional**: może być null (choć domyślnie ustawione na current user)
- **Format**: UUID
- **Business rule**: musi być członkiem tej samej rodziny (weryfikowane przez API)

**Kiedy walidować**:
- **onChange**: implicit validation (wartości ograniczone do opcji w select)
- **onSubmit**: Zod sprawdza format UUID

**Komunikaty błędów**:
- Jeśli nieprawidłowy UUID: "Invalid UUID format for assigned_to" (nie powinno się zdarzyć w UI)
- Jeśli z innej rodziny (błąd API): "Cannot assign task to user outside your family"

**Wpływ na UI**:
- Select dropdown ogranicza wybór do familyMembers → implicit validation
- Błąd API (403) wyświetlany w ErrorDisplay

**Implementacja**:
```typescript
// W komponencie TaskAssigneePicker
<Select value={value || ''} onValueChange={onChange}>
  <SelectTrigger>
    <SelectValue placeholder="Select assignee" />
  </SelectTrigger>
  <SelectContent>
    {familyMembers.map((member) => (
      <SelectItem key={member.id} value={member.id}>
        {member.display_name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

#### 9.1.4. Pole: is_private

**Komponent**: TaskVisibilityToggle

**Warunki**:
- **Required**: zawsze boolean (nie może być null/undefined)
- **Type**: boolean
- **Default**: false (Shared)

**Kiedy walidować**:
- Nie wymaga walidacji (zawsze ma poprawną wartość)

**Wpływ na UI**:
- Switch zapewnia że wartość jest zawsze boolean
- Brak możliwości niepoprawnego stanu

**Implementacja**:
```typescript
// W komponencie TaskVisibilityToggle
<Switch
  checked={value}
  onCheckedChange={onChange}
/>
<span>{value ? 'Private' : 'Shared'}</span>
```

---

### 9.2. Walidacja po stronie backendu (z API)

**Backend waliduje te same warunki + dodatkowe business rules**:

1. **title**: required, min 1 char po trim (duplikacja frontend)
2. **due_date**: optional, ISO 8601 format
3. **assigned_to**: optional, UUID format, **musi być w tej samej rodzinie**
4. **is_private**: required, boolean
5. **Authorization**: JWT musi być valid, user musi mieć profil
6. **RLS Policy**: family_id musi zgadzać się z profilem użytkownika

**Error codes z API**:
- 400 VALIDATION_ERROR → wyświetlić error.message w ErrorDisplay
- 401 UNAUTHORIZED → redirect do loginu
- 403 FORBIDDEN → wyświetlić error.message (np. "Cannot assign to user outside family")
- 500 INTERNAL_ERROR → wyświetlić generic message "An unexpected error occurred"

---

### 9.3. Zod Schema (używane w useCreateTask)

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
```

**Użycie w useCreateTask**:
```typescript
const validation = createTaskSchema.safeParse(data);
if (!validation.success) {
  const firstError = validation.error.errors[0];
  setError(firstError.message);
  throw new Error(firstError.message);
}
```

## 10. Obsługa błędów

### 10.1. Kategorie błędów

#### 10.1.1. Błędy walidacji (400 Validation Error)

**Przyczyna**: 
- Puste pole title
- Nieprawidłowy format due_date (nie ISO 8601)
- Nieprawidłowy format assigned_to (nie UUID)

**Obsługa**:
1. Frontend waliduje przed wysłaniem (Zod schema)
2. Jeśli backend zwróci 400:
   - Wyświetlić error.message w ErrorDisplay
   - Jeśli error.details zawiera pole, podświetlić to pole
   - Nie zamykać modala
   - Umożliwić poprawkę i ponowne wysłanie

**UI**:
```jsx
{error && (
  <Alert variant="destructive">
    <AlertTitle>Validation Error</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

**Przykład**:
```
Error: Title is required
[Input title z czerwoną ramką]
```

---

#### 10.1.2. Błędy autoryzacji (401 Unauthorized)

**Przyczyna**:
- Brak JWT tokena
- Token wygasły
- Token nieprawidłowy

**Obsługa**:
1. Sprawdzić czy możliwe odświeżenie tokena (refresh token flow)
2. Jeśli nie:
   - Wyświetlić komunikat "Session expired, please log in again"
   - Przekierować do strony logowania
   - (Opcjonalnie) Zapisać stan formularza w sessionStorage do odzyskania

**UI**:
```jsx
if (error?.code === 'UNAUTHORIZED') {
  // Toast notification
  toast.error('Your session has expired. Please log in again.');
  // Redirect
  router.push('/login');
}
```

---

#### 10.1.3. Błędy autoryzacji (403 Forbidden)

**Przyczyna**:
- assigned_to jest użytkownikiem z innej rodziny
- User nie ma profilu (edge case)
- RLS policy blokuje INSERT (teoretycznie nie powinno się zdarzyć)

**Obsługa**:
1. Wyświetlić error.message w ErrorDisplay
2. Nie zamykać modala
3. Umożliwić zmianę assigned_to i ponowne wysłanie
4. Logować błąd dla debugowania (console.error)

**UI**:
```jsx
<Alert variant="destructive">
  <AlertTitle>Permission Denied</AlertTitle>
  <AlertDescription>
    {error || "You don't have permission to perform this action."}
  </AlertDescription>
</Alert>
```

**Przykład**:
```
Permission Denied
Cannot assign task to user outside your family
[TaskAssigneePicker podświetlony]
```

---

#### 10.1.4. Błędy serwera (500 Internal Error)

**Przyczyna**:
- Błąd bazy danych
- Nieoczekiwany błąd w logice backendu
- Timeout

**Obsługa**:
1. Wyświetlić generic user-friendly message
2. Nie ujawniać szczegółów technicznych użytkownikowi
3. Logować pełny błąd do console (developer tools)
4. (Produkcja) Wysłać błąd do error tracking service (np. Sentry)
5. Umożliwić retry

**UI**:
```jsx
<Alert variant="destructive">
  <AlertTitle>Unexpected Error</AlertTitle>
  <AlertDescription>
    An unexpected error occurred. Please try again later.
    {process.env.NODE_ENV === 'development' && (
      <pre className="mt-2 text-xs">{errorDetails}</pre>
    )}
  </AlertDescription>
</Alert>

<Button onClick={handleRetry}>
  <RefreshCw className="mr-2 h-4 w-4" />
  Try Again
</Button>
```

---

#### 10.1.5. Błędy sieciowe (Network Error)

**Przyczyna**:
- Brak połączenia internetowego
- CORS error
- Request timeout

**Obsługa**:
1. Wykryć network error (catch w try/catch)
2. Wyświetlić komunikat o problemie z połączeniem
3. Umożliwić retry
4. (Opcjonalnie) Zapisać dane formularza lokalnie (localStorage) do retry później

**UI**:
```jsx
<Alert variant="destructive">
  <WifiOff className="h-4 w-4" />
  <AlertTitle>Connection Error</AlertTitle>
  <AlertDescription>
    Unable to connect to the server. Please check your internet connection.
  </AlertDescription>
</Alert>

<Button onClick={handleRetry} variant="outline">
  <RefreshCw className="mr-2 h-4 w-4" />
  Retry
</Button>
```

---

### 10.2. Optimistic UI Rollback

**Scenariusz**: Request fail po optimistic update (zadanie dodane do listy w Dashboard)

**Obsługa**:
1. React 19 useOptimistic automatycznie rollback gdy Promise rejectuje
2. Wyświetlić toast notification z błędem
3. Focus wrócić do modala (nie zamykać go)

**Implementacja w Dashboard**:
```typescript
const [optimisticTasks, addOptimisticTask] = useOptimistic(
  tasks,
  (state, newTask: TaskResponse) => [newTask, ...state]
);

const handleTaskCreated = async (newTask: TaskResponse) => {
  // Optimistic update
  addOptimisticTask(newTask);
  
  try {
    // Actual API call
    await createTaskAction(newTask);
  } catch (error) {
    // useOptimistic automatycznie rollback
    toast.error('Failed to create task. Please try again.');
  }
};
```

---

### 10.3. Strategia obsługi błędów (podsumowanie)

| Błąd | Przyczyna | UI Action | Data Action |
|------|-----------|-----------|-------------|
| 400 Validation | Nieprawidłowe dane | Wyświetl szczegóły, podświetl pole | Nie zamykaj modala |
| 401 Unauthorized | Token wygasły | Toast + redirect do login | Opcjonalnie zapisz draft |
| 403 Forbidden | Brak uprawnień | Wyświetl message, umożliw retry | Nie zamykaj modala |
| 500 Internal | Błąd serwera | Generic message + retry button | Loguj błąd |
| Network Error | Brak połączenia | "Check connection" + retry | Zapisz lokalnie |
| Optimistic Rollback | Request failed | Toast, rollback, focus modal | useOptimistic auto-rollback |

## 11. Kroki implementacji

### Krok 1: Przygotowanie struktury plików

**Zadanie**: Utworzenie struktury katalogów i pustych plików

**Pliki do utworzenia**:
```
src/
├── components/
│   └── tasks/
│       ├── TaskCreationModal.tsx
│       ├── TaskForm.tsx
│       ├── TaskTitleInput.tsx
│       ├── TaskDueDatePicker.tsx
│       ├── TaskAssigneePicker.tsx
│       ├── TaskVisibilityToggle.tsx
│       └── ErrorDisplay.tsx
├── hooks/
│   └── useCreateTask.ts
├── schemas/
│   └── taskSchemas.ts
├── services/
│   └── tasksService.ts
├── actions/
│   └── taskActions.ts (jeśli Next.js)
└── types/
    └── task-modal.types.ts (opcjonalnie, dla nowych typów)
```

**Weryfikacja**:
- [ ] Wszystkie pliki utworzone
- [ ] Import paths poprawne w tsconfig

---

### Krok 2: Implementacja Zod Schema

**Plik**: `src/schemas/taskSchemas.ts`

**Zadanie**: Utworzenie i eksport schema walidacji

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

**Weryfikacja**:
- [ ] Schema kompiluje się bez błędów
- [ ] Type `CreateTaskInput` zgodny z `CreateTaskRequest` z types.ts
- [ ] Import `zod` działa poprawnie

---

### Krok 3: Implementacja Tasks Service

**Plik**: `src/services/tasksService.ts`

**Zadanie**: Implementacja funkcji `createTask` zgodnie z planem z task-post-implementation-plan.md (pełna implementacja w sekcji 7.2 tego dokumentu)

**Kluczowe punkty**:
1. Walidacja Zod
2. Auth check (getUser)
3. Pobranie family_id z profiles
4. Walidacja assigned_to (jeśli podane)
5. Insert do tasks table
6. Obsługa błędów z odpowiednimi kodami

**Weryfikacja**:
- [ ] Wszystkie error cases obsłużone
- [ ] TypeScript typy poprawne (CreateTaskRequest → TaskResponse)
- [ ] Console.error dla błędów serwera
- [ ] Early returns dla wszystkich warunków błędów

---

### Krok 4: Implementacja Custom Hook useCreateTask

**Plik**: `src/hooks/useCreateTask.ts`

**Zadanie**: Utworzenie hooka zarządzającego stanem wywołania API (implementacja w sekcji 6.2)

**Funkcjonalność**:
- useTransition dla isPending state
- useState dla error state
- Wywołanie createTask z tasksService
- Return: { createTask, isPending, error, reset }

**Weryfikacja**:
- [ ] Hook działa z React 19 useTransition
- [ ] Error handling poprawny
- [ ] Promise resolve/reject zgodnie z wynikiem API
- [ ] Reset function czyści error state

---

### Krok 5: Implementacja komponentów input

**Kolejność**: Od najmniejszych do największych komponentów

#### 5a. ErrorDisplay

**Plik**: `src/components/tasks/ErrorDisplay.tsx`

**Implementacja**:
```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ErrorDisplayProps {
  error: string | null;
}

export function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
```

**Weryfikacja**:
- [ ] Conditional rendering działa (null gdy brak error)
- [ ] Shadcn Alert component importuje się poprawnie
- [ ] Styling (variant="destructive") wyświetla czerwony alert

---

#### 5b. TaskTitleInput

**Plik**: `src/components/tasks/TaskTitleInput.tsx`

**Implementacja**:
```typescript
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FormMessage } from '@/components/ui/form';

interface TaskTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export function TaskTitleInput({ 
  value, 
  onChange, 
  error,
  autoFocus = false 
}: TaskTitleInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="task-title">
        Task Title <span className="text-red-500">*</span>
      </Label>
      <Input
        id="task-title"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Buy groceries"
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={error ? "task-title-error" : undefined}
        className={error ? "border-red-500" : ""}
      />
      {error && (
        <FormMessage id="task-title-error" className="text-red-500">
          {error}
        </FormMessage>
      )}
    </div>
  );
}
```

**Weryfikacja**:
- [ ] AutoFocus działa przy otwarciu modala
- [ ] Error state wyświetla czerwoną ramkę
- [ ] Accessibility attributes (aria-invalid, aria-describedby)

---

#### 5c. TaskDueDatePicker

**Plik**: `src/components/tasks/TaskDueDatePicker.tsx`

**Implementacja**:
```typescript
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FormDescription } from '@/components/ui/form';

interface TaskDueDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

export function TaskDueDatePicker({ value, onChange, error }: TaskDueDatePickerProps) {
  // Konwersja ISO 8601 → datetime-local format
  const localValue = value ? value.slice(0, 16) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const localValue = e.target.value;
    
    if (!localValue) {
      onChange(null);
      return;
    }

    try {
      const isoValue = new Date(localValue).toISOString();
      onChange(isoValue);
    } catch (error) {
      console.error('Invalid date format:', error);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="task-due-date">Due Date & Time</Label>
      <Input
        id="task-due-date"
        type="datetime-local"
        value={localValue}
        onChange={handleChange}
        aria-invalid={!!error}
      />
      <FormDescription className="text-sm text-muted-foreground">
        Optional. Tasks without dates go to "No Due Date" section.
      </FormDescription>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

**Weryfikacja**:
- [ ] Konwersja ISO 8601 ↔ datetime-local działa poprawnie
- [ ] Puste pole (null) obsługiwane
- [ ] Natywny datetime-local picker otwiera się

---

#### 5d. TaskAssigneePicker

**Plik**: `src/components/tasks/TaskAssigneePicker.tsx`

**Implementacja**:
```typescript
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProfileSummary } from '@/types';

interface TaskAssigneePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  familyMembers: ProfileSummary[];
  currentUserId: string;
}

export function TaskAssigneePicker({
  value,
  onChange,
  familyMembers,
  currentUserId,
}: TaskAssigneePickerProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="task-assignee">Assign to</Label>
      <Select value={value || currentUserId} onValueChange={onChange}>
        <SelectTrigger id="task-assignee">
          <SelectValue placeholder="Select assignee" />
        </SelectTrigger>
        <SelectContent>
          {familyMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.display_name}
              {member.id === currentUserId && ' (You)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Weryfikacja**:
- [ ] Domyślnie wybrany current user
- [ ] "(You)" pokazuje się przy current user
- [ ] Lista alfabetycznie posortowana (opcjonalnie można dodać sort)

---

#### 5e. TaskVisibilityToggle

**Plik**: `src/components/tasks/TaskVisibilityToggle.tsx`

**Implementacja**:
```typescript
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FormDescription } from '@/components/ui/form';

interface TaskVisibilityToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function TaskVisibilityToggle({ value, onChange }: TaskVisibilityToggleProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="task-visibility">Visibility</Label>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {value ? 'Private' : 'Shared'}
          </span>
          <Switch
            id="task-visibility"
            checked={value}
            onCheckedChange={onChange}
          />
        </div>
      </div>
      <FormDescription className="text-sm text-muted-foreground">
        Private tasks are visible only to you. Shared tasks are visible to all family members.
      </FormDescription>
    </div>
  );
}
```

**Weryfikacja**:
- [ ] Switch toggle działa płynnie
- [ ] Tekst "Private"/"Shared" aktualizuje się natychmiast
- [ ] Domyślnie unchecked (Shared)

---

### Krok 6: Implementacja TaskForm

**Plik**: `src/components/tasks/TaskForm.tsx`

**Zadanie**: Złożenie wszystkich input componentów w jeden formularz

**Implementacja**:
```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TaskTitleInput } from './TaskTitleInput';
import { TaskDueDatePicker } from './TaskDueDatePicker';
import { TaskAssigneePicker } from './TaskAssigneePicker';
import { TaskVisibilityToggle } from './TaskVisibilityToggle';
import { ErrorDisplay } from './ErrorDisplay';
import type { CreateTaskRequest, ProfileSummary } from '@/types';
import { Loader2 } from 'lucide-react';

interface TaskFormData {
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  is_private: boolean;
}

interface TaskFormProps {
  onSubmit: (data: CreateTaskRequest) => Promise<void>;
  onCancel: () => void;
  familyMembers: ProfileSummary[];
  currentUserId: string;
  isPending: boolean;
  error: string | null;
}

export function TaskForm({
  onSubmit,
  onCancel,
  familyMembers,
  currentUserId,
  isPending,
  error,
}: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    due_date: null,
    assigned_to: currentUserId,
    is_private: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous validation errors
    setValidationErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Submit
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorDisplay error={error} />}

      <TaskTitleInput
        value={formData.title}
        onChange={(title) => {
          setFormData({ ...formData, title });
          if (validationErrors.title) {
            setValidationErrors({ ...validationErrors, title: '' });
          }
        }}
        error={validationErrors.title}
        autoFocus
      />

      <TaskDueDatePicker
        value={formData.due_date}
        onChange={(due_date) => setFormData({ ...formData, due_date })}
      />

      <TaskAssigneePicker
        value={formData.assigned_to}
        onChange={(assigned_to) => setFormData({ ...formData, assigned_to })}
        familyMembers={familyMembers}
        currentUserId={currentUserId}
      />

      <TaskVisibilityToggle
        value={formData.is_private}
        onChange={(is_private) => setFormData({ ...formData, is_private })}
      />

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Task'
          )}
        </Button>
      </div>
    </form>
  );
}
```

**Weryfikacja**:
- [ ] Submit wywołuje onSubmit z poprawnymi danymi
- [ ] Walidacja title działa przed wysłaniem
- [ ] Cancel button wywołuje onCancel
- [ ] isPending disabluje oba przyciski
- [ ] Spinner pokazuje się podczas pending

---

### Krok 7: Implementacja TaskCreationModal

**Plik**: `src/components/tasks/TaskCreationModal.tsx`

**Zadanie**: Główny komponent modala integrujący wszystko

**Implementacja**:
```typescript
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskForm } from './TaskForm';
import { useCreateTask } from '@/hooks/useCreateTask';
import type { TaskResponse, ProfileSummary } from '@/types';

interface TaskCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (task: TaskResponse) => void;
  familyMembers: ProfileSummary[];
  currentUserId: string;
}

export function TaskCreationModal({
  isOpen,
  onClose,
  onSuccess,
  familyMembers,
  currentUserId,
}: TaskCreationModalProps) {
  const { createTask, isPending, error, reset } = useCreateTask();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const handleSubmit = async (data: CreateTaskRequest) => {
    try {
      const task = await createTask(data);
      if (task) {
        onSuccess?.(task);
        onClose();
      }
    } catch (error) {
      // Error already handled in useCreateTask
      console.error('Task creation failed:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <TaskForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          familyMembers={familyMembers}
          currentUserId={currentUserId}
          isPending={isPending}
          error={error}
        />
      </DialogContent>
    </Dialog>
  );
}
```

**Weryfikacja**:
- [ ] Modal otwiera się i zamyka poprawnie
- [ ] ESC key zamyka modal
- [ ] Click outside zamyka modal
- [ ] State resetuje się po zamknięciu
- [ ] onSuccess callback wywołany po utworzeniu zadania

---

### Krok 8: Integracja z Dashboard

**Plik**: `src/pages/Dashboard.tsx` (lub podobny)

**Zadanie**: Dodanie przycisku "+" i kontrola stanu modala

**Implementacja**:
```typescript
import { useState } from 'react';
import { TaskCreationModal } from '@/components/tasks/TaskCreationModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { TaskResponse, ProfileSummary } from '@/types';

export function Dashboard() {
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [familyMembers, setFamilyMembers] = useState<ProfileSummary[]>([]);
  const currentUserId = 'user-id'; // z auth context

  // Fetch family members on mount
  useEffect(() => {
    // TODO: Fetch from API
    // GET /families/me/members
  }, []);

  const handleTaskCreated = (newTask: TaskResponse) => {
    // Optimistic UI: dodaj do listy
    setTasks([newTask, ...tasks]);
    
    // (Opcjonalnie) Toast notification
    // toast.success('Task created successfully!');
  };

  return (
    <div className="dashboard">
      {/* ... existing dashboard content ... */}
      
      {/* Right Panel - Task Feed */}
      <aside className="task-panel">
        <div className="flex justify-between items-center mb-4">
          <h2>Tasks</h2>
          <Button
            size="icon"
            onClick={() => setIsCreateTaskModalOpen(true)}
            aria-label="Create new task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Task list */}
        <div className="task-list">
          {/* ... existing task items ... */}
        </div>
      </aside>

      {/* Modal */}
      <TaskCreationModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onSuccess={handleTaskCreated}
        familyMembers={familyMembers}
        currentUserId={currentUserId}
      />
    </div>
  );
}
```

**Weryfikacja**:
- [ ] Przycisk "+" otwiera modal
- [ ] Modal zamyka się po utworzeniu zadania
- [ ] Nowe zadanie pojawia się w liście
- [ ] familyMembers poprawnie pobrane i przekazane

---

### Krok 9: Styling i UX Improvements

**Zadania**:

1. **Tailwind styling**:
   - Upewnij się że wszystkie komponenty używają Tailwind 4
   - Responsive design (modal dopasowany do mobile)
   - Dark mode support (jeśli aplikacja wspiera)

2. **Animations**:
   - Modal fade-in/fade-out (Shadcn ma wbudowane)
   - Spinner podczas loading
   - Smooth transitions na Switch toggle

3. **Keyboard navigation**:
   - Tab order poprawny
   - ESC zamyka modal
   - Enter submits form
   - Focus trap w modalu (Shadcn Dialog ma wbudowane)

4. **Accessibility**:
   - Wszystkie labels powiązane z inputs (htmlFor)
   - aria-invalid dla błędów
   - aria-describedby dla error messages
   - Screen reader announcements dla success/error

**Weryfikacja**:
- [ ] Modal responsywny na mobile
- [ ] Keyboard navigation działa
- [ ] Screen reader czyta wszystko poprawnie (test z NVDA/VoiceOver)
- [ ] Focus trap w modalu

---

### Krok 10: Testy

#### 10a. Unit Tests (Vitest)

**Plik**: `src/components/tasks/__tests__/TaskCreationModal.test.tsx`

**Przykład**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskCreationModal } from '../TaskCreationModal';

describe('TaskCreationModal', () => {
  const mockFamilyMembers = [
    { id: '1', display_name: 'John', role: 'admin', created_at: '2026-01-01' },
    { id: '2', display_name: 'Jane', role: 'member', created_at: '2026-01-02' },
  ];

  it('should render when open', () => {
    render(
      <TaskCreationModal
        isOpen={true}
        onClose={() => {}}
        familyMembers={mockFamilyMembers}
        currentUserId="1"
      />
    );

    expect(screen.getByText('Create Task')).toBeInTheDocument();
  });

  it('should show validation error for empty title', async () => {
    render(
      <TaskCreationModal
        isOpen={true}
        onClose={() => {}}
        familyMembers={mockFamilyMembers}
        currentUserId="1"
      />
    );

    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  // More tests...
});
```

**Weryfikacja**:
- [ ] Testy komponentów przechodzą
- [ ] Coverage > 80%
- [ ] Edge cases pokryte

---

#### 10b. Integration Tests (Playwright)

**Plik**: `tests/e2e/task-creation.spec.ts`

**Przykład**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Task Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create task successfully', async ({ page }) => {
    // Open modal
    await page.click('[aria-label="Create new task"]');
    await expect(page.getByText('Create Task')).toBeVisible();

    // Fill form
    await page.fill('[id="task-title"]', 'Buy groceries');
    await page.fill('[id="task-due-date"]', '2026-12-31T18:00');

    // Submit
    await page.click('button[type="submit"]');

    // Verify task appears in list
    await expect(page.getByText('Buy groceries')).toBeVisible();
  });
});
```

**Weryfikacja**:
- [ ] E2E testy przechodzą
- [ ] Happy path + error scenarios pokryte

---

### Krok 11: Dokumentacja i Cleanup

**Zadania**:

1. **Code comments**:
   - Dodaj JSDoc dla komponentów publicznych
   - Wyjaśnij złożoną logikę (np. konwersja dat)

2. **README update**:
   - Dodaj sekcję o Task Creation Modal
   - Instrukcje użycia komponentu

3. **Type safety check**:
   - `npm run type-check` bez błędów
   - Wszystkie anys usunięte

4. **Linting**:
   - `npm run lint` bez błędów/warnings
   - Prettier formatting applied

**Weryfikacja**:
- [ ] TypeScript kompiluje bez błędów
- [ ] Linter przechodzi
- [ ] Dokumentacja aktualna

---

### Krok 12: Review i Deploy

**Pre-deployment Checklist**:
- [ ] Wszystkie testy przechodzą (unit + E2E)
- [ ] TypeScript bez błędów
- [ ] Linter bez warnings
- [ ] Accessibility testowane
- [ ] Mobile responsive verified
- [ ] RLS policies przetestowane manualnie
- [ ] Error handling przetestowany (wszystkie scenariusze)
- [ ] Performance: modal otwiera się < 100ms

**Deployment**:
1. Merge do głównej gałęzi
2. CI/CD pipeline uruchamia testy
3. Deploy do staging
4. Smoke testing na staging
5. Deploy do production
6. Monitoring (error rate, performance)

**Post-deployment**:
- [ ] Monitoring dashboards sprawdzone
- [ ] Error tracking (Sentry) bez critical errors
- [ ] User feedback collected

---

## Koniec planu implementacji

**Data utworzenia**: 2026-01-30  
**Wersja**: 1.0  
**Status**: Ready for Implementation

**Uwagi implementacyjne**:
1. Description field: W UI plan jest mowa o polu "Description", ale API nie wspiera tego pola w v1.0. Jeśli wymagane, trzeba najpierw zaktualizować backend (dodać kolumnę `description` do tabeli `tasks` i update endpoint implementation).
2. Optimistic UI: Implementacja opcjonalna w Krok 8, ale silnie zalecana dla lepszego UX (zgodnie z PRD i React 19 capabilities).
3. Toast notifications: Nie pokazane w przykładach, ale zalecane dla success/error feedback (użyć biblioteki jak `sonner` lub Shadcn Toast).
