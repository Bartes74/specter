# Spec Generator

Spec Generator to lokalna aplikacja, która prowadzi Cię od krótkiego opisu projektu do trzech plików w folderze `docs`: `requirements.md`, `design.md` i `tasks.md`.

## Pierwsze Uruchomienie

Na macOS lub Linux uruchom:

```bash
./start.sh
```

Na Windows uruchom:

```bat
start.bat
```

Skrypt sprawdzi Node.js, zainstaluje zależności, zbuduje aplikację jeśli trzeba i otworzy `http://localhost:3000`.

## Codzienne Użycie

1. Wybierz istniejący folder projektu albo utwórz nowy.
2. Opisz projekt prostym językiem.
3. Odpowiedz na pytania doprecyzowujące.
4. Wybierz narzędzie docelowe i model AI.
5. Wklej klucz API wybranego dostawcy.
6. Użyj istniejącego `standards.md`, wygeneruj go albo pomiń ten krok.
7. Wygeneruj dokumenty, sprawdź podgląd i zapisz pliki.

Klucz API jest trzymany tylko w pamięci przeglądarki podczas sesji. Nie jest zapisywany w preferencjach ani w `sessionStorage`.

## Tryb Demo

Tryb demo działa bez klucza API i bez zapisu na dysk. Służy do przejścia całego procesu na przykładowych danych.

## Gdy Coś Pójdzie Nie Tak

W aplikacji zobaczysz profil błędu z opisem, znaczeniem i akcjami naprawczymi. Przy problemach ze startem sprawdź log:

- macOS/Linux: `~/.spec-generator/server.log`
- Windows: `%USERPROFILE%\.spec-generator\server.log`

Zatrzymanie aplikacji:

```bash
./stop.sh
```

lub na Windows:

```bat
stop.bat
```

## Tutoriale Kluczy API

Tutoriale dla OpenAI, Anthropic, Google Gemini i GitHub Models są w aplikacji oraz w `content/tutorials`.

Sprawdzenie metadanych tutoriali:

```bash
npm run tutorials:verify -- --check
```

Podgląd bez zapisu:

```bash
npm run tutorials:verify -- --dry-run
```

## Dla Osób Technicznych

Najważniejsze komendy:

```bash
npm run type-check
npm test
npm run build
```

Wymagania: Node.js 20+ i npm 10+.
