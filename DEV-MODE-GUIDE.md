# 🔧 Development Mode - Automatyczne Logowanie

## ✅ Co zostało dodane

Dodałem **automatyczne logowanie jako mock user** w trybie DEV, dzięki czemu możesz testować aplikację **bez ręcznego logowania**!

## 🎯 Jak to działa

### DEV_MODE włączony (domyślnie)

Aplikacja automatycznie:
- ✅ **Loguje się jako mock user**: `test@example.com`
- ✅ **Otrzymuje prawdziwy JWT token** z Supabase
- ✅ **Zapisuje do i czyta z PRAWDZIWEJ bazy danych** Supabase
- ✅ **Działa z prawdziwymi RLS policies**
- ✅ **Brak mock danych** - wszystko jest prawdziwe!

⚠️ **WAŻNE:** 
- Używasz **prawdziwej bazy danych**, nie mock danych
- Wydarzenia i zadania są rzeczywiste - widoczne w Supabase
- Profile, rodziny - wszystko prawdziwe

## 🚀 Jak używać

### Krok 0: Skonfiguruj mock usera (TYLKO RAZ)

**Pierwszy raz?** Zobacz: `DEV-MODE-MOCK-USER-SETUP.md`

Krótko:
1. Utwórz usera `test@example.com` w Supabase Dashboard
2. Ustaw hasło: `test123456`
3. Skopiuj UUID do `src/lib/mockAuth.ts`

### 1. Uruchom aplikację

```bash
npm run dev
```

### 2. Otwórz w przeglądarce

```
http://localhost:5173
```

### 3. Gotowe! 

**Aplikacja automatycznie loguje się jako mock user!**

Sprawdź konsolę (F12) - powinno być:
```
[DEV MODE] Signing in as mock user for real JWT token
[DEV MODE] Signed in successfully! User ID: ...
```

## 📱 Co możesz teraz zrobić

### Tworzenie wydarzeń
1. Kliknij "Add Event" w kalendarzu
2. Wypełnij formularz
3. Kliknij "Create Event"
4. ✅ Event pojawi się w kalendarzu!

### AI Suggestions działają!
Wypróbuj te tytuły:

```
"Doctor appointment"     → 🤖 Suggest: "Prepare medical documents"
"Sarah's Birthday"       → 🤖 Suggest: "Buy a gift"  
"Flight to Paris"        → 🤖 Suggest: "Pack bags"
"Date night at cinema"   → 🤖 Suggest: "Book a babysitter"
```

### Wyświetlanie kalendarza
- ✅ Zobacz 2 przykładowe wydarzenia
- ✅ Zobacz 2 przykładowe zadania
- ✅ Wszystkie nowo utworzone eventy i taski

## 🔧 Gdzie jest konfiguracja?

### Plik: `src/lib/mockAuth.ts`

```typescript
export const DEV_MODE = true; // ← Zmień na false gdy auth będzie gotowy
```

### Mock User:

```typescript
{
  id: 'mock-user-123',
  email: 'test@example.com',
  user_metadata: {
    family_id: 'mock-family-123',
    role: 'admin',
    display_name: 'Test User'
  }
}
```

### Mock Data: `src/lib/mockData.ts`

- 2 przykładowe wydarzenia
- 2 przykładowe zadania
- In-memory store dla nowych danych

## 🎨 Co jest mockowane

### ✅ Mockowane komponenty:

1. **Autentykacja**
   - `supabase.auth.getUser()` → zwraca mock user
   - `supabase.auth.getSession()` → zwraca mock session

2. **Database Operations**
   - `supabase.from('events').insert()` → zapisuje do memory
   - `supabase.from('tasks').insert()` → zapisuje do memory
   - `supabase.from('events').select()` → czyta z memory

3. **Edge Function**
   - `supabase.functions.invoke('analyze-event-for-suggestions')` → lokalne keyword matching

4. **Hooks**
   - `useEvents()` → zwraca mock events
   - `useTasks()` → zwraca mock tasks

### ✅ Co działa normalnie:

- ✅ **Cały UI** - buttons, forms, dialogs
- ✅ **Walidacja** - Zod schemas
- ✅ **State management** - React hooks
- ✅ **Kalendarz** - date calculations

## 🔄 Przełączanie między DEV MODE a PROD MODE

### DEV MODE (teraz)

```typescript
// src/lib/mockAuth.ts
export const DEV_MODE = true;
```

**Efekt**:
- ✅ Bez logowania
- ✅ Mock data w pamięci
- ✅ Szybkie testowanie
- ❌ Dane NIE są zapisywane do bazy

### PROD MODE (później)

```typescript
// src/lib/mockAuth.ts
export const DEV_MODE = false;
```

**Efekt**:
- ✅ Prawdziwe logowanie Supabase
- ✅ Prawdziwa baza danych
- ✅ Trwałe dane
- ✅ Multi-user support

## 📊 Testowanie AI Suggestions

AI Suggestions działają przez **keyword matching**:

| Keyword | Suggestion | Days Before |
|---------|-----------|-------------|
| doctor, dentist, clinic | Prepare medical documents | 1 day |
| birthday, bday | Buy a gift | 7 days |
| flight, trip, vacation | Pack bags | 2 days |
| cinema, date, dinner | Book a babysitter | 3 days |

### Przykład:

```
Tytuł: "Doctor appointment for kids"
       ↓
🤖 AI wykrywa keyword: "doctor"
       ↓
✨ Sugestia: "Prepare medical documents"
       ↓
Due date: 1 dzień przed eventem
```

## 🧪 Dane w pamięci

### Co się dzieje z danymi?

1. **Utworzysz event** → zapisuje się do `mockEventsStore`
2. **Odświeżysz przeglądarkę** → dane znikają (reset)
3. **Utworzysz ponownie** → nowy event

### Przykładowe dane:

```typescript
// src/lib/mockData.ts
export const MOCK_EVENTS = [
  {
    title: 'Team Meeting',
    start_time: 'Tomorrow 10:00'
  },
  {
    title: 'Doctor Appointment',
    start_time: 'In 2 days 10:00'
  }
];
```

## 🐛 Debugging

### Sprawdź czy DEV MODE jest włączony

Otwórz Console (F12) i szukaj:

```
🔧 DEV MODE: Using mock authentication
🔧 DEV MODE: Using mock events data
🔧 DEV MODE: Using mock tasks data
```

### Sprawdź utworzone eventy

```
[MOCK] Accessing table: events
[MOCK] Insert into events: { title: "...", ... }
```

### Sprawdź AI suggestions

```
[MOCK] Invoke function: analyze-event-for-suggestions
```

## 📚 Kiedy wyłączyć DEV MODE?

Wyłącz DEV MODE gdy:

1. ✅ **Masz gotową autentykację** (login/register)
2. ✅ **Wdrożyłeś Edge Function** do Supabase
3. ✅ **Zastosowałeś migracje** bazy danych
4. ✅ **Skonfigurowałeś RLS policies**

Wtedy zmień:

```typescript
// src/lib/mockAuth.ts
export const DEV_MODE = false; // ← Wyłącz mock
```

I usuń pliki:
- `src/lib/mockAuth.ts`
- `src/lib/mockData.ts`

## ✨ Zalety DEV MODE

✅ **Szybki start** - bez konfiguracji backendu  
✅ **Testowanie UI** - wszystkie komponenty działają  
✅ **Prototypowanie** - szybkie iteracje  
✅ **Bez kosztów** - nie używa Supabase quotas  
✅ **Offline work** - działa bez internetu  

## 🚀 Gotowe!

Teraz możesz:

1. **Kliknąć "Add Event"**
2. **Wypełnić formularz**
3. **Zobaczyć event w kalendarzu**
4. **Testować AI suggestions**

**Wszystko bez logowania!** 🎉

---

**Pytania?**
- Zobacz `QUICK-START-GUIDE.md` dla podstawowego użycia
- Zobacz `docs/DEPLOYMENT.md` jak wdrożyć prawdziwy backend

**Status**: ✅ DEV MODE Aktywny - Gotowy do testowania!


