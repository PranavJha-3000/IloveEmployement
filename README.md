# IloveEmployement

> Ilovepdf but for getting a job.

Brutally honest, actually useful resume analysis. Bring your own AI key. No sign-up, no tracking, nothing stored.

**Live:** [iloveemployement.vercel.app](https://iloveemployement.vercel.app)

## What it does

1. **Selection Probability** — An honest 0–100 score with breakdown (experience, skills, education, extras)
2. **Fit Analysis** — What's working, what's not, and one uncomfortable truth
3. **Rewritten Resume** — Tailored to the job, with notes on what changed and why
4. **Profile Synthesis** — LinkedIn/GitHub evidence (optional URLs)
5. **Application Strategy** — Concrete next steps, talking points, questions to ask

The humor is seasoning, not the meal. Gen-Z slang appears occasionally, when it lands — never forced.

## Supported AI Providers

Bring your own API key. Supported out of the box:

| Provider | Get a key |
|----------|-----------|
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) |
| OpenRouter | [openrouter.ai](https://openrouter.ai/keys) |
| Groq | [console.groq.com](https://console.groq.com/keys) |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| Mistral | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| Together AI | [api.together.xyz](https://api.together.xyz/settings/api-keys) |
| xAI (Grok) | [console.x.ai](https://console.x.ai) |
| Custom | Any OpenAI-compatible endpoint |

**Your API key is used per-request and never stored.** It's sent to the server, used to call your chosen provider, then discarded. No database, no logs, no persistence.

## Tech Stack

- **Next.js 15** (App Router, React 19, TypeScript)
- **Tailwind CSS v4**
- **Vercel AI SDK** (`ai` + provider packages)
- **pdf-parse** for PDF extraction

## Getting Started

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). Paste your resume and a job description, pick a provider, enter your key, set your desperation level, and hit analyze.

## Privacy

- 🔒 **No auth, no accounts** — nothing to leak
- 🗑️ **No database** — nothing to breach
- 🚫 **No tracking** — no analytics, no telemetry
- 🔑 **Your key, your control** — used per-request, never stored
- 📄 **Resume/job data** — processed in-memory per request, never logged

## Documentation

See [platform.md](./platform.md) for full product documentation, architecture details, and the explicit out-of-scope list.

