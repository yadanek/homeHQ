# Quick Start: Create Family View

Szybki przewodnik testowania nowego widoku tworzenia rodziny.

## ⚙️ Wymagania wstępne

### Konfiguracja Mock Usera w Supabase

W trybie DEV aplikacja automatycznie loguje się jako mock user, aby uzyskać prawdziwy JWT token.

1. **Otwórz Supabase Dashboard** → Authentication → Users

2. **Znajdź/Utwórz test usera:**
   - Email: `test@example.com`
   - UUID: `2991ee00-0e73-4ee8-abf8-d454f2b6d8e0`

3. **Ustaw hasło** (jeśli użytkownik już istnieje):
   - Kliknij na użytkownika
   - "Reset Password"
   - Ustaw hasło: `test123456`

4. **Lub utwórz nowego użytkownika:**
   - Kliknij "Add user" → "Create new user"
   - Email: `test@example.com`
   - Password: `test123456`
   - ✅ "Auto Confirm User"
   - Skopiuj wygenerowany UUID do `src/lib/mockAuth.ts`

5. **Upewnij się, że użytkownik NIE ma profilu:**
   - Otwórz Table Editor → profiles
   - Jeśli istnieje profil dla tego użytkownika - usuń go
   - (Pozwoli to przetestować tworzenie rodziny)

## 🚀 Jak przetestować nowy widok?

### Krok 1: Upewnij się, że mock user NIE ma rodziny

```sql
-- W Supabase SQL Editor:
DELETE FROM profiles WHERE id = '2991ee00-0e73-4ee8-abf8-d454f2b6d8e0';
```

(Wklej UUID swojego mock usera)

### Krok 2: Odśwież przeglądarkę

```
Ctrl + F5 (lub F5)
```

**Routing automatyczny:**
- Jeśli user NIE ma rodziny → CreateFamilyPage ✅
- Jeśli user MA rodzinę → DashboardView

Nie ma już flag w App.tsx - routing jest automatyczny!

### Krok 3: Przetestuj przepływ

1. **Sprawdź pre-filled name:**
   - Pole "Family Name" powinno być wstępnie wypełnione jako "Test User's Family"

2. **Przetestuj walidację:**
   - Wyczyść pole i kliknij poza nim → powinien pojawić się błąd
   - Wpisz tylko spacje → powinien pojawić się błąd
   - Wpisz poprawną nazwę → błąd powinien zniknąć

3. **Utwórz rodzinę:**
   - Wpisz nazwę rodziny (np. "Nowak Family")
   - Kliknij "Create Family"
   - Powinien pojawić się spinner i tekst "Creating Family..."
   
4. **Sprawdź animację sukcesu:**
   - Po sukcesie powinien pojawić się zielony checkmark
   - Tekst: "Family created successfully!"
   - Animowane kropki ładowania
   - Po 1.5 sekundzie strona się przeładuje

## 🎨 Czego się spodziewać?

### Layout
- Wyśrodkowany formularz na szarym tle
- Maksymalna szerokość: 28rem (448px)
- Responsywny design

### Komponenty
1. **Nagłówek:**
   - "Create Your Family Hub"
   - Tekst opisowy

2. **Niebieska karta informacyjna:**
   - "You'll be the admin"
   - 3 korzyści z checkmarkami

3. **Formularz:**
   - Jedno pole: "Family Name"
   - Przycisk "Create Family"
   - Link "Join an Existing Family" (loguje do konsoli)

4. **Animacja sukcesu (po utworzeniu):**
   - Duży zielony checkmark z animacją
   - Tekst sukcesu
   - Automatyczne przekierowanie

## 🧪 Scenariusze testowe

### ✅ Test 1: Poprawne utworzenie rodziny
```
1. Wpisz: "Test Family"
2. Kliknij "Create Family"
3. Oczekiwany rezultat: 
   - Loading state → 
   - Animacja sukcesu → 
   - Redirect (reload)
```

### ❌ Test 2: Walidacja - puste pole
```
1. Wyczyść pole "Family Name"
2. Kliknij poza polem (blur)
3. Oczekiwany rezultat: 
   - Czerwony border
   - Błąd: "Family name cannot be empty"
   - Przycisk submit disabled
```

### ❌ Test 3: Walidacja - za długa nazwa
```
1. Wpisz 101 znaków
2. Kliknij poza polem
3. Oczekiwany rezultat: 
   - Błąd: "Family name must be 100 characters or less"
```

### 🔄 Test 4: Obsługa błędów API
```
1. Jeśli użytkownik już ma rodzinę (409 Conflict)
2. Oczekiwany rezultat: 
   - Alert z komunikatem błędu
   - Formularz aktywny (można spróbować ponownie)
```

## 🐛 Troubleshooting

### Problem: Widzę Dashboard zamiast CreateFamilyPage
**Rozwiązanie:** Mock user już ma rodzinę. Usuń profil z bazy:
```sql
DELETE FROM profiles WHERE id = 'TWÓJ-UUID';
```

### Problem: Błąd "display_name is required"
**Rozwiązanie:** Sprawdź `MOCK_USER` w `src/lib/mockAuth.ts` - musi mieć `user_metadata.display_name`

### Problem: "User already belongs to a family" (409 Conflict)
**Rozwiązanie:** 
1. Otwórz Supabase Dashboard → Table Editor → profiles
2. Usuń istniejący profil dla mock usera
3. Spróbuj ponownie

### Problem: "Dev mode auth failed" lub "Invalid login credentials"
**Rozwiązanie:**
1. Sprawdź czy mock user istnieje w Supabase (Authentication → Users)
2. Sprawdź czy hasło w `mockAuth.ts` pasuje do hasła w Supabase
3. Sprawdź czy email i ID są poprawne
4. Upewnij się, że użytkownik jest potwierdzony (Auto Confirm User)

### Problem: "Expected 3 parts in JWT; got 1"
**Rozwiązanie:** To jest stary błąd - została naprawiona w nowej wersji. Użytkownik teraz loguje się normalnie i otrzymuje prawdziwy JWT token.

### Problem: Brak przekierowania po sukcesie
**Rozwiązanie:** 
1. Sprawdź konsolę - czy `refreshProfile()` się powiódł?
2. Sprawdź bazę - czy profil ma `family_id`?
3. Sprawdź Network tab - czy GET /profiles zwrócił dane?

## 📝 Notatki

- **Mock Auth:** Automatyczne logowanie jako `test@example.com`
- **Display Name:** Pobierany automatycznie z auth context
- **Routing:** **AUTOMATYCZNY** - oparty na `hasFamily` z profilu
- **Join Family:** Link tylko loguje do konsoli - widok nie jest zaimplementowany

## 🎯 Jak działa routing?

```
User otwiera app
  ↓
useAuth() sprawdza profil
  ↓
hasFamily = false → CreateFamilyPage
hasFamily = true  → DashboardView
```

Po utworzeniu rodziny:
```
Success → refreshProfile() → hasFamily = true → DashboardView
```

Brak ręcznego przekierowania - wszystko automatyczne!

---

**Pełna dokumentacja:** `docs/CREATE-FAMILY-VIEW-IMPLEMENTATION.md`
