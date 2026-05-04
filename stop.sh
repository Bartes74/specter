#!/usr/bin/env bash
# Spec Generator — skrypt zamykający (macOS / Linux)
# Użycie:  ./stop.sh

set -euo pipefail

APP_NAME="Spec Generator"
PREFS_DIR="${HOME}/.spec-generator"
PID_FILE="${PREFS_DIR}/.spec-generator.pid"
SCREEN_NAME="spec-generator"
GRACE_SECONDS=5

say() { printf "  %s\n" "$1"; }
ok()  { printf "  ✓ %s\n" "$1"; }
err() { printf "  ✗ %s\n" "$1" >&2; }
hr()  { printf "\n"; }

hr
say "${APP_NAME} — zatrzymywanie..."
hr

if [ ! -f "$PID_FILE" ]; then
  screen -S "$SCREEN_NAME" -X quit >/dev/null 2>&1 || true
  ok "Aplikacja nie była uruchomiona (brak pliku PID)."
  hr
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"

if [ -z "$PID" ]; then
  rm -f "$PID_FILE"
  ok "Plik PID był pusty — usunięto."
  hr
  exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
  ok "Proces ${PID} już nie działa. Czyszczę plik PID."
  rm -f "$PID_FILE"
  hr
  exit 0
fi

say "Zatrzymuję proces ${PID} (SIGTERM)..."
kill -TERM "$PID" 2>/dev/null || true

WAITED=0
while [ "$WAITED" -lt "$GRACE_SECONDS" ]; do
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if kill -0 "$PID" 2>/dev/null; then
  err "Proces nie zakończył się w ciągu ${GRACE_SECONDS}s — wymuszam zamknięcie (SIGKILL)..."
  kill -KILL "$PID" 2>/dev/null || true
fi

rm -f "$PID_FILE"
screen -S "$SCREEN_NAME" -X quit >/dev/null 2>&1 || true
ok "${APP_NAME} został zatrzymany."
hr
