# E2E Tests - Playwright

## Przegląd

Testy E2E (End-to-End) dla aplikacji HomeHQ używające Playwright.

## Wymagania wstępne

1. **Zainstalowane zależności:**
   ```bash
   npm install
   ```

2. **Plik `.env.test`** z danymi testowymi:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   E2E_USERNAME=test@example.com
   E2E_PASSWORD=Test123456!
   E2E_USERNAME_ID=user-id-from-supabase
   ```

3. **Działająca aplikacja:**
   ```bash
   npm run dev
   ```
   Aplikacja powinna być dostępna na `http://localhost:5173`

## Uruchamianie testów

### Wszystkie testy w trybie headless (szybki):
```bash
npx playwright test
```

### Testy w trybie UI (interaktywny):
```bash
npx playwright test --ui
```

### Testy z widoczną przeglądarką (headed mode):
```bash
npx playwright test --headed
```

### Konkretny plik testowy:
```bash
npx playwright test e2e/create-event.spec.ts
```

### Konkretny test:
```bash
npx playwright test -g "should create an event"
```

### Debug mode:
```bash
npx playwright test --debug
```

## Dostępne testy

### `create-event.spec.ts`

Testuje scenariusz tworzenia wydarzenia z następującymi case'ami:

1. **Główny scenariusz** - Tworzenie wydarzenia z sugestiami AI:
   - Logowanie do aplikacji
   - Otwieranie dialogu tworzenia wydarzenia
   - Wypełnienie formularza (tytuł, daty)
   - Oczekiwanie na sugestie AI tasków
   - Zaznaczenie pierwszej sugestii
   - Wysłanie formularza
   - Weryfikacja sukcesu

2. **Walidacja formularza** - Sprawdzenie błędów walidacji:
   - Próba wysłania pustego formularza
   - Weryfikacja HTML5 validation

3. **Anulowanie** - Zamykanie dialogu bez zapisywania:
   - Otwieranie dialogu
   - Kliknięcie "Cancel"
   - Weryfikacja zamknięcia

### `create-event-pom.spec.ts`

Ten sam scenariusz, ale używa **Page Object Model** pattern dla lepszej organizacji kodu:
- `LoginPage` - zarządza logowaniem
- `DashboardPage` - zarządza dashboardem
- `CreateEventDialog` - zarządza dialogiem tworzenia wydarzenia

Przykład użycia POM:
```typescript
const loginPage = new LoginPage(page);
const dashboardPage = new DashboardPage(page);
const createEventDialog = new CreateEventDialog(page);

await loginPage.loginAs(email, password);
await dashboardPage.openCreateEventDialog();
await createEventDialog.createEvent({ title: 'Meeting', ... });
```

### `create-event-fixtures.example.ts`

Przykład użycia **custom fixtures** dla jeszcze czystszego kodu:
- Automatyczna autentykacja przed każdym testem
- Wszystkie Page Objects dostępne jako fixtures
- Mniej boilerplate code

```typescript
test('my test', async ({ authenticatedPage, dashboardPage }) => {
  // Already logged in!
  await dashboardPage.openCreateEventDialog();
});
```

## Struktura katalogów

```
e2e/
├── create-event.spec.ts           # Główny test (bez POM)
├── create-event-pom.spec.ts       # Test z Page Object Model
├── create-event-fixtures.example.ts  # Przykład z fixtures (nie uruchamiany)
├── example.spec.ts                # Domyślny przykład Playwright
├── README.md                      # Ta dokumentacja
├── pages/                         # Page Object Models
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   └── CreateEventDialog.ts
├── fixtures/                      # Custom Playwright fixtures
│   └── index.ts
└── utils/                         # Utility functions
    └── helpers.ts
```

## Struktura testu

Testy używają:
- `test.describe()` - grupowanie testów
- `test.beforeEach()` - setup przed każdym testem
- `test.step()` - dzielenie testu na kroki (lepsze raporty)
- `expect()` - asercje

## Selektory używane w testach

- **Logowanie:**
  - Email: `input[type="email"]`
  - Password: `input[type="password"]`
  - Login button: `button:has-text("Zaloguj się")`

- **Dashboard:**
  - Title: `h1:has-text("HomeHQ")`
  - Add Event button: `button:has-text("Add Event")`

- **Event Dialog:**
  - Title input: `input#title`
  - Start time: `input#startTime`
  - End time: `input#endTime`
  - Suggestion checkbox: `input[type="checkbox"][id^="suggestion-"]`
  - Submit button: `button[type="submit"]:has-text("Create Event")`
  - Success message: `text=Event created successfully`

## Raporty

Po uruchomieniu testów, raport HTML jest dostępny:
```bash
npx playwright show-report
```

## Troubleshooting

### Test fails: "Add Event button not visible"
- Sprawdź czy aplikacja działa na `localhost:5173`
- Sprawdź czy użytkownik testowy ma dostęp do dashboardu
- Sprawdź czy dane w `.env.test` są poprawne

### Test fails: "AI suggestions timeout"
- To jest normalne - AI może nie zwrócić sugestii
- Test obsługuje ten przypadek i kontynuuje

### Test fails: "Login timeout"
- Sprawdź czy Supabase credentials w `.env.test` są poprawne
- Sprawdź czy użytkownik testowy istnieje w bazie

## Dodawanie nowych testów

1. Utwórz nowy plik w folderze `e2e/` z końcówką `.spec.ts`
2. Importuj niezbędne narzędzia:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Użyj struktury z `test.describe()` i `test.step()` dla lepszej czytelności
4. Dodaj odpowiednie asercje używając `expect()`

**Dla testów z Page Object Model:**
```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
// ... import innych Page Objects
```

**Dla testów z custom fixtures:**
```typescript
import { test, expect } from './fixtures';
// Fixtures automatycznie zapewniają autentykację
```

## Pomocnicze funkcje (utils/helpers.ts)

W pliku helpers dostępne są przydatne funkcje:

```typescript
import { 
  formatDateTimeLocal, 
  getDaysFromNow, 
  TestData, 
  TestCredentials,
  retry
} from './utils/helpers';

// Formatowanie dat dla input datetime-local
const dateTime = formatDateTimeLocal(new Date(), 14, 30);

// Generowanie dat
const tomorrow = getDaysFromNow(1);
const yesterday = getDaysAgo(1);

// Generowanie testowych danych
const eventTitle = TestData.event.title();
const taskDescription = TestData.task.description('Important');

// Credentials
const { email, password } = TestCredentials;

// Retry dla niestabilnych operacji
await retry(async () => {
  // flaky operation
}, { maxAttempts: 3, delay: 1000 });
```

## Najlepsze praktyki

- ✅ Używaj `test.step()` dla logicznych kroków
- ✅ Dodawaj sensowne timeouty dla operacji async
- ✅ Używaj `getByRole` / `getByLabel` gdzie możliwe (accessibility)
- ✅ Sprawdzaj zarówno happy path jak i edge cases
- ✅ Dodawaj console.log dla debugowania
- ❌ Nie używaj `page.waitForTimeout()` bez powodu
- ❌ Nie hardcoduj credentials w testach (używaj .env.test)

## CI/CD

W środowisku CI (np. GitHub Actions):
```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npx playwright test
  env:
    CI: true
```

Konfiguracja automatycznie:
- Uruchamia testy sekwencyjnie (nie równolegle)
- Powtarza failed testy 2 razy
- Generuje HTML report
