# iloveemployment

iLovePDF, but for getting a job — 28 brutally honest, AI-powered employment tools (resume analysis, job-fit scoring, interview prep, LinkedIn/GitHub auditing, cover letters and more) that run on your own API key, with real document parsing, evidence-based analysis and validated structured outputs. No account, no database, no stored data.

**Live:** [iloveemployement.vercel.app](https://iloveemployement.vercel.app)

## Features

- **28 employment tools** — resume analyzer, job fit checker, skill gap analyzer, resume truth detector, delulu detector, ATS checker, interview prep, boss fight (mock interview), cover letter generator, resume rewriter, LinkedIn optimizer, GitHub resume checker, JD red flag scanner, and more
- **Real document processing** — upload PDF, DOCX or TXT resumes (or paste text); extraction runs server-side and normalizes the text for analysis, with graceful fallback to pasted text
- **Evidence-based analysis** — LinkedIn/GitHub sources are compared against resume claims and classified as STRONG / PARTIAL / MISSING / UNVERIFIED. Keyword presence alone is never treated as proof, and absence from GitHub is never treated as "doesn't know it"
- **Truth-filtered rewriting** — the resume rewriter only repositions experience that exists; it never invents jobs, metrics, certifications or technologies. Desperation level controls tone, never facts
- **Multi-provider BYOK** — bring your own key from 9 providers; the key lives in memory for the duration of one request
- **Professional outputs, Gen-Z seasoning** — the actual resumes, cover letters and interview answers stay professional; the surrounding copy carries the humor

## Architecture

Every AI tool runs through the same pipeline, so no tool duplicates parsing, validation or error handling:

```
INPUT (resume + JD + optional LinkedIn/GitHub)
  ↓
Document extraction        lib/documents.ts (PDF / DOCX / TXT / pasted)
  ↓
Structured normalization   lib/resume-parser.ts (contact, experience, skills, …)
  ↓
Prompt construction        lib/prompts.ts (per-tool, structured-output schemas)
  ↓
Unified AI call            lib/ai.ts → provider abstraction (9 providers)
  ↓
JSON extraction + repair   lib/utils.ts (handles markdown fences, trailing prose)
  ↓
Runtime validation         lib/utils.ts validators (malformed output never crashes the UI)
  ↓
Standardized error handling lib/pipeline.ts (auth / rate-limit / timeout / model / JSON)
  ↓
Tool-specific presentation components/shared/*
```

API routes are thin wrappers over `standardAIHandler` in `lib/pipeline.ts`, which centralizes config validation, input limits, JSON extraction, output validation and error classification. The evidence engine (`lib/evidence.ts`) is shared across the Resume Analyzer, Job Fit Checker, Skill Gap Analyzer, Resume Truth Detector, GitHub Resume Checker and Delulu Detector.

## AI Providers

The app uses a BYOK (bring-your-own-key) architecture. You pick a provider, a model and paste your key in the UI — the key is held in browser memory and sent per-request to the tool's API route, which calls the provider through one unified interface (`lib/providers.ts`). Keys are never persisted, never logged, never placed in URLs, and never written to localStorage.

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

## Privacy

Your documents are processed for your request. We don't need an account and we don't store your API key.

- Resume/JD text and profile URLs are processed in-memory per request; they are not written to disk or a database (there is no database)
- Your API key is forwarded to your chosen provider for that single request, then discarded — it is not persisted server-side or in browser storage
- Provider error messages are scanned and API-key-like strings are redacted before anything is returned to the client
- No analytics, no tracking, no auth

## Local Development

```bash
git clone https://github.com/PranavJha-3000/IloveEmployement.git
cd IloveEmployement
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment variables are required — the app is fully BYOK and stateless.

```bash
npm run build   # production build
npm run start   # serve the production build
```

## Deployment

Deploy to Vercel with zero configuration:

1. Push the repo to GitHub
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Deploy — no environment variables, no database, no setup

Or via CLI:

```bash
npm i -g vercel
vercel
```

## Technical Highlights

- **Document parsing** — unified server-side extraction for PDF (`pdf-parse`), DOCX (`mammoth`) and TXT with size limits and paste fallback
- **Structured LLM outputs** — every tool validates model responses against its result type at runtime; malformed JSON, truncated output or hallucinated shapes degrade to a clean error instead of crashing
- **Evidence matching** — multi-source classification (resume / LinkedIn / GitHub / JD) that distinguishes "not found in source" from "doesn't exist"
- **Multi-provider architecture** — one `createModel` abstraction over the Vercel AI SDK; adding a provider is a config entry, not new logic
- **Reusable tool architecture** — shared `ToolShell`, upload, input, loading, error, score and evidence components; each route is ~50 lines of tool-specific config
- **Validation & error handling** — centralized classification of auth failures, rate limits, timeouts, invalid models and malformed JSON, with actionable messages and secret redaction


