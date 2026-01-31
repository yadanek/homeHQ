# 🚀 Szybki Start - Jak Stworzyć Event w Kalendarzu

## ✅ Co właśnie zostało dodane

1. **CreateEventDialog** - Modal do tworzenia wydarzeń
2. **Integracja z kalendarzem** - Przycisk "Add Event" teraz otwiera dialog
3. **Automatyczne odświeżanie** - Po utworzeniu eventu kalendarz się odświeża

## 📋 Co musisz zrobić TERAZ (bez deploymentu)

### Opcja A: Testuj lokalnie (najszybsza)

```bash
# 1. Uruchom aplikację (jeśli nie jest uruchomiona)
npm run dev

# 2. Otwórz w przeglądarce
# http://localhost:5173
```

### Opcja B: Z prawdziwym backendem (wymaga Supabase)

**UWAGA**: AI suggestions **NIE BĘDĄ działać** dopóki nie wdrożysz Edge Function!

Ale **możesz już tworzyć eventy** - po prostu bez AI suggestions.

## 🎮 Jak używać aplikacji

### Krok 1: Otwórz aplikację
```
http://localhost:5173
```

### Krok 2: Kliknij "Add Event" w kalendarzu
- Zobaczysz przycisk "+ Add Event" na górze kalendarza
- Kliknij go

### Krok 3: Wypełnij formularz
```
Title:       Doctor appointment
Description: Annual checkup
Start Time:  2026-02-15 10:00
End Time:    2026-02-15 11:00
Private:     ☐ (unchecked)
```

### Krok 4: Kliknij "Create Event"
- Event zostanie utworzony
- Zobaczysz komunikat "✅ Event created successfully!"
- Dialog się zamknie
- Event pojawi się w kalendarzu

## ⚠️ Ważne informacje

### Co DZIAŁA już teraz (bez deploymentu Edge Function):
✅ Tworzenie wydarzeń  
✅ Wyświetlanie w kalendarzu  
✅ Walidacja formularza  
✅ Zapisywanie do bazy danych  

### Co NIE DZIAŁA (wymaga deploymentu):
❌ AI Suggestions (birthday, health, outing, travel)  
❌ Automatyczne tworzenie zadań z sugestii  

**Dlaczego?** Edge Function `analyze-event-for-suggestions` nie jest jeszcze wdrożona do Supabase.

## 🔧 Jeśli chcesz AI Suggestions

### Musisz wdrożyć Edge Function:

```bash
# 1. Zaloguj się do Supabase
supabase login

# 2. Połącz z projektem
supabase link --project-ref your-project-ref

# 3. Wdróż Edge Function
supabase functions deploy analyze-event-for-suggestions

# 4. Sprawdź czy działa
supabase functions invoke analyze-event-for-suggestions \
  --data '{
    "title": "Doctor appointment",
    "start_time": "2026-02-01T10:00:00Z"
  }'
```

### Wtedy zobaczysz:
```json
{
  "suggestions": [
    {
      "suggestion_id": "health",
      "title": "Prepare medical documents",
      "due_date": "2026-01-31T10:00:00Z",
      "description": "Gather insurance cards and medical history"
    }
  ]
}
```

## 📝 Przykłady tytułów do testowania AI

Po wdrożeniu Edge Function, wypróbuj te tytuły:

```
✨ "Doctor appointment"      → Suggestion: "Prepare medical documents"
🎂 "Sarah's Birthday Party"  → Suggestion: "Buy a gift"
✈️ "Flight to Paris"         → Suggestion: "Pack bags"
🎬 "Date night at cinema"    → Suggestion: "Book a babysitter" (admin only)
```

## 🐛 Troubleshooting

### Problem: Nie widzę przycisku "Add Event"

**Rozwiązanie**: Sprawdź czy `CalendarArea` ma props `onAddEvent`
- Otwórz `src/components/dashboard/CalendarArea.tsx`
- Znajdź przycisk z tekstem "Add Event"

### Problem: Dialog się nie otwiera

**Rozwiązanie**: Sprawdź console w przeglądarce (F12)
- Szukaj błędów JavaScript
- Sprawdź czy import `CreateEventDialog` jest poprawny

### Problem: Event nie pojawia się w kalendarzu

**Rozwiązanie**:
1. Sprawdź czy masz połączenie z Supabase (`.env.local`)
2. Sprawdź czy masz zalogowanego użytkownika
3. Sprawdź czy użytkownik należy do rodziny (profile + family_id)

### Problem: Błąd "family_id is null"

**Rozwiązanie**: Użytkownik nie ma profilu w rodzinie
```sql
-- Sprawdź w Supabase SQL Editor
SELECT * FROM profiles WHERE id = 'your-user-id';

-- Jeśli pusty, utwórz profil
INSERT INTO profiles (id, family_id, role, display_name)
VALUES ('your-user-id', 'your-family-id', 'admin', 'Your Name');
```

## 📚 Pełna dokumentacja

Jeśli chcesz wszystko wdrożyć (Edge Function + Database Migration):
- Zobacz `docs/DEPLOYMENT.md`
- Zobacz `IMPLEMENTATION-SUMMARY.md`

## 🎉 Gotowe!

Teraz możesz:
1. **Kliknąć "Add Event"** w kalendarzu
2. **Wypełnić formularz**
3. **Zobaczyć event w kalendarzu**

**To wszystko!** 🚀

---

**Pytania?** Sprawdź:
- `docs/api/events-post-implementation.md` - Pełna dokumentacja API
- `docs/DEPLOYMENT.md` - Deployment guide
- `IMPLEMENTATION-SUMMARY.md` - Przegląd implementacji


