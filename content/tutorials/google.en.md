# How to get a Google Gemini API key

You need an API key to generate specifications using Google models (Gemini 1.5 Pro, Gemini 1.5 Flash). Google offers a **free tier** that is enough for typical Spec Generator usage.

## Step by step

1. Go to [aistudio.google.com](https://aistudio.google.com).
2. Sign in with your Google account (personal or workspace).
3. Accept the Gemini API terms.
4. Once signed in, click **"Get API key"** in the left sidebar (or go directly to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)).
5. Click **"Create API key"** → **"Create API key in new project"** (or choose an existing Google Cloud project).
6. **Copy the key** — it starts with `AIza` and is about 39 characters long.
7. Return to Spec Generator and paste the key into the "API key" field.

## Free tier

Google Gemini offers a **free tier**:
- Gemini 1.5 Flash: **15 requests/minute**, **1M tokens/minute**, **1,500 requests/day**.
- Gemini 1.5 Pro: **2 requests/minute**, **32K tokens/minute**, **50 requests/day**.
- No credit card required.

For typical Spec Generator usage (a few generations per day), **the free tier is more than enough**.

## Paid plan (optional)

If you exceed the free-tier limits:
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Next to your key click **"Set up Billing"**.
3. Link the account to a Google Cloud project with active billing.

## Security

- **Never share** your key and never commit it to a repo.
- Spec Generator keeps the key **only in browser memory** — we do not send it anywhere except Google.
- The `AIza...` key can be used across many Google APIs (not only Gemini) — we recommend restricting it in [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
