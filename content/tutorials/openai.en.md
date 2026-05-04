# How to get an OpenAI API key

You need an API key to generate specifications using OpenAI models (GPT-4o, GPT-4o-mini).

## Step by step

1. **Create an account** at [platform.openai.com](https://platform.openai.com/signup) or sign in if you already have one.
2. Once signed in, go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Click **"Create new secret key"** (green button in the top right).
4. Enter a key name (e.g. "Spec Generator") and click **"Create secret key"**.
5. **Copy the key immediately** — it starts with `sk-` and is several dozen characters long. OpenAI **will not show it again**.
6. Return to Spec Generator and paste the key into the "API key" field.

## Estimated cost

- A full spec (3 documents) using **GPT-4o**: about **$0.05–0.15**.
- Using **GPT-4o-mini** (cheaper): about **$0.005–0.02**.
- New OpenAI accounts sometimes receive **$5 in free credits** valid for 3 months.

## Topping up

If you see a "Quota exceeded" error:
1. Go to [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing).
2. Click **"Add to credit balance"**.
3. Add at least $5 — enough for hundreds of generations.

## Security

- **Never share** your key with anyone, and never commit it to a repo.
- Spec Generator keeps the key **only in browser memory** (sessionStorage) — we do not send it anywhere except OpenAI.
- If the key leaks, you can delete it and create a new one in the OpenAI dashboard.
- We recommend setting **spend limits** at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits).
