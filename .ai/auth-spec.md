# Specyfikacja Architektury Modułu Autentykacji - HomeHQ

## 1. Przegląd Ogólny

Moduł autentykacji implementuje wymagania z **US-007** (Secure Access and Authentication) zgodnie z PRD. System wykorzystuje **Supabase Auth** jako backend autentykacji, **Vite 6** jako bundler, **React 19** jako framework frontendowy oraz **TypeScript 5** dla typowania. Aplikacja nie używa React Router - routing oparty jest na stanie komponentów i hooku `useAuth`.

### 1.1. Wymagania Funkcjonalne (US-007)

- **Rejestracja**: Email, hasło, potwierdzenie hasła
- **Logowanie**: Email i hasło
- **Wylogowanie**: Przycisk w prawym górnym rogu Dashboard (UserMenu)
- **Odzyskiwanie hasła**: Możliwość resetu hasła przez email
- **Strona powitalna**: Dla niezalogowanych użytkowników z opisem aplikacji (LandingPage)
- **Ochrona tras**: Wymaganie logowania do tworzenia wydarzeń/zadań i przeglądania kalendarza
- **Brak zewnętrznych providerów**: Tylko email/password (bez Google, GitHub)
- **UWAGA**: W PRD (linia 128) jest błędnie napisane o przycisku logowania na Dashboard - to jest sprzeczne, ponieważ użytkownik na Dashboard jest już zalogowany. Przycisk logowania znajduje się tylko na LandingPage.

### 1.2. Zgodność z Istniejącą Architekturą

- **Routing**: Rozszerzenie obecnego routingu opartego na stanie w `App.tsx`
- **Hook useAuth**: Rozszerzenie o metody logowania, rejestracji, wylogowania i resetu hasła
- **Supabase Client**: Wykorzystanie istniejącego `createClient()` z `src/db/supabase.client.ts`
- **Komponenty UI**: Wykorzystanie istniejących komponentów shadcn/ui (Button, Input, Label, Card, Alert)
- **DEV Mode**: Zachowanie możliwości mockowania autentykacji w trybie deweloperskim

---

## 2. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 2.1. Struktura Stron i Komponentów

#### 2.1.1. Nowe Strony (Pages)

**`src/pages/auth/LandingPage.tsx`**
- **Cel**: Strona powitalna dla niezalogowanych użytkowników
- **Zawartość**:
  - Logo i nazwa aplikacji "HomeHQ"
  - Krótki opis wartości aplikacji (redukcja mental load rodziców)
  - Przyciski CTA: "Zaloguj się" i "Utwórz konto"
  - Responsywny layout (mobile-first)
- **Styling**: Tailwind 4, komponenty Card z shadcn/ui
- **Nawigacja**: Przyciski przekierowują do odpowiednich widoków

**`src/pages/auth/LoginPage.tsx`**
- **Cel**: Formularz logowania
- **Zawartość**:
  - Formularz z polami: Email, Hasło
  - Link "Zapomniałeś hasła?" → ResetPasswordPage
  - Link "Nie masz konta? Zarejestruj się" → RegisterPage
  - Przycisk "Zaloguj się"
  - Obsługa błędów (wyświetlanie komunikatów)
- **Komponenty**: Wykorzystuje `LoginForm` (komponent formularza)

**`src/pages/auth/RegisterPage.tsx`**
- **Cel**: Formularz rejestracji
- **Zawartość**:
  - Formularz z polami: Email, Hasło, Potwierdzenie hasła
  - Walidacja zgodności haseł
  - Link "Masz już konto? Zaloguj się" → LoginPage
  - Przycisk "Utwórz konto"
  - Obsługa błędów
- **Komponenty**: Wykorzystuje `RegisterForm` (komponent formularza)

**`src/pages/auth/ResetPasswordPage.tsx`**
- **Cel**: Formularz resetu hasła (krok 1: wysłanie emaila)
- **Zawartość**:
  - Pole: Email
  - Przycisk "Wyślij link resetujący"
  - Komunikat sukcesu po wysłaniu emaila
  - Link powrotu do logowania
- **Komponenty**: Wykorzystuje `ResetPasswordForm`

**`src/pages/auth/UpdatePasswordPage.tsx`**
- **Cel**: Formularz ustawienia nowego hasła (krok 2: po kliknięciu w link z emaila)
- **Zawartość**:
  - Pola: Nowe hasło, Potwierdzenie hasła
  - Przycisk "Zmień hasło"
  - Obsługa błędów (nieprawidłowy/nieaktualny token)
- **Komponenty**: Wykorzystuje `UpdatePasswordForm`
- **Uwaga**: Ta strona jest renderowana gdy w URL znajduje się hash z tokenem resetującym (Supabase automatycznie przekierowuje)

#### 2.1.2. Komponenty Formularzy

**`src/components/auth/LoginForm.tsx`**
- **Odpowiedzialność**: Logika formularza logowania
- **Funkcjonalność**:
  - Zarządzanie stanem formularza (email, password)
  - Walidacja pól (email format, hasło wymagane)
  - Wywołanie `useAuth().signIn()` z hooka
  - Wyświetlanie błędów walidacji i błędów autentykacji
  - Loading state podczas logowania
  - Przekierowanie po sukcesie (automatyczne przez `useAuth`)
- **Props**: Brak (samodzielny komponent)
- **Walidacja**: 
  - Email: format email (regex lub HTML5 validation)
  - Hasło: wymagane pole
- **Komunikaty błędów**:
  - "Email jest wymagany"
  - "Nieprawidłowy format email"
  - "Hasło jest wymagane"
  - "Nieprawidłowy email lub hasło" (z Supabase)
  - "Wystąpił błąd podczas logowania"

**`src/components/auth/RegisterForm.tsx`**
- **Odpowiedzialność**: Logika formularza rejestracji
- **Funkcjonalność**:
  - Zarządzanie stanem (email, password, confirmPassword)
  - Walidacja: email format, hasło min. 6 znaków, zgodność haseł
  - Wywołanie `useAuth().signUp()`
  - Wyświetlanie błędów
  - Loading state
  - Przekierowanie po sukcesie
- **Walidacja**:
  - Email: format email
  - Hasło: min. 6 znaków (wymaganie Supabase)
  - Potwierdzenie: musi być identyczne z hasłem
- **Komunikaty błędów**:
  - "Email jest wymagany"
  - "Nieprawidłowy format email"
  - "Hasło musi mieć minimum 6 znaków"
  - "Hasła nie są identyczne"
  - "Email jest już zarejestrowany" (z Supabase)
  - "Wystąpił błąd podczas rejestracji"

**`src/components/auth/ResetPasswordForm.tsx`**
- **Odpowiedzialność**: Wysłanie emaila resetującego hasło
- **Funkcjonalność**:
  - Pole email
  - Wywołanie `useAuth().resetPassword(email)`
  - Komunikat sukcesu: "Sprawdź swoją skrzynkę email"
  - Link powrotu do logowania
- **Walidacja**: Email format
- **Komunikaty błędów**:
  - "Email jest wymagany"
  - "Nieprawidłowy format email"
  - "Nie znaleziono konta z tym emailem" (z Supabase)

**`src/components/auth/UpdatePasswordForm.tsx`**
- **Odpowiedzialność**: Ustawienie nowego hasła po kliknięciu w link
- **Funkcjonalność**:
  - Pola: newPassword, confirmPassword
  - Wywołanie `useAuth().updatePassword(newPassword)`
  - Walidacja zgodności haseł
  - Przekierowanie do logowania po sukcesie
- **Walidacja**: 
  - Hasło: min. 6 znaków
  - Potwierdzenie: zgodność z hasłem
- **Komunikaty błędów**:
  - "Hasło musi mieć minimum 6 znaków"
  - "Hasła nie są identyczne"
  - "Link resetujący wygasł lub jest nieprawidłowy" (z Supabase)

#### 2.1.3. Komponenty Nawigacyjne

**`src/components/auth/AuthHeader.tsx`**
- **Odpowiedzialność**: Nagłówek dla stron autentykacji
- **Zawartość**:
  - Logo/nazwa "HomeHQ"
  - Opcjonalny link powrotu do LandingPage
- **Użycie**: Wszystkie strony auth (LoginPage, RegisterPage, ResetPasswordPage)

**`src/components/dashboard/UserMenu.tsx`** (NOWY)
- **Odpowiedzialność**: Menu użytkownika w prawym górnym rogu Dashboard
- **Zawartość**:
  - Avatar/Inicjały użytkownika lub ikona użytkownika
  - Dropdown menu z opcjami:
    - Email użytkownika (wyświetlony)
    - Separator
    - "Wyloguj się" (wywołuje `useAuth().signOut()`)
- **Lokalizacja**: W headerze DashboardView (prawy górny róg)
- **Styling**: shadcn/ui DropdownMenu (jeśli dostępny) lub custom dropdown
- **Uwaga**: Zastępuje obecny przycisk "Family Settings" w układzie (lub współistnieje obok)
- **UWAGA**: Przycisk logowania NIE znajduje się na Dashboard (użytkownik jest już zalogowany). Przycisk logowania jest tylko na LandingPage dla niezalogowanych użytkowników.

**`src/components/dashboard/AuthButton.tsx`** (NIE POTRZEBNY - USUNIĘTY)
- **Uwaga**: LandingPage ma już własne przyciski CTA ("Zaloguj się" i "Utwórz konto"), więc osobny komponent AuthButton jest nadmiarowy

#### 2.1.4. Rozszerzenie Istniejących Komponentów

**`src/pages/DashboardView.tsx`**
- **Zmiany**:
  - Dodanie `UserMenu` w headerze (obok lub zamiast przycisku "Family Settings")
  - Warunkowe renderowanie: tylko dla zalogowanych użytkowników (`isAuthenticated === true`)
  - Usunięcie lub modyfikacja logiki DEV mode auto-login (zachowanie opcjonalne)

**`src/App.tsx`**
- **Zmiany w routingu**:
  ```typescript
  // Nowa logika routingu:
  if (isLoading) → LoadingScreen
  if (error && !isAuthenticated) → ErrorScreen (z możliwością powrotu do LandingPage)
  if (!isAuthenticated) → LandingPage (NOWA STRONA)
  if (isAuthenticated && !hasFamily) → CreateFamilyPage
  if (isAuthenticated && hasFamily) → DashboardView
  ```
- **Uwaga**: Zachowanie obecnej struktury bez React Router - routing oparty na stanie

### 2.2. Walidacja i Komunikaty Błędów

#### 2.2.1. Walidacja Klienta (Client-Side)

**Biblioteka walidacji**: Zod (jeśli już używana w projekcie) lub natywna walidacja HTML5 + custom logic

**Schematy walidacji**:

```typescript
// src/validations/auth.schema.ts (NOWY PLIK)

// Login Schema
email: z.string().email("Nieprawidłowy format email")
password: z.string().min(1, "Hasło jest wymagane")

// Register Schema
email: z.string().email("Nieprawidłowy format email")
password: z.string().min(6, "Hasło musi mieć minimum 6 znaków")
confirmPassword: z.string()
  .refine((val, ctx) => val === ctx.parent.password, {
    message: "Hasła nie są identyczne"
  })

// Reset Password Schema
email: z.string().email("Nieprawidłowy format email")

// Update Password Schema
newPassword: z.string().min(6, "Hasło musi mieć minimum 6 znaków")
confirmPassword: z.string()
  .refine((val, ctx) => val === ctx.parent.newPassword, {
    message: "Hasła nie są identyczne"
  })
```

#### 2.2.2. Komunikaty Błędów z Supabase

**Mapowanie błędów Supabase na komunikaty użytkownika**:

```typescript
// src/utils/auth.errors.ts (NOWY PLIK)

// Funkcja mapująca błędy Supabase na czytelne komunikaty
function mapAuthError(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Nieprawidłowy email lub hasło';
    case 'Email already registered':
      return 'Email jest już zarejestrowany';
    case 'Password should be at least 6 characters':
      return 'Hasło musi mieć minimum 6 znaków';
    case 'Token has expired or is invalid':
      return 'Link resetujący wygasł lub jest nieprawidłowy';
    case 'User not found':
      return 'Nie znaleziono konta z tym emailem';
    default:
      return 'Wystąpił błąd podczas operacji. Spróbuj ponownie.';
  }
}
```

#### 2.2.3. Wyświetlanie Błędów

**Komponent `ErrorDisplay`** (można rozszerzyć istniejący z `src/components/tasks/ErrorDisplay.tsx`):
- Wyświetlanie błędów walidacji pod odpowiednimi polami
- Wyświetlanie błędów autentykacji jako alert na górze formularza
- Styling: Alert z shadcn/ui (variant: destructive) lub custom error message

### 2.3. Obsługa Scenariuszy

#### 2.3.1. Scenariusz 1: Nowy Użytkownik (Rejestracja)

1. Użytkownik otwiera aplikację → `LandingPage`
2. Klika "Utwórz konto" → `RegisterPage`
3. Wypełnia formularz (email, hasło, potwierdzenie)
4. Klika "Utwórz konto"
5. Walidacja klienta → jeśli OK, wywołanie `signUp()`
6. Supabase tworzy konto i wysyła email weryfikacyjny (opcjonalnie, zależnie od konfiguracji)
7. `useAuth` aktualizuje stan → `isAuthenticated = true`, `hasFamily = false`
8. `App.tsx` przekierowuje do `CreateFamilyPage`
9. Użytkownik tworzy rodzinę → przekierowanie do `DashboardView`

**Obsługa błędów**:
- Email już istnieje → komunikat błędu w formularzu
- Słabe hasło → komunikat walidacji
- Błąd sieci → komunikat z możliwością ponowienia

#### 2.3.2. Scenariusz 2: Logowanie Istniejącego Użytkownika

1. Użytkownik otwiera aplikację → `LandingPage`
2. Klika "Zaloguj się" → `LoginPage`
3. Wypełnia email i hasło
4. Klika "Zaloguj się"
5. Walidacja → wywołanie `signIn()`
6. Supabase weryfikuje dane → zwraca sesję
7. `useAuth` aktualizuje stan → `isAuthenticated = true`
8. `useAuth` pobiera profil → `hasFamily` określa routing
9. Przekierowanie: `CreateFamilyPage` (brak rodziny) lub `DashboardView` (ma rodzinę)

**Obsługa błędów**:
- Nieprawidłowe dane → komunikat "Nieprawidłowy email lub hasło"
- Konto nie istnieje → ten sam komunikat (security best practice)
- Błąd sieci → komunikat z możliwością ponowienia

#### 2.3.3. Scenariusz 3: Wylogowanie

1. Użytkownik klika menu użytkownika w `DashboardView`
2. Klika "Wyloguj się"
3. Wywołanie `signOut()`
4. Supabase usuwa sesję
5. `useAuth` czyści stan → `isAuthenticated = false`, `user = null`
6. `App.tsx` przekierowuje do `LandingPage`

#### 2.3.4. Scenariusz 4: Odzyskiwanie Hasła

**Krok 1: Żądanie resetu**
1. Użytkownik na `LoginPage` klika "Zapomniałeś hasła?"
2. Przekierowanie do `ResetPasswordPage`
3. Wprowadza email
4. Wywołanie `resetPassword(email)`
5. Supabase wysyła email z linkiem resetującym
6. Komunikat sukcesu: "Sprawdź swoją skrzynkę email"

**Krok 2: Ustawienie nowego hasła**
1. Użytkownik klika link w emailu
2. Supabase przekierowuje do aplikacji z hash w URL (np. `#access_token=...&type=recovery`)
3. `useAuth` wykrywa hash i wyodrębnia token
4. Renderowanie `UpdatePasswordPage`
5. Użytkownik wprowadza nowe hasło i potwierdzenie
6. Wywołanie `updatePassword(newPassword, token)`
7. Supabase weryfikuje token i aktualizuje hasło
8. Przekierowanie do `LoginPage` z komunikatem sukcesu

**Obsługa błędów**:
- Email nie istnieje → komunikat (lub ogólny komunikat sukcesu dla bezpieczeństwa)
- Token wygasł → komunikat "Link wygasł, wyślij nowy"
- Nieprawidłowy token → komunikat błędu

#### 2.3.5. Scenariusz 5: Ochrona Tras (Route Guards)

**Implementacja w `App.tsx`**:
- Sprawdzanie `isAuthenticated` przed renderowaniem `DashboardView` lub `CreateFamilyPage`
- Jeśli `!isAuthenticated` → renderowanie `LandingPage`
- Jeśli `isAuthenticated && isLoading` → renderowanie LoadingScreen

**Ochrona na poziomie komponentów**:
- `DashboardView`: Sprawdzenie `isAuthenticated` (opcjonalne, bo routing już to zapewnia)
- Komponenty tworzenia wydarzeń/zadań: Sprawdzenie `isAuthenticated` przed wywołaniem API

---

## 3. LOGIKA BACKENDOWA

### 3.1. Rozszerzenie Hooka useAuth

**`src/hooks/useAuth.ts`** (MODYFIKACJA)

**Nowe metody w interfejsie `UseAuthReturn`**:

```typescript
interface UseAuthReturn {
  // Istniejące pola (bez zmian)
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasFamily: boolean;
  error: Error | null;
  refreshProfile: () => Promise<void>;
  
  // NOWE METODY
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string, token?: string) => Promise<{ success: boolean; error?: string }>;
}
```

**Implementacja metod**:

**`signIn(email, password)`**:
```typescript
const signIn = useCallback(async (email: string, password: string) => {
  try {
    setIsLoading(true);
    setError(null);
    
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (signInError) {
      const errorMessage = mapAuthError(signInError);
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    }
    
    if (!data.user) {
      throw new Error('No user returned from sign in');
    }
    
    // Aktualizacja stanu użytkownika
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || '',
      display_name: data.user.user_metadata?.display_name,
    };
    
    setUser(authUser);
    
    // Pobranie profilu
    await fetchProfile(data.user.id);
    
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas logowania';
    setError(new Error(errorMessage));
    return { success: false, error: errorMessage };
  } finally {
    setIsLoading(false);
  }
}, [fetchProfile]);
```

**`signUp(email, password)`**:
```typescript
const signUp = useCallback(async (email: string, password: string) => {
  try {
    setIsLoading(true);
    setError(null);
    
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      // Opcjonalnie: options dla email verification
      // options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    
    if (signUpError) {
      const errorMessage = mapAuthError(signUpError);
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    }
    
    if (!data.user) {
      throw new Error('No user returned from sign up');
    }
    
    // Aktualizacja stanu użytkownika
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || '',
      display_name: data.user.user_metadata?.display_name,
    };
    
    setUser(authUser);
    
    // Pobranie profilu (może nie istnieć jeszcze, jeśli nie ma automatycznego tworzenia)
    await fetchProfile(data.user.id);
    
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas rejestracji';
    setError(new Error(errorMessage));
    return { success: false, error: errorMessage };
  } finally {
    setIsLoading(false);
  }
}, [fetchProfile]);
```

**`signOut()`**:
```typescript
const signOut = useCallback(async () => {
  try {
    setIsLoading(true);
    
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      throw new Error(signOutError.message);
    }
    
    // Wyczyszczenie stanu
    setUser(null);
    setProfile(null);
    setError(null);
  } catch (err) {
    console.error('[useAuth] Sign out failed:', err);
    setError(err instanceof Error ? err : new Error('Wystąpił błąd podczas wylogowania'));
  } finally {
    setIsLoading(false);
  }
}, []);
```

**`resetPassword(email)`**:
```typescript
const resetPassword = useCallback(async (email: string) => {
  try {
    setIsLoading(true);
    setError(null);
    
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    
    if (resetError) {
      const errorMessage = mapAuthError(resetError);
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    }
    
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas resetu hasła';
    setError(new Error(errorMessage));
    return { success: false, error: errorMessage };
  } finally {
    setIsLoading(false);
  }
}, []);
```

**`updatePassword(newPassword, token?)`**:
```typescript
const updatePassword = useCallback(async (newPassword: string, token?: string) => {
  try {
    setIsLoading(true);
    setError(null);
    
    const supabase = createClient();
    
    // Jeśli token jest podany (z URL hash), używamy go
    if (token) {
      // Supabase automatycznie obsługuje token z URL hash
      // Wystarczy wywołać updateUser z nowym hasłem
    }
    
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (updateError) {
      const errorMessage = mapAuthError(updateError);
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    }
    
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas zmiany hasła';
    setError(new Error(errorMessage));
    return { success: false, error: errorMessage };
  } finally {
    setIsLoading(false);
  }
}, []);
```

**Obsługa URL hash dla resetu hasła**:

W `useEffect` w `useAuth`, dodać logikę wykrywania hash w URL:

```typescript
useEffect(() => {
  // Sprawdzenie czy w URL jest hash z tokenem resetującym
  const hash = window.location.hash;
  if (hash.includes('type=recovery') && hash.includes('access_token')) {
    // Supabase automatycznie parsuje hash i ustawia sesję
    // Możemy przekierować użytkownika do UpdatePasswordPage
    // lub pozwolić App.tsx obsłużyć routing
  }
}, []);
```

### 3.2. Walidacja Danych Wejściowych

**Poziom 1: Walidacja Klienta (React Forms)**
- Wykorzystanie Zod schematów (jeśli dostępne) lub natywnej walidacji HTML5
- Walidacja przed wysłaniem żądania do Supabase
- Natychmiastowa informacja zwrotna dla użytkownika

**Poziom 2: Walidacja Supabase**
- Supabase automatycznie waliduje:
  - Format email (RFC 5322)
  - Długość hasła (min. 6 znaków, konfigurowalne)
  - Unikalność email (przy rejestracji)
- Błędy zwracane przez Supabase są mapowane na czytelne komunikaty

### 3.3. Obsługa Wyjątków

**Typy błędów**:

1. **Błędy walidacji** (client-side):
   - Obsługiwane przez komponenty formularzy
   - Wyświetlane jako inline errors pod polami

2. **Błędy autentykacji** (Supabase):
   - Mapowane przez `mapAuthError()`
   - Wyświetlane jako Alert na górze formularza

3. **Błędy sieci**:
   - Obsługiwane przez try-catch w metodach `useAuth`
   - Komunikat: "Wystąpił błąd połączenia. Sprawdź połączenie internetowe."

4. **Błędy sesji**:
   - Wykrywanie wygasłej sesji przez Supabase
   - Automatyczne odświeżenie tokena (jeśli włączone `autoRefreshToken`)
   - W przypadku niepowodzenia: wylogowanie użytkownika

### 3.4. Aktualizacja Routingu w App.tsx

**Nowa logika routingu**:

```typescript
function App() {
  const { 
    isLoading, 
    isAuthenticated, 
    hasFamily, 
    error 
  } = useAuth();

  // 1. Loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 2. Error state (tylko jeśli nie jesteśmy zalogowani)
  if (error && !isAuthenticated) {
    return <ErrorScreen error={error} />;
  }

  // 3. Niezalogowany użytkownik → LandingPage
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // 4. Zalogowany, ale bez rodziny → Onboarding
  if (!hasFamily) {
    return <CreateFamilyPage />;
  }

  // 5. Zalogowany z rodziną → Dashboard
  return <DashboardView />;
}
```

**Uwaga**: Wymaga to modyfikacji `useAuth`, aby zwracał `error` w interfejsie (już jest zwracany, ale trzeba upewnić się, że jest dostępny).

---

## 4. SYSTEM AUTENTYKACJI (Supabase Auth)

### 4.1. Konfiguracja Supabase Auth

**Wymagane ustawienia w Supabase Dashboard**:

1. **Email Auth Provider**:
   - Włączony (domyślnie włączony)
   - Email confirmation: Opcjonalne (można wyłączyć dla MVP)
   - Password requirements: Min. 6 znaków (domyślne)

2. **Email Templates**:
   - Reset Password: Dostosować template (opcjonalnie)
   - Confirm Signup: Wyłączyć jeśli nie używamy email confirmation

3. **URL Redirects**:
   - Site URL: `http://localhost:5173` (dev) / `https://yourdomain.com` (prod)
   - Redirect URLs: Dodać `http://localhost:5173/auth/update-password` (dev) i odpowiedni URL dla produkcji

4. **OAuth Providers**:
   - Wszystkie wyłączone (zgodnie z wymaganiami)

### 4.2. Integracja z Vite

**Konfiguracja w `vite.config.ts`**:
- Brak zmian wymaganych (Vite automatycznie obsługuje SPA routing)
- Hash routing dla Supabase callbacks (opcjonalnie, jeśli używamy hash-based routing)

**Zmienne środowiskowe** (`.env`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4.3. Przepływ Autentykacji

#### 4.3.1. Rejestracja

```
1. User wypełnia RegisterForm
2. Wywołanie: supabase.auth.signUp({ email, password })
3. Supabase:
   - Tworzy użytkownika w auth.users
   - Wysyła email weryfikacyjny (jeśli włączone)
   - Zwraca user object z session
4. Frontend:
   - Zapisuje session w localStorage (automatycznie przez Supabase)
   - Aktualizuje stan w useAuth
   - Pobiera profil (może nie istnieć jeszcze)
5. Routing: App.tsx przekierowuje do CreateFamilyPage
```

#### 4.3.2. Logowanie

```
1. User wypełnia LoginForm
2. Wywołanie: supabase.auth.signInWithPassword({ email, password })
3. Supabase:
   - Weryfikuje dane
   - Zwraca session z JWT token
4. Frontend:
   - Zapisuje session w localStorage
   - Aktualizuje stan w useAuth
   - Pobiera profil
5. Routing: App.tsx przekierowuje w zależności od hasFamily
```

#### 4.3.3. Wylogowanie

```
1. User klika "Wyloguj się"
2. Wywołanie: supabase.auth.signOut()
3. Supabase:
   - Usuwa session z bazy
   - Inwaliduje JWT token
4. Frontend:
   - Czyści localStorage (automatycznie)
   - Czyści stan w useAuth (user = null, profile = null)
5. Routing: App.tsx przekierowuje do LandingPage
```

#### 4.3.4. Reset Hasła

**Krok 1: Żądanie resetu**
```
1. User wypełnia ResetPasswordForm (email)
2. Wywołanie: supabase.auth.resetPasswordForEmail(email, { redirectTo })
3. Supabase:
   - Generuje token resetujący
   - Wysyła email z linkiem zawierającym token
4. Frontend:
   - Wyświetla komunikat sukcesu
```

**Krok 2: Ustawienie nowego hasła**
```
1. User klika link w emailu
2. Supabase przekierowuje do redirectTo z hash: #access_token=...&type=recovery
3. Frontend (useAuth):
   - Wykrywa hash w URL
   - Supabase automatycznie parsuje hash i ustawia sesję
4. User wypełnia UpdatePasswordForm
5. Wywołanie: supabase.auth.updateUser({ password: newPassword })
6. Supabase:
   - Weryfikuje token z sesji
   - Aktualizuje hasło
7. Frontend:
   - Przekierowuje do LoginPage
```

### 4.4. Zarządzanie Sesją

**Automatyczne zarządzanie przez Supabase**:
- `autoRefreshToken: true` (już skonfigurowane w `supabase.client.ts`)
- `persistSession: true` (sesja zapisywana w localStorage)
- `detectSessionInUrl: true` (wykrywanie tokenów w URL hash)

**Odświeżanie tokena**:
- Supabase automatycznie odświeża access token przed wygaśnięciem
- Jeśli odświeżenie się nie powiedzie, użytkownik jest wylogowywany

**Obsługa wygasłej sesji**:
- W `useAuth`, dodać listener na zmiany sesji:
```typescript
useEffect(() => {
  const supabase = createClient();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      // Aktualizacja stanu
      if (session) {
        setUser(/* ... */);
      } else {
        setUser(null);
        setProfile(null);
      }
    }
  });
  
  return () => subscription.unsubscribe();
}, []);
```

### 4.5. Integracja z Profilem Użytkownika

**Tworzenie profilu po rejestracji**:

Opcja 1: Automatyczne tworzenie przez trigger w bazie danych (zalecane)
- Trigger w PostgreSQL tworzy wpis w `profiles` po utworzeniu użytkownika w `auth.users`

Opcja 2: Tworzenie przez frontend
- Po sukcesie `signUp()`, wywołanie API do utworzenia profilu:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .insert({ id: user.id, email: user.email })
  .select()
  .single();
```

**Pobieranie profilu**:
- Już zaimplementowane w `fetchProfile()` w `useAuth`
- Wywoływane po logowaniu i rejestracji

---

## 5. Podsumowanie Implementacji

### 5.1. Nowe Pliki do Utworzenia

**Strony (Pages)**:
- `src/pages/auth/LandingPage.tsx`
- `src/pages/auth/LoginPage.tsx`
- `src/pages/auth/RegisterPage.tsx`
- `src/pages/auth/ResetPasswordPage.tsx`
- `src/pages/auth/UpdatePasswordPage.tsx`

**Komponenty (Components)**:
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/RegisterForm.tsx`
- `src/components/auth/ResetPasswordForm.tsx`
- `src/components/auth/UpdatePasswordForm.tsx`
- `src/components/auth/AuthHeader.tsx`
- `src/components/dashboard/UserMenu.tsx`
- **UWAGA**: `AuthButton.tsx` nie jest potrzebny - LandingPage ma własne przyciski CTA

**Utilities**:
- `src/utils/auth.errors.ts` (mapowanie błędów Supabase)
- `src/validations/auth.schema.ts` (schematy Zod, jeśli używane)

### 5.2. Pliki do Modyfikacji

- `src/hooks/useAuth.ts` - Dodanie metod: signIn, signUp, signOut, resetPassword, updatePassword
- `src/App.tsx` - Aktualizacja logiki routingu (dodanie warunku dla niezalogowanych)
- `src/pages/DashboardView.tsx` - Dodanie UserMenu w headerze
- `src/lib/mockAuth.ts` - Opcjonalnie: wyłączenie DEV_MODE lub modyfikacja dla testów

### 5.3. Konfiguracja Supabase

- Włączenie Email Auth Provider
- Konfiguracja URL redirects dla resetu hasła
- Opcjonalnie: Wyłączenie email confirmation dla MVP
- Opcjonalnie: Utworzenie triggera do automatycznego tworzenia profilu

### 5.4. Testowanie

**Scenariusze testowe**:
1. Rejestracja nowego użytkownika
2. Logowanie istniejącego użytkownika
3. Wylogowanie
4. Reset hasła (pełny przepływ)
5. Ochrona tras (próba dostępu do Dashboard bez logowania)
6. Obsługa błędów (nieprawidłowe dane, błędy sieci)
7. Zarządzanie sesją (odświeżanie tokena, wygasła sesja)

### 5.5. Uwagi Implementacyjne

1. **DEV Mode**: Rozważyć wyłączenie automatycznego logowania w DEV mode lub uczynienie go opcjonalnym
2. **Email Verification**: Dla MVP można wyłączyć wymaganie weryfikacji email (szybszy development)
3. **Security**: Zawsze wyświetlać ogólne komunikaty błędów (nie ujawniać, czy email istnieje)
4. **Accessibility**: Upewnić się, że wszystkie formularze są dostępne (ARIA labels, keyboard navigation)
5. **Responsive Design**: Wszystkie strony auth muszą być responsywne (mobile-first)

---

## 6. Diagramy Przepływu

### 6.1. Przepływ Rejestracji

```
LandingPage
    ↓ (klik: "Utwórz konto")
RegisterPage
    ↓ (wypełnienie formularza)
RegisterForm → signUp(email, password)
    ↓
Supabase Auth → tworzy użytkownika
    ↓
useAuth → aktualizuje stan (user, isAuthenticated)
    ↓
App.tsx → routing: !hasFamily
    ↓
CreateFamilyPage
```

### 6.2. Przepływ Logowania

```
LandingPage
    ↓ (klik: "Zaloguj się")
LoginPage
    ↓ (wypełnienie formularza)
LoginForm → signIn(email, password)
    ↓
Supabase Auth → weryfikuje dane, zwraca sesję
    ↓
useAuth → aktualizuje stan, pobiera profil
    ↓
App.tsx → routing: hasFamily ? DashboardView : CreateFamilyPage
```

### 6.3. Przepływ Resetu Hasła

```
LoginPage
    ↓ (klik: "Zapomniałeś hasła?")
ResetPasswordPage
    ↓ (wprowadzenie email)
ResetPasswordForm → resetPassword(email)
    ↓
Supabase Auth → wysyła email z linkiem
    ↓
User klika link w emailu
    ↓
Supabase → przekierowuje do UpdatePasswordPage z hash
    ↓
UpdatePasswordForm → updatePassword(newPassword)
    ↓
Supabase Auth → aktualizuje hasło
    ↓
Przekierowanie do LoginPage
```

---

## 7. Zgodność z Wymaganiami PRD

### 7.0. Weryfikacja Wszystkich User Stories

**US-000: Main Dashboard**
- ✅ Wymaga: `isAuthenticated === true` i `hasFamily === true`
- ✅ Realizacja: Routing w `App.tsx` renderuje `DashboardView` tylko dla zalogowanych użytkowników z rodziną
- ✅ Ochrona: Dashboard nie jest dostępny dla niezalogowanych (routing w `App.tsx`)

**US-001: Create Family Account**
- ✅ Wymaga: `isAuthenticated === true` i `hasFamily === false`
- ✅ Realizacja: Routing w `App.tsx` renderuje `CreateFamilyPage` dla zalogowanych bez rodziny
- ✅ Ochrona: Strona tworzenia rodziny nie jest dostępna dla niezalogowanych

**US-002: Invite Family Members**
- ✅ Wymaga: `isAuthenticated === true` i `hasFamily === true` oraz rola Admin
- ✅ Realizacja: Funkcjonalność będzie dostępna w Dashboard (poza zakresem auth-spec.md)
- ✅ Ochrona: Wymaga autentykacji (zapewnione przez routing)

**US-003: AI Suggestions for Events**
- ✅ Wymaga: `isAuthenticated === true` i `hasFamily === true`
- ✅ Realizacja: Funkcjonalność będzie dostępna w Dashboard (poza zakresem auth-spec.md)
- ✅ Ochrona: Wymaga autentykacji (zapewnione przez routing)

**US-004: Private Events**
- ✅ Wymaga: `isAuthenticated === true` i `hasFamily === true`
- ✅ Realizacja: Funkcjonalność będzie dostępna w Dashboard (poza zakresem auth-spec.md)
- ✅ Ochrona: Wymaga autentykacji (zapewnione przez routing)

**US-005: Task List**
- ✅ Wymaga: `isAuthenticated === true` i `hasFamily === true`
- ✅ Realizacja: Funkcjonalność będzie dostępna w Dashboard (poza zakresem auth-spec.md)
- ✅ Ochrona: Wymaga autentykacji (zapewnione przez routing)

**US-006: Complete Tasks**
- ✅ Wymaga: `isAuthenticated === true` i `hasFamily === true`
- ✅ Realizacja: Funkcjonalność będzie dostępna w Dashboard (poza zakresem auth-spec.md)
- ✅ Ochrona: Wymaga autentykacji (zapewnione przez routing)

**US-007: Secure Access** (szczegółowo poniżej)

### 7.1. Checklist US-007

- ✅ Login i rejestracja na dedykowanych stronach
- ✅ Logowanie wymaga email i hasło
- ✅ Rejestracja wymaga email, hasło i potwierdzenie hasła
- ✅ Niezalogowany użytkownik widzi stronę z opisem aplikacji (LandingPage)
- ✅ Użytkownik musi być zalogowany do tworzenia wydarzeń/zadań i przeglądania kalendarza
- ⚠️ **KOREKTA PRD**: W PRD (linia 128) jest błędnie napisane "The user can log in to the system using a button in the top‑right corner of the @Dashboard" - to jest sprzeczne, ponieważ użytkownik na Dashboard jest już zalogowany. Przycisk logowania znajduje się tylko na LandingPage.
- ✅ Przycisk wylogowania w prawym górnym rogu Dashboard (UserMenu)
- ✅ Brak zewnętrznych serwisów logowania
- ✅ Odzyskiwanie hasła jest możliwe

### 7.2. Zgodność z Tech Stack

- ✅ Vite 6: Brak zmian wymaganych
- ✅ React 19: Wykorzystanie istniejących hooków i komponentów
- ✅ TypeScript 5: Pełne typowanie wszystkich nowych komponentów
- ✅ Tailwind 4: Styling zgodny z istniejącym kodem
- ✅ Shadcn/ui: Wykorzystanie istniejących komponentów UI
- ✅ Supabase Auth: Pełna integracja z istniejącym klientem

---

## 8. Analiza Sprzeczności i Nadmiarowych Założeń

### 8.1. Znalezione Sprzeczności

#### Sprzeczność 1: Przycisk logowania na Dashboard (PRD, linia 128)
- **Problem**: W PRD jest napisane: "The user can log in to the system using a button in the top‑right corner of the @Dashboard"
- **Dlaczego sprzeczne**: Użytkownik na Dashboard jest już zalogowany (`isAuthenticated === true`), więc przycisk logowania nie ma sensu
- **Rozwiązanie**: Przycisk logowania znajduje się tylko na `LandingPage` dla niezalogowanych użytkowników. Na Dashboard jest tylko przycisk wylogowania w `UserMenu`
- **Status**: ✅ Poprawione w specyfikacji

### 8.2. Nadmiarowe Założenia

#### Nadmiarowe założenie 1: Komponent AuthButton
- **Problem**: W pierwotnej wersji specyfikacji był planowany komponent `AuthButton.tsx` dla LandingPage
- **Dlaczego nadmiarowe**: `LandingPage` ma już własne przyciski CTA ("Zaloguj się" i "Utwórz konto"), więc osobny komponent jest niepotrzebny
- **Rozwiązanie**: Usunięto `AuthButton.tsx` z listy komponentów do utworzenia
- **Status**: ✅ Poprawione w specyfikacji

### 8.3. Weryfikacja Realizowalności User Stories

Wszystkie User Stories z PRD mogą być zrealizowane w oparciu o przygotowany plan:

- ✅ **US-000**: Dashboard wymaga autentykacji - zapewnione przez routing w `App.tsx`
- ✅ **US-001**: Tworzenie rodziny wymaga autentykacji - zapewnione przez routing
- ✅ **US-002**: Zaproszenia wymagają autentykacji i roli Admin - zapewnione przez routing i profil
- ✅ **US-003-US-006**: Wszystkie funkcjonalności kalendarza i zadań wymagają autentykacji - zapewnione przez routing
- ✅ **US-007**: Wszystkie wymagania autentykacji są szczegółowo opisane w specyfikacji

### 8.4. Zgodność z Istniejącym Kodem

- ✅ **useAuth hook**: Już zwraca `isAuthenticated` i `error` - zgodne z wymaganiami
- ✅ **App.tsx routing**: Wymaga rozszerzenia o sprawdzanie `isAuthenticated` - planowane w specyfikacji
- ✅ **DEV Mode**: Obecny DEV mode auto-login może być zachowany jako opcjonalny - uwzględnione w specyfikacji

---

**Koniec Specyfikacji**
