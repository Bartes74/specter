#!/usr/bin/env bash
# Spec Generator — skrypt uruchomieniowy (macOS / Linux)
# Wymaga: Node.js >= 20, npm >= 10
# Użycie:  ./start.sh

set -euo pipefail

# ---------- Konfiguracja ----------
APP_NAME="Spec Generator"
APP_HOST="localhost"
APP_PORT="${PORT:-3000}"
APP_URL="http://${APP_HOST}:${APP_PORT}"
HEALTH_URL="${APP_URL}/api/health"
PREFS_DIR="${HOME}/.spec-generator"
PID_FILE="${PREFS_DIR}/.spec-generator.pid"
LOG_FILE="${PREFS_DIR}/server.log"
INSTALL_STAMP="node_modules/.install-stamp"
BUILD_STAMP=".next/BUILD_ID"
REQUIRED_NODE_MAJOR=20
HEALTH_TIMEOUT_SECONDS=30

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p "$PREFS_DIR"
EXISTING_RUNNING=0
EXISTING_PID=""
BUILD_WAS_NEEDED=0
SERVER_RESTART_NEEDED=0

# ---------- Pomoce wizualne ----------
say() { printf "  %s\n" "$1"; }
ok()  { printf "  ✓ %s\n" "$1"; }
err() { printf "  ✗ %s\n" "$1" >&2; }
hr()  { printf "\n"; }

refresh_urls() {
  APP_URL="http://${APP_HOST}:${APP_PORT}"
  HEALTH_URL="${APP_URL}/api/health"
}

pick_port() {
  local preferred="$APP_PORT"
  local candidate
  for candidate in "$preferred" 3001 3002 3003 3004 3005; do
    if ! lsof -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
      APP_PORT="$candidate"
      refresh_urls
      if [ "$candidate" != "$preferred" ]; then
        say "Port ${preferred} jest zajęty. Użyję portu ${candidate}."
      fi
      return 0
    fi
  done
  print_error_profile \
    "Nie znaleziono wolnego portu w zakresie 3000–3005." \
    "Aplikacja potrzebuje lokalnego portu HTTP do uruchomienia interfejsu." \
    "    1. Zamknij inne lokalne serwery
    2. Albo uruchom z wybranym portem: PORT=3010 ./start.sh"
  exit 1
}

# ---------- Profil_Błędu (zgodny z design.md) ----------
print_error_profile() {
  local what_happened="$1"
  local what_it_means="$2"
  local how_to_fix="$3"
  hr
  err "Wystąpił błąd podczas uruchamiania ${APP_NAME}"
  printf "\n  Co się stało:\n    %s\n" "$what_happened"
  printf "\n  Co to oznacza:\n    %s\n" "$what_it_means"
  printf "\n  Jak to naprawić:\n%s\n\n" "$how_to_fix"
}

# ---------- 1. Sprawdź Node.js ----------
hr
say "${APP_NAME} — uruchamianie..."
hr
say "Sprawdzam wymagania środowiska..."

if ! command -v node >/dev/null 2>&1; then
  print_error_profile \
    "Nie znaleziono Node.js na tym komputerze." \
    "Aplikacja nie zostanie uruchomiona, dopóki nie zainstalujesz Node.js." \
    "    1. Otwórz https://nodejs.org/pl/download
    2. Pobierz wersję LTS (zalecaną)
    3. Uruchom instalator i postępuj zgodnie z instrukcją
    4. Po zakończeniu uruchom ponownie ./start.sh"
  exit 1
fi

NODE_VERSION_RAW="$(node --version)"           # np. v20.11.1
NODE_MAJOR="${NODE_VERSION_RAW#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  print_error_profile \
    "Wersja Node.js to ${NODE_VERSION_RAW}, a wymagana jest co najmniej ${REQUIRED_NODE_MAJOR}." \
    "Niektóre funkcje aplikacji nie zadziałają na starszej wersji." \
    "    1. Otwórz https://nodejs.org/pl/download
    2. Pobierz najnowszą wersję LTS
    3. Zainstaluj ją (nadpisze starszą)
    4. Uruchom ponownie ./start.sh"
  exit 1
fi
ok "Node.js ${NODE_VERSION_RAW}"

# ---------- 2. Sprawdź czy aplikacja już działa ----------
if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    EXISTING_RUNNING=1
    ok "Aplikacja już działa (PID ${EXISTING_PID}). Sprawdzę jeszcze, czy build jest aktualny."
  else
    rm -f "$PID_FILE"
    EXISTING_PID=""
  fi
fi

# ---------- 3. Instalacja zależności ----------
NEEDS_INSTALL=0
if [ ! -d "node_modules" ]; then NEEDS_INSTALL=1; fi
if [ -f "package-lock.json" ] && [ ! -f "$INSTALL_STAMP" ]; then NEEDS_INSTALL=1; fi
if [ -f "package-lock.json" ] && [ -f "$INSTALL_STAMP" ] && [ "package-lock.json" -nt "$INSTALL_STAMP" ]; then
  NEEDS_INSTALL=1
fi

if [ "$NEEDS_INSTALL" -eq 1 ]; then
  say "Instaluję zależności... (to może potrwać 1–3 minuty)"
  if ! npm install --no-audit --no-fund; then
    print_error_profile \
      "Instalacja zależności (npm install) nie powiodła się." \
      "Aplikacja nie wstanie bez zainstalowanych zależności." \
      "    1. Sprawdź połączenie z internetem
    2. Uruchom ręcznie: npm install
    3. Sprawdź log: ${LOG_FILE}
    4. Po naprawieniu uruchom ./start.sh ponownie"
    exit 1
  fi
  mkdir -p "$(dirname "$INSTALL_STAMP")"
  : > "$INSTALL_STAMP"
  ok "Zależności zainstalowane"
else
  ok "Zależności są aktualne"
fi

# ---------- 4. Build produkcyjny ----------
needs_build() {
  if [ ! -f "$BUILD_STAMP" ]; then
    return 0
  fi

  if find src messages content public package.json package-lock.json next.config.js next.config.mjs next.config.ts tailwind.config.ts tsconfig.json \
    -newer "$BUILD_STAMP" -print -quit 2>/dev/null | grep -q .; then
    return 0
  fi

  return 1
}

if needs_build; then
  BUILD_WAS_NEEDED=1
  say "Buduję aplikację... (źródła zmieniły się od ostatniego uruchomienia)"
  if ! npm run build; then
    print_error_profile \
      "Budowanie aplikacji (npm run build) nie powiodło się." \
      "Aplikacja produkcyjna nie zostanie uruchomiona bez aktualnego builda." \
      "    1. Sprawdź komunikat błędu powyżej
    2. Uruchom ręcznie: npm run type-check
    3. Po naprawieniu uruchom ./start.sh ponownie"
    exit 1
  fi
  ok "Build jest aktualny"
else
  ok "Build jest aktualny"
fi

if [ "$EXISTING_RUNNING" -eq 1 ] && [ -f "$BUILD_STAMP" ] && [ -f "$PID_FILE" ] && [ "$BUILD_STAMP" -nt "$PID_FILE" ]; then
  SERVER_RESTART_NEEDED=1
  say "Build jest nowszy niż działający serwer. Serwer wymaga restartu."
fi

open_browser() {
  if command -v open >/dev/null 2>&1; then open "$APP_URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$APP_URL" >/dev/null 2>&1
  fi
}

if [ "$EXISTING_RUNNING" -eq 1 ] && [ "$BUILD_WAS_NEEDED" -eq 0 ] && [ "$SERVER_RESTART_NEEDED" -eq 0 ]; then
  ok "Działający serwer używa aktualnego builda. Otwieram przeglądarkę..."
  open_browser || true
  hr
  say "Aby zatrzymać aplikację uruchom: ./stop.sh"
  exit 0
fi

if [ "$EXISTING_RUNNING" -eq 1 ]; then
  say "Restartuję działający serwer, żeby użył nowego builda..."
  screen -S spec-generator -X quit >/dev/null 2>&1 || true
  kill "$EXISTING_PID" >/dev/null 2>&1 || true
  rm -f "$PID_FILE"
  sleep 0.5
fi

# ---------- 5. Uruchom serwer ----------
pick_port
say "Uruchamiam aplikację w tle..."
: > "$LOG_FILE"
# Preferuj `npm start` (produkcja), fallback `npm run dev`
if [ "$(npm pkg get scripts.start 2>/dev/null || printf '{}')" != "{}" ]; then
  START_CMD="npm start"
else
  START_CMD="npm run dev"
fi

if command -v screen >/dev/null 2>&1; then
  screen -S spec-generator -X quit >/dev/null 2>&1 || true
  screen -dmS spec-generator bash -lc "cd \"$SCRIPT_DIR\" && echo \\\$\\\$ > \"$PID_FILE\" && exec env PORT=\"$APP_PORT\" $START_CMD >>\"$LOG_FILE\" 2>&1"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -s "$PID_FILE" ] && break
    sleep 0.1
  done
  SERVER_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
else
  nohup env PORT="$APP_PORT" $START_CMD >>"$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PID_FILE"
fi

if [ -z "${SERVER_PID:-}" ]; then
  print_error_profile \
    "Nie udało się odczytać PID procesu serwera." \
    "Aplikacja mogła nie wystartować poprawnie." \
    "    1. Sprawdź log: ${LOG_FILE}
    2. Uruchom ręcznie: PORT=${APP_PORT} npm start"
  rm -f "$PID_FILE"
  exit 1
fi

# ---------- 6. Czekaj na health check ----------
say "Czekam aż aplikacja będzie gotowa..."
WAITED=0
while [ "$WAITED" -lt "$HEALTH_TIMEOUT_SECONDS" ]; do
  if curl --silent --fail --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    LISTENER_PID="$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
    if [ -n "$LISTENER_PID" ]; then
      SERVER_PID="$LISTENER_PID"
      echo "$SERVER_PID" > "$PID_FILE"
    fi
    ok "Aplikacja jest gotowa (PID ${SERVER_PID})"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    LISTENER_PID="$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
    if [ -n "$LISTENER_PID" ]; then
      SERVER_PID="$LISTENER_PID"
      echo "$SERVER_PID" > "$PID_FILE"
      sleep 1
      WAITED=$((WAITED + 1))
      continue
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    continue
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ "$WAITED" -ge "$HEALTH_TIMEOUT_SECONDS" ]; then
  print_error_profile \
    "Aplikacja nie odpowiedziała w ciągu ${HEALTH_TIMEOUT_SECONDS} sekund." \
    "Serwer prawdopodobnie utknął lub port ${APP_PORT} jest zajęty." \
    "    1. Sprawdź log: ${LOG_FILE}
    2. Sprawdź czy port ${APP_PORT} nie jest zajęty: lsof -i :${APP_PORT}
    3. Uruchom ./stop.sh i spróbuj ponownie"
  kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  exit 1
fi

# ---------- 7. Otwórz przeglądarkę ----------
say "Otwieram przeglądarkę..."
if command -v open >/dev/null 2>&1; then open "$APP_URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$APP_URL" >/dev/null 2>&1
else
  say "Nie udało się automatycznie otworzyć przeglądarki. Otwórz ręcznie: ${APP_URL}"
fi

hr
ok "${APP_NAME} działa pod adresem ${APP_URL}"
say "Aby zatrzymać aplikację uruchom: ./stop.sh"
say "Log serwera: ${LOG_FILE}"
hr
