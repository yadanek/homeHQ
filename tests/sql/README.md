# SQL Integration Tests

Testy integracyjne dla weryfikacji RLS policies i triggerów bazodanowych w Supabase PostgreSQL.

## 📋 Dostępne Pliki Testowe

### 1. `test_rls_update_event.sql`
**Cel**: Weryfikacja RLS policies dla operacji UPDATE na tabeli `events`

**Testy**:
- ✅ TEST 1: Twórca może aktualizować swój event
- ✅ TEST 2: Nie-twórca NIE może aktualizować cudzego eventu
- ✅ TEST 3: Nie można aktualizować zarchiwizowanego eventu
- ✅ TEST 4: Trigger `update_timestamp` aktualizuje `updated_at`

**RLS Policy**: `events_update_own_authenticated`
```sql
USING (
  created_by = auth.uid()
  AND archived_at IS NULL
)
```

### 2. `test_triggers_update_event.sql`
**Cel**: Weryfikacja triggerów działających podczas UPDATE eventów

**Testy**:
- ✅ TEST 1: `update_timestamp` trigger aktualizuje `updated_at`
- ✅ TEST 2: `clean_participants_on_private` usuwa uczestników
- ✅ TEST 3: Trigger nie uruchamia się przy innych aktualizacjach
- ✅ TEST 4: Trigger działa tylko dla zmiany false→true
- ✅ TEST 5: `validate_participant_family` blokuje cross-family

**Triggery**:
- `trg_update_timestamp_events` (BEFORE UPDATE)
- `trg_clean_participants_on_private` (AFTER UPDATE OF is_private)
- `trg_validate_participant_family` (BEFORE INSERT on event_participants)

---

## 🚀 Jak Uruchomić Testy

### Opcja 1: Supabase CLI (Zalecane)

```bash
# Połącz się z lokalną bazą Supabase
supabase db reset  # Resetuj bazę do czystego stanu

# Uruchom testy RLS
psql \
  postgresql://postgres:postgres@localhost:54322/postgres \
  -f tests/sql/test_rls_update_event.sql

# Uruchom testy triggerów
psql \
  postgresql://postgres:postgres@localhost:54322/postgres \
  -f tests/sql/test_triggers_update_event.sql
```

### Opcja 2: Supabase Dashboard

1. Otwórz Supabase Dashboard → SQL Editor
2. Skopiuj zawartość pliku testowego
3. Wykonaj query
4. Sprawdź output w Messages panel

### Opcja 3: psql Direct

```bash
# Połącz się z bazą produkcyjną (UWAGA: używaj staging!)
psql -U postgres -h db.xxx.supabase.co -d postgres \
  -f tests/sql/test_rls_update_event.sql
```

---

## 📊 Interpretacja Wyników

### Sukces
```
NOTICE: ✓ TEST 1 PASSED: Creator can update their own event (1 row updated)
NOTICE: ✓ TEST 2 PASSED: Non-creator cannot update event (0 rows updated)
NOTICE: ✓ TEST 3 PASSED: Cannot update archived event (0 rows updated)
NOTICE: ✓ TEST 4 PASSED: updated_at timestamp was updated
```

### Niepowodzenie
```
WARNING: ✗ TEST 1 FAILED: Expected 1 row updated, got 0
```

**Jeśli test failuje**:
1. Sprawdź czy RLS policy jest włączona: `ALTER TABLE events ENABLE ROW LEVEL SECURITY;`
2. Sprawdź czy policy istnieje: `SELECT * FROM pg_policies WHERE tablename = 'events';`
3. Sprawdź czy triggery są aktywne: `SELECT * FROM pg_trigger WHERE tgname LIKE '%events%';`

---

## 🔒 Bezpieczeństwo

### Ważne Uwagi

⚠️ **Transakcje**: Wszystkie testy używają `BEGIN...ROLLBACK`, więc nie modyfikują rzeczywistych danych

⚠️ **Production**: **NIE URUCHAMIAJ** na bazie produkcyjnej bez wcześniejszego przetestowania na staging

⚠️ **Timing**: Testy używają `pg_sleep()` aby zapewnić różnice w timestampach

### Test Data Cleanup

Każdy plik testowy:
1. Rozpoczyna transakcję (`BEGIN;`)
2. Tworzy testowe dane
3. Wykonuje testy
4. Rollbackuje wszystkie zmiany (`ROLLBACK;`)

Żadne dane nie są zapisywane permanentnie.

---

## 🧪 Rozszerzanie Testów

### Dodawanie Nowego Testu

```sql
-- ============================================================================
-- TEST CASE X: Description of test
-- ============================================================================
-- Expected: What should happen
-- Policy/Trigger: Which database object is being tested

DO $$
DECLARE
  -- Your variables here
BEGIN
  -- Test setup
  
  -- Execute operation
  
  -- Verify results
  IF condition THEN
    RAISE NOTICE '✓ TEST X PASSED: Success message';
  ELSE
    RAISE WARNING '✗ TEST X FAILED: Failure message';
  END IF;
END $$;
```

### Best Practices

1. **Descriptive Names**: Używaj jasnych nazw dla test cases
2. **Clear Messages**: PASS/FAIL messages powinny być jednoznaczne
3. **Isolation**: Każdy test powinien być niezależny
4. **Cleanup**: Zawsze używaj ROLLBACK
5. **Documentation**: Dokumentuj expected behavior

---

## 📝 Maintenance

### Kiedy Uruchomić Testy

✅ **Po każdej zmianie w**:
- RLS policies (`supabase/migrations/*_enable_rls_policies.sql`)
- Triggers (`supabase/migrations/*_create_triggers.sql`)
- Database schema affecting events or event_participants

✅ **Przed**:
- Mergem do main branch
- Deploym do staging
- Deploym do production

### Aktualizacja Testów

Gdy zmieniasz database logic:
1. Zaktualizuj odpowiedni plik testowy
2. Uruchom testy lokalnie
3. Commituj zmiany razem z migracjami
4. Dodaj nowy test case jeśli potrzeba

---

## 🆘 Troubleshooting

### Problem: Testy nie działają lokalnie

**Rozwiązanie**:
```bash
# Upewnij się że Supabase jest uruchomiony
supabase status

# Jeśli nie, uruchom
supabase start

# Zresetuj bazę do czystego stanu
supabase db reset
```

### Problem: "auth.uid() returns NULL"

**Przyczyna**: Brak proper JWT simulation w testach

**Rozwiązanie**: Testy używają `set_config('request.jwt.claims', ...)` aby symulować auth context

### Problem: "permission denied for table"

**Przyczyna**: Brak uprawnień dla użytkownika testowego

**Rozwiązanie**: Uruchom jako postgres superuser lub z odpowiednimi rolami

---

## 📚 Dodatkowe Zasoby

- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/trigger-definition.html)
- [Supabase Testing Guide](https://supabase.com/docs/guides/database/testing)

---

**Maintainer**: Development Team  
**Last Updated**: 2026-01-27  
**Status**: Active
