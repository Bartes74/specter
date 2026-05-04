# Jak zdobyć klucz API OpenAI

Klucz API potrzebny jest do generowania specyfikacji modelami OpenAI (GPT-4o, GPT-4o-mini).

## Krok po kroku

1. **Załóż konto** na [platform.openai.com](https://platform.openai.com/signup) lub zaloguj się jeśli już masz.
2. Po zalogowaniu wejdź na [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Kliknij **"Create new secret key"** (zielony przycisk w prawym górnym rogu).
4. Wpisz nazwę klucza (np. "Spec Generator") i kliknij **"Create secret key"**.
5. **Skopiuj klucz natychmiast** — zaczyna się od `sk-` i ma kilkadziesiąt znaków. OpenAI **nie pokaże go już więcej**.
6. Wróć do Spec Generatora i wklej klucz w pole "Klucz API".

## Szacowane koszty

- Pełna specyfikacja (3 dokumenty) z modelem **GPT-4o**: ok. **0,05–0,15 USD**.
- Z modelem **GPT-4o-mini** (tańszy): ok. **0,005–0,02 USD**.
- Pierwsze konto OpenAI dostaje czasem **5 USD darmowych kredytów** ważnych przez 3 miesiące.

## Doładowanie konta

Jeśli zobaczysz błąd "Quota exceeded":
1. Wejdź na [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing).
2. Kliknij **"Add to credit balance"**.
3. Doładuj minimum 5 USD — to wystarczy na setki generowań.

## Bezpieczeństwo

- **Nigdy nie udostępniaj** klucza nikomu i nie commituj go do repo.
- Spec Generator trzyma klucz **wyłącznie w pamięci przeglądarki** (sessionStorage) — nie wysyłamy go na żaden serwer poza OpenAI.
- Jeśli klucz wycieknie, możesz go usunąć i wygenerować nowy w panelu OpenAI.
- Zalecamy ustawić **limity wydatków** w [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits).
