# Quick Start: Tworzenie Rodziny

## ✅ Co zostało już zrobione:

1. ✅ Kod połączony z prawdziwym Supabase
2. ✅ Mock autentykacji przygotowany
3. ✅ Wszystkie akcje (createEvent, updateEvent, deleteEvent, createFamily) zaktualizowane
4. ✅ TypeScript kompilacja działa

## 🚀 Pozostało 3 kroki (5 minut):

### Krok 1: Stwórz test usera w Supabase

1. Otwórz: https://supabase.com/dashboard
2. Wybierz swój projekt (pzcfgncasfkfmylpkpul)
3. **Authentication** → **Users** → **"Add user"**
4. Email: `test@example.com`, Password: `Test123456!`
5. **SKOPIUJ UUID** użytkownika (długi ciąg, np. `a1b2c3d4-...`)

### Krok 2: Wklej UUID do kodu

Edytuj: `src/lib/mockAuth.ts` (linia 13):

```typescript
export const MOCK_USER = {
  id: 'WKLEJ-TUTAJ-UUID-Z-SUPABASE', // ← ZMIEŃ TO!
  email: 'test@example.com',
  user_metadata: {
    display_name: 'Test User'
  }
};
```

### Krok 3: Wyłącz RLS (tymczasowo)

W Supabase Dashboard → **SQL Editor**, wykonaj:

```sql
-- TYLKO DLA DEVELOPMENTU!
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants DISABLE ROW LEVEL SECURITY;
```

⚠️ **Pamiętaj**: Przed wdrożeniem WŁĄCZ to z powrotem!

## 🎯 Gotowe! Uruchom:

```bash
npm run dev
```

Aplikacja będzie działać na: http://localhost:5173

## 🔍 Sprawdzenie:

W konsoli przeglądarki powinieneś zobaczyć:
```
[DEV MODE] Using real Supabase with mock authentication
[DEV MODE] User ID: <twój-uuid>
[DEV MODE] This will write to REAL database!
```

## 📊 Po stworzeniu rodziny:

Sprawdź w Supabase Dashboard → **Table Editor**:
- `families` - nowa rodzina
- `profiles` - nowy profil z rolą `admin`

---

## 💡 Informacje dodatkowe:

### Jak działa DEV_MODE:
- Używa **prawdziwego Supabase client**
- Mockuje tylko `auth.getUser()` (zwraca test usera)
- **Wszystkie operacje na bazie są PRAWDZIWE**
- Dane zapisują się do Supabase!

### Następne kroki (opcjonalne):
- [ ] Stwórz widok `CreateFamilyView.tsx`
- [ ] Dodaj routing (warunek: jeśli nie ma profilu → CreateFamilyView)
- [ ] Zaimplementuj prawdziwe auth (później)

### Troubleshooting:

**Problem**: "User already belongs to a family"
- **Rozwiązanie**: Usuń profil z tabeli `profiles` w Supabase

**Problem**: "new row violates row-level security policy"
- **Rozwiązanie**: Wyłącz RLS (patrz Krok 3)

**Problem**: Błąd 401 "Unauthorized"
- **Rozwiązanie**: Sprawdź UUID w `mockAuth.ts`

**Problem**: Brak połączenia z Supabase
- **Rozwiązanie**: Sprawdź `.env` - czy klucze są poprawne

---

📖 Szczegółowa dokumentacja: `SUPABASE-DEV-SETUP.md`
