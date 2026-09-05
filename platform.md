# IloveEmployement — Platform Documentation

> "Ilovepdf but for getting a job"

## Product Purpose

IloveEmployement is an absurdly high-quality, humorous resume analyzer. Users provide a resume, job description, LinkedIn URL, GitHub URL, their own AI API key, and a **Desperation Level**. The app then:

1. Analyzes the resume against the job description.
2. Provides a brutally honest selection probability.
3. Details why the user is (or is not) a fit.
4. Rewrites the resume specifically for the target job.
5. Synthesizes LinkedIn/GitHub data to find supporting evidence.
6. Delivers a tailored application strategy.
7. Includes witty, Gen-Z/troll-style commentary.

## Core Philosophy

- **Utility over Gimmick:** The humor must never compromise the quality of the analysis. It's "actually useful resume analysis + occasionally unhinged commentary" — not "AI-generated cringe."
- **Tone & Voice:** Gen-Z slang (rizz, cooked, aura, skill issue, it's giving) is used sparingly and contextually. It is never forced into every sentence.
- **Aesthetics:** Clean, modern, professional UI. Personality comes from the copy, not a "meme-style" visual design.
- **Anti-Overengineering:** This is NOT a SaaS startup. No auth, billing, databases, dashboards, admin panels, subscriptions, or complex backend architecture.


## Architecture & Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI Integration | Vercel AI SDK (`ai`) with multi-provider support |
| PDF Parsing | `pdf-parse` (server-side) |
| Deployment | Vercel (`iloveemployement.vercel.app`) |

### Multi-Provider AI Support

Users bring their **own API key** and choose their provider. Supported:

| Provider | Example Models | SDK Package |
|----------|---------------|-------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini` | `@ai-sdk/openai` |
| Google Gemini | `gemini-2.0-flash`, `gemini-1.5-pro` | `@ai-sdk/google` |
| OpenRouter | `anthropic/claude-sonnet-4`, etc. | `@ai-sdk/openai-compatible` |
| Groq | `llama-3.1-70b-versatile` | `@ai-sdk/openai-compatible` |
| Together AI | `meta-llama/Llama-3.3-70B` | `@ai-sdk/openai-compatible` |
| xAI (Grok) | `grok-2-latest` | `@ai-sdk/openai-compatible` |
| Mistral | `mistral-large-latest` | `@ai-sdk/openai-compatible` |
| DeepSeek | `deepseek-chat` | `@ai-sdk/openai-compatible` |
| Custom | Any OpenAI-compatible endpoint | `@ai-sdk/openai-compatible` |

The client sends `{ provider, apiKey, model, baseUrl? }` with each request. The server uses it to construct the right AI SDK provider instance, calls the model, and **never stores the key**.

## Main User Flow

```
Landing Page
   │
   ▼
Analyzer Form ──────────────────────────────┐
   │  • Resume (paste text or upload PDF)  │
   │  • Job Description (paste)            │
   │  • LinkedIn URL (optional)            │
   │  • GitHub URL (optional)              │
   │  • Desperation Level (selector 0–5)    │
   │  • Provider + API Key + Model         │
   ▼                                       │
"Analyze Me" ──────────────────────────────┘
   │
   ▼
API Route: POST /api/analyze
   │  • Parses PDF if uploaded
   │  • Fetches LinkedIn/GitHub public data
   │  • Builds structured prompt
   │  • Calls user's AI provider
   │  • Returns structured JSON
   ▼
Results Panel (tabbed / sectioned)
   ├── 🎯 Selection Probability
   ├── 🔍 Fit Analysis (why / why not)
   ├── ✍️ Rewritten Resume
   ├── 🕵️ Profile Synthesis (LinkedIn/GitHub evidence)
   └── 📋 Application Strategy
```

## Components

| Component | Purpose |
|-----------|---------|
| `app/page.tsx` | Main page — orchestrates form → loading → results |
| `components/LandingHero.tsx` | Landing hero with CTA |
| `components/InputSection.tsx` | Card-based input form (resume, JD, profiles, key, desperation) |
| `components/ResumeCard.tsx` | Resume paste/upload with parsed-state display |
| `components/DesperationSelector.tsx` | Card-based 0-5 desperation selector |
| `components/ProviderConfig.tsx` | Provider/API key/model selection UI |
| `components/LoadingState.tsx` | Rotating status messages + shimmer |
| `components/ResultsPanel.tsx` | Tabbed results container |
| `components/sections/ReportHeader.tsx` | Report header + animated selection chance |
| `components/sections/RecruiterSimulator.tsx` | 30-second recruiter scan + tab-closing risk |
| `components/sections/ResumeCapDetector.tsx` | Claim evidence tiers with funny notes |
| `components/sections/InterviewBossFight.tsx` | 5-question interview boss fight with reveal mechanic |
| `components/sections/VerdictCard.tsx` | Verdict status + witty caption + summary |
| `components/sections/ScoreBreakdown.tsx` | Six-metric score grid |
| `components/sections/ComparativeAnalysis.tsx` | Matches / problems / fatal gaps |
| `components/sections/ResumeOptimization.tsx` | PROBLEM to FIX change list |
| `components/sections/ProfileSynthesis.tsx` | LinkedIn/GitHub evidence |
| `components/sections/StrategySection.tsx` | Lead with / De-emphasize / Fix before applying |
| `components/sections/AuraCheck.tsx` | Troll verdict section |
| `components/sections/ReportActions.tsx` | Rewrite / Interview prep / Copy report CTAs |
| `app/api/analyze/route.ts` | Server-side analysis endpoint |
| `app/api/parse-pdf/route.ts` | PDF text extraction endpoint |
| `app/api/optimize-resume/route.ts` | Resume optimizer (Truth Filter rewrite) |
| `app/api/translate-jd/route.ts` | Corporate Yapping Translator endpoint |
| `lib/ai.ts` | Multi-provider AI client factory |
| `components/ApiKeyInput.tsx` | Password-style API key input |
| `components/ResumeRewriteModal.tsx` | Optimizer modal: ORIGINAL / OPTIMIZED / WHAT CHANGED tabs + export |
| `components/CorporateYappingTranslator.tsx` | Standalone JD jargon translator card |
| `lib/prompts.ts` | System + user prompt templates |
| `lib/providers.ts` | Provider registry (models, base URLs) |
| `lib/types.ts` | Shared TypeScript interfaces |
| `lib/utils.ts` | Helpers (HTML extraction, JSON parsing, URL validation, runtime schema validation) |

## Data & Privacy Approach

- **API Keys:** User provides their own key. It is sent per-request to the API route, used server-side to call the AI provider, then **immediately discarded**. Nothing is written to disk, database, or logs.
- **No Persistence:** No database. No session storage. No cookies. Everything is ephemeral — refresh the page and it's gone.
- **No Tracking:** No analytics, no telemetry, no fingerprinting.
- **Resume/Job Data:** Processed in-memory per request. Never logged, never stored.
- **LinkedIn/GitHub:** Only public profile data is fetched via the provided URL. No OAuth, no scraping behind auth walls.

## Planned MVP Features

- [x] Multi-provider AI integration (OpenAI, Gemini, OpenRouter, Groq, DeepSeek, etc.)
- [x] Resume input (paste text or upload PDF)
- [x] Job description input (paste)
- [x] LinkedIn URL synthesis (optional)
- [x] GitHub URL synthesis (optional)
- [x] Desperation Level selector (0–5)
- [x] Selection chance estimate with explanation + verdict labels (APPLY / BORDERLINE / LONG SHOT / ABSOLUTELY COOKED)
- [x] Evidence-based fit analysis (strong / weak / none classifications)
- [x] Resume problems + concrete change list (strict no-fabrication rules)
- [x] One-click resume optimizer (Truth Filter: structure/wording/keywords only, never fabrication)
- [x] Corporate Yapping Translator (standalone JD jargon decoder)
- [x] 30-Second Recruiter Test (time-stamped scan simulation + tab-closing risk)
- [x] Resume Cap Detector (claim evidence tiers: green/yellow/red)
- [x] Interview Boss Fight (5 high-probability questions with truthful answer strategies)
- [x] Application strategy + interview risk flags
- [x] Single troll comment; all other analysis strictly professional
- [x] Clean, modern, professional UI
- [x] Copy-to-clipboard for rewritten resume
- [x] Download rewritten resume as .txt

## Out of Scope (Explicitly NOT Building)

- ❌ Authentication / user accounts
- ❌ Database / data persistence
- ❌ Billing / subscriptions / payments
- ❌ Admin dashboards / analytics panels
- ❌ Email notifications
- ❌ Third-party OAuth (LinkedIn/GitHub data is fetched via public URLs only)
- ❌ Rate limiting / API key management / key storage
- ❌ Analytics / tracking pixels
- ❌ Multi-user / team features
- ❌ Resume versioning / history
- ❌ Job application auto-submission
- ❌ Cover letter generation (maybe later, not MVP)
- ❌ Mobile app
- ❌ Localization / i18n










