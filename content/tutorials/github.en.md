# How to get a GitHub Models key (for Copilot users)

GitHub Models is a platform that lets you use many AI models (including GPT-4o, Llama, Phi) via a **GitHub Personal Access Token (PAT)**. Convenient for people already using GitHub and Copilot.

## Step by step

1. **Sign in** at [github.com](https://github.com) (create an account if you don't have one).
2. Click your avatar in the top right → **"Settings"**.
3. In the sidebar scroll all the way down to **"Developer settings"**.
4. Choose **"Personal access tokens" → "Fine-grained tokens"**.
5. Click **"Generate new token"**.
6. Fill in:
   - **Token name**: e.g. "Spec Generator"
   - **Expiration**: we recommend 90 days (renewable)
   - **Repository access**: "Public Repositories (read-only)" is enough
   - **Account permissions** → **"Models"** → set to **"Read"**
7. Click **"Generate token"**.
8. **Copy the token** — it starts with `github_pat_` (or `ghp_` for older classic tokens).
9. Return to Spec Generator and paste the token into the "API key" field.

## Limits and cost

GitHub Models in **preview** is free, but rate-limited:
- **Rate limits** depend on your GitHub plan (Free / Pro / Enterprise).
- Generally enough for **dozens of requests per day** on the Free plan.
- Some models (e.g. GPT-4o) have **lower limits** than smaller models.

Current limits: [docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits](https://docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits).

## Important restrictions

- GitHub Models is **in preview** (as of 2026) — functionality may change.
- Not suitable for **production use** — for production, use OpenAI / Anthropic / Google.
- Excellent for **prototyping** and trying different models.

## Security

- **Never share** the token — it is a key to your GitHub account.
- Spec Generator keeps the token **only in browser memory** — we don't send it anywhere except the GitHub Models endpoint.
- If the token leaks, **revoke it immediately** in the GitHub dashboard and create a new one.
- We recommend **fine-grained tokens** over classic tokens — they let you scope permissions to "Models" only.
