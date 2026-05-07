# Dokument Wymagań

## Wprowadzenie

Spec Generator to aplikacja webowa umożliwiająca nietechnicznym użytkownikom generowanie kompletnych specyfikacji projektów (requirements.md, design.md, tasks.md) zoptymalizowanych pod konkretne narzędzia AI (Codex, Claude Code, Gemini, Copilot). Aplikacja wykorzystuje modele AI od czterech dostawców (OpenAI, Anthropic, Google, GitHub Models) do analizy opisu użytkownika, zadawania pytań doprecyzowujących oraz generowania dokumentów zgodnych ze standardami korporacyjnymi.

## Słownik

- **Aplikacja**: Aplikacja webowa Spec Generator
- **Użytkownik**: Osoba korzystająca z aplikacji w celu wygenerowania specyfikacji projektu
- **Specyfikacja**: Zestaw dokumentów (requirements.md, design.md, tasks.md) opisujących projekt
- **Narzędzie_AI_Docelowe**: Narzędzie AI, dla którego generowana jest specyfikacja (Codex, Claude Code, Gemini, Copilot)
- **Model_AI**: Model językowy używany do generowania specyfikacji, dostarczany przez jednego z czterech Dostawców_Klucza_API (OpenAI GPT, Anthropic Claude, Google Gemini, GitHub Models)
- **Katalog_Projektu**: Ścieżka do folderu projektu podana przez użytkownika
- **Katalog_Docs**: Podkatalog /docs w katalogu projektu, w którym zapisywane są wygenerowane dokumenty
- **Standardy_Korporacyjne**: Plik standards.md zawierający ograniczenia i wymagania organizacyjne
- **Sesja_Generowania**: Pojedynczy proces od opisu projektu do wygenerowania kompletnej specyfikacji
- **Pytania_Doprecyzowujące**: Pytania zadawane przez aplikację w celu uściślenia wymagań użytkownika
- **Profil_Aplikacji**: Kategoryzacja typu projektu (np. aplikacja webowa React, API REST w Node.js, aplikacja mobilna Flutter, biblioteka Python, monorepo) używana przez Generator Standardów do dobrania właściwych best practices
- **Generator_Standardów**: Funkcja Aplikacji generująca plik standards.md z zalecanymi best practices dla wybranego Profilu_Aplikacji
- **Dostawca_Klucza_API**: Jeden z czterech wspieranych dostawców API: OpenAI, Anthropic (Claude), Google (Gemini), GitHub (Copilot / GitHub Models)
- **Tutorial_Klucza_API**: Krokowa instrukcja zdobycia klucza API u wybranego Dostawcy_Klucza_API prezentowana w Aplikacji
- **Pytanie_Aktywne**: Pojedyncze Pytanie_Doprecyzowujące aktualnie wyświetlane Użytkownikowi w trybie chat-like
- **Tour_Powitalny**: Interaktywne wprowadzenie pokazywane przy pierwszym uruchomieniu Aplikacji
- **Tryb_Demo**: Pokazowy przebieg wizarda z wbudowanymi przykładowymi danymi i symulowanym Modelem_AI, niewymagający klucza API
- **Profil_Błędu**: Strukturalny opis błędu zawierający kontekst, konsekwencje dla bieżącej sesji i instrukcję naprawy
- **Skrypt_Uruchomieniowy**: Plik wykonywalny (start/stop) instalujący zależności, uruchamiający lub zatrzymujący lokalny serwer Aplikacji

## Wymagania

### Wymaganie 1: Wybór lub utworzenie katalogu projektu

**User Story:** Jako użytkownik, chcę po uruchomieniu aplikacji szybko wybrać istniejący folder projektu lub utworzyć nowy, aby aplikacja wiedziała gdzie zapisać wygenerowane dokumenty bez konieczności ręcznego wpisywania ścieżki.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL wyświetlić ekran startowy z trzema równoważnymi sposobami wskazania Katalogu_Projektu: (a) wybór z listy ostatnio używanych projektów, (b) wskazanie istniejącego folderu (przycisk "Wybierz folder" oraz drag & drop), (c) utworzenie nowego projektu (przycisk "Nowy projekt")
2. THE Aplikacja SHALL utrzymywać listę co najmniej 10 ostatnio używanych Katalogów_Projektu wraz z datą ostatniego użycia i nazwą projektu
3. WHEN Użytkownik wybierze pozycję z listy ostatnio używanych projektów, THE Aplikacja SHALL automatycznie przejść do następnego kroku po pomyślnej walidacji ścieżki
4. WHEN Użytkownik wybierze opcję "Nowy projekt", THE Aplikacja SHALL poprosić o nazwę projektu i lokalizację rodzica, a następnie utworzyć nowy folder
5. WHEN Użytkownik upuści folder na pole drag & drop, THE Aplikacja SHALL wykryć i wstawić ścieżkę do tego folderu jako Katalog_Projektu
6. THE Aplikacja SHALL umożliwić ręczne wpisanie ścieżki do Katalogu_Projektu jako opcję alternatywną dla użytkowników zaawansowanych
7. WHEN Użytkownik poda ścieżkę do Katalogu_Projektu, THE Aplikacja SHALL zweryfikować istnienie i prawo do zapisu w podanym katalogu
8. IF podana ścieżka do Katalogu_Projektu nie istnieje, THEN THE Aplikacja SHALL zaproponować utworzenie folderu w tej lokalizacji jednym kliknięciem zamiast wyświetlania samego błędu
9. IF podana ścieżka do Katalogu_Projektu istnieje, ale Aplikacja nie ma prawa zapisu, THEN THE Aplikacja SHALL wyświetlić Profil_Błędu z instrukcją naprawy uprawnień
10. WHEN ścieżka do Katalogu_Projektu zostanie zweryfikowana pomyślnie, THE Aplikacja SHALL utworzyć Katalog_Docs jeśli nie istnieje
11. WHEN Katalog_Projektu zostanie pomyślnie skonfigurowany, THE Aplikacja SHALL zapisać go na liście ostatnio używanych projektów

### Wymaganie 2: Opis projektu w języku naturalnym

**User Story:** Jako użytkownik nietechniczny, chcę opisać w prostych słowach co chcę zbudować, aby aplikacja mogła zrozumieć moje potrzeby.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL wyświetlić pole tekstowe do wprowadzenia opisu projektu w języku naturalnym
2. THE Aplikacja SHALL akceptować opisy o długości od 20 do 10000 znaków
3. IF opis projektu zawiera mniej niż 20 znaków, THEN THE Aplikacja SHALL wyświetlić komunikat z prośbą o bardziej szczegółowy opis
4. THE Aplikacja SHALL wyświetlić wskazówki i przykłady pomagające użytkownikowi sformułować opis projektu

### Wymaganie 3: Pytania doprecyzowujące w trybie chat-like

**User Story:** Jako użytkownik nietechniczny, chcę odpowiadać na pytania doprecyzowujące pojedynczo, jedno po drugim, aby nie czuć się przytłoczony ścianą tekstu i móc skupić się na każdej odpowiedzi z osobna.

#### Kryteria Akceptacji

1. WHEN Użytkownik prześle opis projektu, THE Aplikacja SHALL przeanalizować opis za pomocą wybranego Modelu_AI i wygenerować listę Pytań_Doprecyzowujących
2. THE Aplikacja SHALL wygenerować od 3 do 10 Pytań_Doprecyzowujących na podstawie analizy opisu
3. THE Aplikacja SHALL wyświetlać Pytania_Doprecyzowujące pojedynczo (jedno Pytanie_Aktywne na ekranie) w stylu rozmowy (chat-like)
4. THE Aplikacja SHALL wyświetlić wskaźnik postępu informujący o numerze bieżącego pytania i całkowitej liczbie pytań (np. "Pytanie 2 z 5")
5. WHERE Model_AI potrafi przewidzieć typowe odpowiedzi na Pytanie_Aktywne, THE Aplikacja SHALL zaprezentować sugerowane odpowiedzi w formie klikanych chipów (skracających czas odpowiedzi)
6. THE Aplikacja SHALL umożliwić Użytkownikowi pominięcie Pytania_Aktywnego przyciskiem "Pomiń"
7. THE Aplikacja SHALL umożliwić Użytkownikowi pominięcie wszystkich pozostałych pytań przyciskiem "Pomiń pozostałe i przejdź dalej"
8. THE Aplikacja SHALL umożliwić Użytkownikowi powrót do poprzedniego pytania w celu zmiany odpowiedzi
9. WHEN Użytkownik odpowie lub pominie wszystkie pytania, THE Aplikacja SHALL umożliwić przejście do generowania specyfikacji
10. WHEN Użytkownik odpowie na pytania, THE Aplikacja SHALL umożliwić wygenerowanie dodatkowych pytań pogłębiających na podstawie udzielonych odpowiedzi
11. THE Aplikacja SHALL wyświetlać wskaźnik kompletności informujący jaki procent niezbędnych informacji został już zebrany ("Mamy ok. 80% potrzebnych informacji — możesz zakończyć etap pytań")

### Wymaganie 4: Wybór narzędzia AI docelowego z inteligentną sugestią

**User Story:** Jako użytkownik, który już programuje w jakimś środowisku, chcę dostać sugestię optymalnego narzędzia AI dla mojego typu projektu, ale zachować pełną kontrolę nad ostatecznym wyborem, aby dopasować generowanie do swojego codziennego workflow.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL wyświetlić listę dostępnych Narzędzi_AI_Docelowych: Codex, Claude Code, Gemini, Copilot
2. THE Aplikacja SHALL na podstawie opisu projektu i odpowiedzi na Pytania_Doprecyzowujące zaproponować jedno Narzędzie_AI_Docelowe jako rekomendowane (oznaczone wizualnie jako "Polecane dla Twojego projektu")
3. THE Aplikacja SHALL wyświetlić krótkie uzasadnienie rekomendacji (np. "Polecamy Claude Code — jest mocny w długich kontekstach i refaktoryzacji, co pasuje do Twojego projektu monorepo")
4. THE Aplikacja SHALL umożliwić Użytkownikowi wybór dowolnego innego Narzędzia_AI_Docelowego z listy bez konieczności podawania uzasadnienia
5. WHEN Użytkownik wybierze Narzędzie_AI_Docelowe, THE Aplikacja SHALL dostosować format i strukturę generowanych dokumentów do wymagań wybranego narzędzia
6. THE Aplikacja SHALL wyświetlić krótki opis każdego Narzędzia_AI_Docelowego pomagający Użytkownikowi w świadomym wyborze
7. THE Aplikacja SHALL umożliwić wybór opcji "Uniwersalny / Nie wiem" generującej dokumenty w neutralnym formacie zrozumiałym dla wszystkich Narzędzi_AI_Docelowych

### Wymaganie 5: Wybór modelu AI do generowania z inteligentną sugestią

**User Story:** Jako użytkownik, chcę dostać sugestię optymalnego modelu AI dla mojego zadania, ale jeśli już pracuję z konkretnym modelem chcę móc go wybrać samodzielnie, aby mieć kontrolę nad jakością, kosztem i kompatybilnością z moim istniejącym workflow.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL wyświetlić listę dostępnych Modeli_AI z podziałem na Dostawców_Klucza_API: OpenAI, Anthropic (Claude), Google (Gemini), GitHub (Copilot / GitHub Models)
2. THE Aplikacja SHALL na podstawie złożoności projektu zaproponować jeden Model_AI jako rekomendowany (oznaczony jako "Polecany dla tego projektu")
3. THE Aplikacja SHALL wyświetlać dla każdego Modelu_AI: szacowany czas generowania, szacowany koszt w USD oraz poziom jakości (Szybki / Zbalansowany / Najwyższa jakość)
4. THE Aplikacja SHALL umożliwić Użytkownikowi wybór dowolnego innego Modelu_AI z pełnej listy
5. WHEN Użytkownik wybierze Model_AI, THE Aplikacja SHALL użyć wybranego modelu do wszystkich operacji generowania w ramach Sesji_Generowania
6. THE Aplikacja SHALL wymagać podania klucza API odpowiedniego dostawcy przed użyciem wybranego Modelu_AI
7. THE Aplikacja SHALL umożliwić Użytkownikowi uruchomienie Tutoriala_Klucza_API zamiast podawania klucza, jeśli Użytkownik go jeszcze nie posiada
8. WHEN Użytkownik poda klucz API, THE Aplikacja SHALL natychmiast zweryfikować jego poprawność wykonując pojedyncze, tanie żądanie testowe i wyświetlić wynik (✓/✗)
9. IF klucz API jest nieprawidłowy lub wygasł, THEN THE Aplikacja SHALL wyświetlić Profil_Błędu z najczęstszymi przyczynami (np. literówka, brak środków na koncie, klucz wygasł) i przyciskiem otwierającym Tutorial_Klucza_API

### Wymaganie 6: Obsługa standardów korporacyjnych

**User Story:** Jako użytkownik korporacyjny, chcę aby generowane specyfikacje uwzględniały standardy mojej organizacji, aby dokumenty były zgodne z wewnętrznymi wymaganiami.

#### Kryteria Akceptacji

1. WHEN Sesja_Generowania rozpocznie się, THE Aplikacja SHALL sprawdzić istnienie pliku standards.md w Katalogu_Projektu
2. WHEN plik standards.md istnieje i nie jest pusty, THE Aplikacja SHALL uwzględnić zawarte w nim Standardy_Korporacyjne podczas generowania specyfikacji
3. WHEN plik standards.md nie istnieje lub jest pusty, THE Aplikacja SHALL zaproponować Użytkownikowi uruchomienie Generatora_Standardów (zgodnie z Wymaganiem 15) lub kontynuowanie bez Standardów_Korporacyjnych
4. THE Aplikacja SHALL wyświetlić informację o wykrytych Standardach_Korporacyjnych przed rozpoczęciem generowania
5. THE Aplikacja SHALL umożliwić Użytkownikowi podgląd i edycję wykrytych Standardów_Korporacyjnych przed rozpoczęciem generowania

### Wymaganie 7: Generowanie dokumentu requirements.md

**User Story:** Jako użytkownik, chcę otrzymać dokument wymagań, aby mieć formalny opis tego co ma zostać zbudowane.

#### Kryteria Akceptacji

1. WHEN Użytkownik zatwierdzi rozpoczęcie generowania, THE Aplikacja SHALL wygenerować plik requirements.md w Katalogu_Docs
2. THE Aplikacja SHALL wygenerować requirements.md zawierający: wprowadzenie, słownik, wymagania z user stories i kryteriami akceptacji
3. THE Aplikacja SHALL dostosować format requirements.md do wymagań wybranego Narzędzia_AI_Docelowego
4. THE Aplikacja SHALL uwzględnić Standardy_Korporacyjne w treści requirements.md jeśli zostały wykryte

### Wymaganie 8: Generowanie dokumentu design.md

**User Story:** Jako użytkownik, chcę otrzymać dokument projektowy, aby narzędzie AI wiedziało jak zaimplementować wymagania.

#### Kryteria Akceptacji

1. WHEN plik requirements.md zostanie wygenerowany pomyślnie, THE Aplikacja SHALL wygenerować plik design.md w Katalogu_Docs
2. THE Aplikacja SHALL wygenerować design.md zawierający: architekturę systemu, komponenty, interfejsy, modele danych i decyzje projektowe
3. THE Aplikacja SHALL dostosować format design.md do wymagań wybranego Narzędzia_AI_Docelowego
4. THE Aplikacja SHALL zapewnić spójność między design.md a requirements.md

### Wymaganie 9: Generowanie dokumentu tasks.md

**User Story:** Jako użytkownik, chcę otrzymać listę zadań implementacyjnych, aby narzędzie AI mogło krok po kroku zbudować aplikację.

#### Kryteria Akceptacji

1. WHEN plik design.md zostanie wygenerowany pomyślnie, THE Aplikacja SHALL wygenerować plik tasks.md w Katalogu_Docs
2. THE Aplikacja SHALL wygenerować tasks.md zawierający: uporządkowaną listę zadań z opisami, zależnościami i kryteriami ukończenia
3. THE Aplikacja SHALL dostosować format tasks.md do wymagań wybranego Narzędzia_AI_Docelowego
4. THE Aplikacja SHALL zapewnić że każde zadanie w tasks.md jest wystarczająco szczegółowe aby narzędzie AI mogło je zrealizować bez dodatkowych wyjaśnień
5. THE Aplikacja SHALL uporządkować zadania w kolejności implementacji uwzględniając zależności między nimi

### Wymaganie 10: Wybór języka interfejsu i dokumentów

**User Story:** Jako użytkownik, chcę wybrać język w jakim generowane są dokumenty i wyświetlany interfejs, aby pracować w preferowanym języku.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL obsługiwać dwa języki: polski (domyślny) i angielski
2. THE Aplikacja SHALL wyświetlić selektor języka dostępny na każdym ekranie aplikacji
3. WHEN Użytkownik zmieni język, THE Aplikacja SHALL natychmiast zaktualizować interfejs do wybranego języka
4. THE Aplikacja SHALL generować dokumenty specyfikacji w języku wybranym przez Użytkownika
5. THE Aplikacja SHALL ustawić język polski jako domyślny przy pierwszym uruchomieniu

### Wymaganie 11: Interfejs użytkownika dla osób nietechnicznych

**User Story:** Jako użytkownik nietechniczny, chcę aby interfejs był prosty i intuicyjny, aby móc korzystać z aplikacji bez wiedzy technicznej.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL prowadzić Użytkownika przez proces generowania krok po kroku w formie wizarda
2. THE Aplikacja SHALL wyświetlić pasek postępu informujący o aktualnym etapie Sesji_Generowania
3. THE Aplikacja SHALL wyświetlić podpowiedzi kontekstowe przy każdym polu formularza
4. THE Aplikacja SHALL używać prostego języka bez żargonu technicznego w komunikatach interfejsu
5. THE Aplikacja SHALL wyświetlić podgląd wygenerowanych dokumentów przed ich zapisaniem
6. WHEN generowanie jest w toku, THE Aplikacja SHALL wyświetlić animację ładowania z informacją o aktualnie wykonywanym kroku

### Wymaganie 12: Obsługa błędów oparta na Profilu_Błędu

**User Story:** Jako użytkownik, chcę otrzymywać zrozumiałe komunikaty o błędach, które wyjaśniają co poszło nie tak, jakie to ma znaczenie dla mojej pracy i pozwalają mi jednym kliknięciem przejść do naprawy.

#### Kryteria Akceptacji

1. WHEN wystąpi błąd dowolnego typu, THE Aplikacja SHALL wyświetlić Profil_Błędu zawierający cztery sekcje: (a) "Co się stało" — opis błędu w prostym języku, (b) "Co to oznacza" — konsekwencje dla bieżącej Sesji_Generowania (np. "Twoje odpowiedzi nie zostały utracone"), (c) "Jak to naprawić" — krokowa instrukcja, (d) przyciski akcji
2. THE Aplikacja SHALL udostępnić w Profilu_Błędu przycisk "Napraw ten błąd", który generuje precyzyjny prompt zawierający kontekst błędu, uruchamia odpowiedni przepływ naprawczy lub kopiuje go do schowka
3. WHEN błąd dotyczy klucza API (AUTH_ERROR), THE przycisk "Napraw ten błąd" SHALL otworzyć Tutorial_Klucza_API z preselekcją bieżącego dostawcy
4. WHEN błąd dotyczy ścieżki (PATH_NOT_FOUND, FILE_ACCESS), THE przycisk "Napraw ten błąd" SHALL otworzyć krok wyboru Katalogu_Projektu z wskazaniem problemu
5. WHEN błąd dotyczy generowania AI (PARSE_ERROR, TOKEN_LIMIT, NETWORK_ERROR), THE przycisk "Napraw ten błąd" SHALL umożliwić retry, automatycznie zastosować chunking lub przełączyć Model_AI
6. IF połączenie z Modelem_AI zostanie przerwane podczas generowania, THEN THE Aplikacja SHALL automatycznie ponowić próbę (max 3) z exponential backoff zanim wyświetli Profil_Błędu
7. IF Model_AI zwróci błąd przekroczenia limitu tokenów, THEN THE Aplikacja SHALL automatycznie podzielić żądanie na mniejsze części i ponowić generowanie bez przerywania Sesji_Generowania
8. THE Aplikacja SHALL walidować wszystkie dane wejściowe Użytkownika przed wysłaniem do Modelu_AI
9. IF wystąpi nieoczekiwany błąd, THEN THE Aplikacja SHALL zapisać szczegóły błędu w zsanityzowanych logach i wyświetlić Profil_Błędu z unikalnym identyfikatorem oraz przyciskiem "Skopiuj raport błędu"
10. THE Aplikacja SHALL nigdy nie utracić stanu Sesji_Generowania na skutek błędu — wszystkie wprowadzone dane (opis, odpowiedzi, wybory) SHALL być zachowane do czasu jawnego zresetowania sesji przez Użytkownika

### Wymaganie 13: Podgląd, edycja i sugestie AI dla wygenerowanych dokumentów

**User Story:** Jako użytkownik, chcę móc przejrzeć i zmodyfikować wygenerowane dokumenty przed zapisaniem oraz otrzymywać sugestie AI dotyczące potencjalnych braków lub usprawnień, aby specyfikacja była naprawdę kompletna.

#### Kryteria Akceptacji

1. WHEN dokument zostanie wygenerowany, THE Aplikacja SHALL wyświetlić podgląd dokumentu w formacie Markdown z renderowaniem
2. THE Aplikacja SHALL umożliwić Użytkownikowi edycję wygenerowanego dokumentu przed zapisaniem
3. WHEN Użytkownik zatwierdzi dokument, THE Aplikacja SHALL zapisać dokument w Katalogu_Docs
4. THE Aplikacja SHALL umożliwić Użytkownikowi ponowne wygenerowanie całego dokumentu z dodatkowymi wskazówkami
5. THE Aplikacja SHALL umożliwić Użytkownikowi regenerację pojedynczej sekcji dokumentu bez ponownego generowania całej treści
6. WHEN regeneracja zostanie wykonana, THE Aplikacja SHALL wyświetlić różnicę (diff) między poprzednią a nową wersją dokumentu
7. THE Aplikacja SHALL przechowywać co najmniej 5 ostatnich wersji dokumentu w pamięci sesji i umożliwić cofnięcie zmiany
8. WHEN dokument zostanie wygenerowany, THE Aplikacja SHALL automatycznie przeanalizować jego treść i wyświetlić listę sugestii AI (np. "Sekcja 'Bezpieczeństwo' jest pusta — czy dodać?", "Brak kryterium akceptacji dla Wymagania 5", "Komponent X jest opisany, ale nie ma go w schemacie architektury")
9. THE Aplikacja SHALL umożliwić Użytkownikowi zaakceptowanie sugestii AI jednym kliknięciem (automatyczna regeneracja sekcji z uwzględnieniem sugestii) lub odrzucenie jej
10. THE Aplikacja SHALL umożliwić Użytkownikowi cofnięcie się do poprzedniego kroku wizarda w celu zmiany parametrów

### Wymaganie 14: Bezpieczeństwo kluczy API

**User Story:** Jako użytkownik, chcę aby moje klucze API były bezpiecznie przechowywane, aby nie zostały ujawnione osobom trzecim.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL przechowywać klucze API wyłącznie w pamięci sesji przeglądarki i nie zapisywać ich na serwerze
2. THE Aplikacja SHALL maskować klucze API w interfejsie użytkownika po ich wprowadzeniu
3. WHEN sesja przeglądarki zostanie zamknięta, THE Aplikacja SHALL usunąć klucze API z pamięci
4. THE Aplikacja SHALL przesyłać klucze API wyłącznie przez szyfrowane połączenie HTTPS
5. THE Aplikacja SHALL nie logować kluczy API w żadnych logach aplikacji

### Wymaganie 15: Generator standardów (best practices)

**User Story:** Jako użytkownik nieznający branżowych best practices, chcę aby aplikacja wygenerowała dla mnie plik standards.md zawierający najlepsze praktyki dla mojego typu projektu, aby moja specyfikacja była zgodna ze standardami nawet jeśli sam ich nie znam.

#### Kryteria Akceptacji

1. WHEN Użytkownik nie ma pliku standards.md w Katalogu_Projektu, THE Aplikacja SHALL zaproponować uruchomienie Generatora_Standardów na ekranie wyboru standardów
2. THE Generator_Standardów SHALL umożliwić Użytkownikowi wybór Profilu_Aplikacji z predefiniowanej listy (np. aplikacja webowa React/Next.js, API REST w Node.js/Python, aplikacja mobilna Flutter/React Native, biblioteka open-source, monorepo, aplikacja desktopowa, mikroserwisy)
3. THE Generator_Standardów SHALL zadać Użytkownikowi 3–7 pytań uzupełniających dotyczących wykonawczych preferencji dla Profilu_Aplikacji (np. preferowany stack, decyzje architektoniczne, biblioteki, standardy jakości kodu, testy, CI/CD, utrzymanie)
4. WHEN Użytkownik odpowie na pytania, THE Generator_Standardów SHALL użyć Modelu_AI do wygenerowania pliku standards.md zawierającego best practices dla wybranego Profilu_Aplikacji w sekcjach: Architektura, Bezpieczeństwo, Testowanie, Jakość kodu, Dokumentacja, CI/CD, Dostępność (a11y), Wydajność
5. THE Generator_Standardów SHALL wyświetlić podgląd wygenerowanego standards.md z możliwością edycji przed zapisaniem
6. WHEN Użytkownik zatwierdzi standards.md, THE Aplikacja SHALL zapisać plik w Katalogu_Projektu (nie w Katalogu_Docs) i automatycznie uwzględnić go w dalszej Sesji_Generowania
7. THE Generator_Standardów SHALL umożliwić Użytkownikowi pominięcie generowania standardów i kontynuację bez nich
8. THE Generator_Standardów SHALL być dostępny również jako oddzielna funkcja w menu Aplikacji, niezależnie od Sesji_Generowania

### Wymaganie 16: Tutorial zdobywania klucza API (4 dostawców, regularnie aktualizowany)

**User Story:** Jako użytkownik nieposiadający klucza API, chcę otrzymać krokową instrukcję zdobycia klucza dla wybranego dostawcy z aktualnymi linkami do dokumentacji, aby móc ukończyć konfigurację bez znajomości procesu.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL udostępnić Tutorial_Klucza_API dla każdego z czterech Dostawców_Klucza_API: OpenAI, Anthropic (Claude), Google (Gemini), GitHub (Copilot / GitHub Models)
2. THE Tutorial_Klucza_API SHALL być dostępny z poziomu kroku wyboru Modelu_AI oraz z menu pomocy Aplikacji
3. THE Tutorial_Klucza_API SHALL prezentować instrukcję krok po kroku z numerowanymi krokami i ilustracjami (zrzuty ekranu lub diagramy)
4. THE Tutorial_Klucza_API SHALL zawierać klikalne linki kierujące bezpośrednio do strony zarządzania kluczami API u danego Dostawcy_Klucza_API
5. THE Tutorial_Klucza_API SHALL informować Użytkownika o szacowanych kosztach generowania pełnej Specyfikacji oraz o sposobie doładowania konta u Dostawcy_Klucza_API (jeśli dostawca tego wymaga)
6. THE Tutorial_Klucza_API SHALL informować Użytkownika o limitach darmowego planu (gdzie istnieje, np. Google Gemini ma darmowy tier) i kiedy wymagane jest płatne konto
7. THE Tutorial_Klucza_API SHALL ostrzegać Użytkownika o konieczności bezpiecznego przechowywania klucza i nie udostępniania go osobom trzecim
8. THE Tutorial_Klucza_API SHALL zawierać metadane: `lastUpdatedAt` (data ostatniej weryfikacji treści), `verifiedAgainstDocsAt` (data ostatniej weryfikacji względem oficjalnej dokumentacji dostawcy), `sourceUrl` (link do oryginalnej dokumentacji)
9. THE Aplikacja SHALL utrzymywać treść Tutorialu_Klucza_API jako zewnętrzny zasób w plikach `content/tutorials/<provider>.<locale>.md`, edytowalny bez ponownego deployu kodu
10. THE Aplikacja SHALL wyświetlać Użytkownikowi ostrzeżenie "Treść może być nieaktualna — sprawdź oryginalną dokumentację" jeśli `verifiedAgainstDocsAt` jest starsze niż 90 dni
11. THE projekt Aplikacji SHALL zawierać proces regularnej aktualizacji tutoriali: zaplanowane zadanie (CI cron lub procedura manualna) weryfikujące każdy tutorial co najmniej raz na 30 dni i aktualizujące treść w razie zmian w dokumentacji dostawcy
12. WHEN Użytkownik ukończy Tutorial_Klucza_API, THE Aplikacja SHALL przekierować go z powrotem do kroku wprowadzania klucza API z preselekcją wybranego Dostawcy_Klucza_API

### Wymaganie 17: Tour powitalny i tryb demo

**User Story:** Jako nowy użytkownik, chcę przy pierwszym uruchomieniu aplikacji zobaczyć krótkie wprowadzenie i móc wypróbować pełny przepływ na przykładzie bez podawania klucza API, aby zrozumieć co aplikacja robi i czy jest dla mnie.

#### Kryteria Akceptacji

1. WHEN Aplikacja zostanie uruchomiona po raz pierwszy (brak znacznika `firstRunComplete` w pamięci lokalnej), THE Aplikacja SHALL automatycznie uruchomić Tour_Powitalny
2. THE Tour_Powitalny SHALL składać się z 3–5 ekranów wyjaśniających: (a) co Aplikacja robi, (b) jak wygląda przepływ wizarda, (c) jakie są wymagania (klucz API), (d) gdzie znajdują się ustawienia i pomoc
3. THE Tour_Powitalny SHALL umożliwić Użytkownikowi przerwanie ("Pomiń wprowadzenie") na każdym ekranie
4. THE Aplikacja SHALL udostępnić w menu opcję "Pokaż wprowadzenie ponownie" uruchamiającą Tour_Powitalny ręcznie
5. THE Aplikacja SHALL udostępnić Tryb_Demo uruchamiany jednym kliknięciem z ekranu startowego
6. WHEN Użytkownik uruchomi Tryb_Demo, THE Aplikacja SHALL przeprowadzić Użytkownika przez cały wizard z wbudowanymi przykładowymi danymi i symulowanym Modelem_AI (mock), bez wymagania klucza API
7. THE Tryb_Demo SHALL trzymać wszystkie wygenerowane treści wyłącznie w pamięci przeglądarki — żadne pliki (w tym tymczasowe) nie SHALL być zapisywane w żadnej lokalizacji systemu plików (Katalog_Projektu, katalog tymczasowy `/tmp`, katalog preferencji aplikacji)
8. THE Tryb_Demo SHALL wyraźnie oznaczyć każdy ekran banerem "Tryb demo — dane są symulowane, nic nie zostanie zapisane na dysk"
9. THE Tryb_Demo SHALL zastąpić wszystkie API Routes operujące na systemie plików (`/api/files/save`, `/api/projects/create`, `/api/standards/generate` w trybie zapisu) implementacjami no-op zwracającymi sukces bez efektów ubocznych
10. WHEN Użytkownik zakończy Tryb_Demo, THE Aplikacja SHALL zaproponować rozpoczęcie prawdziwej Sesji_Generowania

### Wymaganie 18: Skrypty uruchamiające i zamykające aplikację

**User Story:** Jako użytkownik nietechniczny, chcę uruchamiać i zamykać aplikację jednym dwukliknięciem na ikonę, aby nie musieć korzystać z terminala ani znać poleceń `npm`.

#### Kryteria Akceptacji

1. THE Aplikacja SHALL dostarczać Skrypt_Uruchomieniowy w wariantach dla systemów: macOS/Linux (`start.sh`), Windows (`start.bat`)
2. THE Aplikacja SHALL dostarczać skrypt zamykający w wariantach dla systemów: macOS/Linux (`stop.sh`), Windows (`stop.bat`)
3. WHEN Użytkownik uruchomi Skrypt_Uruchomieniowy po raz pierwszy, THE skrypt SHALL automatycznie sprawdzić obecność wymaganych zależności (Node.js w wymaganej wersji), zainstalować zależności npm jeśli to potrzebne, a następnie uruchomić lokalny serwer Aplikacji
4. WHEN serwer zostanie uruchomiony, THE Skrypt_Uruchomieniowy SHALL automatycznie otworzyć przeglądarkę domyślną na adresie aplikacji (http://localhost:3000)
5. IF wymagana wersja Node.js nie jest zainstalowana, THEN THE Skrypt_Uruchomieniowy SHALL wyświetlić Profil_Błędu z linkiem do strony pobierania Node.js i zatrzymać uruchamianie
6. WHEN Użytkownik uruchomi skrypt zamykający, THE skrypt SHALL bezpiecznie zatrzymać proces lokalnego serwera Aplikacji oraz wyczyścić plik PID
7. THE Skrypt_Uruchomieniowy SHALL zapisywać PID działającego serwera w pliku `.spec-generator.pid` w katalogu Aplikacji w celu poprawnego zatrzymania
8. THE skrypty SHALL wyświetlać czytelne komunikaty postępu w prostym języku (np. "Sprawdzam Node.js...", "Instaluję zależności... (to może chwilę potrwać)", "Uruchamiam aplikację...", "Otwieram przeglądarkę...")
