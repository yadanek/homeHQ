## Frontend - Vite + React 19 (SPA)

- **Vite 6:** Błyskawiczne środowisko deweloperskie z HMR, zoptymalizowane pod szybkie budowanie nowoczesnych aplikacji React.
   
- **React 19:** Wykorzystanie najnowszych możliwości frameworka, takich jak **Actions** do uproszczenia obsługi formularzy, **hooka `useOptimistic`** do natychmiastowej reakcji UI (np. przy odhaczaniu zadań) oraz lepszego wsparcia dla komponentów asynchronicznych.
   
- **Schedule-X:** Nowoczesna, lekka biblioteka kalendarza z natywnym wsparciem dla React. Zapewnia responsywny widok tygodnia i miesiąca oraz intuicyjne przeciąganie zdarzeń (Drag & Drop) "z pudełka".
   
- **TypeScript 5:** Ścisłe typowanie całego przepływu danych – od odpowiedzi z Supabase po parametry reguł asystenta AI.
   
- **Tailwind 4:** Najnowszy silnik CSS-first, który dzięki głębokiej integracji z kompilatorem pozwala na szybsze stylowanie bez skomplikowanych plików konfiguracyjnych.
   
- **Shadcn/ui:** Biblioteka komponentów (przycisków, modali, formularzy) w pełni kompatybilna z Tailwind 4, stanowiąca bazę dla profesjonalnego interfejsu użytkownika.
   

## Backend - Supabase (Backend-as-a-Service)

- **PostgreSQL:** Stabilna baza danych, w której przechowujemy wydarzenia, zadania towarzyszące oraz strukturę rodziny.
   
- **Row Level Security (RLS):** Kluczowa warstwa bezpieczeństwa realizująca wymóg PRD: administratorzy widzą wszystko, a dzieci mają dostęp tylko do list oznaczonych jako wspólne.
   
- **Supabase Auth:** Obsługa sesji i rejestracji. Wykorzystamy mechanizm `metadata` w auth, aby przypisywać użytkowników do konkretnej `family_id` już na etapie logowania.
   
- **Supabase Edge Functions:** Funkcje serverless (Deno/TypeScript) do obsługi cyklicznego importu iCal oraz uruchamiania silnika reguł po wykryciu nowych zdarzeń.
   

## AI - Silnik Reguł i OpenRouter.ai

- **Hard-coded Logic (MVP):** Wydajny system dopasowywania wzorców tekstowych (keywords) bezpośrednio w Edge Functions, generujący sugestie zadań w czasie rzeczywistym.
   
- **OpenRouter.ai (Skalowanie):** Interfejs przygotowany pod łatwe wpięcie modeli LLM (np. GPT-4o-mini), które w przyszłości pozwolą na bardziej subtelną analizę kontekstu (np. odróżnienie wizyty u lekarza od serialu o lekarzach).
   

## CI/CD i Hosting

- **GitHub Actions:** Zautomatyzowany pipeline budujący obraz Docker i uruchamiający testy sprawdzające reguły dostępu (RLS).
   
- **Vercel** 