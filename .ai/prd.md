# Dokument wymagań produktu (PRD) - HomeHQ - Home Headquarters

## 1. Przegląd produktu

HomeHQ to centrum dowodzenia dla nowoczesnej rodziny – aplikacja webowa (dostępna przez przeglądarkę), która łączy funkcje wspólnego kalendarza i list zadań z unikalnym Asystentem AI opartym na regułach. Głównym celem produktu jest zmniejszenie obciążenia mentalnego (mental load) rodziców, którzy pełnią rolę domowych menedżerów.

W odróżnieniu od standardowych kalendarzy, HomeHQ nie tylko przechowuje informacje o wydarzeniach, ale rozumie ich kontekst logistyczny. Dzięki systemowi zdefiniowanych reguł, aplikacja automatycznie sugeruje zadania towarzyszące wydarzeniom (np. przypomnienie o kupnie prezentu przed urodzinami lub zamówieniu opieki do dziecka przed wyjściem rodziców), zanim użytkownik sam o nich pomyśli.

MVP skupia się na weryfikacji hipotezy, że prosty, przewidywalny silnik reguł dostarcza wystarczającą wartość w modelu webowym, by użytkownicy przenieśli swoje zarządzanie domem do nowej aplikacji.

## 2. Problem użytkownika

Rodzice, a w szczególności główny organizator życia rodzinnego (często nazywany "Project Managerem Domu"), borykają się z trzema głównymi problemami:

1. Przeciążenie poznawcze (Mental Load): Samo wpisanie wydarzenia do kalendarza to za mało. Rodzic musi pamiętać o szeregu zadań z nim związanych (np. wpis "Urodziny Jasia" oznacza konieczność pamiętania o zadaniu "Kup prezent").
2. Rozproszenie narzędzi: Listy zakupów lądują na lodówce lub w komunikatorach, wydarzenia w Kalendarzu Google/Apple, a zadania domowe w głowie. Brak jednego źródła prawdy prowadzi do nieporozumień.
3. Brak prywatności w narzędziach rodzinnych: Dzieci powinny widzieć kalendarz i listę zakupów, ale nie powinny mieć dostępu do listy prezentów świątecznych czy budżetu.

HomeHQ rozwiązuje te problemy poprzez centralizację danych w chmurze (dostęp WWW), kontrolę uprawnień oraz aktywne sugerowanie zadań, zdejmując z rodzica konieczność pamiętania o wszystkim.

## 3. Wymagania funkcjonalne

### 3.1. Uwierzytelnianie i Zarządzanie Rodziną (Family Setup)

System musi umożliwiać stworzenie bezpiecznej, odizolowanej przestrzeni dla danych rodziny.

* Rejestracja i logowanie: Obsługa adresu e-mail i hasła. Dostęp przez przeglądarkę internetową.
* Tworzenie Przestrzeni Rodzinnej: Użytkownik, który zakłada konto, automatycznie staje się administratorem nowej przestrzeni.
* Zapraszanie członków: Administrator generuje unikalny kod/link zaproszenia, który inny użytkownik wpisuje po rejestracji, aby dołączyć do istniejącej rodziny.
* Mapowanie ról (Family Setup): W panelu ustawień Administrator musi przypisać każdego dołączającego użytkownika do jednej z dwóch ról:
    1. Administrator (Pełny dostęp: widzi wszystko, zarządza zadaniami i ustawieniami).
    2. Członek Rodziny/Dziecko (Dostęp ograniczony: widzi tylko kalendarz i listy wspólne, brak dostępu do zadań i list prywatnych).

### 3.2. Moduł Kalendarza i Integracje

Kalendarz jest głównym widokiem aplikacji webowej.

* Widoki: Miesiąc, Tydzień, Dzień (responsywny interfejs webowy).
* Tworzenie wydarzeń natywnych: Formularz zawiera tytuł, datę/czas, lokalizację oraz obligatoryjną sekcję "Uczestnicy" (checkboxy z imionami członków rodziny).
* Import z Apple Calendar:
    * Jednokierunkowa synchronizacja (tylko odczyt, np. poprzez subskrypcję iCal URL).
    * Importowane wydarzenia są oznaczone specjalną ikoną/kolorem.
    * Import uruchamia silnik analizy AI w tle.

### 3.3. Asystent AI (Silnik Reguł)

Serce MVP. System oparty na sztywnych regułach (hard-coded logic) analizujący tytuły wydarzeń i uczestników.

Zasada działania: Analiza następuje jednorazowo w momencie tworzenia wydarzenia lub importu.

Zdefiniowane reguły dla MVP:

1. Reguła "Urodziny"
   * Słowa kluczowe: urodziny, urodzinki, birthday, bday, jubileusz.
   * Akcja: Sugestia zadania "Kupić prezent" z terminem 7 dni przed wydarzeniem.

2. Reguła "Wyjście Rodziców"
   * Warunek: Uczestnicy to wyłącznie użytkownicy z rolą "Administrator" (brak dzieci).
   * Słowa kluczowe: kino, teatr, kolacja, randka, opera, koncert.
   * Akcja: Sugestia zadania "Umówić opiekunkę do dzieci" z terminem 3 dni przed wydarzeniem.

3. Reguła "Zdrowie"
   * Słowa kluczowe: lekarz, wizyta, szczepienie, dentysta, pediatra, przychodnia.
   * Akcja: Sugestia zadania "Przygotować książeczkę zdrowia i dokumenty" z terminem 1 dzień przed wydarzeniem.

4. Reguła "Podróż"
   * Słowa kluczowe: wyjazd, wycieczka, lot, wakacje, ferie, urlop.
   * Akcja: Sugestia zadania "Spakować walizki" z terminem 2 dni przed wydarzeniem.

5. Reguła "Samochód"
   * Słowa kluczowe: przegląd, mechanik, opony, ubezpieczenie oc.
   * Akcja: Sugestia zadania "Przygotować dowód rejestracyjny i dokumenty auta" z terminem 1 dzień przed wydarzeniem.

Interfejs sugestii:
* Podczas ręcznego tworzenia (Web): Sekcja pod formularzem z pytaniem "Wykryto kontekst [Nazwa reguły]. Dodać zadanie [Treść zadania]?". Opcje: Checkbox (domyślnie zaznaczony).
* Podczas importu (Web): System analizuje zaimportowane wydarzenia w tle i buforuje pasujące sugestie. Przy najbliższym logowaniu Administratora wyświetla się okno (modal) "Raport Asystenta", prezentujące listę wykrytych sugestii z możliwością zbiorczego lub pojedynczego zatwierdzenia/odrzucenia.

### 3.4. Moduł Zadania (TODO)

Lista zadań operacyjnych, widoczna wyłącznie dla roli Administrator.

* Zadania są niezależnymi bytami w bazie danych (nie są technicznie połączone z wydarzeniem po utworzeniu).
* Sortowanie: Zaległe, Dziś, Nadchodzące.
* Funkcje: Odhaczanie (ukończone), edycja tytułu i daty, usuwanie.

### 3.5. Moduł Listy

Uniwersalne listy do zarządzania zasobami.

* CRUD: Tworzenie, edycja, usuwanie list.
* Widoczność: Przełącznik "Prywatna" (tylko Admini) / "Wspólna" (Cała rodzina).
* Elementy listy: Dodawanie pozycji, checkbox do odhaczania.

## 4. Granice produktu

Poniższe funkcjonalności są celowo wyłączone z zakresu MVP:

* Aplikacja Natywna: Produkt dostępny wyłącznie jako aplikacja webowa (RWD - Responsive Web Design). Brak aplikacji w AppStore/Google Play.
* Zapis do Kalendarza Apple: Aplikacja nie modyfikuje zewnętrznego kalendarza (tylko odczyt).
* Edycja reguł AI: Użytkownik nie może definiować własnych słów kluczowych.
* Deduplikacja: Jeśli użytkownik zaimportuje to samo wydarzenie dwukrotnie (np. po usunięciu i ponownym dodaniu konta), system może stworzyć zduplikowane sugestie.
* Powiadomienia Push: MVP korzysta tylko z powiadomień wewnątrz interfejsu webowego (brak systemowych powiadomień przeglądarki).
* Czat rodzinny: Komunikacja odbywa się poza aplikacją.

## 5. Historyjki użytkowników

### Uwierzytelnianie i Konfiguracja

US-001 Rejestracja i utworzenie rodziny
* Tytuł: Zakładanie konta i przestrzeni
* Opis: Jako nowy użytkownik chcę zarejestrować się w aplikacji webowej, aby automatycznie stać się Administratorem nowej Przestrzeni Rodzinnej.
* Kryteria akceptacji:
    1. Użytkownik podaje email/hasło na stronie rejestracji.
    2. Po sukcesie tworzona jest nowa instancja "Rodziny".
    3. Użytkownik otrzymuje rolę "Administrator".
    4. Wyświetla się dashboard startowy (pusty stan).

US-002 Zapraszanie i mapowanie ról
* Tytuł: Dodawanie członków rodziny
* Opis: Jako Administrator chcę wygenerować kod zaproszenia i przypisać rolę "Dziecko" do konta mojego syna, aby ograniczyć mu dostęp do danych wrażliwych.
* Kryteria akceptacji:
    1. Admin widzi unikalny kod w ustawieniach WWW.
    2. Drugi użytkownik wpisuje kod podczas rejestracji na stronie.
    3. Admin w panelu "Użytkownicy" widzi nową osobę i wybiera z listy rolę: "Administrator" lub "Członek Rodziny".
    4. Zmiana roli natychmiast aktualizuje uprawnienia (przy odświeżeniu strony przez dziecko).

### Kalendarz i AI (Core Features)

US-003 Tworzenie wydarzenia z sugestią AI
* Tytuł: Ręczne dodawanie wydarzenia z wykryciem reguły
* Opis: Jako Administrator chcę dodać wydarzenie "Urodziny Babci" przez formularz WWW, aby system zaproponował mi utworzenie zadania zakupu prezentu.
* Kryteria akceptacji:
    1. Użytkownik wpisuje tytuł zawierający słowo "Urodziny".
    2. Pod formularzem pojawia się sekcja "Sugestia Asystenta" z tekstem: "Dodać zadanie: Kupić prezent (termin: data wydarzenia - 7 dni)?".
    3. Sekcja zawiera checkbox (domyślnie zaznaczony).
    4. Po kliknięciu "Zapisz", w module Zadania pojawia się nowe zadanie.

US-004 Wykrywanie kontekstu "Tylko Rodzice"
* Tytuł: Reguła opieki nad dziećmi
* Opis: Jako Administrator chcę dodać wydarzenie "Randka w kinie" zaznaczając tylko siebie i żonę, aby system zasugerował zamówienie opiekunki.
* Kryteria akceptacji:
    1. Użytkownik wybiera z listy uczestników tylko osoby z rolą Admin.
    2. Tytuł zawiera słowo "kino" lub "randka".
    3. System wyświetla sugestię zadania "Umówić opiekunkę" (termin: data wydarzenia - 3 dni).
    4. Jeśli do wydarzenia dodane zostanie Dziecko, sugestia się NIE pojawia.

US-005 Import z Kalendarza Apple (Zatwierdzanie)
* Tytuł: Weryfikacja sugestii po imporcie przy logowaniu
* Opis: Jako Administrator chcę po zalogowaniu zobaczyć listę sugestii wygenerowanych na podstawie importowanych wydarzeń, aby ręcznie zdecydować, które zadania faktycznie utworzyć.
* Kryteria akceptacji:
    1. System importuje wydarzenia w tle.
    2. Jeśli reguły zostaną dopasowane, sugestie trafiają do kolejki "Do akceptacji".
    3. Przy zalogowaniu (lub wejściu na Dashboard), Admin widzi modal/okno "Sugestie Asystenta".
    4. Okno wyświetla listę: "Wydarzenie X -> Sugerowane zadanie Y".
    5. Admin może zatwierdzić lub odrzucić każdą sugestię.
    6. Zatwierdzone sugestie stają się Zadaniami, odrzucone są usuwane z kolejki.

### Zarządzanie Listami i Zadaniami

US-006 Prywatność List
* Tytuł: Tworzenie listy prywatnej
* Opis: Jako Administrator chcę stworzyć listę "Prezenty Gwiazdkowe" widoczną tylko dla dorosłych, aby nie popsuć niespodzianki dzieciom.
* Kryteria akceptacji:
    1. Przy tworzeniu listy dostępny jest przełącznik "Widoczność: Wspólna / Tylko Admini".
    2. Po wybraniu "Tylko Admini", lista ma ikonę kłódki/oka.
    3. Użytkownik z rolą "Członek Rodziny" nie widzi tej listy w swoim panelu WWW.

US-007 Obsługa listy przez Dziecko
* Tytuł: Dziecko dodaje wpis do listy
* Opis: Jako Dziecko chcę otworzyć stronę aplikacji i dodać "Mleko" do wspólnej listy zakupów, aby rodzice wiedzieli, co kupić.
* Kryteria akceptacji:
    1. Użytkownik z rolą "Członek Rodziny" loguje się i widzi tylko listy "Wspólne".
    2. Może dodać nowy element tekstowy.
    3. Może odhaczyć istniejący element.
    4. Zmiany są widoczne dla wszystkich członków rodziny.

US-008 Zarządzanie Zadaniami
* Tytuł: Edycja wygenerowanego zadania
* Opis: Jako Administrator chcę zmienić termin zadania "Kupić prezent" wygenerowanego przez AI, ponieważ wolę to zrobić wcześniej.
* Kryteria akceptacji:
    1. Użytkownik wchodzi w zakładkę Zadania.
    2. Klika na zadanie wygenerowane automatycznie.
    3. Może zmienić datę, godzinę oraz treść zadania.
    4. Zmiana nie wpływa na oryginalne wydarzenie w kalendarzu.

## 6. Metryki sukcesu

Aby ocenić powodzenie MVP, monitorowane będą następujące wskaźniki:

1. Wskaźnik Akceptacji AI (AI Acceptance Rate)
   * Definicja: Procent sugestii wyświetlonych w modalu po imporcie, które zostały zaakceptowane przez Admina.
   * Cel: Powyżej 70% dla importowanych wydarzeń.

2. Aktywność Rodziny (Family Engagement Score)
   * Definicja: Średnia liczba interakcji (dodanie wydarzenia, zadania, pozycji na liście lub odhaczenie) na rodzinę tygodniowo w interfejsie webowym.
   * Cel: Minimum 20 akcji na aktywną rodzinę tygodniowo.

3. Retencja Dnia 30 (D30 Retention)
   * Definicja: Procent rodzin, które zalogowały się do aplikacji w 30. dniu od rejestracji.
   * Cel: Powyżej 20%.

4. Wykorzystanie List Prywatnych
   * Definicja: Procent rodzin, które utworzyły przynajmniej jedną listę prywatną.
   * Cel: 40% (weryfikuje potrzebę separacji treści dla dorosłych i dzieci).