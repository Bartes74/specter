# Jak zdobyć klucz API Google Gemini

Klucz API potrzebny jest do generowania specyfikacji modelami Google (Gemini 1.5 Pro, Gemini 1.5 Flash). Google oferuje **darmowy plan** wystarczający do typowego użycia Spec Generatora.

## Krok po kroku

1. Wejdź na [aistudio.google.com](https://aistudio.google.com).
2. Zaloguj się kontem Google (osobistym lub firmowym).
3. Zaakceptuj warunki Gemini API.
4. Po zalogowaniu kliknij **"Get API key"** w lewym sidebarze (lub wejdź wprost na [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)).
5. Kliknij **"Create API key"** → **"Create API key in new project"** (lub wybierz istniejący projekt Google Cloud).
6. **Skopiuj klucz** — zaczyna się od `AIza` i ma ok. 39 znaków.
7. Wróć do Spec Generatora i wklej klucz w pole "Klucz API".

## Darmowy plan

Google Gemini oferuje **darmowy tier**:
- Gemini 1.5 Flash: **15 zapytań/minutę**, **1 mln tokenów/minutę**, **1500 zapytań/dzień**.
- Gemini 1.5 Pro: **2 zapytania/minutę**, **32 tys. tokenów/minutę**, **50 zapytań/dzień**.
- Brak konieczności podawania karty kredytowej.

Dla typowego użycia Spec Generatora (kilka generowań dziennie) **darmowy plan w pełni wystarczy**.

## Płatny plan (opcjonalny)

Jeśli wyczerpiesz limity darmowego planu:
1. Wejdź na [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Przy swoim kluczu kliknij **"Set up Billing"**.
3. Połącz konto z projektem Google Cloud z aktywnym billing-iem.

## Bezpieczeństwo

- **Nigdy nie udostępniaj** klucza i nie commituj go do repo.
- Spec Generator trzyma klucz **wyłącznie w pamięci przeglądarki** — nie wysyłamy go na żaden serwer poza Google.
- Klucz `AIza...` może zostać użyty w wielu Google API (nie tylko Gemini) — zalecamy ograniczenie zakresu w [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
