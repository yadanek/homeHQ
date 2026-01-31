# GET /tasks - Quick Start Guide

## 🚀 Szybki Start

### 1. Podstawowe użycie w komponencie React

```typescript
import { useTasks } from '@/hooks/useTasks';

function MyComponent() {
  const { tasks, isLoading, error } = useTasks({
    assigned_to: 'me',
    is_completed: false
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {tasks.map(task => (
        <li key={task.id}>
          {task.title} - Due: {task.due_date}
        </li>
      ))}
    </ul>
  );
}
```

### 2. Najczęstsze przypadki użycia

#### Lista "Moje zadania do zrobienia"
```typescript
const { tasks } = useTasks({
  assigned_to: 'me',
  is_completed: false,
  sort: 'due_date_asc'
});
```

#### Zadania z konkretnego wydarzenia
```typescript
const { tasks } = useTasks({
  event_id: eventId,
  limit: 50
});
```

#### Zadania do zrobienia w tym tygodniu
```typescript
const startOfWeek = new Date().toISOString();
const endOfWeek = new Date(Date.now() + 7*24*60*60*1000).toISOString();

const { tasks } = useTasks({
  is_completed: false,
  due_after: startOfWeek,
  due_before: endOfWeek,
  sort: 'due_date_asc'
});
```

### 3. Parametry zapytania

| Parametr | Przykład | Opis |
|----------|----------|------|
| `assigned_to` | `"me"` | Zadania przypisane do mnie |
| `is_completed` | `false` | Tylko niezakończone |
| `is_private` | `false` | Tylko wspólne zadania |
| `due_before` | `"2026-02-01T00:00:00Z"` | Termin przed datą |
| `due_after` | `"2026-01-15T00:00:00Z"` | Termin po dacie |
| `event_id` | `"uuid-here"` | Zadania z eventu |
| `limit` | `50` | Max 50 wyników |
| `offset` | `100` | Pomiń pierwsze 100 |
| `sort` | `"due_date_asc"` | Sortowanie |

### 4. Opcje sortowania

```typescript
// Najbliższy termin pierwsze (NULL na końcu)
sort: 'due_date_asc'

// Najpóźniejszy termin pierwsze (NULL na końcu)
sort: 'due_date_desc'

// Najnowsze zadania pierwsze
sort: 'created_at_desc'
```

### 5. Paginacja

```typescript
const [page, setPage] = useState(0);
const pageSize = 20;

const { tasks, pagination } = useTasks({
  limit: pageSize,
  offset: page * pageSize
});

const nextPage = () => {
  if (pagination?.has_more) {
    setPage(p => p + 1);
  }
};
```

### 6. Bezpieczeństwo (automatyczne!)

✅ **RLS automatycznie filtruje:**
- Tylko zadania z Twojej rodziny
- Prywatne zadania innych użytkowników są niewidoczne
- Zarchiwizowane zadania są wykluczone

**Nie musisz nic robić - to dzieje się automatycznie w bazie danych!**

### 7. Response Structure

```typescript
{
  tasks: [
    {
      id: string,
      title: string,
      due_date: string | null,
      is_completed: boolean,
      assigned_to: string | null,
      assigned_to_name: string | null,
      created_by_name: string,
      event_title: string | null,
      // ... więcej pól
    }
  ],
  pagination: {
    total: number,
    limit: number,
    offset: number,
    has_more: boolean
  }
}
```

### 8. Error Handling

```typescript
const { tasks, error, refetch } = useTasks({
  assigned_to: 'me'
});

if (error) {
  // Możliwe błędy:
  // - "Authentication required"
  // - "Invalid query parameters"
  // - "Failed to fetch tasks"
  
  return (
    <div>
      <p>Error: {error}</p>
      <button onClick={refetch}>Try Again</button>
    </div>
  );
}
```

### 9. Refresh danych

```typescript
const { tasks, refetch } = useTasks({
  assigned_to: 'me'
});

// Odśwież listę zadań
const handleRefresh = async () => {
  await refetch();
};
```

### 10. Łączenie filtrów

```typescript
// Wszystko naraz!
const { tasks } = useTasks({
  assigned_to: 'me',           // Moje zadania
  is_completed: false,         // Niezakończone
  is_private: false,           // Wspólne (widoczne dla rodziny)
  due_after: '2026-01-29T00:00:00Z',  // Od dziś
  due_before: '2026-02-05T23:59:59Z', // Do końca tygodnia
  sort: 'due_date_asc',        // Od najwcześniejszego terminu
  limit: 50                    // Max 50 wyników
});
```

---

## 📚 Więcej informacji

- **Pełna dokumentacja:** `.ai/api-get-tasks-documentation.md`
- **Plan implementacji:** `.ai/task-get-view-implementation-plan.md`
- **API Spec:** `.ai/api-plan.md` (sekcja 2.6.1)

## 🆘 Problemy?

1. Sprawdź czy użytkownik jest zalogowany
2. Sprawdź czy ma `family_id` w profilu
3. Zobacz logi w konsoli przeglądarki
4. Sprawdź RLS policies w Supabase

---

**Status:** ✅ Gotowe do użycia  
**Ostatnia aktualizacja:** 2026-01-29
