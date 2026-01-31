# Debug: Family Members w Events

## Problem
Members (bez kont) nie pokazują się w Participants mimo zaznaczenia przy tworzeniu eventu.

## Dodałem Debug Logging

Teraz w Console (F12 → Console) zobaczysz dokładne logi pokazujące co się dzieje:

### 1. Przy tworzeniu eventu:
```
🎯 CreateEventDialog - Submitting request:
  - title: "Nazwa eventu"
  - participant_ids: [...]
  - member_ids: [...]  ← WAŻNE: czy są IDs?
  - selectedMemberIds: [...]
  - members: [...]
```

### 2. W serwisie przy dodawaniu uczestników:
```
🔧 EventsService.addParticipants called:
  - eventId: "..."
  - participantIds: [...]
  - memberIds: [...]  ← WAŻNE: czy są przekazane?
  - participantCount: X
  - memberCount: Y
```

### 3. Przy pobieraniu eventu:
```
🔍 Raw event data from DB:
  - event_participants_raw: [...]  ← WAŻNE: czy zawiera member_id?

👥 Processing participant:
  - profile_id: null lub UUID
  - member_id: null lub UUID  ← WAŻNE: powinien być UUID dla members
  - profile: {...} lub null
  - member: {...} lub null  ← WAŻNE: powinien być {name, is_admin}
```

## Test Krok po Kroku

### Krok 1: Sprawdź czy members istnieją
1. Otwórz Family Settings
2. Zobacz czy są jakieś members na liście
3. Jeśli nie - dodaj nowego (np. "Emma", unchecked Adult)

### Krok 2: Stwórz event z members
1. Kliknij "Add Event"
2. Wpisz tytuł: "Test Event"
3. **OTWÓRZ CONSOLE (F12) TERAZ!**
4. Przewiń w dół do sekcji "Family Members"
5. **Czy widzisz members na liście?** (Emma, itp.)
6. **Zaznacz checkboxy przy members**
7. Kliknij "Create Event"
8. **SPRAWDŹ CONSOLE** - szukaj: `🎯 CreateEventDialog - Submitting request`

### Co powinieneś zobaczyć w Console:
```javascript
🎯 CreateEventDialog - Submitting request: {
  title: "Test Event",
  member_ids: ["uuid-1234-5678-..."],  // ← Powinny być UUIDs!
  selectedMemberIds: ["uuid-1234-5678-..."],
  members: [
    { id: "uuid-1234-5678-...", name: "Emma", is_admin: false }
  ]
}
```

**Jeśli `member_ids` jest `undefined`** → Problem w formularzu  
**Jeśli `member_ids` to pusta tablica** → Members nie zostały zaznaczone  
**Jeśli `member_ids` zawiera UUIDs** → OK, sprawdź dalej

### Krok 3: Sprawdź zapis do bazy
W Console szukaj:
```
🔧 EventsService.addParticipants called:
  memberIds: ["uuid-1234-5678-..."]
  memberCount: 1

➕ Adding member participants: ["uuid-1234-5678-..."]
✅ Member participants added successfully: [...]
```

**Jeśli nie widzisz tych logów** → Members nie zostały wysłane do API  
**Jeśli widzisz błąd ❌** → Problem z zapisem do bazy (RLS?)  
**Jeśli widzisz ✅** → Zapis OK, sprawdź dalej

### Krok 4: Sprawdź odczyt z bazy
1. Kliknij w event na kalendarzu
2. W Console szukaj:
```
🔍 Raw event data from DB:
  event_participants_raw: [
    { profile_id: "...", member_id: null, profile: {...}, member: null },
    { profile_id: null, member_id: "...", profile: null, member: {...} }
  ]

👥 Processing participant:
  member_id: "uuid-1234-5678-..."
  member: { id: "...", name: "Emma", is_admin: false }
```

**Jeśli `member` jest `null`** → JOIN w SQL nie działa (RLS?)  
**Jeśli `member_id` jest `null`** → Nie zapisało się do bazy  
**Jeśli wszystko OK** → Problem w wyświetlaniu

### Krok 5: Sprawdź wyświetlanie
W Console szukaj:
```
EventDetailsView - Event data:
  participants: [
    { profile: {...}, member: null },
    { profile: null, member: {name: "Emma", is_admin: false} }
  ]
```

## Możliwe Przyczyny

### A. Members nie są zaznaczane w formularzu
**Symptom**: `member_ids` is `undefined` w Step 2  
**Rozwiązanie**: Sprawdź czy sekcja "Family Members" w ogóle się pokazuje

### B. RLS blokuje zapis do event_participants
**Symptom**: ❌ Failed to add member participants  
**Rozwiązanie**: Sprawdź RLS policy w SQL:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'event_participants';
```

### C. RLS blokuje odczyt family_members
**Symptom**: `member` jest `null` mimo że `member_id` istnieje  
**Rozwiązanie**: Sprawdź czy policy `family_members_all` istnieje

### D. Frontend nie wyświetla members
**Symptom**: Dane są OK w console, ale nie widać na UI  
**Rozwiązanie**: Problem w `EventDetailsView` - sprawdź kod

## WYKONAJ TERAZ:

1. **Otwórz Console** (F12)
2. **Stwórz nowy event** z zaznaczonymi members
3. **Skopiuj wszystkie logi** z Console (Ctrl+A w zakładce Console)
4. **Prześlij mi** - pokażę Ci gdzie jest problem

Dzięki tym logom zobaczę **dokładnie** gdzie się psuje!
