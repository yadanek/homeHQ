# Plan implementacji widoku Dashboard - Calendar View with Daily Tasks Sidebar

## 1. Przegląd

Widok Dashboard jest głównym widokiem aplikacji HomeHQ, na który użytkownik trafia bezpośrednio po zalogowaniu. Widok łączy w sobie kalendarz miesięczny z wydarzeniami rodzinnymi oraz dynamiczny sidebar pokazujący zadania dla wybranej daty. Kluczową funkcjonalnością jest wizualna reprezentacja wydarzeń z rozróżnieniem na prywatne (niebieskie) i rodzinne (zielone), oraz możliwość filtrowania zadań przez wybór konkretnego dnia w kalendarzu.

Widok implementuje następujące US:
- **US-000**: Dashboard z month view i sidebar, color coding (blue/green), click date → filter tasks
- **US-003**: Dodanie wydarzenia z AI suggestions (modal, nie bezpośrednio w tym widoku)
- **US-004**: Private events z lock iconem

## 2. Routing widoku

**Ścieżka**: `/dashboard`

**Guard**: Wymaga autentykacji + przynależności do rodziny (family_id w JWT)

**Domyślny widok po loginie**: Tak, użytkownik po zalogowaniu jest automatycznie przekierowywany na `/dashboard`

## 3. Struktura komponentów

```
DashboardView (strona główna)
├── TopNavigationBar (shadcn/ui NavigationMenu - wspólny layout)
│   ├── Logo
│   ├── NavItems (Calendar | Tasks | Family | Profile)
│   └── UserMenu
│
├── CalendarArea (główny obszar treści)
│   ├── CalendarControls
│   │   ├── MonthYearNavigation (← Styczeń 2026 →)
│   │   └── FilterToggle (Everything | My | Family)
│   │
│   ├── CalendarGrid (Schedule-X integration)
│   │   ├── EventCard[] (wiele)
│   │   └── TaskItemInline[] (zadania z due_date)
│   │
│   ├── AddEventButton (desktop) / FAB (mobile)
│   │
│   └── EmptyState (jeśli brak wydarzeń)
│       └── QuickStartCard[] (3 przykładowe karty)
│
└── DailyTasksSidebar (prawy sidebar, 320px, desktop only)
    ├── SidebarHeader
    │   ├── DateTitle ("Tasks for Today" / "Tasks for Jan 15")
    │   └── AddTaskButton ('+' icon, top-right)
    │
    ├── TaskList (scrollable, filtrowane po wybranej dacie)
    │   └── TaskItem[] (wiele)
    │
    └── SidebarEmptyState ("No tasks for this day")
```

**Responsywność**:
- **Desktop (≥1024px)**: CalendarArea + DailyTasksSidebar widoczne jednocześnie
- **Tablet (768px-1023px)**: CalendarArea full-width, DailyTasksSidebar jako collapsible drawer (shadcn/ui Sheet)
- **Mobile (≤767px)**: CalendarArea full-screen, brak sidebara (zadania w osobnym widoku `/dashboard/tasks`)

## 4. Szczegóły komponentów

### DashboardView (strona główna, kontener)

**Opis**: Główny kontener widoku Dashboard, zarządza stanem globalnym widoku (wybrana data, filtr, dane z API), orchestruje komunikację między kalendarzem a sidebare'm zadań.

**Główne elementy**:
- Layout wrapper z Flexbox/Grid do pozycjonowania CalendarArea i DailyTasksSidebar
- Breakpoint-aware rendering (conditional rendering dla sidebara na mobile)
- Error boundary dla obsługi błędów

**Obsługiwane interakcje**:
- Mount: Fetchuje wydarzenia i zadania dla bieżącego miesiąca
- onDateSelect(date): Aktualizuje selectedDate i filtruje zadania w sidebarze
- onMonthChange(newMonth): Fetchuje dane dla nowego miesiąca
- onFilterChange(filter): Aktualizuje activeFilter i ponownie fetchuje wydarzenia
- onEventClick(eventId): Otwiera Event Edit Modal
- onTaskClick(taskId): Otwiera Task Edit Modal
- onAddEvent(): Otwiera Event Creation Modal
- onAddTask(dueDate): Otwiera Task Creation Modal z pre-filled due_date

**Obsługiwana walidacja**: Brak (kontener, deleguje walidację do child components)

**Typy**:
- `DashboardState` (ViewModel lokalny)
- `EventWithCreator[]` (z API)
- `TaskWithDetails[]` (z API)
- `FilterOption` ('all' | 'private' | 'shared')

**Propsy**: Brak (strona główna, nie przyjmuje propsów)

**Custom hook**: `useDashboard()` - zarządza stanem widoku, API calls, computed values

---

### CalendarArea (główny obszar kalendarza)

**Opis**: Kontener dla kalendarza i jego kontrolek. Wyświetla siatkę kalendarza z wydarzeniami i zadaniami, umożliwia nawigację między miesiącami i filtrowanie widoczności.

**Główne elementy**:
- `<div>` wrapper z responsive width (full-width na mobile/tablet, minus 320px na desktop dla sidebara)
- CalendarControls (sub-komponent)
- CalendarGrid (Schedule-X wrapper)
- AddEventButton (shadcn/ui Button desktop, FAB mobile)
- EmptyState (conditional render jeśli brak wydarzeń)

**Obsługiwane interakcje**:
- onDateClick(date): Propaguje do parent (DashboardView) → aktualizuje sidebar
- onEventClick(eventId): Propaguje do parent
- onMonthChange(month): Propaguje do parent → fetchuje nowe dane
- onFilterChange(filter): Propaguje do parent → ponowny fetch
- onAddEventClick(): Propaguje do parent → otwiera modal

**Obsługiwana walidacja**: 
- Walidacja zakresu dat dla API call (start_date i end_date muszą być valid ISO 8601)
- Sprawdzenie, czy currentMonth jest valid Date object

**Typy**:
- `EventWithCreator[]` (props)
- `TaskWithDetails[]` (props)
- `Date` (currentMonth, selectedDate)
- `FilterOption` (activeFilter)

**Propsy**:
```typescript
interface CalendarAreaProps {
  events: EventWithCreator[];
  tasks: TaskWithDetails[];
  currentMonth: Date;
  selectedDate: Date;
  activeFilter: FilterOption;
  isLoading: boolean;
  onDateSelect: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  onFilterChange: (filter: FilterOption) => void;
  onEventClick: (eventId: string) => void;
  onAddEvent: () => void;
}
```

---

### CalendarControls (kontrolki kalendarza)

**Opis**: Nagłówek kalendarza z nawigacją miesiąc/rok oraz przyciskami filtrowania widoczności wydarzeń.

**Główne elementy**:
- `<div>` flex container (justify-between)
- MonthYearNavigation:
  - Button Previous Month (←)
  - Text "Styczeń 2026" (format: MMMM yyyy)
  - Button Next Month (→)
- FilterToggle: Segmented control (shadcn/ui ToggleGroup)
  - Button "Everything"
  - Button "My"
  - Button "Family"

**Obsługiwane interakcje**:
- onPreviousMonth(): Zmniejsza miesiąc o 1, propaguje onMonthChange
- onNextMonth(): Zwiększa miesiąc o 1, propaguje onMonthChange
- onFilterClick(filter): Propaguje onFilterChange

**Obsługiwana walidacja**:
- Sprawdzenie, czy nowy miesiąc jest w reasonable range (np. ±5 lat od dzisiaj) - opcjonalne
- Brak walidacji po stronie UI dla filtra (wszystkie opcje są valid)

**Typy**:
- `Date` (currentMonth)
- `FilterOption` (activeFilter)

**Propsy**:
```typescript
interface CalendarControlsProps {
  currentMonth: Date;
  activeFilter: FilterOption;
  onMonthChange: (month: Date) => void;
  onFilterChange: (filter: FilterOption) => void;
}
```

---

### CalendarGrid (Schedule-X integration)

**Opis**: Wrapper dla biblioteki Schedule-X, renderuje siatkę kalendarza miesięcznego z wydarzeniami i zadaniami. Odpowiada za transformację danych z API do formatu Schedule-X oraz obsługę interakcji użytkownika z kalendarzem.

**Główne elementy**:
- Schedule-X `<ScheduleXCalendar>` component
- Custom event renderer dla EventCard
- Custom event renderer dla TaskItemInline (zadania z due_date)
- ARIA grid attributes dla accessibility

**Obsługiwane interakcje**:
- onDateClick(date): Wybór daty → propaguje do parent
- onEventClick(eventId): Kliknięcie wydarzenia → propaguje do parent
- onTaskClick(taskId): Kliknięcie zadania → propaguje do parent
- Keyboard navigation (Arrow keys, Enter) - obsługiwane przez Schedule-X

**Obsługiwana walidacja**: Brak (prezentacja danych)

**Typy**:
- `EventWithCreator[]` (props)
- `TaskWithDetails[]` (props)
- `CalendarItemViewModel[]` (internal, transformed data dla Schedule-X)
- `Date` (selectedDate)

**Propsy**:
```typescript
interface CalendarGridProps {
  events: EventWithCreator[];
  tasks: TaskWithDetails[];
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (eventId: string) => void;
  onTaskClick: (taskId: string) => void;
}
```

**Adapter function** (transformacja danych):
```typescript
function transformToCalendarItems(
  events: EventWithCreator[],
  tasks: TaskWithDetails[]
): CalendarItemViewModel[] {
  // Konwersja wydarzeń i zadań do formatu Schedule-X
}
```

---

### EventCard (wydarzenia w kalendarzu)

**Opis**: Komponent wyświetlający pojedyncze wydarzenie w kalendarzu. Implementuje color coding zgodnie z US-000: niebieski dla prywatnych, zielony dla rodzinnych. Pokazuje lock icon dla wydarzeń prywatnych zgodnie z US-004.

**Główne elementy**:
- `<div>` lub `<button>` wrapper (semantic: button dla clickable)
- Time badge (np. "10:00 AM")
- Title (truncated jeśli > 30 znaków)
- Lock icon (lucide-react Lock) - conditional render jeśli `is_private === true`
- Participant avatars (max 3 widoczne, +N dla overflow)

**Obsługiwane interakcje**:
- onClick(): Propaguje eventId do parent

**Obsługiwana walidacja**: Brak (prezentacja)

**Typy**:
- `EventWithCreator` (props)

**Propsy**:
```typescript
interface EventCardProps {
  event: EventWithCreator;
  onClick: (eventId: string) => void;
}
```

**Styling (Tailwind)**:
- Private: `bg-blue-100 border-blue-300 text-blue-900`
- Shared: `bg-green-100 border-green-300 text-green-900`
- Hover: `hover:shadow-md cursor-pointer`
- Past event: `opacity-60`

---

### TaskItemInline (zadania w kalendarzu)

**Opis**: Komponent wyświetlający pojedyncze zadanie bezpośrednio w kalendarzu (dla zadań z due_date). Odróżnia się wizualnie od wydarzeń (np. badge "Task", inna ikona).

**Główne elementy**:
- `<div>` wrapper
- Task badge ("Task" label)
- Title (truncated)
- Checkbox (completion toggle) - mini version
- Assignee avatar (jeśli assigned)

**Obsługiwane interakcje**:
- onClick(): Propaguje taskId do parent
- onCheckboxToggle(): Optimistic UI update → PATCH /tasks/:taskId

**Obsługiwana walidacja**: Brak (prezentacja)

**Typy**:
- `TaskWithDetails` (props)

**Propsy**:
```typescript
interface TaskItemInlineProps {
  task: TaskWithDetails;
  onClick: (taskId: string) => void;
  onToggleComplete: (taskId: string, isCompleted: boolean) => void;
}
```

**Styling (Tailwind)**:
- Default: `bg-orange-50 border-orange-200`
- Completed: `opacity-60 line-through`

---

### FilterToggle (przycisk filtrowania)

**Opis**: Segmented control do wyboru filtra widoczności wydarzeń: Everything (wszystko), My (moje prywatne + rodzinne), Family (tylko rodzinne).

**Główne elementy**:
- shadcn/ui ToggleGroup (variant="outline", type="single")
- ToggleGroupItem "Everything"
- ToggleGroupItem "My"
- ToggleGroupItem "Family"

**Obsługiwane interakcje**:
- onValueChange(value): Propaguje nowy filtr do parent

**Obsługiwana walidacja**: Brak (wszystkie opcje są valid)

**Typy**:
- `FilterOption` ('all' | 'private' | 'shared')

**Propsy**:
```typescript
interface FilterToggleProps {
  activeFilter: FilterOption;
  onChange: (filter: FilterOption) => void;
}
```

---

### AddEventButton (przycisk dodawania wydarzenia)

**Opis**: Przycisk uruchamiający modal tworzenia wydarzenia. Na deskopie: standardowy button, na mobile: FAB (Floating Action Button).

**Główne elementy**:
- Desktop: shadcn/ui Button (variant="default")
- Mobile: shadcn/ui Button (variant="default", rounded-full, fixed position, elevated shadow)
- Icon: Plus (lucide-react)
- Text: "Add Event" (desktop only, mobile tylko icon)

**Obsługiwane interakcje**:
- onClick(): Propaguje do parent → otwiera Event Creation Modal

**Obsługiwana walidacja**: Brak

**Typy**: Brak

**Propsy**:
```typescript
interface AddEventButtonProps {
  onClick: () => void;
}
```

**Responsywność**:
- Desktop: `<Button className="...">Add Event</Button>`
- Mobile: `<Button className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg">+</Button>`

---

### EmptyState (stan pusty kalendarza)

**Opis**: Wyświetlany gdy brak wydarzeń w bieżącym miesiącu. Pokazuje Quick Start Cards z przykładowymi wydarzeniami demonstrującymi AI suggestions.

**Główne elementy**:
- Heading (H2): "Your calendar is empty"
- Subheading: "Create your first event and see how HomeHQ suggests tasks automatically"
- QuickStartCard[] (3 karty):
  1. "Dentist appointment next Friday" → "Try it" button
  2. "Emma's birthday party" → "Try it" button
  3. "Weekend trip to the mountains" → "Try it" button

**Obsługiwane interakcje**:
- onTryExample(title): Propaguje do parent → otwiera Event Creation Modal z pre-filled title

**Obsługiwana walidacja**: Brak

**Typy**:
- `QuickStartExample[]` (internal, array obiektów z przykładowymi tytułami)

**Propsy**:
```typescript
interface EmptyStateProps {
  onTryExample: (title: string) => void;
}
```

---

### QuickStartCard (przykładowa karta)

**Opis**: Pojedyncza karta z przykładowym wydarzeniem i podglądem AI suggestion.

**Główne elementy**:
- shadcn/ui Card
- CardHeader: Example event title
- CardContent: Preview AI suggestion ("→ Prepare medical documents")
- CardFooter: "Try it" button (shadcn/ui Button variant="outline")

**Obsługiwane interakcje**:
- onClick(): Propaguje title do parent

**Obsługiwana walidacja**: Brak

**Typy**:
- `string` (title, suggestion preview)

**Propsy**:
```typescript
interface QuickStartCardProps {
  title: string;
  suggestionPreview: string;
  onTry: (title: string) => void;
}
```

---

### DailyTasksSidebar (prawy sidebar z zadaniami)

**Opis**: Sidebar wyświetlający zadania dla wybranej daty w kalendarzu. Na deskopie widoczny jako fixed sidebar (320px), na tablecie jako collapsible drawer, na mobile niewidoczny (zadania w osobnym widoku).

**Główne elementy**:
- `<aside>` wrapper (semantic)
- SidebarHeader (sub-komponent)
- TaskList (scrollable, shadcn/ui ScrollArea)
- SidebarEmptyState (conditional render jeśli brak zadań)

**Obsługiwane interakcje**:
- onTaskClick(taskId): Propaguje do parent
- onTaskToggleComplete(taskId, isCompleted): Optimistic UI → PATCH /tasks/:taskId
- onAddTask(): Propaguje do parent → otwiera Task Creation Modal z due_date = selectedDate

**Obsługiwana walidacja**: Brak (prezentacja)

**Typy**:
- `TaskWithDetails[]` (props, filtrowane po selectedDate)
- `Date` (selectedDate)

**Propsy**:
```typescript
interface DailyTasksSidebarProps {
  tasks: TaskWithDetails[]; // już filtrowane po selectedDate w parent
  selectedDate: Date;
  onTaskClick: (taskId: string) => void;
  onTaskToggleComplete: (taskId: string, isCompleted: boolean) => void;
  onAddTask: (dueDate: Date) => void;
}
```

**Responsywność**:
- Desktop (≥1024px): `<aside className="hidden lg:block lg:w-80 lg:fixed lg:right-0">`
- Tablet (768px-1023px): shadcn/ui Sheet (drawer from right)
- Mobile (≤767px): `hidden` (nie renderowany)

---

### SidebarHeader (nagłówek sidebara)

**Opis**: Nagłówek sidebara z tytułem pokazującym wybraną datę oraz przyciskiem dodawania zadania.

**Główne elementy**:
- `<div>` flex container (justify-between, items-center)
- Heading (H3): "Tasks for Today" lub "Tasks for Jan 15" (dynamiczny)
- AddTaskButton: shadcn/ui Button (variant="ghost", size="icon", '+' icon)

**Obsługiwane interakcje**:
- onAddTask(): Propaguje do parent

**Obsługiwana walidacja**: Brak

**Typy**:
- `Date` (selectedDate)

**Propsy**:
```typescript
interface SidebarHeaderProps {
  selectedDate: Date;
  onAddTask: () => void;
}
```

**Format daty**:
- Jeśli selectedDate === today: "Tasks for Today"
- Jeśli selectedDate !== today: "Tasks for Jan 15" (format: MMM d)

---

### TaskItem (zadanie w sidebarze)

**Opis**: Pojedyncze zadanie w liście sidebara. Pokazuje checkbox, tytuł, assignee, due date badge, visibility indicator.

**Główne elementy**:
- `<div>` wrapper (flex, items-start)
- Checkbox (shadcn/ui Checkbox) - completion toggle
- TaskContent:
  - Title
  - Due date badge (color-coded: red jeśli overdue, orange jeśli today, gray jeśli future)
  - Assignee name/avatar
  - Lock icon (jeśli private)
  - Source event link (jeśli created_from_suggestion)

**Obsługiwane interakcje**:
- onClick(): Propaguje taskId do parent (otwiera Task Edit Modal)
- onCheckboxChange(): Propaguje onTaskToggleComplete do parent

**Obsługiwana walidacja**: Brak (prezentacja)

**Typy**:
- `TaskWithDetails` (props)

**Propsy**:
```typescript
interface TaskItemProps {
  task: TaskWithDetails;
  onClick: (taskId: string) => void;
  onToggleComplete: (taskId: string, isCompleted: boolean) => void;
}
```

**Styling**:
- Pending: Normal colors, empty checkbox
- Completed: `opacity-60 line-through`, checked checkbox
- Hover: `hover:bg-accent cursor-pointer`

---

### SidebarEmptyState (pusty sidebar)

**Opis**: Wyświetlany gdy brak zadań dla wybranej daty.

**Główne elementy**:
- `<div>` centered container
- Illustration (optional icon)
- Text: "No tasks for this day"
- Subtext: "Click '+' to add a task"

**Obsługiwane interakcje**: Brak

**Obsługiwana walidacja**: Brak

**Typy**: Brak

**Propsy**: Brak (static content)

---

## 5. Typy

### Typy z types.ts (już zdefiniowane):

```typescript
// Wydarzenie z nazwą twórcy i uczestnikami
interface EventWithCreator extends Omit<Tables<'events'>, 'created_by'> {
  created_by: string;
  created_by_name: string;
  participants: EventParticipant[];
}

// Uczestnik wydarzenia
type EventParticipant = Pick<Tables<'profiles'>, 'id' | 'display_name'>;

// Zadanie z nazwami powiązanych osób
interface TaskWithDetails extends Tables<'tasks'> {
  created_by_name: string;
  assigned_to_name: string | null;
  completed_by_name: string | null;
  event_title: string | null;
}

// Parametry zapytania GET /events
interface GetEventsQueryParams {
  start_date?: string; // ISO 8601 date
  end_date?: string;
  is_private?: boolean;
  participant_id?: string;
  limit?: number; // default: 100, max: 500
  offset?: number; // default: 0
}

// Parametry zapytania GET /tasks
interface GetTasksQueryParams {
  is_completed?: boolean;
  is_private?: boolean;
  assigned_to?: string; // UUID lub "me"
  due_before?: string; // ISO 8601 date
  due_after?: string;
  event_id?: string;
  limit?: number;
  offset?: number;
  sort?: 'due_date_asc' | 'due_date_desc' | 'created_at_desc';
}

// Odpowiedź GET /events
interface ListEventsResponse {
  events: EventWithCreator[];
  pagination: PaginationMeta;
}

// Odpowiedź GET /tasks
interface ListTasksResponse {
  tasks: TaskWithDetails[];
  pagination: PaginationMeta;
}

// Metadane paginacji
interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}
```

### Nowe ViewModels i typy lokalne:

```typescript
// ViewModel dla filtra widoczności
type FilterOption = 'all' | 'private' | 'shared';

// ViewModel dla stanu Dashboard
interface DashboardState {
  selectedDate: Date;
  currentMonth: Date;
  activeFilter: FilterOption;
  events: EventWithCreator[];
  tasks: TaskWithDetails[];
  isLoadingEvents: boolean;
  isLoadingTasks: boolean;
  error: string | null;
}

// ViewModel dla pojedynczego elementu kalendarza (ujednolicony typ dla Schedule-X)
interface CalendarItemViewModel {
  id: string;
  type: 'event' | 'task';
  title: string;
  start: Date;
  end: Date;
  isPrivate: boolean;
  participants?: EventParticipant[];
  assignedTo?: string | null;
  isCompleted?: boolean; // tylko dla tasks
  rawData: EventWithCreator | TaskWithDetails; // oryginalne dane
}

// ViewModel dla przykładowych wydarzeń w Empty State
interface QuickStartExample {
  title: string;
  suggestionPreview: string;
  demoDate: Date; // relatywna data (np. "next Friday")
}

// Helper types dla computed values
interface TasksForDate {
  date: Date;
  tasks: TaskWithDetails[];
  pendingCount: number;
  completedCount: number;
}

// Helper dla transformacji daty do ISO 8601
type ISO8601Date = string; // Format: YYYY-MM-DD

// Helper dla date range
interface DateRange {
  start: ISO8601Date;
  end: ISO8601Date;
}
```

**Szczegóły pól ViewModels**:

**DashboardState**:
- `selectedDate: Date` - aktualnie wybrana data w kalendarzu, domyślnie dzisiaj
- `currentMonth: Date` - aktualnie wyświetlany miesiąc w kalendarzu
- `activeFilter: FilterOption` - aktywny filtr widoczności ('all' | 'private' | 'shared')
- `events: EventWithCreator[]` - lista wydarzeń dla bieżącego miesiąca
- `tasks: TaskWithDetails[]` - lista zadań dla bieżącego miesiąca
- `isLoadingEvents: boolean` - flaga ładowania wydarzeń
- `isLoadingTasks: boolean` - flaga ładowania zadań
- `error: string | null` - komunikat błędu jeśli wystąpił

**CalendarItemViewModel**:
- `id: string` - UUID wydarzenia lub zadania
- `type: 'event' | 'task'` - typ elementu (dla różnicowania renderowania)
- `title: string` - tytuł
- `start: Date` - data/czas rozpoczęcia
- `end: Date` - data/czas zakończenia
- `isPrivate: boolean` - czy element jest prywatny
- `participants: EventParticipant[] | undefined` - uczestnicy (tylko dla events)
- `assignedTo: string | null | undefined` - przypisany użytkownik (tylko dla tasks)
- `isCompleted: boolean | undefined` - czy ukończone (tylko dla tasks)
- `rawData: EventWithCreator | TaskWithDetails` - oryginalne dane z API

**QuickStartExample**:
- `title: string` - przykładowy tytuł wydarzenia
- `suggestionPreview: string` - podgląd AI suggestion ("→ Prepare medical documents")
- `demoDate: Date` - obliczona data relatywna (np. "next Friday at 10 AM")

**TasksForDate**:
- `date: Date` - data dla której są zadania
- `tasks: TaskWithDetails[]` - lista zadań dla tej daty
- `pendingCount: number` - liczba niezakończonych zadań
- `completedCount: number` - liczba zakończonych zadań

## 6. Zarządzanie stanem

### Stan globalny (custom hook: useDashboard)

Stan widoku jest zarządzany przez custom hook `useDashboard()`, który enkapsuluje całą logikę biznesową i zarządzanie stanem. Hook zwraca computed values i handler functions dla child components.

**Struktura hooka**:

```typescript
function useDashboard() {
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed values
  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return isSameDay(dueDate, selectedDate);
    });
  }, [tasks, selectedDate]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    if (activeFilter === 'private') return events.filter(e => e.is_private);
    if (activeFilter === 'shared') return events.filter(e => !e.is_private);
    return events;
  }, [events, activeFilter]);

  const calendarItems = useMemo(() => {
    return transformToCalendarItems(filteredEvents, tasks);
  }, [filteredEvents, tasks]);

  // API calls
  const fetchEvents = useCallback(async (month: Date, filter: FilterOption) => {
    setIsLoadingEvents(true);
    setError(null);
    try {
      const dateRange = getMonthDateRange(month);
      const params: GetEventsQueryParams = {
        start_date: dateRange.start,
        end_date: dateRange.end,
        is_private: filter === 'private' ? true : filter === 'shared' ? false : undefined,
        limit: 100,
      };
      
      // Mock data dla development (endpoint nie zaimplementowany)
      const response = await getMockEvents(params);
      setEvents(response.events);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  const fetchTasks = useCallback(async (month: Date) => {
    setIsLoadingTasks(true);
    try {
      const dateRange = getMonthDateRange(month);
      const params: GetTasksQueryParams = {
        due_after: dateRange.start,
        due_before: dateRange.end,
        limit: 100,
      };
      
      // Mock data dla development
      const response = await getMockTasks(params);
      setTasks(response.tasks);
    } catch (err) {
      setError('Failed to load tasks');
      console.error(err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  // Effects
  useEffect(() => {
    fetchEvents(currentMonth, activeFilter);
    fetchTasks(currentMonth);
  }, [currentMonth, activeFilter, fetchEvents, fetchTasks]);

  // Handlers
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleMonthChange = useCallback((newMonth: Date) => {
    setCurrentMonth(newMonth);
  }, []);

  const handleFilterChange = useCallback((filter: FilterOption) => {
    setActiveFilter(filter);
  }, []);

  const handleTaskToggleComplete = useCallback(async (taskId: string, isCompleted: boolean) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, is_completed: isCompleted } : t
    ));

    try {
      // Mock API call
      await updateTaskCompletion(taskId, isCompleted);
    } catch (err) {
      // Rollback on error
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, is_completed: !isCompleted } : t
      ));
      console.error('Failed to update task:', err);
    }
  }, []);

  return {
    // State
    selectedDate,
    currentMonth,
    activeFilter,
    events: filteredEvents,
    tasks,
    tasksForSelectedDate,
    calendarItems,
    isLoading: isLoadingEvents || isLoadingTasks,
    error,
    
    // Handlers
    handleDateSelect,
    handleMonthChange,
    handleFilterChange,
    handleTaskToggleComplete,
  };
}
```

**Helper functions** (lokalne, nie w hooku):

```typescript
// Oblicza pierwszy i ostatni dzień miesiąca w formacie ISO 8601
function getMonthDateRange(month: Date): DateRange {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

// Transformuje wydarzenia i zadania do formatu Schedule-X
function transformToCalendarItems(
  events: EventWithCreator[],
  tasks: TaskWithDetails[]
): CalendarItemViewModel[] {
  const eventItems: CalendarItemViewModel[] = events.map(event => ({
    id: event.id,
    type: 'event',
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    isPrivate: event.is_private,
    participants: event.participants,
    rawData: event,
  }));

  const taskItems: CalendarItemViewModel[] = tasks
    .filter(task => task.due_date) // tylko zadania z due_date
    .map(task => ({
      id: task.id,
      type: 'task',
      title: task.title,
      start: new Date(task.due_date!),
      end: new Date(task.due_date!), // zadania nie mają end_time
      isPrivate: task.is_private,
      assignedTo: task.assigned_to,
      isCompleted: task.is_completed,
      rawData: task,
    }));

  return [...eventItems, ...taskItems];
}

// Sprawdza czy dwie daty są w tym samym dniu
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
```

### Stan lokalny komponentów

Większość komponentów jest "dumb" (presentational) i nie posiada własnego stanu. Jedyny stan lokalny to:

- **CalendarGrid**: Stan wewnętrzny Schedule-X (zarządzany przez bibliotekę)
- **TaskItem**: Hover state dla actions menu (useState lub CSS-only)
- **Modals** (nie część tego widoku): Własny stan formularzy

### Polling dla real-time updates (opcjonalny, MVP może bez tego)

```typescript
// W useDashboard hook, dodać:
useEffect(() => {
  const interval = setInterval(() => {
    // Tylko jeśli tab jest active (Page Visibility API)
    if (document.visibilityState === 'visible') {
      fetchEvents(currentMonth, activeFilter);
      fetchTasks(currentMonth);
    }
  }, 60000); // 1 minuta

  return () => clearInterval(interval);
}, [currentMonth, activeFilter, fetchEvents, fetchTasks]);
```

## 7. Integracja API

### Endpoint: GET /events

**URL**: `/api/v1/events`

**Headers**:
```
Authorization: Bearer {access_token}
```

**Query Parameters** (dla Dashboard):
```typescript
{
  start_date: "2026-01-01", // pierwszy dzień wyświetlanego miesiąca
  end_date: "2026-01-31",   // ostatni dzień wyświetlanego miesiąca
  is_private: undefined | true | false, // zależy od activeFilter
  limit: 100,
  offset: 0
}
```

**Request Type**: `GetEventsQueryParams` (z types.ts)

**Response Type**: `ListEventsResponse` (z types.ts)

**Response Example**:
```json
{
  "events": [
    {
      "id": "uuid-event-1",
      "created_by": "uuid-user-1",
      "created_by_name": "John Smith",
      "title": "Dentist Appointment",
      "description": "Annual checkup",
      "start_time": "2026-01-15T10:00:00Z",
      "end_time": "2026-01-15T11:00:00Z",
      "is_private": false,
      "created_at": "2026-01-02T12:00:00Z",
      "updated_at": "2026-01-02T12:00:00Z",
      "participants": [
        {
          "id": "uuid-kid-1",
          "display_name": "Kid 1"
        }
      ]
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

**Error Handling**:
- `400 Bad Request`: Wyświetl toast "Invalid date range"
- `401 Unauthorized`: Redirect do /login
- `500 Internal Server Error`: Wyświetl toast "Failed to load events", przycisk "Retry"

**Mock Implementation** (dla development - szczegóły w pliku mockData.ts)

---

### Endpoint: GET /tasks

**URL**: `/api/v1/tasks`

**Headers**:
```
Authorization: Bearer {access_token}
```

**Query Parameters** (dla Dashboard):
```typescript
{
  due_after: "2026-01-01",  // pierwszy dzień miesiąca
  due_before: "2026-01-31", // ostatni dzień miesiąca
  limit: 100,
  offset: 0,
  sort: 'due_date_asc' // domyślnie
}
```

**Request Type**: `GetTasksQueryParams` (z types.ts)

**Response Type**: `ListTasksResponse` (z types.ts)

**Error Handling**: Analogicznie jak GET /events

**Mock Implementation** (dla development - szczegóły w pliku mockData.ts)

---

### Endpoint: PATCH /tasks/:taskId (toggle completion)

**URL**: `/api/v1/tasks/{taskId}`

**Headers**:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```typescript
{
  is_completed: true // lub false
}
```

**Request Type**: `UpdateTaskRequest` (partial, z types.ts)

**Response Type**: `UpdateTaskResponse` (z types.ts)

**Error Handling**:
- `403 Forbidden`: Wyświetl toast "You don't have permission to update this task"
- `404 Not Found`: Wyświetl toast "Task not found"
- Network error: Rollback optimistic UI, wyświetl toast "Failed to update task", przycisk "Retry"

## 8. Interakcje użytkownika

### 1. Wybór daty w kalendarzu

**Trigger**: Użytkownik klika na datę w kalendarzu

**Flow**:
1. CalendarGrid wykrywa click event na date cell
2. CalendarGrid wywołuje `props.onDateClick(clickedDate)`
3. CalendarArea propaguje do DashboardView: `onDateSelect(clickedDate)`
4. DashboardView aktualizuje `selectedDate` w state
5. useDashboard recomputuje `tasksForSelectedDate` (useMemo)
6. DailyTasksSidebar otrzymuje zaktualizowaną listę zadań jako props
7. SidebarHeader aktualizuje tytuł: "Tasks for Jan 15"
8. TaskList renderuje zadania dla nowej daty

**Visual feedback**:
- Kliknięta data otrzymuje highlight (border accent color)
- Sidebar header zmienia tekst
- Lista zadań w sidebarze aktualizuje się (transition fade)

**Edge cases**:
- Jeśli wybrana data nie ma zadań: wyświetl SidebarEmptyState
- Jeśli wybrana data === dzisiaj: wyświetl "Tasks for Today"
- Jeśli wybrana data w przyszłości/przeszłości: wyświetl "Tasks for Jan 15"

---

### 2. Zmiana miesiąca w kalendarzu

**Trigger**: Użytkownik klika ← (previous) lub → (next) w CalendarControls

**Flow**:
1. CalendarControls wywołuje `props.onMonthChange(newMonth)`
2. CalendarArea propaguje do DashboardView
3. DashboardView aktualizuje `currentMonth` w state
4. useEffect w useDashboard wykrywa zmianę currentMonth
5. Hook wywołuje `fetchEvents(newMonth, activeFilter)` i `fetchTasks(newMonth)`
6. Wyświetla loading skeleton podczas fetchowania
7. Po otrzymaniu danych aktualizuje `events` i `tasks` w state
8. CalendarGrid renderuje nowy miesiąc z nowymi danymi
9. Jeśli selectedDate jest poza nowym miesiącem, resetuje selectedDate do pierwszego dnia nowego miesiąca

**Visual feedback**:
- Loading skeleton w kalendarzu podczas fetch
- Smooth transition między miesiącami (fade-in)
- Tytuł miesiąca aktualizuje się: "Styczeń 2026" → "Luty 2026"

---

### 3. Zmiana filtra (Everything / My / Family)

**Trigger**: Użytkownik klika jeden z przycisków filtra w FilterToggle

**Flow**:
1. FilterToggle wywołuje `props.onChange(newFilter)`
2. CalendarArea propaguje do DashboardView: `onFilterChange(newFilter)`
3. DashboardView aktualizuje `activeFilter` w state
4. useEffect w useDashboard wykrywa zmianę activeFilter
5. Hook wywołuje `fetchEvents(currentMonth, newFilter)` z nowym parametrem is_private
6. Po otrzymaniu danych aktualizuje `events` w state
7. useMemo recomputuje `filteredEvents`
8. CalendarGrid renderuje tylko filtrowane wydarzenia

**Visual feedback**:
- Aktywny przycisk filtra ma accent color background
- Wydarzenia znikają/pojawiają się z animacją (fade)

**Mapping filtra na API**:
- `'all'` → `is_private: undefined` (wszystkie wydarzenia)
- `'private'` → `is_private: true` (tylko prywatne)
- `'shared'` → `is_private: false` (tylko rodzinne)

---

### 4. Toggle zadania (checkbox completion)

**Trigger**: Użytkownik klika checkbox przy TaskItem w DailyTasksSidebar

**Flow**:
1. TaskItem wywołuje `props.onToggleComplete(task.id, !task.is_completed)`
2. DailyTasksSidebar propaguje do DashboardView: `handleTaskToggleComplete(taskId, isCompleted)`
3. useDashboard wykonuje optimistic UI update:
   - Natychmiast aktualizuje `tasks` w state (setTasks)
   - TaskItem pokazuje nowy stan (checked checkbox, strikethrough)
4. Hook wywołuje API call: PATCH /tasks/:taskId { is_completed }
5. Jeśli success: Nie robi nic (już zaktualizowane)
6. Jeśli error: Rollback (setTasks z poprzednim stanem), wyświetl toast "Failed to update task"

**Visual feedback**:
- Immediate checkbox toggle (0ms perceived latency)
- Immediate strikethrough + opacity 60% jeśli completed
- Toast "Task completed" lub "Task marked as pending"

**Optimistic UI pattern** (React 19 `useOptimistic` - opcjonalny):
```typescript
const [optimisticTasks, addOptimisticTask] = useOptimistic(
  tasks,
  (state, { taskId, isCompleted }) => {
    return state.map(t => 
      t.id === taskId ? { ...t, is_completed: isCompleted } : t
    );
  }
);
```

---

### 5. Keyboard navigation (accessibility)

**Supported shortcuts**:
- **Tab**: Nawigacja między focusable elements
- **Arrow keys**: Nawigacja po datach w kalendarzu (obsługiwane przez Schedule-X)
- **Enter**: Wybór daty / otwarcie wydarzenia/zadania
- **Space**: Toggle checkbox zadania
- **Escape**: Zamknięcie modali

**Screen reader announcements**:
- Wybór daty: "Selected January 15, 2026. 2 tasks for this day"
- Toggle zadania: "Task 'Prepare medical documents' marked as completed"
- Zmiana miesiąca: "Showing February 2026. 8 events"

## 9. Warunki i walidacja

### Warunki weryfikowane na poziomie UI:

#### 1. Data range dla API calls

**Warunek**: `start_date` i `end_date` muszą być valid ISO 8601 date strings

**Weryfikacja**:
```typescript
function getMonthDateRange(month: Date): DateRange {
  if (!(month instanceof Date) || isNaN(month.getTime())) {
    throw new Error('Invalid month date');
  }

  const start = startOfMonth(month);
  const end = endOfMonth(month);
  
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd')
  };
}
```

---

#### 2. Filtrowanie zadań po wybranej dacie

**Warunek**: Zadanie pojawia się w sidebarze tylko jeśli `task.due_date` === `selectedDate` (same day)

**Weryfikacja**:
```typescript
const tasksForSelectedDate = useMemo(() => {
  return tasks.filter(task => {
    if (!task.due_date) return false;
    
    const dueDate = new Date(task.due_date);
    
    if (isNaN(dueDate.getTime())) {
      console.error('Invalid due_date for task:', task.id);
      return false;
    }
    
    return isSameDay(dueDate, selectedDate);
  });
}, [tasks, selectedDate]);
```

---

#### 3. Color coding wydarzeń (US-000)

**Warunek**: Wydarzenia osobiste (private) w kolorze niebieskim, rodzinne (shared) w kolorze zielonym

**Weryfikacja**:
```typescript
function getEventColorClasses(isPrivate: boolean): string {
  return isPrivate
    ? 'bg-blue-100 border-blue-300 text-blue-900' // private
    : 'bg-green-100 border-green-300 text-green-900'; // shared
}
```

---

#### 4. Lock icon dla private events (US-004)

**Warunek**: Prywatne wydarzenia pokazują lock icon

**Weryfikacja**:
```typescript
{event.is_private && (
  <Lock className="w-4 h-4 text-blue-600" aria-label="Private event" />
)}
```

---

#### 5. Optimistic UI rollback

**Warunek**: Jeśli PATCH /tasks/:taskId fails, UI musi wrócić do poprzedniego stanu

**Weryfikacja**:
```typescript
const handleTaskToggleComplete = useCallback(async (taskId: string, isCompleted: boolean) => {
  const previousTasks = [...tasks];
  
  // Optimistic update
  setTasks(prev => prev.map(t => 
    t.id === taskId ? { ...t, is_completed: isCompleted } : t
  ));

  try {
    await updateTaskCompletion(taskId, isCompleted);
  } catch (err) {
    // Rollback
    setTasks(previousTasks);
    toast.error('Failed to update task');
  }
}, [tasks]);
```

---

### Warunki weryfikowane przez backend (RLS):

1. **Widoczność wydarzeń**: Private wydarzenia widoczne tylko dla created_by, shared dla całej rodziny
2. **Widoczność zadań**: Analogicznie jak wydarzenia
3. **Uprawnienia do edycji**: Tylko created_by może edytować/usuwać wydarzenia

**UI nie robi własnej filtracji security-related** - RLS na backend jest source of truth.

## 10. Obsługa błędów

### 1. Network errors (brak połączenia)

**Obsługa**:
```typescript
try {
  const response = await getMockEvents(params);
  setEvents(response.events);
} catch (err) {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    setError('No internet connection. Please check your network.');
  } else {
    setError('Failed to load events');
  }
  console.error(err);
}
```

**UI feedback**:
- Toast (error, red): "No internet connection. Please check your network."
- Retry button w toast
- Jeśli są cache'owane dane: pokazuj je z warning banner "Showing offline data"

---

### 2. API errors (400, 401, 403, 404, 500)

**401 Unauthorized** (sesja wygasła):
```typescript
if (error.status === 401) {
  window.location.href = '/login';
}
```

**403 Forbidden** (brak uprawnień):
```typescript
if (error.status === 403) {
  toast.error('You don\'t have permission to access this resource');
}
```

**500 Internal Server Error**:
```typescript
if (error.status === 500) {
  toast.error('Server error. Please try again later.');
}
```

---

### 3. Optimistic UI failure (task toggle)

**Obsługa**:
```typescript
const handleTaskToggleComplete = async (taskId: string, isCompleted: boolean) => {
  const previousTasks = [...tasks];
  
  // Optimistic update
  setTasks(prev => prev.map(t => 
    t.id === taskId ? { ...t, is_completed: isCompleted } : t
  ));

  try {
    await updateTaskCompletion(taskId, isCompleted);
  } catch (err) {
    // Rollback with animation
    setTasks(previousTasks);
    
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    taskElement?.classList.add('animate-shake');
    setTimeout(() => taskElement?.classList.remove('animate-shake'), 500);
    
    toast.error('Failed to update task', {
      action: {
        label: 'Retry',
        onClick: () => handleTaskToggleComplete(taskId, isCompleted)
      }
    });
  }
};
```

**CSS dla shake animation**:
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}
```

---

### 4. Schedule-X integration errors

**Obsługa**: Error boundary w CalendarGrid

```typescript
class CalendarErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Calendar rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600">Failed to load calendar</p>
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 11. Kroki implementacji

### Krok 1: Setup projektu i dependencies

**Cel**: Zainstalować niezbędne biblioteki i skonfigurować workspace

**Akcje**:
1. Zainstaluj Schedule-X:
   ```bash
   npm install @schedule-x/calendar @schedule-x/theme-default
   ```

2. Zainstaluj date-fns:
   ```bash
   npm install date-fns
   ```

3. Zainstaluj shadcn/ui components:
   ```bash
   npx shadcn-ui@latest add button dialog sheet checkbox toast toggle-group scroll-area skeleton card
   ```

4. Zainstaluj lucide-react (icons):
   ```bash
   npm install lucide-react
   ```

**Weryfikacja**: `npm run dev` działa bez błędów

---

### Krok 2: Stwórz mock data service

**Cel**: Przygotować mock API dla development (endpoint nie zaimplementowany)

**Akcje**:
1. Utwórz plik `src/services/mockData.ts`
2. Zaimplementuj funkcje:
   - `getMockEvents(params: GetEventsQueryParams): Promise<ListEventsResponse>`
   - `getMockTasks(params: GetTasksQueryParams): Promise<ListTasksResponse>`
   - `updateTaskCompletion(taskId: string, isCompleted: boolean): Promise<UpdateTaskResponse>`
3. Dodaj sample data zgodne z US-000, US-003, US-004

**Weryfikacja**: Wywołanie `getMockEvents({})` zwraca valid data

---

### Krok 3: Stwórz typy i ViewModels

**Cel**: Zdefiniować wszystkie typy lokalne dla widoku

**Akcje**:
1. Utwórz plik `src/types/dashboard.types.ts`
2. Zdefiniuj:
   - `FilterOption`
   - `DashboardState`
   - `CalendarItemViewModel`
   - `QuickStartExample`
   - `DateRange`
3. Export wszystkich typów

**Weryfikacja**: TypeScript nie pokazuje błędów

---

### Krok 4: Zaimplementuj helper functions

**Cel**: Stwórz utility functions używane przez hook i komponenty

**Akcje**:
1. Utwórz plik `src/utils/dateHelpers.ts`:
   - `getMonthDateRange(month: Date): DateRange`
   - `isSameDay(date1: Date, date2: Date): boolean`
   - `formatDateForSidebar(date: Date): string`

2. Utwórz plik `src/utils/calendarTransformers.ts`:
   - `transformToCalendarItems(events, tasks): CalendarItemViewModel[]`
   - `mapFilterToApiParam(filter: FilterOption): boolean | undefined`
   - `getEventColorClasses(isPrivate: boolean): string`

**Weryfikacja**: Testy dodamy w przyszłości

---

### Krok 5: Zaimplementuj custom hook `useDashboard`

**Cel**: Enkapsulować całą logikę zarządzania stanem widoku

**Akcje**:
1. Utwórz plik `src/hooks/useDashboard.ts`
2. Zaimplementuj state variables
3. Zaimplementuj computed values (useMemo)
4. Zaimplementuj API calls
5. Zaimplementuj handlers
6. Dodaj useEffect dla initial fetch

**Weryfikacja**: Hook zwraca wszystkie expected values i handlers

---

### Krok 6: Zaimplementuj base components (bottom-up)

**Cel**: Stworzyć małe, reusable components

**Akcje** (w kolejności):
1. **EventCard** - `src/components/dashboard/EventCard.tsx`
2. **TaskItemInline** - `src/components/dashboard/TaskItemInline.tsx`
3. **TaskItem** - `src/components/dashboard/TaskItem.tsx`
4. **QuickStartCard** - `src/components/dashboard/QuickStartCard.tsx`
5. **SidebarEmptyState** - `src/components/dashboard/SidebarEmptyState.tsx`
6. **EmptyState** - `src/components/dashboard/EmptyState.tsx`

**Weryfikacja**: Każdy component renderuje się z mock props

---

### Krok 7: Zaimplementuj compound components

**Cel**: Stworzyć większe komponenty składające się z base components

**Akcje**:
1. **FilterToggle** - `src/components/dashboard/FilterToggle.tsx`
2. **AddEventButton** - `src/components/dashboard/AddEventButton.tsx`
3. **CalendarControls** - `src/components/dashboard/CalendarControls.tsx`
4. **SidebarHeader** - `src/components/dashboard/SidebarHeader.tsx`
5. **TaskList** - `src/components/dashboard/TaskList.tsx`

**Weryfikacja**: Komponenty renderują się z mock props

---

### Krok 8: Zaimplementuj Schedule-X wrapper (CalendarGrid)

**Cel**: Zintegrować bibliotekę Schedule-X z aplikacją

**Akcje**:
1. Utwórz `src/components/dashboard/CalendarGrid.tsx`
2. Zainstaluj i skonfiguruj Schedule-X
3. Zaimplementuj custom event renderer używający EventCard
4. Zaimplementuj custom task renderer używający TaskItemInline
5. Dodaj ARIA attributes dla accessibility
6. Dodaj keyboard navigation support
7. Wrap w CalendarErrorBoundary

**Weryfikacja**: Kalendarz renderuje się z mock wydarzeniami i zadaniami

---

### Krok 9: Zaimplementuj DailyTasksSidebar

**Cel**: Stworzyć sidebar z zadaniami dla wybranej daty

**Akcje**:
1. Utwórz `src/components/dashboard/DailyTasksSidebar.tsx`
2. Renderuj SidebarHeader
3. Renderuj TaskList lub SidebarEmptyState (conditional)
4. Dodaj shadcn/ui ScrollArea dla scrollable list
5. Zaimplementuj responsywność:
   - Desktop: fixed sidebar (320px)
   - Tablet: shadcn/ui Sheet (drawer)
   - Mobile: hidden

**Weryfikacja**: Sidebar pokazuje zadania dla wybranej daty

---

### Krok 10: Zaimplementuj CalendarArea

**Cel**: Połączyć CalendarControls, CalendarGrid, AddEventButton, EmptyState

**Akcje**:
1. Utwórz `src/components/dashboard/CalendarArea.tsx`
2. Layout: CalendarControls na górze, CalendarGrid w centrum
3. Conditional rendering: EmptyState jeśli brak wydarzeń
4. AddEventButton (responsive: standard button desktop, FAB mobile)
5. Propaguj wszystkie event handlery do parent

**Weryfikacja**: CalendarArea renderuje się z pełną funkcjonalnością

---

### Krok 11: Zaimplementuj DashboardView (main container)

**Cel**: Połączyć wszystko w główny widok

**Akcje**:
1. Utwórz `src/pages/DashboardView.tsx`
2. Użyj `useDashboard()` hook
3. Renderuj CalendarArea z props z hooka
4. Renderuj DailyTasksSidebar z props z hooka
5. Layout: Flexbox/Grid dla desktop (sidebar on right)
6. Dodaj error handling i loading states
7. Dodaj Toast component dla notifications

**Weryfikacja**: Pełny widok działa z mock data

---

### Krok 12: Stylowanie i responsywność

**Cel**: Dostosować UI do różnych rozdzielczości

**Akcje**:
1. Dodaj Tailwind breakpoint utilities:
   - Mobile: domyślne style
   - Tablet: `md:` prefix
   - Desktop: `lg:` prefix
2. Zaimplementuj collapsible sidebar dla tablet (shadcn/ui Sheet)
3. Zaimplementuj FAB dla mobile (AddEventButton)
4. Testuj na różnych rozdzielczościach

**Weryfikacja**: Widok wygląda dobrze na mobile/tablet/desktop

---

### Krok 13: Accessibility

**Cel**: Zapewnić pełną dostępność dla keyboard i screen readers

**Akcje**:
1. Dodaj ARIA labels dla wszystkich interactive elements
2. Sprawdź Tab order (logical keyboard navigation)
3. Dodaj focus indicators (visible focus states)
4. Dodaj screen reader announcements dla dynamic content
5. Test z screen reader (NVDA/VoiceOver)
6. Test keyboard navigation (Tab, Arrow keys, Enter, Space, Escape)

**Weryfikacja**: Widok jest w pełni accessible

---

### Krok 14: Error handling i edge cases

**Cel**: Obsłużyć wszystkie scenariusze błędów

**Akcje**:
1. Dodaj error boundaries
2. Zaimplementuj rollback dla optimistic UI
3. Dodaj toasts dla wszystkich error scenarios
4. Dodaj retry mechanisms
5. Testuj network failures, API errors, invalid data

**Weryfikacja**: Wszystkie error scenarios są gracefully handled

---

### Krok 15: Testy dodamy w przyszłości



---

### Krok 16: Integracja z routing

**Cel**: Podłączyć widok do aplikacji

**Akcje**:
1. Dodaj route `/dashboard` w router configuration
2. Dodaj authentication guard
3. Dodaj redirect po loginie do `/dashboard`
4. Testuj navigation z innych widoków

**Weryfikacja**: Użytkownik po loginie ląduje na Dashboard

---

## Podsumowanie

Ten plan implementacji zapewnia:

✅ **Kompletność**: Wszystkie wymagania z US-000, US-003, US-004  
✅ **Modularność**: Komponenty są reusable i dobrze zorganizowane  
✅ **Responsywność**: Desktop/Tablet/Mobile layouts  
✅ **Accessibility**: Keyboard navigation i screen reader support  
✅ **Error handling**: Graceful degradation i user feedback  
✅ **Performance**: Optimistic UI, memoization, efficient re-renders  
✅ **Maintainability**: Clean code, separation of concerns, TypeScript safety  

**Szacowany czas implementacji**: 3-5 dni dla doświadczonego frontend developera

**Priorytety dla MVP**:
1. Core functionality (steps 1-11): Calendar + Sidebar + Interactions
2. Responsywność (step 12): Mobile/Desktop support
3. Accessibility (step 13): Keyboard i screen reader
4. Polish (steps 14-15): Error handling, animations, testing

**Nice-to-have (post-MVP)**:
- Real-time updates (polling/WebSocket)
- Drag & drop dla wydarzeń
- Keyboard shortcuts (beyond basic navigation)
- Performance optimizations (virtualization dla długich list)

