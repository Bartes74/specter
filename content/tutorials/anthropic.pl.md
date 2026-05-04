# Jak zdobyć klucz API Anthropic (Claude)

Klucz API potrzebny jest do generowania specyfikacji modelami Anthropic (Claude Sonnet, Claude Haiku, Claude Opus).

## Krok po kroku

1. **Załóż konto** na [console.anthropic.com](https://console.anthropic.com/login) lub zaloguj się.
2. Zweryfikuj numer telefonu (wymagane przez Anthropic).
3. Wejdź na [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
4. Kliknij **"Create Key"** (przycisk po prawej stronie).
5. Wpisz nazwę klucza (np. "Spec Generator"), wybierz workspace **"Default"**.
6. Kliknij **"Add"** — pojawi się klucz zaczynający się od `sk-ant-`.
7. **Skopiuj klucz natychmiast** — Anthropic **nie pokaże go już więcej**.
8. Wróć do Spec Generatora i wklej klucz w pole "Klucz API".

## Szacowane koszty

- Pełna specyfikacja (3 dokumenty) z modelem **Claude Sonnet 4.5**: ok. **0,10–0,30 USD**.
- Z modelem **Claude Haiku 4.5** (tańszy): ok. **0,02–0,08 USD**.
- Wymagane jest **doładowanie konta przed pierwszym użyciem** — Anthropic nie oferuje darmowego planu.

## Doładowanie konta

1. Wejdź na [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing).
2. Kliknij **"Add credits"**.
3. Doładuj minimum 5 USD — to wystarczy na wiele generowań.

## Bezpieczeństwo

- **Nigdy nie udostępniaj** klucza i nie commituj go do repo.
- Spec Generator trzyma klucz **wyłącznie w pamięci przeglądarki** — nie wysyłamy go na żaden serwer poza Anthropic.
- Jeśli klucz wycieknie, usuń go w panelu i wygeneruj nowy.
- W panelu możesz ustawić **monthly spend limits** — silnie zalecane.
