# Plan Implementacji: Spec Generator

## Przegląd

Implementacja aplikacji Spec Generator w Next.js z App Router. Zadania są uporządkowane według zależności — zaczynamy od struktury projektu i warstwy walidacji, następnie budujemy serwisy backendowe, API Routes, komponenty UI, integrujemy całość w przepływ wizarda, dodajemy Generator_Standardów, Tutorial_Klucza_API, Tour_Powitalny + Tryb_Demo, Profil_Błędu z funkcją "Napraw ten błąd", a na końcu dostarczamy skrypty uruchomieniowe.

## Zadania

- [ ] 1. Konfiguracja projektu i podstawowa struktura
  - [ ] 1.1 Zainicjalizuj projekt Next.js z TypeScript i App Router
    - Utwórz projekt Next.js z konfiguracją TypeScript
    - Zainstaluj zależności: next-intl, fast-check, vitest, @testing-library/react
    - Skonfiguruj vitest.config.ts z obsługą plików .property.ts
    - Utwórz strukturę katalogów: src/app, src/components, src/services, src/lib, src/__tests__/properties, src/__tests__/unit, src/__tests__/integration
    - _Wymagania: 11.1_

  - [~] 1.2 Skonfiguruj internacjonalizację (next-intl)
    - Utwórz pliki tłumaczeń: messages/pl.json i messages/en.json
    - Skonfiguruj next-intl z polskim jako językiem domyślnym
    - Utwórz middleware do obsługi locale w App Router
    - Dodaj selektor języka jako komponent globalny
    - _Wymagania: 10.1, 10.2, 10.3, 10.5_

- [ ] 2. Warstwa walidacji i narzędzia pomocnicze
  - [~] 2.1 Zaimplementuj funkcje walidacji danych wejściowych
    - Utwórz src/lib/validation.ts z funkcjami: validateDescription(str) → {valid, error}, validateApiKey(key, provider) → boolean, validateSessionState(state) → {valid, errors}
    - validateDescription akceptuje ciągi 20-10000 znaków
    - validateSessionState sprawdza kompletność wymaganych pól przed generowaniem
    - _Wymagania: 2.2, 2.3, 12.4_

  - [ ]* 2.2 Napisz test właściwości dla walidacji opisu projektu
    - **Property 1: Walidacja długości opisu projektu**
    - **Waliduje: Wymagania 2.2, 2.3**

  - [ ]* 2.3 Napisz test właściwości dla pipeline walidacji danych wejściowych
    - **Property 10: Pipeline walidacji danych wejściowych**
    - **Waliduje: Wymagania 12.4**

  - [~] 2.4 Zaimplementuj funkcje maskowania i sanityzacji kluczy API
    - Utwórz src/lib/security.ts z funkcjami: maskApiKey(key) → zamaskowany ciąg (wszystko oprócz ostatnich 4 znaków), sanitizeLogs(text) → tekst bez kluczy API
    - sanitizeLogs wykrywa wzorce kluczy 4 dostawców i maskuje je: OpenAI (`sk-...`), Anthropic (`sk-ant-...`), Google (`AIza...`), GitHub (`ghp_...`, `github_pat_...`, `gho_...`)
    - _Wymagania: 14.2, 14.5_

  - [ ]* 2.5 Napisz test właściwości dla maskowania kluczy API
    - **Property 11: Maskowanie kluczy API**
    - **Waliduje: Wymagania 14.2**

  - [ ]* 2.6 Napisz test właściwości dla sanityzacji logów
    - **Property 12: Sanityzacja logów z kluczy API**
    - **Waliduje: Wymagania 14.5**

- [ ] 3. Checkpoint — Upewnij się że wszystkie testy przechodzą
  - Upewnij się że wszystkie testy przechodzą, zapytaj użytkownika jeśli pojawią się pytania.

- [ ] 4. Serwisy backendowe
  - [~] 4.1 Zaimplementuj FileSystemService
    - Utwórz src/services/FileSystemService.ts implementujący interfejs z designu
    - Metody: validatePath (sprawdza istnienie i uprawnienia zapisu), readStandards, ensureDocsDirectory, saveDocument, readDocument, createProject (tworzy nowy folder projektu), saveStandards (zapisuje wygenerowane standards.md w katalogu projektu)
    - Walidacja ścieżki musi zapobiegać path traversal (np. ../)
    - createProject odrzuca nazwy zawierające niedozwolone znaki dla danego OS
    - _Wymagania: 1.4, 1.7, 1.8, 1.9, 1.10, 6.1, 6.3, 15.6_

  - [~] 4.1a Zaimplementuj PreferencesService
    - Utwórz src/services/PreferencesService.ts
    - Plik konfiguracyjny: ~/.spec-generator/preferences.json
    - Metody: load, save, addRecentProject (max 10, sortowane malejąco po lastUsedAt, brak duplikatów), markFirstRunComplete
    - Klucze API NIGDY nie są tu zapisywane
    - _Wymagania: 1.2, 1.3, 1.11, 17.1, 17.4_

  - [ ]* 4.1b Napisz test właściwości dla spójności listy ostatnich projektów
    - **Property 14: Spójność listy ostatnich projektów**
    - **Waliduje: Wymagania 1.2, 1.11**

  - [~] 4.2 Zaimplementuj PromptTemplateService
    - Utwórz src/services/PromptTemplateService.ts z szablonami promptów
    - Szablony zróżnicowane per narzędzie AI (Codex, Claude Code, Gemini, Copilot) i per typ dokumentu (requirements, design, tasks)
    - Każdy szablon zawiera systemPrompt, userPromptTemplate, outputFormat
    - Szablony uwzględniają locale (pl/en) w instrukcji generowania
    - Szablony uwzględniają standardy korporacyjne (włączane warunkowo)
    - _Wymagania: 4.3, 7.3, 8.3, 9.3, 10.4_

  - [ ]* 4.3 Napisz test właściwości dla PromptTemplateService
    - **Property 3: Poprawność serwisu szablonów promptów**
    - **Waliduje: Wymagania 4.3, 7.3, 8.3, 9.3**

  - [ ]* 4.4 Napisz test właściwości dla włączenia standardów korporacyjnych
    - **Property 4: Włączenie standardów korporacyjnych do promptu**
    - **Waliduje: Wymagania 6.2, 6.3, 7.4**

  - [ ]* 4.5 Napisz test właściwości dla języka w prompcie
    - **Property 8: Język w prompcie generowania**
    - **Waliduje: Wymagania 10.4**

  - [~] 4.6 Zaimplementuj AIService
    - Utwórz src/services/AIService.ts z abstrakcją nad 4 dostawcami API: OpenAI, Anthropic, Google (Gemini), GitHub Models
    - Każdy dostawca ma własną implementację adaptera (OpenAIAdapter, AnthropicAdapter, GoogleAdapter, GithubModelsAdapter) implementującego wspólny interfejs
    - Metody: generateQuestions, generateDocument (ze streamingiem), validateApiKey
    - Obsługa streamingu przez callback onChunk (SSE u OpenAI/Anthropic/GitHub Models, native streaming u Google)
    - Implementacja retry z exponential backoff (max 3 próby, 1s bazowy delay, mnożnik 2x)
    - Walidacja liczby pytań (3-10, przycinanie nadmiaru)
    - validateApiKey wykonuje pojedyncze, najtańsze wywołanie testowe per dostawca
    - _Wymagania: 3.1, 5.1, 5.5, 5.6, 5.8, 5.9, 12.1_

  - [ ]* 4.7 Napisz test właściwości dla wymuszenia liczby pytań
    - **Property 2: Wymuszenie liczby pytań doprecyzowujących**
    - **Waliduje: Wymagania 3.3**

  - [~] 4.8 Zaimplementuj mechanizm chunking
    - Utwórz src/lib/chunking.ts z funkcją splitIntoChunks(text, maxTokens) → chunks[]
    - Każdy fragment mieści się w 80% limitu tokenów (margines bezpieczeństwa)
    - Konkatenacja fragmentów odtwarza oryginalną treść
    - Estymacja tokenów: tiktoken dla OpenAI, przybliżenie (chars/4) dla Anthropic
    - _Wymagania: 12.2_

  - [ ]* 4.9 Napisz test właściwości dla chunking
    - **Property 9: Poprawność dzielenia treści na fragmenty**
    - **Waliduje: Wymagania 12.2**

- [ ] 5. Checkpoint — Upewnij się że wszystkie testy przechodzą
  - Upewnij się że wszystkie testy przechodzą, zapytaj użytkownika jeśli pojawią się pytania.

- [ ] 6. API Routes
  - [~] 6.1 Zaimplementuj POST /api/validate/path
    - Utwórz src/app/api/validate/path/route.ts
    - Przyjmuje projectPath, zwraca: valid, exists, writable, hasStandards, standardsPreview (pierwsze 500 znaków), error
    - Wykorzystuje FileSystemService do walidacji
    - _Wymagania: 1.7, 1.8, 1.9, 6.1_

  - [~] 6.1a Zaimplementuj GET/POST /api/projects/recent
    - Utwórz src/app/api/projects/recent/route.ts
    - GET zwraca listę ostatnich projektów (top 10) z PreferencesService
    - POST dopisuje projekt do listy lub aktualizuje datę ostatniego użycia
    - _Wymagania: 1.2, 1.11_

  - [~] 6.1b Zaimplementuj POST /api/projects/create
    - Utwórz src/app/api/projects/create/route.ts
    - Przyjmuje parentPath, projectName, opcjonalnie initializeStandards
    - Wykorzystuje FileSystemService.createProject
    - Zwraca pełną ścieżkę utworzonego projektu lub Profil_Błędu
    - _Wymagania: 1.4, 1.9_

  - [~] 6.2 Zaimplementuj POST /api/questions
    - Utwórz src/app/api/questions/route.ts
    - Przyjmuje: projectDescription, previousAnswers, standards, locale, aiModel, apiKey
    - Zwraca listę pytań doprecyzowujących (3-10)
    - Klucz API przekazywany w body (nie w nagłówku) — nie logować
    - Wykorzystuje AIService.generateQuestions
    - _Wymagania: 3.1, 3.3, 3.6_

  - [~] 6.3 Zaimplementuj POST /api/generate (SSE stream)
    - Utwórz src/app/api/generate/route.ts
    - Przyjmuje: projectPath, projectDescription, answers, targetTool, aiModel, apiKey, standards, locale
    - Zwraca strumień SSE z eventami: progress, content, document_complete, error, done
    - Generuje dokumenty sekwencyjnie: requirements → design → tasks
    - Każdy kolejny dokument otrzymuje w kontekście poprzednie dokumenty
    - Obsługa retry i chunking przy błędach
    - _Wymagania: 7.1, 8.1, 8.4, 9.1, 11.6, 12.1, 12.2_

  - [ ]* 6.4 Napisz test właściwości dla kontekstu sekwencyjnego generowania
    - **Property 6: Kontekst sekwencyjnego generowania dokumentów**
    - **Waliduje: Wymagania 8.4**

  - [~] 6.5 Zaimplementuj POST /api/files/save
    - Utwórz src/app/api/files/save/route.ts
    - Przyjmuje: projectPath, documents (tablica {filename, content})
    - Tworzy katalog /docs jeśli nie istnieje
    - Zapisuje pliki i zwraca listę zapisanych plików lub błędy
    - _Wymagania: 1.4, 7.1, 13.3_

- [ ] 7. Checkpoint — Upewnij się że wszystkie testy przechodzą
  - Upewnij się że wszystkie testy przechodzą, zapytaj użytkownika jeśli pojawią się pytania.

- [ ] 8. Komponenty UI
  - [~] 8.1 Zaimplementuj komponent WizardLayout
    - Utwórz src/components/WizardLayout.tsx
    - Wyświetla pasek postępu z krokami (numerowane, z tytułami)
    - Zarządza nawigacją między krokami (następny/poprzedni)
    - Blokuje przejście do następnego kroku jeśli bieżący nie jest ukończony
    - Responsywny design, prosty język bez żargonu technicznego
    - _Wymagania: 11.1, 11.2, 13.5_

  - [~] 8.2 Zaimplementuj komponent ProjectPicker (ekran startowy)
    - Utwórz src/components/ProjectPicker.tsx
    - Sekcja A: lista ostatnich projektów (z /api/projects/recent) — kafelki klikalne, z datą ostatniego użycia i nazwą
    - Sekcja B: przycisk "Wybierz folder" (otwiera natywny dialog systemowy gdy dostępny) + obszar drag & drop dla folderu
    - Sekcja C: przycisk "Nowy projekt" otwierający formularz z polami nazwa + lokalizacja rodzica
    - Sekcja D (zwijana, dla zaawansowanych): pole ręcznego wpisania ścieżki
    - Wywołuje /api/validate/path z debounce 500ms dla pól tekstowych
    - IF ścieżka nie istnieje → przycisk "Utwórz folder" zamiast czerwonego błędu
    - Wyświetla status walidacji: ✓ istnieje, informacja o standards.md
    - _Wymagania: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 6.4, 11.3_

  - [~] 8.3 Zaimplementuj komponent ProjectDescriptionInput
    - Utwórz src/components/ProjectDescriptionInput.tsx
    - Pole textarea z licznikiem znaków (min 20, max 10000)
    - Wyświetla wskazówki i przykłady opisów projektów
    - Walidacja w czasie rzeczywistym z komunikatem o minimalnej długości
    - _Wymagania: 2.1, 2.2, 2.3, 2.4, 11.3_

  - [~] 8.4 Zaimplementuj komponent ChatLikeQuestion (jedno pytanie naraz)
    - Utwórz src/components/ChatLikeQuestion.tsx
    - Wyświetla dokładnie jedno Pytanie_Aktywne wraz ze wskaźnikiem postępu "Pytanie X z Y"
    - Wyświetla wskaźnik kompletności informacji (procent) i komunikat "Możesz zakończyć etap pytań"
    - Pole odpowiedzi z opcjonalnymi sugerowanymi odpowiedziami w formie chipów (klikalnych)
    - Przyciski: "Wstecz", "Pomiń", "Pomiń pozostałe i przejdź dalej", "Następne pytanie", "Wygeneruj więcej pytań"
    - Animacja przejścia między pytaniami (slide / fade)
    - _Wymagania: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 3.11_

  - [ ]* 8.4a Napisz test właściwości dla pojedynczego Pytania_Aktywnego
    - **Property 18: Pojedyncze Pytanie_Aktywne**
    - **Waliduje: Wymagania 3.3, 3.4**

  - [~] 8.5 Zaimplementuj komponent ToolSelector z rekomendacją
    - Utwórz src/components/ToolSelector.tsx oraz src/components/ToolModelRecommendation.tsx
    - Karty z ikonami i opisami dla: Codex, Claude Code, Gemini, Copilot, Uniwersalny
    - Karta rekomendowana wyróżniona wizualnie i z 1-zdaniowym uzasadnieniem AI
    - Zaznaczenie wybranego narzędzia (radio-button style); wybór alternatywy nie wymaga uzasadnienia
    - Opisy w języku wybranym przez użytkownika
    - Wywołuje POST /api/suggest dla otrzymania rekomendacji
    - _Wymagania: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7_

  - [~] 8.6 Zaimplementuj komponent ModelSelector z rekomendacją i tutorialem
    - Utwórz src/components/ModelSelector.tsx
    - Lista modeli z podziałem na dostawców (OpenAI, Anthropic), z oznaczeniem "Polecany dla tego projektu"
    - Dla każdego modelu: szacowany czas generowania, szacowany koszt USD, poziom jakości (Szybki / Zbalansowany / Najwyższa jakość)
    - Pole na klucz API z maskowaniem (wyświetla tylko ostatnie 4 znaki)
    - Przycisk "Nie mam klucza — pokaż jak go zdobyć" otwierający Tutorial_Klucza_API (komponent ApiKeyTutorial)
    - Walidacja klucza API po wprowadzeniu (tanie żądanie testowe), wynik ✓/✗
    - IF klucz nieprawidłowy → renderuje ErrorProfile z fixAction open-tutorial
    - _Wymagania: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 5.9, 14.2_

  - [~] 8.6a Zaimplementuj komponent ApiKeyTutorial
    - Utwórz src/components/ApiKeyTutorial.tsx
    - Obsługuje 4 dostawców: openai, anthropic, google, github
    - Modal/sidebar wyświetlający treść z GET /api/tutorials/:provider
    - Renderuje markdown z numerowanymi krokami i ilustracjami
    - Klikalne linki do zewnętrznych stron (otwierane w nowej karcie z `noopener noreferrer`)
    - Sekcja "Szacowane koszty", "Darmowy plan" (gdy istnieje, np. Gemini), "Bezpieczeństwo klucza"
    - Wskaźnik wieku treści: ikona dla 30–90 dni, żółty banner dla > 90 dni z linkiem do oryginalnej dokumentacji
    - Po kliknięciu "Mam klucz" wraca do pola wpisania klucza w ModelSelector
    - _Wymagania: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.10, 16.12_

  - [~] 8.7 Zaimplementuj komponent GenerationProgress
    - Utwórz src/components/GenerationProgress.tsx
    - Wyświetla kroki generowania: requirements → design → tasks
    - Animacja ładowania przy aktywnym kroku
    - Podgląd streamowanej treści w czasie rzeczywistym
    - Obsługa stanów: pending, in_progress, completed, error
    - _Wymagania: 11.6_

  - [~] 8.8 Zaimplementuj komponent DocumentPreview
    - Utwórz src/components/DocumentPreview.tsx
    - Renderowanie Markdown z podglądem sformatowanym
    - Tryb edycji (textarea z podświetlaniem składni Markdown)
    - Przycisk "Regeneruj całość" z polem na dodatkowe wskazówki
    - Klikalne sekcje (nagłówki) z przyciskiem "Regeneruj tę sekcję"
    - Historia 5 ostatnich wersji z przyciskiem "Cofnij zmianę"
    - Integracja z DocumentSuggestions i DocumentDiff
    - Przycisk "Zapisz" do zatwierdzenia dokumentu
    - _Wymagania: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.10, 11.5_

  - [~] 8.9 Zaimplementuj komponent DocumentSuggestions
    - Utwórz src/components/DocumentSuggestions.tsx
    - Wyświetla listę sugestii AI z severity (info / warning / critical)
    - Każda sugestia ma przyciski "Zaakceptuj" (uruchamia regenerację sekcji) i "Odrzuć"
    - Dane pobierane z POST /api/suggest (kind: document-suggestions)
    - _Wymagania: 13.8, 13.9_

  - [~] 8.10 Zaimplementuj komponent DocumentDiff
    - Utwórz src/components/DocumentDiff.tsx
    - Tryby: unified, side-by-side
    - Przyciski "Zaakceptuj zmiany" i "Cofnij zmiany"
    - Wykorzystuje bibliotekę diff (np. `diff` lub `react-diff-viewer-continued`)
    - _Wymagania: 13.6, 13.7_

  - [~] 8.11 Zaimplementuj komponent ErrorProfile
    - Utwórz src/components/ErrorProfile.tsx
    - Cztery sekcje: "Co się stało", "Co to oznacza", "Jak to naprawić", przyciski akcji
    - Główny przycisk "Napraw ten błąd" z payloadem zależnym od kodu błędu
    - Przycisk "Skopiuj raport błędu" zawsze dostępny
    - Mapowanie kodu błędu → akcja zgodne z tabelą w design.md
    - _Wymagania: 12.1, 12.2, 12.3, 12.4, 12.5, 12.9_

  - [ ]* 8.11a Napisz test właściwości dla kompletności Profilu_Błędu
    - **Property 15: Kompletność Profilu_Błędu**
    - **Waliduje: Wymagania 12.1, 12.9**

  - [ ]* 8.11b Napisz test właściwości dla powiązania Profilu_Błędu z akcją naprawczą
    - **Property 16: Powiązanie Profilu_Błędu z akcją naprawczą**
    - **Waliduje: Wymagania 12.3, 12.4, 12.5**

  - [~] 8.12 Zaimplementuj komponent WelcomeTour
    - Utwórz src/components/WelcomeTour.tsx
    - 3–5 ekranów z tytułem, opisem, ilustracją SVG
    - Przyciski "Dalej", "Pomiń wprowadzenie", "Wypróbuj demo"
    - Stan w PreferencesService.firstRunComplete
    - _Wymagania: 17.1, 17.2, 17.3, 17.4_

- [ ] 9. Integracja przepływu wizarda
  - [~] 9.1 Zaimplementuj stronę główną wizarda i zarządzanie stanem sesji
    - Utwórz src/app/[locale]/page.tsx jako główną stronę wizarda
    - Zaimplementuj hook useSessionState do zarządzania stanem w sessionStorage
    - Stan sesji zgodny z interfejsem SessionState z designu
    - Klucze API przechowywane wyłącznie w sessionStorage, usuwane przy zamknięciu sesji
    - Połącz wszystkie komponenty w przepływ: ścieżka → opis → pytania → narzędzie → model → generowanie → podgląd → zapis
    - _Wymagania: 11.1, 14.1, 14.3_

  - [~] 9.2 Zaimplementuj logikę generowania z SSE na frontendzie
    - Utwórz src/lib/useGeneration.ts (custom hook)
    - Obsługa połączenia SSE z /api/generate
    - Parsowanie eventów: progress, content, document_complete, error, done
    - Aktualizacja stanu komponentów w czasie rzeczywistym
    - Obsługa błędów: wyświetlenie komunikatu, możliwość ponowienia
    - _Wymagania: 7.1, 8.1, 9.1, 11.6, 12.1_

  - [~] 9.3 Zaimplementuj walidację struktury wygenerowanych dokumentów
    - Utwórz src/lib/documentValidator.ts
    - Funkcja validateDocumentStructure(type, content) → {valid, missingSections}
    - Sprawdza obecność wymaganych sekcji: requirements (wprowadzenie, słownik, wymagania), design (architektura, komponenty, interfejsy, modele danych), tasks (lista zadań z opisami i zależnościami)
    - _Wymagania: 7.2, 8.2, 9.2_

  - [ ]* 9.4 Napisz test właściwości dla walidacji struktury dokumentów
    - **Property 5: Walidacja struktury wygenerowanych dokumentów**
    - **Waliduje: Wymagania 7.2, 8.2, 9.2**

  - [ ]* 9.5 Napisz test właściwości dla porządku topologicznego zadań
    - **Property 7: Porządek topologiczny zadań**
    - **Waliduje: Wymagania 9.5**

- [ ] 10. Obsługa błędów i UX
  - [~] 10.1 Zaimplementuj globalną obsługę błędów
    - Utwórz src/lib/errors.ts z typami błędów: NETWORK_ERROR, TOKEN_LIMIT, AUTH_ERROR, FILE_ACCESS, PATH_NOT_FOUND, PARSE_ERROR, UNKNOWN
    - Utwórz src/components/ErrorBoundary.tsx jako React Error Boundary
    - Każdy błąd generuje unikalny identyfikator (errorId) wyświetlany użytkownikowi
    - Komunikaty błędów w prostym języku, przetłumaczone na pl/en
    - _Wymagania: 12.1, 12.3, 12.5, 11.4_

  - [~] 10.2 Zaimplementuj mechanizm retry w UI
    - Dodaj przycisk "Spróbuj ponownie" przy błędach sieciowych i parsowania
    - Automatyczny retry z exponential backoff dla błędów sieciowych (max 3 próby)
    - Informacja o postępie retry: "Ponawiam próbę (2/3)..."
    - _Wymagania: 12.1_

- [ ] 11. Bezpieczeństwo i finalizacja
  - [~] 11.1 Zaimplementuj zabezpieczenia kluczy API
    - Upewnij się że klucze API nie są logowane w żadnych console.log ani logach serwera
    - Zastosuj sanitizeLogs we wszystkich miejscach logowania
    - Klucze API przesyłane w body requestów (nie w URL ani nagłówkach)
    - Weryfikacja że sessionStorage jest czyszczony przy zamknięciu sesji (event beforeunload)
    - _Wymagania: 14.1, 14.3, 14.4, 14.5_

  - [~] 11.2 Dodaj zabezpieczenie HTTPS i walidację połączenia
    - Dodaj middleware sprawdzający że w trybie produkcyjnym połączenie jest szyfrowane
    - W trybie deweloperskim (localhost) pomiń wymóg HTTPS
    - _Wymagania: 14.4_

- [ ] 12. Generator standardów (Wymaganie 15)
  - [~] 12.1 Przygotuj profile aplikacji (zasób statyczny)
    - Utwórz katalog content/profiles/ z plikami JSON dla profili: webapp-react, api-nodejs, mobile-flutter, library-python, monorepo, desktop, microservices
    - Każdy profil: id, name (pl/en), description (pl/en), followUpQuestions (3–7), standardsTemplate (szablon promptu)
    - _Wymagania: 15.2, 15.3_

  - [~] 12.2 Zaimplementuj StandardsGeneratorService
    - Utwórz src/services/StandardsGeneratorService.ts
    - Metody: listProfiles, getFollowUpQuestions, generateStandards (z onChunk dla streamingu)
    - Sekcje generowanego standards.md: Architektura, Bezpieczeństwo, Testowanie, Jakość kodu, Dokumentacja, CI/CD, Dostępność, Wydajność
    - _Wymagania: 15.2, 15.3, 15.4_

  - [~] 12.3 Zaimplementuj POST /api/standards/generate (SSE)
    - Utwórz src/app/api/standards/generate/route.ts
    - SSE eventy: progress, content, done, error
    - Wywołuje StandardsGeneratorService z wybranym Modelem_AI
    - _Wymagania: 15.4_

  - [~] 12.4 Zaimplementuj komponent StandardsGenerator
    - Utwórz src/components/StandardsGenerator.tsx
    - Krok 1: wybór profilu (kafelki z opisami)
    - Krok 2: pytania uzupełniające (chat-like, jedno na raz)
    - Krok 3: streaming generowania z podglądem na żywo
    - Krok 4: edycja i zapis (przyciski "Zapisz standards.md", "Pomiń")
    - _Wymagania: 15.1, 15.2, 15.3, 15.5, 15.6, 15.7_

  - [~] 12.5 Wystaw Generator_Standardów jako oddzielną funkcję w menu
    - Dodaj wpis "Generator standardów" w globalnym menu
    - Pozwala uruchomić generator niezależnie od aktywnej sesji generowania
    - _Wymagania: 15.8_

- [ ] 13. Tutorial zdobywania klucza API (Wymaganie 16)
  - [~] 13.1 Przygotuj treść tutoriali dla 4 dostawców × 2 języków
    - Utwórz katalog content/tutorials/ z plikami: openai.{pl,en}.md, anthropic.{pl,en}.md, google.{pl,en}.md, github.{pl,en}.md (8 plików łącznie)
    - Każdy tutorial: numerowane kroki, ilustracje (SVG), klikalne linki, sekcja kosztów, sekcja darmowego planu (gdy istnieje, np. Gemini), sekcja bezpieczeństwa
    - Treść w prostym języku, dostosowana do nietechnicznego odbiorcy
    - _Wymagania: 16.1, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [~] 13.2 Utwórz content/tutorials/_meta.json
    - Wpisy dla każdego z 4 dostawców z polami: sourceUrl, lastUpdatedAt, verifiedAgainstDocsAt, contentHash, locales
    - sourceUrl wg tabeli mapowania w design.md
    - _Wymagania: 16.8, 16.9_

  - [~] 13.3 Zaimplementuj TutorialService
    - Utwórz src/services/TutorialService.ts
    - Metody: getTutorial (parsuje markdown + meta, wylicza staleWarning), listAvailableProviders, isStale, verifyAgainstSource
    - verifyAgainstSource pobiera sourceUrl, ekstrahuje sekcje istotne dla zdobywania kluczy, porównuje z bieżącym contentMarkdown przez LLM, generuje proposedUpdate gdy wykryto zmiany
    - _Wymagania: 16.1, 16.8, 16.9, 16.10, 16.11_

  - [~] 13.4 Zaimplementuj GET /api/tutorials/:provider
    - Utwórz src/app/api/tutorials/[provider]/route.ts
    - Walidacja parametru provider (musi być jednym z 4 wspieranych)
    - Zwraca TutorialResponse z polami: contentMarkdown, externalLinks, estimatedCostUsd, freeTier, lastUpdatedAt, verifiedAgainstDocsAt, sourceUrl, staleWarning
    - _Wymagania: 16.1, 16.10_

  - [~] 13.5 Zaimplementuj wskaźnik "stale" w komponencie ApiKeyTutorial
    - Brak ostrzeżenia dla ≤ 30 dni
    - Ikona informacyjna 30–90 dni
    - Żółty banner "Treść może być nieaktualna" dla > 90 dni z linkiem do sourceUrl
    - _Wymagania: 16.10_

  - [~] 13.6 Zaimplementuj procedurę regularnej weryfikacji tutoriali
    - Utwórz scripts/verify-tutorials.ts (skrypt CLI uruchamiany ręcznie i z CI)
    - Skrypt iteruje po wszystkich providerach z _meta.json, wywołuje TutorialService.verifyAgainstSource, zapisuje propozycje aktualizacji do content/tutorials/<provider>.<locale>.proposed.md gdy wykryto zmiany, lub aktualizuje verifiedAgainstDocsAt gdy treść zgodna
    - Utwórz .github/workflows/verify-tutorials.yml — cron co 30 dni, otwiera PR z aktualizacjami
    - W README dodaj instrukcję ręcznego uruchomienia skryptu (`npm run tutorials:verify`) jako fallback dla samodzielnego deploymentu
    - _Wymagania: 16.11_

  - [ ]* 13.7 Napisz test właściwości dla kompletności tutoriali
    - **Property 19: Kompletność tutoriali**
    - **Waliduje: Wymagania 16.1, 16.9**

  - [ ]* 13.8 Napisz test właściwości dla ostrzeżenia o nieaktualnej treści
    - **Property 20: Ostrzeżenie o nieaktualnej treści**
    - **Waliduje: Wymagania 16.10**

- [ ] 14. Rekomendacje narzędzia, modelu i sugestie dla dokumentów (Wymagania 4, 5, 13)
  - [~] 14.1 Zaimplementuj RecommendationService
    - Utwórz src/services/RecommendationService.ts
    - Metody: recommendTool, recommendModel, analyzeDocument
    - Wykorzystuje AIService do oceny kontekstu projektu i treści dokumentów
    - _Wymagania: 4.2, 4.3, 5.2, 13.8_

  - [~] 14.2 Zaimplementuj POST /api/suggest
    - Utwórz src/app/api/suggest/route.ts
    - Obsługa kind: 'tool', 'model', 'document-suggestions'
    - _Wymagania: 4.2, 5.2, 13.8_

  - [ ]* 14.3 Napisz test właściwości dla rekomendacji narzędzia/modelu
    - **Property 17: Dostępność rekomendacji narzędzia/modelu**
    - **Waliduje: Wymagania 4.2, 4.3, 5.2**

- [ ] 15. Tour powitalny i Tryb demo (Wymaganie 17)
  - [~] 15.1 Zaimplementuj DemoModeService
    - Utwórz src/services/DemoModeService.ts
    - Metoda getScenario zwracająca dane z content/demo/scenario.<locale>.json
    - Metoda isDemoActive sprawdzająca flagę w SessionState
    - _Wymagania: 17.5, 17.6_

  - [~] 15.2 Zaimplementuj GET /api/demo/scenario
    - Utwórz src/app/api/demo/scenario/route.ts
    - Zwraca DemoScenarioResponse w wybranym języku
    - _Wymagania: 17.5_

  - [~] 15.3 Zintegruj WelcomeTour z routingiem
    - W src/app/[locale]/page.tsx: przy załadowaniu pobierz preferencje, jeśli !firstRunComplete uruchom WelcomeTour
    - Po zakończeniu lub pominięciu wywołaj PreferencesService.markFirstRunComplete
    - _Wymagania: 17.1, 17.3_

  - [~] 15.4 Zaimplementuj Tryb_Demo w przepływie wizarda (zero zapisów na dysk)
    - Flaga "isDemoMode" w SessionState wymusza użycie DemoModeService zamiast prawdziwych wywołań AI
    - Wszystkie API Routes operujące na FS (`/api/files/save`, `/api/projects/create`, `/api/standards/generate` w trybie zapisu) SHALL sprawdzać nagłówek/parametr `X-Demo-Mode: true` i zwracać sukces bez efektów ubocznych — żadnych zapisów do Katalogu_Projektu, `/tmp`, ani `~/.spec-generator/`
    - Każdy ekran wizarda renderuje baner "Tryb demo — dane są symulowane, nic nie zostanie zapisane na dysk"
    - Wygenerowane treści żyją wyłącznie w sessionStorage przeglądarki
    - Po zakończeniu Trybu_Demo banner z przyciskiem "Rozpocznij prawdziwą sesję"
    - _Wymagania: 17.6, 17.7, 17.8, 17.9, 17.10_

  - [ ]* 15.4a Napisz test właściwości dla braku efektów ubocznych w Trybie Demo
    - **Property 21: Brak efektów ubocznych w Trybie Demo**
    - **Waliduje: Wymagania 17.7, 17.9**

  - [~] 15.5 Dodaj wpis "Pokaż wprowadzenie ponownie" w menu
    - Resetuje tourStepIndex i otwiera WelcomeTour bez zmiany firstRunComplete
    - _Wymagania: 17.4_

- [ ] 16. Profil_Błędu — pełna integracja (Wymaganie 12)
  - [~] 16.1 Zaimplementuj ErrorProfileService
    - Utwórz src/services/ErrorProfileService.ts
    - Metoda build mapuje kod błędu na cztery sekcje + akcje (zgodnie z tabelą w design.md)
    - Metoda buildFixPrompt generuje precyzyjny prompt do schowka dla "Napraw ten błąd"
    - _Wymagania: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [~] 16.2 Zintegruj ErrorProfile z globalną obsługą błędów
    - Wszystkie błędy (klient i serwer) konwertowane na ErrorProfileData
    - ErrorBoundary renderuje komponent ErrorProfile zamiast surowego komunikatu
    - SessionState.activeErrorProfile trzyma aktywny profil aż do zamknięcia
    - _Wymagania: 12.1, 12.10_

  - [ ]* 16.3 Napisz test właściwości dla braku utraty stanu sesji przy błędzie
    - **Property 13: Brak utraty stanu sesji przy błędzie**
    - **Waliduje: Wymagania 12.10**

- [ ] 17. Skrypty uruchomieniowe i zamykające (Wymaganie 18)
  - [~] 17.1 Zaimplementuj GET /api/health
    - Utwórz src/app/api/health/route.ts
    - Zwraca {ok: true, pid: process.pid, uptimeSeconds, version}
    - _Wymagania: 18.4, 18.6_

  - [~] 17.2 Utwórz start.sh (macOS/Linux)
    - Skrypt w korzeniu projektu, uprawnienia +x
    - Sekwencja: sprawdź Node ≥ 20 → npm install jeśli trzeba → uruchom serwer w tle → zapisz PID → poll /api/health → otwórz przeglądarkę
    - Komunikaty postępu w prostym języku
    - _Wymagania: 18.1, 18.3, 18.4, 18.5, 18.7, 18.8_

  - [~] 17.3 Utwórz stop.sh (macOS/Linux)
    - Czyta PID z ~/.spec-generator/.spec-generator.pid
    - SIGTERM → 5s timeout → SIGKILL
    - Usuwa plik PID
    - _Wymagania: 18.2, 18.6, 18.7_

  - [~] 17.4 Utwórz start.bat (Windows)
    - Analogicznie do start.sh, używa where node, start /B, taskkill
    - PID zapisywany w %USERPROFILE%\.spec-generator\.spec-generator.pid
    - _Wymagania: 18.1, 18.3, 18.4, 18.5, 18.7, 18.8_

  - [~] 17.5 Utwórz stop.bat (Windows)
    - taskkill /PID <pid> z 5s timeoutem, potem /F
    - Usuwa plik PID
    - _Wymagania: 18.2, 18.6, 18.7_

  - [~] 17.6 Dodaj README z instrukcją uruchomienia (dla użytkownika nietechnicznego)
    - Sekcje: "Pierwsze uruchomienie (3 kroki)", "Codzienne użycie", "Co zrobić, gdy coś nie działa"
    - Zrzuty ekranu lub krótki gif
    - _Wymagania: 18.8_

- [ ] 18. Checkpoint końcowy — Upewnij się że wszystkie testy przechodzą
  - Upewnij się że wszystkie testy przechodzą, zapytaj użytkownika jeśli pojawią się pytania.
  - Sprawdź ręcznie cztery scenariusze E2E: pierwsze uruchomienie z Tour_Powitalnym, Tryb_Demo od początku do końca, Generator_Standardów, pełna Sesja_Generowania z prawdziwym kluczem API
  - Sprawdź skrypty start/stop na obu systemach (macOS/Linux i Windows)

## Uwagi

- Zadania oznaczone `*` są opcjonalne i mogą być pominięte dla szybszego MVP
- Każde zadanie odwołuje się do konkretnych wymagań dla zachowania śledzalności
- Checkpointy zapewniają inkrementalną walidację postępu
- Testy właściwości (property-based) walidują uniwersalne właściwości poprawności
- Testy jednostkowe walidują konkretne scenariusze i edge case'y
- Wszystkie komunikaty UI muszą być przetłumaczone (pl/en) przez next-intl
- Zasoby treści (tutorials, profiles, demo) trzymane jako pliki w `content/`, edytowalne bez deployu kodu
- Klucze API NIGDY nie trafiają do PreferencesService ani logów; jedyne miejsce: sessionStorage przeglądarki
