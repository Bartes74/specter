# How to get an Anthropic (Claude) API key

You need an API key to generate specifications using Anthropic models (Claude Sonnet, Claude Haiku, Claude Opus).

## Step by step

1. **Create an account** at [console.anthropic.com](https://console.anthropic.com/login) or sign in.
2. Verify your phone number (required by Anthropic).
3. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
4. Click **"Create Key"** (button on the right).
5. Enter a key name (e.g. "Spec Generator"), select workspace **"Default"**.
6. Click **"Add"** — a key starting with `sk-ant-` will appear.
7. **Copy the key immediately** — Anthropic **will not show it again**.
8. Return to Spec Generator and paste the key into the "API key" field.

## Estimated cost

- A full spec (3 documents) using **Claude Sonnet 4.5**: about **$0.10–0.30**.
- Using **Claude Haiku 4.5** (cheaper): about **$0.02–0.08**.
- You must **add credits before first use** — Anthropic does not offer a free tier.

## Topping up

1. Go to [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing).
2. Click **"Add credits"**.
3. Add at least $5 — enough for many generations.

## Security

- **Never share** your key and never commit it to a repo.
- Spec Generator keeps the key **only in browser memory** — we do not send it anywhere except Anthropic.
- If the key leaks, delete it in the dashboard and create a new one.
- The dashboard lets you set **monthly spend limits** — strongly recommended.
