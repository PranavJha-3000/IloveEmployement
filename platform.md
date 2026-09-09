# IloveEmployement - Platform Documentation

> "Ilovepdf but for getting a job"

## Product Purpose

IloveEmployement is an absurdly high-quality, humorous **employment tool suite**. It provides **28 purpose-built tools** across five categories covering the full job-search lifecycle: resume analysis, application optimization, job investigation, interview preparation, and chaotic self-assessment.

Users bring their own AI API key and pick their provider. Each tool takes what it needs (resume text, job description, LinkedIn/GitHub URLs, desperation level) and returns structured, evidence-based AI output with witty, contextual commentary. The suite shares one design system, but every tool feels purpose-built - from the 30-second recruiter scan simulation to the interview boss fight.

The tool marketplace displays 33 cards: several flagship tools are intentionally listed in more than one category, so 33 cards map to 28 unique tool routes.

### Tool Categories

| Category | Purpose | Tools |
|----------|---------|-------|
| Analyze | Diagnose fit, detect delusion, decode jargon | Resume Analyzer, Job Fit Checker, Resume Roast, Delulu Detector, ATS Checker, JD Translator |
| Optimize | Rewrite, fix, and polish application materials | Resume Rewriter, Resume Fixer, Bullet Point Fixer, LinkedIn Optimizer, Cover Letter Generator, Recruiter Message |
| Investigate | Research the job, the requirements, and the evidence | JD Red Flag Scanner, Skill Gap Analyzer, GitHub Resume Checker, Resume Truth Detector, Recruiter Simulator |
| Prepare | Get interview-ready with structured answers | Interview Prep, Interview Boss Fight, STAR Answer Builder, Tell Me About Yourself, Weakness Detector |
| Chaos | Measure employment vibes with unhinged self-awareness | Employment Aura, Rizz Score, Cooked Meter, Resume Court, ATS Boss Fight, Skill Issue |

## Core Philosophy

- **Utility over Gimmick:** The humor must never compromise the quality of the analysis. It's "actually useful resume analysis + occasionally unhinged commentary" - not "AI-generated cringe."
- **Tone & Voice:** Gen-Z slang (rizz, cooked, aura, skill issue, it's giving) is used sparingly and contextually. It is never forced into every sentence.
- **Aesthetics:** Clean, modern, professional UI. Personality comes from the copy, not a "meme-style" visual design.
- **Purpose-Built Tools:** Every tool shares the same design system, but each has its own result metaphors, copy voice, and interaction model. No SaaS-dashboard sameness.
- **Anti-Overengineering:** This is NOT a SaaS startup. No auth, billing, databases, dashboards, admin panels, subscriptions, or complex backend architecture.

## Architecture & Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3+ (App Router, React 19) |
| Language | TypeScript 5.7+ |
| Styling | Tailwind CSS v4.1+ |
| AI Integration | Vercel AI SDK (`ai` ^4.3) with multi-provider support |
| PDF Parsing | `pdf-parse` (server-side) |
| Deployment | Vercel (`iloveemployement.vercel.app`) |

### Routing Model

Every tool lives at its own standalone route (`app/<tool>/page.tsx` rendering a dedicated page component). The landing page is a tool marketplace: category tabs filter the grid, and every card deep-links to its tool's route via `router.push(tool.target)`. The registry in `lib/tools.ts` types `target` as a route path (`` `/${string}` ``), so a card cannot point anywhere but a real route. The one special case is the **JD Translator**, which the home page opens as a full-viewport overlay from the navbar/footer; `/jd-translator` also exists as a direct-link fallback.

### Multi-Provider AI Support

Users bring their **own API key** and choose their provider. Supported (from `lib/providers.ts`):

| Provider | Example Models | SDK Package |
|----------|---------------|-------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` | `@ai-sdk/openai` |
| Google Gemini | `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro` | `@ai-sdk/google` |
| OpenRouter | `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`, `meta-llama/llama-3.1-70b-instruct` | `@ai-sdk/openai-compatible` |
| Groq | `llama-3.1-70b-versatile`, `mixtral-8x7b-32768` | `@ai-sdk/openai-compatible` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` | `@ai-sdk/openai-compatible` |
| Mistral | `mistral-large-latest`, `mistral-small-latest` | `@ai-sdk/openai-compatible` |
| Together AI | `meta-llama/Llama-3.3-70B-Instruct-Turbo`, `Qwen/Qwen2.5-72B-Instruct-Turbo` | `@ai-sdk/openai-compatible` |
| xAI (Grok) | `grok-2-latest`, `grok-2-mini` | `@ai-sdk/openai-compatible` |
| Custom / Other | Any OpenAI-compatible endpoint | `@ai-sdk/openai-compatible` |

The client sends `{ provider, apiKey, model, baseUrl? }` with each request. The server builds the right AI SDK provider instance via `lib/ai.ts`, calls the model, and **never stores the key**.

## Main User Flow

```
Landing Page (Tool Marketplace)
   |
   v
Tool Card Selected
   |
   +-- Most tools -> router.push to the tool's standalone route
   +-- JD Translator -> opens as an in-page overlay (navbar/footer entry)
   |
   v
Tool Page (purpose-built component per tool)
   |  - Resume (paste text or upload PDF)   [where applicable]
   |  - Job Description (paste)             [where applicable]
   |  - LinkedIn URL (optional)             [where applicable]
   |  - GitHub URL (optional)               [where applicable]
   |  - Desperation Level (0-5)             [where applicable]
   |  - Provider + API Key + Model          [always]
   |
   v
Tool Action ("Analyze" / "Generate" / "Fight" / "Scan" / ...)
   |
   v
API Route: POST /api/<endpoint>
   |  - Validates AI config; rate-limit + timeout guards
   |  - Parses PDF if uploaded
   |  - Fetches LinkedIn/GitHub public data (when provided)
   |  - Builds structured prompt (lib/prompts.ts)
   |  - Calls the user's AI provider
   |  - Validates + normalizes the JSON response (lib/utils.ts)
   |
   v
Results Panel (tool-specific sections)
   +-- Tool-specific result metaphors (boss HP, court verdicts, aura readings, ...)
   +-- Evidence-based, actionable output
   +-- Witty, contextual commentary
```

The flagship resume-analyzer flow remains the deepest: Selection Probability, Fit Analysis, Rewritten Resume, Profile Synthesis (LinkedIn/GitHub evidence), and Application Strategy.
## The 28 Tools

| Tool | Route | What it does |
|------|-------|--------------|
| Resume Analyzer | `/resume-analyzer` | Full report: selection probability, fit analysis, rewrite, strategy |
| Resume Roast | `/resume-roast` | Brutally honest diagnosis of what a recruiter is really thinking |
| Job Fit Checker | `/job-fit-checker` | Should you apply, or are you absolutely cooked? |
| Delulu Detector | `/delulu-detector` | Career-reality check: qualified, or delulu? |
| ATS Checker | `/ats-checker` | Whether the resume robots can actually parse you |
| JD Translator | `/jd-translator` | Decode corporate yapping into human language (overlay on home) |
| Resume Rewriter | `/resume-rewriter` | Reposition real experience for the target job (truth filter on) |
| Resume Fixer | `/resume-fixer` | Fix weak sections only - no full rewrite |
| Bullet Point Fixer | `/bullet-point-fixer` | Turn weak bullets into impact statements |
| LinkedIn Optimizer | `/linkedin-optimizer` | Make your LinkedIn less NPC |
| Cover Letter Generator | `/cover-letter-generator` | Job-specific cover letter without sounding like ChatGPT |
| Recruiter Message | `/recruiter-message` | Cold message that does not immediately scream desperation |
| JD Red Flag Scanner | `/jd-red-flag-scanner` | Find the suspicious parts of the job description |
| Skill Gap Analyzer | `/skill-gap-analyzer` | See exactly what you are missing for the role |
| GitHub Resume Checker | `/github-resume-checker` | Does your GitHub actually back up your resume? |
| Resume Truth Detector | `/resume-truth-detector` | Separate actual evidence from trust-me-bro claims |
| Recruiter Simulator | `/recruiter-simulator` | What a recruiter notices in a 30-second scan |
| Interview Prep | `/interview-prep` | Questions generated from your resume and the actual JD |
| Interview Boss Fight | `/interview-boss-fight` | Get interrogated before the interviewer gets the chance |
| STAR Answer Builder | `/star-answer-builder` | Turn messy experience into interview-ready STAR answers |
| Tell Me About Yourself | `/tell-me-about-yourself` | Build the answer everyone asks and nobody prepares |
| Weakness Detector | `/weakness-detector` | Find the questions most likely to expose your gaps |
| Employment Aura | `/employment-aura` | Measure your current employment aura |
| Rizz Score | `/rizz-score` | How convincing is this application, really? |
| Cooked Meter | `/cooked-meter` | How cooked you are for this particular job |
| Resume Court | `/resume-court` | Put your resume claims on trial |
| ATS Boss Fight | `/ats-boss-fight` | Fight the robots. Again. |
| Skill Issue | `/skill-issue` | Find out exactly why you are getting rejected |

## API Routes (30)

| Group | Endpoints (all POST unless noted) |
|-------|-----------------------------------|
| Core analyzer | `/api/analyze`, `/api/parse-pdf` |
| Resume optimization | `/api/optimize-resume`, `/api/rewrite-resume`, `/api/fix-resume`, `/api/fix-bullet` |
| Analysis tools | `/api/check-ats`, `/api/roast-resume`, `/api/check-delulu`, `/api/translate-jd` |
| Job research | `/api/analyze-skill-gap`, `/api/scan-jd-red-flags` |
| Investigation | `/api/check-github-resume`, `/api/check-resume-truth`, `/api/simulate-recruiter` |
| Content generation | `/api/generate-cover-letter`, `/api/generate-recruiter-message`, `/api/optimize-linkedin` |
| Interview prep | `/api/prepare-interview`, `/api/start-boss-fight`, `/api/evaluate-boss-answer`, `/api/build-star-answer`, `/api/build-introduction`, `/api/detect-weaknesses` |
| Chaos tools | `/api/employment-aura`, `/api/rizz-score`, `/api/cooked-meter`, `/api/resume-court`, `/api/ats-boss-fight`, `/api/skill-issue` |

All AI endpoints follow the same contract: accept the tool inputs plus `config: { provider, apiKey, model, baseUrl? }`, build the prompt, call the model, validate the JSON response, and return structured data or a typed error (400 bad config, 429 rate limit, 504 timeout, 502 malformed model output, 500 unexpected).
## Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Home page - tool marketplace grid + embedded resume-analyzer flow |
| `lib/tools.ts` | Tool registry: every card's name, category, icon, accent, and route (`target`) |
| `lib/prompts.ts` | System + user prompt templates for every tool |
| `lib/ai.ts` | Multi-provider AI model factory (`createModel`) |
| `lib/providers.ts` | Provider registry (models, base URLs, docs links) |
| `lib/types.ts` | Shared TypeScript interfaces (incl. `AiRequestConfig`) |
| `lib/utils.ts` | Helpers (HTML extraction, JSON parsing, URL validation, response validation) |
| `components/layout/Header.tsx` | Sticky navbar + mobile menu (logo links home) |
| `components/layout/Footer.tsx` | Footer links (real `<Link>` navigation on every page) |
| `components/tools/ToolGrid.tsx` | Category-tabbed tool grid |
| `components/tools/ToolCard.tsx` | Marketplace card (icon tile, accent, description) |
| `components/tools/CategoryTabs.tsx` | Category filter tabs with counts |
| `components/InputSection.tsx` | Card-based analyzer input form |
| `components/ResumeCard.tsx` | Resume paste/upload with parsed-state display |
| `components/DesperationSelector.tsx` | 0-5 desperation selector |
| `components/ProviderConfig.tsx` | Provider/API key/model selection UI |
| `components/ApiKeyInput.tsx` | Password-style API key input |
| `components/LoadingState.tsx` | Rotating status messages + shimmer (per-tool copy) |
| `components/ResultsPanel.tsx` | Tabbed results container (analyzer) |
| `components/ResumeRewriteModal.tsx` | Optimizer modal: ORIGINAL / OPTIMIZED / WHAT CHANGED tabs + export |
| `components/JDTranslatorOverlay.tsx` | Full-viewport JD Translator overlay (closes on X / backdrop / Escape) |
| `components/CorporateYappingTranslator.tsx` | JD jargon translator card (JD Translator, tab 1) |
| `components/ContactForm.tsx` | Suggestions form on the home page (mailto draft, no backend) |
| `components/<Tool>Page.tsx` | One purpose-built page component per tool (28 total) |
| `components/sections/*` | Result sections - shared (ReportHeader, VerdictCard, ScoreBreakdown, ...) and tool-specific (RoastLevel, DeluluScore, FitVerdict, AtsScore, ...) |

## Data & Privacy Approach

- **API Keys:** User provides their own key. It is sent per-request to the API route, used server-side to call the AI provider, then **immediately discarded**. Nothing is written to disk, database, or logs.
- **No Persistence:** No database. No session storage. No cookies. Everything is ephemeral - refresh the page and it's gone.
- **No Tracking:** No analytics, no telemetry, no fingerprinting.
- **Resume/Job Data:** Processed in-memory per request. Never logged, never stored.
- **LinkedIn/GitHub:** Only public profile data is fetched via the provided URL. No OAuth, no scraping behind auth walls.

## Shipped (Current MVP)

- [x] Multi-provider AI integration (OpenAI, Gemini, OpenRouter, Groq, DeepSeek, Mistral, Together, xAI, custom)
- [x] 28 standalone tool routes + tool marketplace with category filtering
- [x] Flagship resume analyzer (selection probability, fit analysis, rewrite, strategy)
- [x] Resume input (paste text or upload PDF)
- [x] Job description input (paste)
- [x] LinkedIn URL synthesis (optional)
- [x] GitHub URL synthesis (optional)
- [x] Desperation Level selector (0-5)
- [x] Selection chance estimate + verdict labels (APPLY / BORDERLINE / LONG SHOT / ABSOLUTELY COOKED)
- [x] Evidence-based fit analysis (strong / weak / none classifications)
- [x] Resume problems + concrete change list (strict no-fabrication rules)
- [x] One-click resume optimizer (Truth Filter: structure/wording/keywords only, never fabrication)
- [x] JD Translator (corporate yapping decoder - overlay + standalone route)
- [x] 30-Second Recruiter Test (time-stamped scan simulation + tab-closing risk)
- [x] Resume Cap Detector (claim evidence tiers: green/yellow/red)
- [x] Interview Boss Fight (5 high-probability questions with truthful answer strategies)
- [x] Application strategy + interview risk flags
- [x] Cover Letter Generator (job-specific letters)
- [x] Chaos suite (Employment Aura, Rizz Score, Cooked Meter, Resume Court, ATS Boss Fight, Skill Issue)
- [x] Single troll comment; all other analysis strictly professional
- [x] Clean, modern, professional UI
- [x] Copy-to-clipboard + .txt download for rewritten resume

## Out of Scope (Explicitly NOT Building)

- [ ] Authentication / user accounts
- [ ] Database / data persistence
- [ ] Billing / subscriptions / payments
- [ ] Admin dashboards / analytics panels
- [ ] Email notifications
- [ ] Third-party OAuth (LinkedIn/GitHub data is fetched via public URLs only)
- [ ] Rate limiting / API key management / key storage
- [ ] Analytics / tracking pixels
- [ ] Multi-user / team features
- [ ] Resume versioning / history
- [ ] Job application auto-submission
- [ ] Mobile app
- [ ] Localization / i18n
