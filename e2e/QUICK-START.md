# Quick Start - E2E Tests

## 🚀 Szybki start (5 minut)

### 1. Upewnij się, że masz dane testowe

Plik `.env.test` powinien zawierać:
```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
E2E_USERNAME=test@example.com
E2E_PASSWORD=Test123456!
E2E_USERNAME_ID=user-id
```

### 2. Uruchom aplikację

```bash
npm run dev
```

Aplikacja powinna być dostępna na `http://localhost:5173`

### 3. Uruchom testy

**W trybie interaktywnym (polecane na start):**
```bash
npm run test:e2e:ui
```

Otworzy się interfejs Playwright UI, gdzie możesz:
- Kliknąć test, aby go uruchomić
- Zobaczyć wizualizację każdego kroku
- Sprawdzić screenshots i logi
- Debugować problemy

**W trybie headless (szybki):**
```bash
npm run test:e2e
```

**Z widoczną przeglądarką:**
```bash
npm run test:e2e:headed
```

### 4. Zobacz wyniki

Po uruchomieniu testów:
```bash
npm run test:e2e:report
```

Otworzy raport HTML z wynikami testów.

## 📝 Tworzenie pierwszego testu

### Opcja 1: Prosty test (bez POM)

```typescript
// e2e/my-first-test.spec.ts
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  // ... your test
});
```

### Opcja 2: Z Page Object Model

```typescript
// e2e/my-test-pom.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test('should do something', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs('test@example.com', 'password');
  // ... your test
});
```

### Opcja 3: Z fixtures (najczystszy kod)

```typescript
// e2e/my-test-fixtures.spec.ts
import { test, expect } from './fixtures';

test('should do something', async ({ 
  authenticatedPage, 
  dashboardPage 
}) => {
  // Already logged in!
  await dashboardPage.openCreateEventDialog();
  // ... your test
});
```

## 🎯 Typowe problemy

### Test nie znajduje elementu
- Sprawdź czy aplikacja działa (`localhost:5173`)
- Użyj `--debug` aby zobaczyć co się dzieje:
  ```bash
  npx playwright test --debug
  ```

### Login nie działa
- Sprawdź `.env.test` - czy dane są poprawne?
- Sprawdź w Supabase czy użytkownik istnieje

### AI suggestions timeout
- To normalne - AI może nie zwrócić sugestii
- Test obsługuje ten przypadek automatycznie

## 🔧 Debugowanie

### Krok po kroku:
```bash
npm run test:e2e:debug
```

### Inspector:
```bash
npx playwright test --debug
```

### Traces:
Po failed teście:
```bash
npx playwright show-trace trace.zip
```

## 📚 Następne kroki

1. ✅ Przejrzyj `e2e/README.md` - pełna dokumentacja
2. ✅ Zobacz `e2e/create-event.spec.ts` - przykładowy test
3. ✅ Sprawdź `e2e/pages/` - Page Object Models
4. ✅ Użyj `e2e/utils/helpers.ts` - pomocnicze funkcje

## 💡 Wskazówki

- Używaj `test.step()` dla lepszych raportów
- Dodawaj `console.log()` do debugowania
- Sprawdzaj zarówno happy path jak i error cases
- Używaj fixtures dla testów wymagających logowania
- Nie hardcoduj danych - używaj `TestData` z helpers
