# Supabase Development Setup

Instrukcja połączenia aplikacji z prawdziwą bazą Supabase w trybie rozwoju (bez pełnej autentykacji).

## ✅ Co już masz:
- Tabele w Supabase
- Klucze Supabase w `.env`
- Kod przygotowany do połączenia

## 🔧 Setup (5 minut):

### Krok 1: Stwórz test usera w Supabase

1. Otwórz: https://supabase.com/dashboard
2. Wybierz swój projekt
3. Idź do: **Authentication** → **Users**
4. Kliknij: **"Add user"** → **"Create new user"**
5. Wypełnij:
   - Email: `test@example.com`
   - Password: `Test123456!`
   - Confirm Password: `Test123456!`
6. Kliknij **"Create user"**
7. **SKOPIUJ UUID** użytkownika (długi ciąg znaków, np. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Krok 2: Wklej UUID do kodu

Otwórz: `src/lib/mockAuth.ts`

Znajdź linię:
```typescript
id: 'WKLEJ-TUTAJ-UUID-Z-SUPABASE',
```

Zamień na:
```typescript
id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // ← Twój UUID
```

### Krok 3: (Opcjonalnie) Tymczasowo wyłącz RLS

Jeśli masz problemy z RLS policies, tymczasowo wyłącz je w Supabase:

1. Idź do: **SQL Editor** w Supabase Dashboard
2. Wykonaj:

```sql
-- TYLKO DLA DEVELOPMENTU!
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_codes DISABLE ROW LEVEL SECURITY;
```

⚠️ **PAMIĘTAJ**: Przed wdrożeniem WŁĄCZ RLS z powrotem:
```sql
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
-- itd.
```

### Krok 4: Uruchom aplikację

```bash
npm run dev
```

## 🎯 Co się dzieje pod maską:

- Aplikacja używa **prawdziwego Supabase client**
- **TYLKO** `auth.getUser()` jest zamockowany (zwraca test usera)
- **Wszystkie operacje na bazie są prawdziwe** - dane zapisują się do Supabase!
- Możesz sprawdzać dane w Supabase Dashboard → Table Editor

## 📊 Sprawdzenie:

Po stworzeniu rodziny przez formularz, sprawdź w Supabase Dashboard:

1. **Table Editor** → `families` - nowa rodzina
2. **Table Editor** → `profiles` - nowy profil z rolą `admin`

## 🔄 Przejście do prawdziwej autentykacji (później):

Kiedy będziesz gotowy na prawdziwe auth:

1. Zmień w `src/lib/mockAuth.ts`:
   ```typescript
   export const DEV_MODE = false;
   ```

2. Zaimplementuj:
   - Login/Register formy
   - Protected routes
   - Sprawdzanie czy user ma profil
   - Redirect do CreateFamilyView jeśli nie ma

---

## 🐛 Troubleshooting:

### Błąd: "Missing or invalid authentication token"
- Sprawdź czy UUID w `mockAuth.ts` jest poprawny
- Sprawdź czy DEV_MODE = true

### Błąd: "User already belongs to a family"
- Usuń istniejący profil z tabeli `profiles` w Supabase
- Lub użyj innego test usera

### Błąd: "new row violates row-level security policy"
- Wyłącz RLS (patrz Krok 3)
- LUB dodaj policy która akceptuje twojego test usera

### Dane nie zapisują się
- Sprawdź console - czy widzisz `[DEV MODE] Using real Supabase`?
- Sprawdź Network tab - czy są requesty do Supabase?
- Sprawdź `.env` - czy klucze są poprawne?
