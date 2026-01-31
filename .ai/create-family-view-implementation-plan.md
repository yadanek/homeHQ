# Plan implementacji widoku Create Family

## 1. Przegląd

Widok **Create Family** jest kluczowym elementem procesu onboardingu użytkownika w aplikacji HomeHQ. Umożliwia nowemu użytkownikowi utworzenie własnego Family Hub, w którym automatycznie otrzymuje rolę administratora. Jest to pierwszy krok w konfiguracji przestrzeni rodzinnej, po której następuje możliwość zaproszenia innych członków rodziny.

**Główne cele widoku:**
- Umożliwienie utworzenia nowej rodziny przez zalogowanego użytkownika
- Automatyczne przypisanie roli administratora twórcy rodziny
- Wyjaśnienie korzyści płynących z roli admina
- Zapewnienie alternatywnej ścieżki (dołączenie do istniejącej rodziny)
- Płynne przekierowanie do dashboardu po sukcesie

**Kontekst użycia:**
Widok jest dostępny dla użytkowników zalogowanych, którzy nie należą jeszcze do żadnej rodziny. Jest częścią procesu onboardingu następującego bezpośrednio po rejestracji.

## 2. Routing widoku

**Ścieżka:** `/onboarding/create-family`

**Warunki dostępu:**
- Użytkownik musi być zalogowany (authenticated)
- Użytkownik NIE może należeć już do rodziny (w przeciwnym razie: błąd 409 Conflict)
- Jeśli użytkownik już należy do rodziny, powinien zostać przekierowany do `/dashboard`

**Przekierowania:**
- **Po sukcesie:** → `/dashboard` (kalendarz)
- **Po kliknięciu "Join Family":** → `/onboarding/join-family`
- **Po wylogowaniu:** → `/auth/login`

**Guard route:**
```typescript
// Wymaga ochrony przed nieautoryzowanym dostępem
// Wymaga sprawdzenia czy użytkownik już NIE należy do rodziny
```

## 3. Struktura komponentów

Hierarchia komponentów widoku:

```
CreateFamilyPage
├── PageLayout (kontener główny)
│   ├── Header
│   │   ├── Heading (H1: "Create Your Family Hub")
│   │   └── Subheading (tekst wyjaśniający)
│   │
│   ├── ExplanationCard (korzyści roli admina)
│   │   ├── AdminBenefitsList
│   │   │   ├── BenefitItem ("Generate invitation codes")
│   │   │   ├── BenefitItem ("Manage family settings")
│   │   │   └── BenefitItem ("Full access to shared content")
│   │   └── InfoIcon
│   │
│   ├── CreateFamilyForm
│   │   ├── FormField (Family Name)
│   │   │   ├── Label
│   │   │   ├── Input (text field)
│   │   │   └── ErrorMessage (jeśli błąd walidacji)
│   │   │
│   │   ├── HelperText (hint pod inputem)
│   │   │
│   │   └── FormActions
│   │       ├── SubmitButton ("Create Family")
│   │       │   ├── LoadingSpinner (jeśli isSubmitting)
│   │       │   └── ButtonText
│   │       │
│   │       └── AlternativeAction
│   │           └── Link ("Join an Existing Family")
│   │
│   └── SuccessAnimation (wyświetla się po sukcesie)
│       ├── CheckmarkIcon
│       └── SuccessMessage
│
└── ToastNotification (błędy i komunikaty)
```

## 4. Szczegóły komponentów

### 4.1. CreateFamilyPage (główny komponent strony)

**Opis komponentu:**
Komponent główny widoku, odpowiedzialny za zarządzanie stanem formularza, walidację, wywołanie API oraz obsługę błędów.

**Główne elementy:**
- Nagłówek strony (H1, subheading)
- Karta wyjaśniająca korzyści roli admina
- Formularz tworzenia rodziny
- Przycisk alternatywny (link do Join Family)
- Animacja sukcesu

**Obsługiwane interakcje:**
- Zmiana wartości w polu Family Name
- Walidacja po blur lub przy próbie submit
- Submit formularza
- Kliknięcie "Join an Existing Family"
- Przekierowanie po sukcesie

**Obsługiwana walidacja:**
- Pole `name` nie może być puste po trimowaniu
- Długość `name`: 1-100 znaków
- Walidacja client-side (natychmiastowa) + server-side (authorytatywna)
- Błędy z API: 409 Conflict (użytkownik już w rodzinie), 401 Unauthorized, 400 Bad Request

**Typy:**
- `CreateFamilyFormData` - dane formularza
- `CreateFamilyRequest` - request DTO
- `CreateFamilyResponse` - response DTO
- `ApiError` - typ błędu

**Propsy:**
```typescript
interface CreateFamilyPageProps {
  // Brak propsów - komponent standalone (page)
}
```

### 4.2. CreateFamilyForm (komponent formularza)

**Opis komponentu:**
Formularz z pojedynczym polem tekstowym do wprowadzenia nazwy rodziny. Obsługuje walidację, stan loading oraz przekazywanie danych do rodzica.

**Główne elementy:**
- `<form>` element z obsługą onSubmit
- `<input>` dla nazwy rodziny
- `<label>` powiązane z inputem
- `<button type="submit">` do wysłania formularza
- Komunikat błędu walidacji (inline)

**Obsługiwane interakcje:**
- onChange na polu Family Name
- onBlur (walidacja przy utracie fokusa)
- onSubmit (wysłanie formularza)
- Disabled state podczas ładowania

**Obsługiwana walidacja:**
- **Client-side (inline):**
  - Pole wymagane
  - Min: 1 znak (po trim)
  - Max: 100 znaków
  - Błąd wyświetlany pod inputem
- **Server-side:**
  - Dodatkowo sprawdzane na backendzie
  - Błędy z API wyświetlane przez toast

**Typy:**
- `CreateFamilyFormData`: `{ name: string }`
- `ValidationError`: `{ field: string, message: string }`

**Propsy:**
```typescript
interface CreateFamilyFormProps {
  onSubmit: (data: CreateFamilyFormData) => Promise<void>;
  isSubmitting: boolean;
  error: ApiError | null;
  defaultName?: string; // Pre-fill z "[Display Name]'s Family"
}
```

### 4.3. ExplanationCard (karta wyjaśniająca)

**Opis komponentu:**
Karta informacyjna wyjaśniająca korzyści płynące z roli administratora. Wyświetlana nad formularzem, aby użytkownik rozumiał kontekst przed utworzeniem rodziny.

**Główne elementy:**
- Nagłówek: "You'll be the admin"
- Lista korzyści (bulleted list)
- Ikona informacyjna (opcjonalnie)

**Obsługiwane interakcje:**
- Brak interakcji (komponent informacyjny)

**Obsługiwana walidacja:**
- Nie dotyczy

**Typy:**
- Brak specjalnych typów

**Propsy:**
```typescript
interface ExplanationCardProps {
  // Brak propsów - statyczna treść
}
```

### 4.4. SubmitButton (przycisk wysyłania)

**Opis komponentu:**
Przycisk głównej akcji (CTA) do wysłania formularza. Wyświetla spinner podczas ładowania i jest disabled gdy formularz nie jest gotowy do wysłania.

**Główne elementy:**
- `<button>` z type="submit"
- LoadingSpinner (komponent shadcn/ui)
- Tekst przycisku

**Obsługiwane interakcje:**
- onClick (submit formularza)
- Disabled podczas isSubmitting

**Obsługiwana walidacja:**
- Disabled gdy pole jest puste
- Disabled podczas wysyłania

**Typy:**
- Brak specjalnych typów

**Propsy:**
```typescript
interface SubmitButtonProps {
  isSubmitting: boolean;
  disabled: boolean;
  children: React.ReactNode; // Tekst: "Create Family"
}
```

### 4.5. SuccessAnimation (animacja sukcesu)

**Opis komponentu:**
Komponent wyświetlany krótko po pomyślnym utworzeniu rodziny. Pokazuje checkmark z animacją fade-in i przekierowuje użytkownika do dashboardu.

**Główne elementy:**
- Ikona checkmark (animowana)
- Tekst: "Family created successfully!"
- Animacja fade-in + slide-up

**Obsługiwane interakcje:**
- Automatyczne przekierowanie po 1.5 sekundy

**Obsługiwana walidacja:**
- Nie dotyczy

**Typy:**
- Brak specjalnych typów

**Propsy:**
```typescript
interface SuccessAnimationProps {
  onComplete: () => void; // Callback po zakończeniu animacji
}
```

## 5. Typy

### 5.1. Request/Response DTOs (z types.ts)

**CreateFamilyRequest:**
```typescript
interface CreateFamilyRequest {
  name: string;           // Nazwa rodziny (1-100 znaków po trim)
  display_name: string;   // Nazwa użytkownika (pobrana z profilu)
}
```

**CreateFamilyResponse:**
```typescript
interface CreateFamilyResponse {
  id: string;                 // UUID rodziny
  name: string;               // Nazwa rodziny
  created_at: string;         // ISO 8601 timestamp
  profile: {
    id: string;               // UUID profilu użytkownika
    family_id: string;        // UUID rodziny (=id)
    role: string;             // "admin"
    display_name: string;     // Nazwa użytkownika
    created_at: string;       // ISO 8601 timestamp
  };
}
```

**ApiError:**
```typescript
interface ApiError {
  error: {
    code: string;             // Kod błędu (np. "USER_ALREADY_IN_FAMILY")
    message: string;          // Wiadomość do wyświetlenia
    details?: Record<string, unknown>; // Dodatkowe szczegóły
  };
}
```

### 5.2. Typy lokalne widoku (ViewModels)

**CreateFamilyFormData:**
```typescript
// Typ danych formularza (używany lokalnie w komponencie)
interface CreateFamilyFormData {
  name: string;   // Wartość z pola input (przed walidacją)
}
```

**CreateFamilyViewState:**
```typescript
// Stan widoku
interface CreateFamilyViewState {
  formData: CreateFamilyFormData;  // Dane formularza
  isSubmitting: boolean;            // Czy formularz jest wysyłany
  validationError: string | null;   // Błąd walidacji client-side
  apiError: ApiError | null;        // Błąd z API
  showSuccess: boolean;             // Czy pokazać animację sukcesu
}
```

**ValidationError:**
```typescript
// Błąd walidacji
interface ValidationError {
  field: keyof CreateFamilyFormData; // Pole formularza
  message: string;                    // Wiadomość błędu
}
```

### 5.3. Typy z Zod schema (src/validations/families.schema.ts)

**CreateFamilyInput:**
```typescript
// Wygenerowany automatycznie z createFamilySchema
type CreateFamilyInput = z.infer<typeof createFamilySchema>;

// Równoważny:
interface CreateFamilyInput {
  name: string;        // 1-100 znaków po trim
  display_name: string; // 1-100 znaków po trim
}
```

## 6. Zarządzanie stanem

### 6.1. Stan lokalny (useState)

Widok wykorzystuje lokalny stan React (nie wymaga globalnego store):

**Zmienne stanu:**
```typescript
const [formData, setFormData] = useState<CreateFamilyFormData>({
  name: defaultName || '' // Pre-fill z "[Display Name]'s Family"
});

const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
const [validationError, setValidationError] = useState<string | null>(null);
const [apiError, setApiError] = useState<ApiError | null>(null);
const [showSuccess, setShowSuccess] = useState<boolean>(false);
```

### 6.2. Custom hook: useCreateFamily

Widok wykorzystuje niestandardowy hook do enkapsulacji logiki tworzenia rodziny:

**Sygnatura:**
```typescript
function useCreateFamily() {
  return {
    createFamily: (data: CreateFamilyFormData) => Promise<CreateFamilyResponse>,
    isCreating: boolean,
    error: ApiError | null,
    reset: () => void
  };
}
```

**Implementacja:**
```typescript
import { useState } from 'react';
import { createFamily as createFamilyAction } from '@/actions/createFamily';
import type { CreateFamilyRequest, CreateFamilyResponse, ApiError } from '@/types';

function useCreateFamily() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createFamily = async (data: CreateFamilyFormData): Promise<CreateFamilyResponse> => {
    setIsCreating(true);
    setError(null);

    try {
      // Pobierz display_name z profilu użytkownika (z kontekstu auth)
      const displayName = getUserDisplayName(); // Helper function
      
      const request: CreateFamilyRequest = {
        name: data.name.trim(),
        display_name: displayName
      };

      const result = await createFamilyAction(request);

      if (!result.success) {
        setError(result.error);
        throw new Error(result.error.error.message);
      }

      setIsCreating(false);
      return result.data;
    } catch (err) {
      setIsCreating(false);
      throw err;
    }
  };

  const reset = () => {
    setError(null);
    setIsCreating(false);
  };

  return { createFamily, isCreating, error, reset };
}
```

**Odpowiedzialność hooka:**
- Zarządzanie stanem ładowania (isCreating)
- Wywołanie akcji `createFamily` z przekazanymi danymi
- Obsługa błędów z API
- Przekształcenie danych formularza na format API request
- Zwrócenie wyniku lub rzucenie błędu

### 6.3. Przepływ danych

**1. Inicjalizacja:**
```
User lands on /onboarding/create-family
→ Component mounts
→ Fetch user display_name from auth context
→ Pre-fill form with "[Display Name]'s Family"
```

**2. Edycja:**
```
User types in Family Name input
→ onChange handler
→ Update formData state
→ Clear validation error (if any)
```

**3. Walidacja (on blur):**
```
User leaves input field (blur event)
→ Validate formData.name
→ If invalid: setValidationError(message)
→ If valid: setValidationError(null)
```

**4. Submit:**
```
User clicks "Create Family" button
→ Prevent default form submission
→ Validate formData (client-side)
→ If invalid: Show validation error, return early
→ If valid: Call useCreateFamily().createFamily(formData)
→ Set isSubmitting = true
→ Disable form inputs and button
→ Call API via createFamilyAction
→ Wait for response
→ On success:
  → setShowSuccess(true)
  → Show success animation (1.5s)
  → Navigate to /dashboard
→ On error:
  → setApiError(error)
  → Show toast notification with error message
  → setIsSubmitting(false)
  → Re-enable form
```

## 7. Integracja API

### 7.1. Endpoint używany przez widok

**POST /families**

**Request:**
```typescript
{
  name: string;        // Nazwa rodziny z formularza
  display_name: string; // Pobrane z profilu zalogowanego użytkownika
}
```

**Response (201 Created):**
```typescript
{
  id: string;
  name: string;
  created_at: string;
  profile: {
    id: string;
    family_id: string;
    role: "admin";
    display_name: string;
    created_at: string;
  };
}
```

**Error Responses:**
- **400 Bad Request:** Nieprawidłowa nazwa rodziny (pusta po trim)
  ```typescript
  {
    error: {
      code: "INVALID_INPUT",
      message: "Validation failed",
      details: {
        field: "name",
        reason: "Family name cannot be empty"
      }
    }
  }
  ```

- **401 Unauthorized:** Brak tokena autoryzacji lub token nieprawidłowy
  ```typescript
  {
    error: {
      code: "UNAUTHORIZED",
      message: "Missing or invalid authentication token"
    }
  }
  ```

- **409 Conflict:** Użytkownik już należy do rodziny
  ```typescript
  {
    error: {
      code: "USER_ALREADY_IN_FAMILY",
      message: "User already belongs to a family",
      details: {
        family_id: "uuid"
      }
    }
  }
  ```

- **500 Internal Server Error:** Błąd bazy danych
  ```typescript
  {
    error: {
      code: "DATABASE_ERROR",
      message: "Failed to create family due to database error",
      details: {
        reason: "..."
      }
    }
  }
  ```

### 7.2. Implementacja wywołania API

**Wykorzystywana akcja:** `src/actions/createFamily.ts`

**Użycie w komponencie:**
```typescript
import { createFamily } from '@/actions/createFamily';

// W komponencie:
const handleSubmit = async (formData: CreateFamilyFormData) => {
  const result = await createFamily({
    name: formData.name.trim(),
    display_name: userDisplayName // z auth context
  });

  if (result.success) {
    // Sukces - pokaż animację i przekieruj
    setShowSuccess(true);
    setTimeout(() => {
      navigate('/dashboard');
    }, 1500);
  } else {
    // Błąd - wyświetl toast
    toast.error(result.error.error.message);
  }
};
```

### 7.3. Pobieranie display_name użytkownika

Display name jest wymagane w request, ale nie jest wprowadzane w formularzu. Musi zostać pobrane z profilu zalogowanego użytkownika:

**Opcje:**
1. **Z auth context:**
   ```typescript
   const { user } = useAuth(); // Custom hook
   const displayName = user?.display_name;
   ```

2. **Z Supabase profilu:**
   ```typescript
   const { data: profile } = await supabase
     .from('profiles')
     .select('display_name')
     .eq('id', user.id)
     .single();
   const displayName = profile?.display_name;
   ```

3. **Z GET /profiles/me endpoint:**
   ```typescript
   const profile = await fetch('/api/profiles/me');
   const displayName = profile.display_name;
   ```

**Rekomendacja:** Użyj opcji 1 (auth context) jeśli display_name jest już dostępne w sesji. W przeciwnym razie użyj opcji 2 lub 3 przy montowaniu komponentu.

## 8. Interakcje użytkownika

### 8.1. Edycja nazwy rodziny

**Akcja użytkownika:**
- Użytkownik klika w pole "Family Name"
- Pole otrzymuje fokus
- Użytkownik wpisuje nazwę

**Oczekiwany rezultat:**
- Wartość pola aktualizuje się na bieżąco (controlled input)
- Placeholder znika po wpisaniu pierwszego znaku
- Jeśli był błąd walidacji, znika po wpisaniu nowych znaków
- Licznik znaków (opcjonalnie) pokazuje 0/100

### 8.2. Walidacja on blur

**Akcja użytkownika:**
- Użytkownik opuszcza pole (blur event)

**Oczekiwany rezultat:**
- System waliduje wartość pola
- Jeśli puste po trim: pokazuje błąd "Family name cannot be empty" (czerwony tekst pod polem)
- Jeśli za długie (>100): pokazuje błąd "Family name must be 100 characters or less"
- Jeśli poprawne: brak komunikatu błędu

### 8.3. Submit formularza

**Akcja użytkownika:**
- Użytkownik klika przycisk "Create Family"
- LUB naciska Enter w polu tekstowym

**Oczekiwany rezultat:**

**Jeśli dane niepoprawne (client-side validation):**
- Formularz NIE zostaje wysłany
- Pokazuje się inline error pod polem
- Fokus wraca do pola z błędem

**Jeśli dane poprawne:**
- Przycisk zmienia stan na loading (spinner + tekst "Creating...")
- Pole input staje się disabled
- Wysłanie request do API
- Oczekiwanie na odpowiedź

**Po sukcesie (201 Created):**
- Animacja sukcesu (checkmark + fade-in)
- Tekst: "Family created successfully!"
- Po 1.5 sekundy: przekierowanie do `/dashboard`
- JWT token automatycznie zaktualizowany (family_id w metadata)

**Po błędzie (400/401/409/500):**
- Toast notification z komunikatem błędu
- Przycisk wraca do normalnego stanu
- Pole input wraca do enabled
- Użytkownik może poprawić dane i spróbować ponownie

### 8.4. Kliknięcie "Join an Existing Family"

**Akcja użytkownika:**
- Użytkownik klika link "Join an Existing Family"

**Oczekiwany rezultat:**
- Przekierowanie do `/onboarding/join-family`
- Dane formularza NIE są zapisywane (nie ma draft state)

### 8.5. Wylogowanie podczas wypełniania

**Akcja użytkownika:**
- Użytkownik wylogowuje się (np. przez menu)

**Oczekiwany rezultat:**
- Sesja jest czyszczona
- Przekierowanie do `/auth/login`
- Dane formularza NIE są zachowane

## 9. Warunki i walidacja

### 9.1. Warunki dostępu do widoku

| Warunek | Weryfikacja | Akcja przy niespełnieniu |
|---------|-------------|--------------------------|
| Użytkownik zalogowany | Sprawdzenie tokena JWT w auth context | Przekierowanie do `/auth/login` |
| Użytkownik NIE należy do rodziny | Sprawdzenie `family_id` w profilu/JWT | Przekierowanie do `/dashboard` |
| Brak aktywnej sesji tworzenia | Brak `family_id` w localStorage (opcjonalnie) | Wyświetlenie widoku normalnie |

**Implementacja:**
```typescript
// W komponencie głównym lub w router guard
useEffect(() => {
  if (!isAuthenticated) {
    navigate('/auth/login');
    return;
  }
  
  if (userHasFamily) {
    navigate('/dashboard');
    return;
  }
}, [isAuthenticated, userHasFamily, navigate]);
```

### 9.2. Walidacja pola Family Name (client-side)

| Reguła | Warunek | Komunikat błędu |
|--------|---------|-----------------|
| Pole wymagane | `name.trim().length === 0` | "Family name cannot be empty" |
| Minimalna długość | `name.trim().length < 1` | "Family name cannot be empty" |
| Maksymalna długość | `name.length > 100` | "Family name must be 100 characters or less" |

**Moment walidacji:**
- **On blur:** Po opuszczeniu pola
- **On submit:** Przed wysłaniem formularza
- **Real-time (opcjonalnie):** Po każdej zmianie wartości (dla lepszego UX)

**Implementacja Zod:**
```typescript
import { createFamilySchema } from '@/validations/families.schema';

const validateForm = (data: CreateFamilyFormData): ValidationError | null => {
  const result = createFamilySchema.safeParse({
    name: data.name,
    display_name: userDisplayName // z context
  });

  if (!result.success) {
    const firstError = result.error.errors[0];
    return {
      field: firstError.path[0] as keyof CreateFamilyFormData,
      message: firstError.message
    };
  }

  return null;
};
```

### 9.3. Walidacja server-side (API)

Backend również wykonuje walidację (authorytatywną):

| Błąd | Kod HTTP | Kod błędu | Powód |
|------|----------|-----------|-------|
| Nazwa pusta | 400 | INVALID_INPUT | Nazwa rodziny pusta lub tylko whitespace |
| Nazwa za długa | 400 | INVALID_INPUT | Nazwa rodziny > 100 znaków |
| Brak display_name | 400 | INVALID_INPUT | Display name nie został przekazany |
| Brak tokena | 401 | UNAUTHORIZED | Token JWT brakuje lub nieprawidłowy |
| Użytkownik już w rodzinie | 409 | USER_ALREADY_IN_FAMILY | Użytkownik należy już do rodziny |
| Błąd DB | 500 | DATABASE_ERROR | Problem z bazą danych |

**Obsługa błędów w UI:**
```typescript
if (!result.success) {
  const { code, message } = result.error.error;
  
  switch (code) {
    case 'INVALID_INPUT':
      // Wyświetl inline error pod polem
      setValidationError(message);
      break;
    
    case 'UNAUTHORIZED':
      // Wyloguj użytkownika i przekieruj do loginu
      logout();
      navigate('/auth/login');
      break;
    
    case 'USER_ALREADY_IN_FAMILY':
      // Przekieruj do dashboardu z informacją
      toast.info('You already belong to a family');
      navigate('/dashboard');
      break;
    
    case 'DATABASE_ERROR':
    default:
      // Wyświetl toast z błędem ogólnym
      toast.error('An error occurred. Please try again.');
      break;
  }
}
```

### 9.4. Warunki UX wpływające na stan interfejsu

| Warunek | Wpływ na UI |
|---------|-------------|
| `formData.name.trim() === ''` | Przycisk Submit disabled |
| `isSubmitting === true` | Formularz disabled, przycisk pokazuje spinner |
| `validationError !== null` | Czerwony border na input, komunikat błędu pod polem |
| `apiError !== null` | Toast notification z komunikatem błędu |
| `showSuccess === true` | Animacja checkmark, formularz ukryty |

## 10. Obsługa błędów

### 10.1. Błędy walidacji client-side

**Typ błędu:** Nieprawidłowe dane wprowadzone przez użytkownika

**Przykłady:**
- Puste pole Family Name
- Nazwa dłuższa niż 100 znaków

**Obsługa:**
- Walidacja inline po blur
- Komunikat błędu wyświetlany pod polem (czerwony tekst)
- Border pola zmienia kolor na czerwony
- Submit jest blokowany do momentu poprawy

**Przykład komunikatu:**
```
Family Name
[____________________________]
⚠️ Family name cannot be empty
```

### 10.2. Błędy autoryzacji (401 Unauthorized)

**Typ błędu:** Brak lub nieprawidłowy token JWT

**Przyczyny:**
- Token wygasł
- Token został usunięty z localStorage
- Użytkownik nie jest zalogowany

**Obsługa:**
1. Wyświetl toast: "Session expired. Please log in again."
2. Wyczyść lokalny stan auth
3. Przekieruj do `/auth/login`
4. Po ponownym zalogowaniu, użytkownik wraca do procesu onboardingu

### 10.3. Błędy konfliktów (409 Conflict)

**Typ błędu:** Użytkownik już należy do rodziny

**Przyczyny:**
- Użytkownik otworzył widok w nowej karcie, a w międzyczasie dołączył do rodziny
- Race condition: równoczesne wywołania POST /families
- Użytkownik kliknął "Create Family" wielokrotnie

**Obsługa:**
1. Wyświetl toast: "You already belong to a family"
2. Przekieruj do `/dashboard`
3. Nie wyświetlaj błędu jako error (to informacyjne przekierowanie)

### 10.4. Błędy sieciowe i 500 Internal Server Error

**Typ błędu:** Problem z połączeniem lub błąd serwera

**Przyczyny:**
- Brak połączenia internetowego
- Serwer Supabase nie odpowiada
- Błąd bazy danych
- Timeout

**Obsługa:**
1. Wyświetl toast: "An error occurred. Please try again."
2. Pozostaw formularz w stanie gotowym do ponownego wysłania
3. Nie czyść danych formularza (użytkownik nie musi wpisywać ponownie)
4. Dodaj przycisk "Retry" w toast (opcjonalnie)

**Przykład UI:**
```
🔴 An error occurred. Please try again.
   [Retry] [Dismiss]
```

### 10.5. Błąd braku display_name

**Typ błędu:** Display name nie może zostać pobrany z profilu

**Przyczyny:**
- Profil użytkownika nie został jeszcze utworzony
- Błąd podczas rejestracji
- Brak display_name w auth metadata

**Obsługa:**
1. Wyświetl toast: "Profile information is incomplete. Please complete your registration."
2. Przekieruj do widoku uzupełnienia profilu (jeśli istnieje)
3. Lub wyświetl modal z prośbą o podanie display_name

### 10.6. Edge cases

| Scenariusz | Obsługa |
|------------|---------|
| Użytkownik klika Submit wielokrotnie | Przycisk disabled po pierwszym kliknięciu, ignoruj kolejne kliknięcia |
| Użytkownik opuszcza stronę podczas wysyłania | Request nadal zostanie wysłany (backend wymaga idempotentności), przy powrocie sprawdź czy rodzina została utworzona |
| Użytkownik wraca przyciskiem "Back" po sukcesie | Powinien być przekierowany do `/dashboard` (guard route) |
| Nazwa rodziny zawiera emoji lub znaki specjalne | Backend akceptuje wszystkie znaki UTF-8, frontend również (brak dodatkowej walidacji) |
| Nazwa rodziny tylko whitespace | Trimowanie po stronie client i server, błąd "cannot be empty" |

## 11. Kroki implementacji

### Krok 1: Przygotowanie struktury plików
1. Utwórz folder `src/pages/onboarding/`
2. Utwórz plik `CreateFamilyPage.tsx`
3. Utwórz folder `src/components/onboarding/`
4. Utwórz pliki komponentów:
   - `CreateFamilyForm.tsx`
   - `ExplanationCard.tsx`
   - `SuccessAnimation.tsx`
5. Utwórz custom hook: `src/hooks/useCreateFamily.ts`

### Krok 2: Implementacja custom hooka useCreateFamily
1. Zaimportuj niezbędne typy z `@/types`
2. Zaimportuj akcję `createFamily` z `@/actions/createFamily`
3. Zaimportuj Zod schema z `@/validations/families.schema`
4. Utwórz state dla `isCreating` i `error`
5. Zaimplementuj funkcję `createFamily`:
   - Pobierz `display_name` z auth context
   - Waliduj dane z użyciem Zod schema
   - Wywołaj akcję `createFamilyAction`
   - Obsłuż wynik (success/error)
6. Zaimplementuj funkcję `reset`
7. Zwróć obiekt z funkcjami i stanem

### Krok 3: Implementacja ExplanationCard
1. Utwórz komponent `ExplanationCard.tsx`
2. Użyj komponentu `Card` z shadcn/ui
3. Dodaj nagłówek: "You'll be the admin"
4. Dodaj listę korzyści (bulleted list):
   - "Generate invitation codes for your family"
   - "Manage family settings and members"
   - "Full access to all shared content"
5. Dodaj ikonę informacyjną (opcjonalnie)
6. Stylizuj z użyciem Tailwind CSS
7. Zapewnij responsywność (mobile-first)

### Krok 4: Implementacja CreateFamilyForm
1. Utwórz komponent `CreateFamilyForm.tsx`
2. Zdefiniuj propsy według interfejsu z sekcji 4.2
3. Użyj komponentów shadcn/ui:
   - `Form` (React Hook Form wrapper)
   - `FormField`
   - `FormLabel`
   - `FormControl`
   - `Input`
   - `FormMessage`
   - `Button`
4. Zaimplementuj walidację z użyciem Zod schema
5. Obsłuż zdarzenia:
   - `onChange` → aktualizacja stanu
   - `onBlur` → walidacja pola
   - `onSubmit` → wywołanie callback z rodzica
6. Zaimplementuj stan loading:
   - Disabled input i button gdy `isSubmitting === true`
   - Spinner w przycisku podczas ładowania
7. Dodaj link "Join an Existing Family" pod przyciskiem
8. Stylizuj zgodnie z design system (Tailwind + shadcn/ui)

### Krok 5: Implementacja SuccessAnimation
1. Utwórz komponent `SuccessAnimation.tsx`
2. Użyj biblioteki animacji (np. Framer Motion lub Tailwind CSS animations)
3. Zaimplementuj animację:
   - Fade-in całego komponentu
   - Scale-up ikony checkmark
   - Slide-up tekstu
4. Dodaj ikonę checkmark (z lucide-react lub shadcn/ui)
5. Dodaj tekst: "Family created successfully!"
6. Zaimplementuj auto-callback po 1.5 sekundy:
   ```typescript
   useEffect(() => {
     const timer = setTimeout(() => {
       onComplete();
     }, 1500);
     return () => clearTimeout(timer);
   }, [onComplete]);
   ```
7. Stylizuj (centrowanie, kolory, spacing)

### Krok 6: Implementacja głównego komponentu CreateFamilyPage
1. Utwórz komponent `CreateFamilyPage.tsx`
2. Zaimportuj wszystkie komponenty dzieci
3. Zaimportuj custom hook `useCreateFamily`
4. Utwórz state lokalny:
   ```typescript
   const [formData, setFormData] = useState({ name: '' });
   const [showSuccess, setShowSuccess] = useState(false);
   ```
5. Pobierz funkcje i stan z hooka:
   ```typescript
   const { createFamily, isCreating, error } = useCreateFamily();
   ```
6. Pobierz `display_name` użytkownika z auth context:
   ```typescript
   const { user } = useAuth();
   const defaultName = `${user?.display_name}'s Family`;
   ```
7. Zaimplementuj handler submit:
   ```typescript
   const handleSubmit = async (data: CreateFamilyFormData) => {
     try {
       await createFamily(data);
       setShowSuccess(true);
     } catch (error) {
       // Błąd obsłużony przez hook
     }
   };
   ```
8. Zaimplementuj handler sukcesu:
   ```typescript
   const handleSuccessComplete = () => {
     navigate('/dashboard');
   };
   ```
9. Zbuduj layout:
   - Kontener główny (max-width, center, padding)
   - Nagłówek (H1 + subheading)
   - ExplanationCard
   - CreateFamilyForm
   - SuccessAnimation (warunkowe renderowanie)
10. Stylizuj zgodnie z design system

### Krok 7: Konfiguracja routingu
1. Dodaj route w konfiguracji routera (np. React Router):
   ```typescript
   {
     path: '/onboarding/create-family',
     element: <CreateFamilyPage />,
     // Wymaga auth guard
   }
   ```
2. Utwórz guard dla onboardingu:
   ```typescript
   const OnboardingGuard = ({ children }) => {
     const { isAuthenticated, userHasFamily } = useAuth();
     
     if (!isAuthenticated) {
       return <Navigate to="/auth/login" />;
     }
     
     if (userHasFamily) {
       return <Navigate to="/dashboard" />;
     }
     
     return children;
   };
   ```
3. Zastosuj guard do route:
   ```typescript
   {
     path: '/onboarding/create-family',
     element: (
       <OnboardingGuard>
         <CreateFamilyPage />
       </OnboardingGuard>
     )
   }
   ```

### Krok 8: Implementacja obsługi błędów
1. Zaimportuj toast z shadcn/ui:
   ```typescript
   import { useToast } from '@/components/ui/use-toast';
   ```
2. Dodaj obsługę błędów w handleSubmit:
   ```typescript
   const handleSubmit = async (data: CreateFamilyFormData) => {
     try {
       await createFamily(data);
       setShowSuccess(true);
     } catch (error) {
       if (error.code === 'USER_ALREADY_IN_FAMILY') {
         toast({
           title: 'Already in family',
           description: 'You already belong to a family',
           variant: 'default'
         });
         navigate('/dashboard');
       } else {
         toast({
           title: 'Error',
           description: error.message,
           variant: 'destructive'
         });
       }
     }
   };
   ```
3. Dodaj obsługę błędów 401 Unauthorized:
   ```typescript
   useEffect(() => {
     if (error?.error.code === 'UNAUTHORIZED') {
       logout();
       navigate('/auth/login');
     }
   }, [error, logout, navigate]);
   ```

### Krok 9: Walidacja i accessibility
1. Dodaj atrybuty ARIA do formularza:
   ```typescript
   <form aria-label="Create family form">
   ```
2. Powiąż label z input:
   ```typescript
   <label htmlFor="family-name">Family Name</label>
   <input id="family-name" ... />
   ```
3. Dodaj komunikaty błędów z role="alert":
   ```typescript
   {validationError && (
     <p role="alert" className="text-red-600">
       {validationError}
     </p>
   )}
   ```
4. Zapewnij keyboard navigation:
   - Tab między elementami
   - Enter wysyła formularz
   - Escape zamyka toast
5. Przetestuj z czytnikiem ekranu (np. NVDA, JAWS)

### Krok 10: Responsywność i styling
1. Dodaj breakpointy Tailwind dla różnych rozmiarów ekranu:
   ```typescript
   <div className="container mx-auto px-4 py-8 max-w-md lg:max-w-lg">
   ```
2. Zapewnij touch-friendly elementy na mobile (min 44x44px)
3. Przetestuj na różnych urządzeniach:
   - Mobile (≤767px)
   - Tablet (768px-1023px)
   - Desktop (≥1024px)
4. Sprawdź czytelność tekstu (contrast ratio ≥4.5:1)
5. Użyj utility classes z Tailwind dla spójności:
   ```typescript
   <h1 className="text-2xl lg:text-4xl font-bold mb-4">
   ```

### Krok 11: Testowanie
1. **Testy jednostkowe:**
   - Test custom hooka `useCreateFamily`
   - Test walidacji formularza
   - Test obsługi błędów
2. **Testy integracyjne:**
   - Test przepływu submit → success → redirect
   - Test przepływu submit → error → pokazanie toast
   - Test guard route
3. **Testy E2E:**
   - Test pełnego przepływu onboardingu
   - Test edge cases (wielokrotne kliknięcia, etc.)
4. **Testy manualne:**
   - Sprawdź UX na prawdziwych urządzeniach
   - Przetestuj z różnymi długościami nazw rodziny
   - Sprawdź animacje i przejścia

### Krok 12: Dokumentacja i finalizacja
1. Dodaj komentarze JSDoc do komponentów:
   ```typescript
   /**
    * CreateFamilyPage - Widok tworzenia nowej rodziny
    * 
    * Część procesu onboardingu. Umożliwia użytkownikowi utworzenie
    * własnego Family Hub i automatyczne przypisanie roli admina.
    * 
    * @example
    * <Route path="/onboarding/create-family" element={<CreateFamilyPage />} />
    */
   ```
2. Zaktualizuj dokumentację API (jeśli potrzeba)
3. Dodaj przykłady użycia do Storybook (opcjonalnie)
4. Przegląd kodu (code review)
5. Deploy do środowiska staging
6. QA testing
7. Deploy do produkcji

---

## Załącznik: Przykładowa implementacja komponentu głównego

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCreateFamily } from '@/hooks/useCreateFamily';
import { useToast } from '@/components/ui/use-toast';
import { CreateFamilyForm } from '@/components/onboarding/CreateFamilyForm';
import { ExplanationCard } from '@/components/onboarding/ExplanationCard';
import { SuccessAnimation } from '@/components/onboarding/SuccessAnimation';
import type { CreateFamilyFormData } from '@/types/onboarding';

/**
 * CreateFamilyPage - Widok tworzenia nowej rodziny
 * 
 * Część procesu onboardingu umożliwiająca utworzenie Family Hub
 * i automatyczne przypisanie roli administratora.
 */
export function CreateFamilyPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated, userHasFamily } = useAuth();
  const { createFamily, isCreating, error } = useCreateFamily();

  const [showSuccess, setShowSuccess] = useState(false);

  // Redirect guards
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login');
    } else if (userHasFamily) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, userHasFamily, navigate]);

  // Error handling for 401 Unauthorized
  useEffect(() => {
    if (error?.error.code === 'UNAUTHORIZED') {
      toast({
        title: 'Session expired',
        description: 'Please log in again',
        variant: 'default'
      });
      navigate('/auth/login');
    }
  }, [error, navigate, toast]);

  // Pre-fill family name with user's display name
  const defaultFamilyName = user?.display_name 
    ? `${user.display_name}'s Family` 
    : '';

  // Handle form submission
  const handleSubmit = async (data: CreateFamilyFormData) => {
    try {
      await createFamily(data);
      setShowSuccess(true);
    } catch (err) {
      const apiError = err as ApiError;
      
      if (apiError?.error.code === 'USER_ALREADY_IN_FAMILY') {
        toast({
          title: 'Already in family',
          description: 'You already belong to a family',
          variant: 'default'
        });
        navigate('/dashboard');
      } else {
        toast({
          title: 'Error creating family',
          description: apiError?.error.message || 'Please try again',
          variant: 'destructive'
        });
      }
    }
  };

  // Handle success animation completion
  const handleSuccessComplete = () => {
    navigate('/dashboard');
  };

  // Show success animation after family creation
  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SuccessAnimation onComplete={handleSuccessComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Your Family Hub
          </h1>
          <p className="text-gray-600">
            Start organizing your family's life in one place
          </p>
        </div>

        {/* Explanation Card */}
        <ExplanationCard />

        {/* Create Family Form */}
        <CreateFamilyForm
          onSubmit={handleSubmit}
          isSubmitting={isCreating}
          error={error}
          defaultName={defaultFamilyName}
        />
      </div>
    </div>
  );
}
```

---

**Wersja dokumentu:** 1.0.0  
**Data utworzenia:** 2026-01-28  
**Status:** Gotowy do implementacji  
**Powiązane dokumenty:** 
- PRD (prd.md)
- API Plan (api-plan.md) 
- UI Plan (ui-plan.md)
- Tech Stack (tech-stack.md)
