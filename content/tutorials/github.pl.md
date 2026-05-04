# Jak zdobyć klucz GitHub Models (dla użytkowników Copilota)

GitHub Models to platforma pozwalająca używać wielu modeli AI (w tym GPT-4o, Llama, Phi) przez **GitHub Personal Access Token (PAT)**. Wygodne dla osób już używających GitHuba i Copilota.

## Krok po kroku

1. **Zaloguj się** na [github.com](https://github.com) (jeśli nie masz konta — załóż).
2. Kliknij swój awatar w prawym górnym rogu → **"Settings"**.
3. W sidebarze przewiń na sam dół do **"Developer settings"**.
4. Wybierz **"Personal access tokens" → "Fine-grained tokens"**.
5. Kliknij **"Generate new token"**.
6. Wypełnij:
   - **Token name**: np. "Spec Generator"
   - **Expiration**: zalecamy 90 dni (z możliwością odnowienia)
   - **Repository access**: "Public Repositories (read-only)" wystarczy
   - **Account permissions** → **"Models"** → ustaw na **"Read"**
7. Kliknij **"Generate token"**.
8. **Skopiuj token** — zaczyna się od `github_pat_` (lub `ghp_` dla starszych klasycznych tokenów).
9. Wróć do Spec Generatora i wklej token w pole "Klucz API".

## Limity i koszty

GitHub Models w **wersji preview** jest darmowy, ale ma limity:
- **Rate limits** zależne od planu GitHub (Free / Pro / Enterprise).
- Generalnie wystarcza na **kilkadziesiąt zapytań dziennie** w planie Free.
- Niektóre modele (np. GPT-4o) mają **niższy limit** niż mniejsze modele.

Aktualne limity: [docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits](https://docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits).

## Ważne ograniczenia

- GitHub Models jest **w wersji preview** (stan na 2026) — funkcjonalność może się zmienić.
- Nie nadaje się do **użycia produkcyjnego** — dla zastosowań produkcyjnych użyj OpenAI / Anthropic / Google.
- Doskonały do **prototypowania** i testowania różnych modeli.

## Bezpieczeństwo

- **Nigdy nie udostępniaj** tokenu — to klucz do Twojego konta GitHub.
- Spec Generator trzyma token **wyłącznie w pamięci przeglądarki** — nie wysyłamy go nigdzie poza endpoint GitHub Models.
- Jeśli token wycieknie, **natychmiast** odwołaj go w panelu GitHub i wygeneruj nowy.
- Zalecamy **fine-grained tokens** zamiast classic — pozwalają ograniczyć uprawnienia tylko do "Models".
