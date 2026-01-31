# 🛣️ Routing Implementation

## Przegląd

Aplikacja używa **prostego routingu opartego na stanie profilu użytkownika** bez React Router. Routing automatycznie kieruje użytkowników w zależności od tego, czy mają już utworzoną rodzinę.

## Struktura Routingu

```
App.tsx (główny router)
├── isLoading? → LoadingScreen
├── hasError? → ErrorScreen
├── !hasFamily? → CreateFamilyPage (onboarding)
└── hasFamily? → DashboardView (kalendarz)
```

## Logika Routingu

### 1. Stan Ładowania
```typescript
if (isLoading) {
  return <LoadingScreen />;
}
```

**Wyświetlane gdy:**
- Aplikacja sprawdza sesję użytkownika
- Pobiera profil z bazy danych
- Loguje użytkownika (DEV mode)

**Czas trwania:** ~1-2 sekundy

---

### 2. Stan Błędu
```typescript
if (error) {
  return <ErrorScreen />;
}
```

**Wyświetlane gdy:**
- Nie udało się zalogować (DEV mode)
- Błąd połączenia z bazą danych
- Mock user nie istnieje lub ma złe hasło

**Akcje użytkownika:**
- Przycisk "Retry" → przeładowanie strony

---

### 3. Brak Rodziny → Onboarding
```typescript
if (!hasFamily) {
  return <CreateFamilyPage />;
}
```

**Wyświetlane gdy:**
- Użytkownik jest zalogowany
- NIE ma profilu w tabeli `profiles`
- LUB profil nie ma `family_id`

**Ścieżki:**
- Nowy użytkownik po rejestracji
- Użytkownik usunął swoją rodzinę
- Testowanie w DEV mode z czystym userem

**Akcje użytkownika:**
- Utworzenie nowej rodziny
- (Przyszłość) Dołączenie do istniejącej rodziny

---

### 4. Ma Rodzinę → Dashboard
```typescript
if (hasFamily) {
  return <DashboardView />;
}
```

**Wyświetlane gdy:**
- Użytkownik jest zalogowany
- Ma profil w tabeli `profiles`
- Profil ma `family_id`

**Funkcje:**
- Widok kalendarza wydarzeń
- Lista zadań
- Tworzenie wydarzeń
- AI suggestions

## Przepływ Po Utworzeniu Rodziny

### Krok po kroku:

1. **Użytkownik wypełnia formularz**
   ```
   CreateFamilyPage → CreateFamilyForm → handleSubmit()
   ```

2. **Wywołanie API**
   ```typescript
   await createFamily({ name: 'Smith Family' });
   // → POST /families (Supabase)
   // → Tworzy family + profile w bazie
   ```

3. **Success animation**
   ```
   setShowSuccess(true) → SuccessAnimation (1.5s)
   ```

4. **Odświeżenie profilu**
   ```typescript
   await refreshProfile();
   // → GET /profiles (Supabase)
   // → Pobiera nowy profil z family_id
   ```

5. **Automatyczne przekierowanie**
   ```
   hasFamily zmienia się z false → true
   App.tsx re-renderuje
   CreateFamilyPage znika
   DashboardView pojawia się
   ```

## useAuth Hook

Hook `useAuth` zarządza całym stanem autentykacji i routingu:

```typescript
const { 
  user,          // Zalogowany użytkownik
  profile,       // Profil z bazy danych
  isLoading,     // Czy trwa ładowanie?
  hasFamily,     // Czy user ma rodzinę? (używane do routingu!)
  refreshProfile // Funkcja do odświeżenia profilu
} = useAuth();
```

### Inicjalizacja (DEV Mode)

```typescript
// 1. Automatyczne logowanie
const { data } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'test123456'
});

// 2. Pobranie profilu
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .maybeSingle();

// 3. Ustawienie stanu
setUser(data.user);
setProfile(profile);
// → hasFamily = !!profile?.family_id
```

### Odświeżenie Po Utworzeniu Rodziny

```typescript
// W CreateFamilyPage po sukcesie:
await refreshProfile();

// → Ponowne pobranie profilu z bazy
// → Profil teraz ma family_id
// → hasFamily zmienia się na true
// → App.tsx automatycznie pokazuje DashboardView
```

## Przykład: Pełny Przepływ Nowego Użytkownika

### 1. Pierwsze Uruchomienie
```
User otwiera app
  ↓
App.tsx: useAuth() inicjalizuje
  ↓
DEV: Logowanie jako test@example.com
  ↓
Pobieranie profilu z bazy
  ↓
Profil = null (user nie ma rodziny)
  ↓
hasFamily = false
  ↓
App.tsx renderuje CreateFamilyPage
```

### 2. Tworzenie Rodziny
```
User wpisuje "Smith Family"
  ↓
Klika "Create Family"
  ↓
createFamily() wywołuje API
  ↓
Supabase tworzy:
  - family (id, name)
  - profile (id, family_id, role: 'admin')
  ↓
Success animation (1.5s)
  ↓
refreshProfile() pobiera nowy profil
  ↓
Profil teraz ma family_id
  ↓
hasFamily = true
```

### 3. Automatyczne Przekierowanie
```
hasFamily zmienia się: false → true
  ↓
App.tsx re-renderuje (React state change)
  ↓
Warunek: if (!hasFamily) === false
  ↓
Przechodzi do: if (hasFamily)
  ↓
Renderuje DashboardView
  ↓
✅ User widzi kalendarz!
```

## Przyszłe Rozszerzenia

### 1. Dodanie React Router
```typescript
<BrowserRouter>
  <Routes>
    <Route path="/onboarding" element={<CreateFamilyPage />} />
    <Route path="/dashboard" element={<DashboardView />} />
    <Route path="/login" element={<LoginPage />} />
  </Routes>
</BrowserRouter>
```

### 2. Route Guards
```typescript
function PrivateRoute({ children }) {
  const { isAuthenticated, hasFamily } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!hasFamily) return <Navigate to="/onboarding" />;
  
  return children;
}
```

### 3. Dodanie "Join Family"
```typescript
if (!hasFamily) {
  return (
    <Routes>
      <Route path="/onboarding/create" element={<CreateFamilyPage />} />
      <Route path="/onboarding/join" element={<JoinFamilyPage />} />
    </Routes>
  );
}
```

## Testowanie Routingu

### Test 1: Nowy User (Brak Rodziny)
```sql
-- Usuń profil test usera
DELETE FROM profiles WHERE id = '2991ee00-0e73-4ee8-abf8-d454f2b6d8e0';
```

**Oczekiwany wynik:**
- Loading screen → CreateFamilyPage

### Test 2: Istniejący User (Ma Rodzinę)
```sql
-- User już ma profil z family_id
SELECT * FROM profiles WHERE id = '2991ee00-0e73-4ee8-abf8-d454f2b6d8e0';
```

**Oczekiwany wynik:**
- Loading screen → DashboardView

### Test 3: Utworzenie Rodziny
1. Usuń profil (Test 1)
2. Odśwież stronę → CreateFamilyPage
3. Wypełnij formularz i kliknij "Create Family"
4. Zobacz success animation
5. Automatycznie → DashboardView

**Oczekiwany wynik:**
- Płynne przejście bez ręcznego reload

## Troubleshooting

### Problem: Po utworzeniu rodziny nadal widać CreateFamilyPage

**Przyczyna:** `refreshProfile()` nie został wywołany lub nie zadziałał.

**Rozwiązanie:**
1. Sprawdź konsolę - czy jest błąd?
2. Sprawdź Network tab - czy GET /profiles się powiódł?
3. Sprawdź bazę - czy profil ma `family_id`?

### Problem: Loading screen nigdy nie znika

**Przyczyna:** Błąd podczas logowania (DEV mode).

**Rozwiązanie:**
1. Sprawdź konsolę - szukaj błędów auth
2. Sprawdź czy mock user istnieje w Supabase
3. Sprawdź czy hasło jest poprawne

### Problem: Error screen z "DEV auth failed"

**Przyczyna:** Mock user nie może się zalogować.

**Rozwiązanie:**
- Zobacz: `DEV-MODE-MOCK-USER-SETUP.md`

---

**Routing działa!** 🎉 Użytkownicy są automatycznie kierowani w zależności od stanu ich profilu.
