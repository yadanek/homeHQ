# 🔧 Konfiguracja Mock Usera dla Trybu DEV

## Problem
W trybie DEV aplikacja automatycznie loguje się jako mock user, aby uzyskać **prawdziwy JWT token** wymagany przez Supabase RLS (Row Level Security).

## Szybka Konfiguracja

### Opcja 1: Użyj istniejącego usera (ZALECANE)

Jeśli masz już użytkownika `test@example.com` w Supabase:

1. **Otwórz Supabase Dashboard**
   - Przejdź do: Authentication → Users
   - Znajdź użytkownika: `test@example.com`

2. **Zresetuj hasło**
   - Kliknij na użytkownika
   - Kliknij "Send Magic Link" → "Reset Password"
   - Ustaw nowe hasło: `test123456`

3. **Skopiuj UUID**
   - Skopiuj UUID użytkownika (np. `2991ee00-0e73-4ee8-abf8-d454f2b6d8e0`)

4. **Zaktualizuj `src/lib/mockAuth.ts`**
   ```typescript
   export const MOCK_USER = {
     id: 'WKLEJ-TUTAJ-UUID',
     email: 'test@example.com',
     password: 'test123456',
     user_metadata: {
       display_name: 'Test User'
     }
   };
   ```

5. **Usuń profil użytkownika (jeśli istnieje)**
   - Przejdź do: Table Editor → profiles
   - Znajdź profil z `id` = UUID użytkownika
   - Usuń go (aby przetestować tworzenie rodziny)

### Opcja 2: Utwórz nowego usera

Jeśli nie masz użytkownika testowego:

1. **Otwórz Supabase Dashboard**
   - Przejdź do: Authentication → Users

2. **Dodaj nowego użytkownika**
   - Kliknij "Add user" → "Create new user"
   - Email: `test@example.com`
   - Password: `test123456`
   - ✅ **Zaznacz:** "Auto Confirm User"
   - Kliknij "Create user"

3. **Skopiuj wygenerowany UUID**
   - Po utworzeniu, skopiuj UUID użytkownika

4. **Zaktualizuj `src/lib/mockAuth.ts`**
   ```typescript
   export const MOCK_USER = {
     id: 'WKLEJ-TUTAJ-UUID',
     email: 'test@example.com',
     password: 'test123456',
     user_metadata: {
       display_name: 'Test User'
     }
   };
   ```

## Weryfikacja Konfiguracji

### 1. Sprawdź czy użytkownik istnieje
```sql
-- Wykonaj w Supabase SQL Editor
SELECT id, email, confirmed_at 
FROM auth.users 
WHERE email = 'test@example.com';
```

**Oczekiwany wynik:**
- `id`: UUID użytkownika
- `email`: test@example.com
- `confirmed_at`: data (nie NULL!)

### 2. Sprawdź czy użytkownik NIE ma profilu
```sql
-- Wykonaj w Supabase SQL Editor
SELECT * 
FROM profiles 
WHERE id = 'WKLEJ-UUID-USERA';
```

**Oczekiwany wynik:**
- Brak wyników (0 rows) ✅
- Lub istnieje profil → usuń go przed testowaniem

### 3. Test logowania
```typescript
// W konsoli przeglądarki (F12):
const { createClient } = await import('./src/db/supabase.client');
const supabase = createClient();
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'test123456'
});
console.log('Auth result:', data, error);
```

**Oczekiwany wynik:**
- `data.user.id` = UUID użytkownika
- `data.session` = obiekt z JWT tokenem
- `error` = null

## Jak to działa?

### Przed (STARY - NIE DZIAŁAŁO)
```typescript
// Mockowanie auth.getUser() - brak prawdziwego JWT
const supabase = createClient();
supabase.auth.getUser = () => Promise.resolve({ 
  data: { user: MOCK_USER } 
});

// ❌ Supabase próbuje użyć "mock-token" jako JWT
// ❌ RLS sprawdza token: "Expected 3 parts in JWT; got 1"
await supabase.from('profiles').select('*');
```

### Po (NOWY - DZIAŁA)
```typescript
// Prawdziwe logowanie - otrzymujemy prawdziwy JWT
const supabase = createClient();
const { data } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'test123456'
});

// ✅ Supabase ma prawdziwy JWT token
// ✅ RLS działa poprawnie
await supabase.from('profiles').select('*');
```

## Troubleshooting

### Błąd: "Invalid login credentials"
**Przyczyna:** Hasło w `mockAuth.ts` nie pasuje do hasła w Supabase.

**Rozwiązanie:**
1. Zresetuj hasło użytkownika w Supabase Dashboard
2. Upewnij się, że nowe hasło to `test123456`
3. Zaktualizuj `mockAuth.ts` jeśli używasz innego hasła

### Błąd: "Email not confirmed"
**Przyczyna:** Użytkownik nie został potwierdzony.

**Rozwiązanie:**
1. W Supabase Dashboard → Authentication → Users
2. Znajdź użytkownika `test@example.com`
3. W kolumnie "Confirmed" powinno być ✅
4. Jeśli nie, usuń użytkownika i utwórz nowego z zaznaczonym "Auto Confirm User"

### Błąd: "User already belongs to a family" (409)
**Przyczyna:** Mock user już ma profil w bazie.

**Rozwiązanie:**
1. Przejdź do: Table Editor → profiles
2. Znajdź profil z `id` = UUID mock usera
3. Usuń profil
4. Spróbuj ponownie

### Błąd: "Expected 3 parts in JWT; got 1"
**Przyczyna:** Używasz starej wersji kodu.

**Rozwiązanie:**
1. Upewnij się, że masz najnowszą wersję `createFamily.ts`
2. Powinno być: `signInWithPassword` zamiast `wrapSupabaseWithMockAuth`
3. Odśwież przeglądarkę (Ctrl+F5)

## Bezpieczeństwo

⚠️ **WAŻNE:** 
- Mock user i hasło są **tylko do developmentu**
- NIE commituj hasła do repozytorium (dodaj `mockAuth.ts` do `.gitignore`)
- W produkcji ustaw `DEV_MODE = false`
- Używaj prawdziwego auth flow w produkcji

## Wyłączenie trybu DEV

Gdy będziesz gotowy do używania prawdziwego auth:

```typescript
// W src/lib/mockAuth.ts
export const DEV_MODE = false; // ✅ Zmień na false
```

Po tej zmianie:
- Aplikacja będzie używać prawdziwego `auth.getUser()`
- Użytkownicy muszą się zalogować normalnie
- Brak automatycznego logowania jako mock user

---

**Gotowe!** 🎉 Teraz możesz przetestować tworzenie rodziny w trybie DEV.
