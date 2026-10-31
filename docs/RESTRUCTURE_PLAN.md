# IloveEmployement — Restructure Plan

> iLovePDF for your career: many single-purpose tools on the surface, a handful of
> grounded AI engines underneath, and one Career Vault that every tool reads from.

## Why restructure

Today the app is 28 independent tools (28 page components, 31 API routes, a
2,400-line prompt file and ~1,900 lines of hand-written validators). Every tool
starts from zero: the user re-pastes their resume each time and nothing compounds.

Community research (r/jobsearchhacks, r/resumes, r/recruitinghell,
r/cscareerquestions) points at two real pains, not a lack of generators:

1. **Repetition** — tailoring takes 1–3 hours per application.
2. **Distrust** — AI output invents experience and reads as generic; recruiters notice.

So the product promise is: *fast, tailored, and never makes things up.*

## Decisions (agreed)

| Topic | Decision |
|---|---|
| AI access | Free tier on a server key (cheap model, per-IP daily limit) **plus** BYOK for unlimited / premium models |
| Data | Local-first Career Vault in the browser (IndexedDB), export/import file, no accounts |
| Scope | Rebuild on engines + preset registry; port the good prompts; delete replaced code |
| Git | Work on `feat/engine-restructure` |

## Architecture

```
Browser (local-first)                         Server (stateless)
─────────────────────                         ──────────────────
Career Vault (IndexedDB)                      POST /api/run/[preset]
  profile · experiences · bullets · stories     1. resolve access (free tier | BYOK) + rate limit
  wins (brag doc) · applications                2. validate inputs against preset field spec
        │                                       3. injection gate on untrusted text (JDs, emails)
        ▼                                       4. retrieve knowledge-base guidance (BM25)
  hybrid retrieval (BM25 now, embeddings        5. context assembler: budgeted, labelled blocks
  next) picks the top-k chunks for the task  ─► 6. generateObject with the preset's zod schema
  only those chunks leave the browser           7. grounding check: every citation must resolve
                                                   to a supplied chunk id; unsupported claims flagged
        ◄────────────────────────────────────── 8. typed result + citations + usage
  save-back: stories / wins / applications
```

### Engines

| Engine | Job | Notes |
|---|---|---|
| **Message** | Every email / DM / letter | One schema (subject, body, variants, notes, citations); presets supply intent, tone, required fields, KB tags |
| **Match** | JD ↔ profile analysis | Ports the evidence engine (STRONG/PARTIAL/MISSING/UNVERIFIED); one analysis, many views |
| **Tailor** | Resume / cover letter / LinkedIn | Drafter → reviewer loop, per-bullet citations to vault chunks, PDF export |
| **Interview** | Prep, mock, STAR | STAR builder writes stories back into the vault |
| **Offer** | Comparison + negotiation | Total-comp math is deterministic TypeScript, the LLM only explains and scripts |
| **Growth** | Self-review, promotion case, 30-60-90 | Reads the vault's wins log |
| **Fun** | Roast, Court, Aura, Bingo | Shareable result cards — acquisition, not core |

### AI-engineering showcase (built into the product, not bolted on)

- **RAG over the Career Vault** — structure-aware chunking (role → bullet → story), hybrid retrieval, citations on generated claims.
- **Knowledge-base RAG** — curated, versioned guidance (ATS rules, negotiation playbooks, email etiquette, India notice-period/offer norms) retrieved per preset.
- **Context engineering** — a context assembler with per-block token budgets, priority ordering and labelled, delimited untrusted content.
- **Structured outputs** — zod schemas + `generateObject` replace hand-written validators.
- **Prompt-injection defence** — deterministic gate (hidden text, zero-width chars, instruction-shaped lines) before any model sees pasted content.
- **Grounding verifier** — citations must resolve to real chunk ids; claims without support are surfaced, not hidden.
- **Evals** — golden set per engine + hallucination-rate judge, runnable with `npm run eval`.

## Tool catalog (93 ideas → ~45 presets)

**Kept & merged**

- *Target*: Job Fit Check (absorbs Delulu Detector, Cooked Meter, Am I Cooked as its verdict), JD Decoder (Translator + Red Flags + Posting Quality), Skill Gap Plan, ATS Check, Company Brief
- *Materials*: Tailor Resume (Analyzer + Rewriter + Fixer), Bullet Fixer, Cover Letter, LinkedIn Optimizer, Proof Check (GitHub + Truth Detector + Portfolio), Resume Builder
- *Outreach*: Cold Recruiter Message, Referral Request, Follow-up (incl. ghosted), Thank-you Note, Rejection Reply
- *Interview*: Prep Pack (Question Bank + Weakness Detector + Recruiter Sim), Mock Interview (Boss Fight + Panel), STAR Builder, Tell Me About Yourself, Salary Expectation Script, Interview Debrief
- *Offer*: Offer Comparator (incl. Equity/RSU explainer), Negotiation Coach (counteroffer script + calculator), Accept / Decline Offer
- *Transition*: Resignation Letter (with Rage Filter), Notice Period / Joining Date Request, Reference Request, Internship Conversion Ask, Exit Interview Prep, Gap / Layoff Explainer
- *At work*: Email Tone Fixer (absorbs Passive-Aggressive Translator, Late Reply Recovery, Workplace Insult Translator), Leave / PTO Request, Corporate Speak Translator, HR Concern Write-up, Intro Message, Manager Update, 1:1 Agenda, 30-60-90 Plan
- *Growth*: Self-Review Writer, Promotion / Raise Case, Peer Feedback, Career Switch Plan
- *Fun*: Resume Roast (absorbs Rizz Score, Skill Issue, ATS Boss Fight as modes), Resume Court, Employment Aura, Corporate Bingo

**Cut**

- Meeting Excuse / WFH Excuse generators — help users deceive; erode trust in the brand.
- Firing Generator, Ghosted Candidate Callout, Rejection Generator — hiring-side or low value.
- Application Tracker Note — becomes a real tracker in the vault, not a generator.
- Recruiter-side tools (Batch Resume Ranker, Candidate GitHub Verifier) — different user; separate product later.
- Duplicates (Interview Question Bank ×2, Job Posting Quality ×2, Promotion Generator vs Pitch, Counteroffer Generator vs Negotiator).

## Phases

1. **Foundation (this branch, first)** — engine core (access, injection gate, context assembler, structured run, grounding check), knowledge base, Career Vault (IndexedDB + chunker + BM25), Message engine with ~25 presets, one SEO route per preset (`/tools/[slug]`), new catalog home, vault page.
2. **Match + Tailor** — port evidence engine and resume prompts into presets; drafter/reviewer loop; PDF export. Delete the replaced analyze/optimize/investigate pages and routes.
3. **Interview + Offer** — STAR save-back, mock interview chat, deterministic offer math. Delete replaced prepare pages.
4. **Fun + growth** — share cards; wins log; consolidate chaos tools into Roast modes and delete the rest.
5. **Quality** — in-browser embeddings (transformers.js) for hybrid retrieval, eval suite + CI, Upstash rate limiting in production, analytics-free usage counters.

## Free tier configuration

```
FREE_TIER_PROVIDER=google            # any ProviderId
FREE_TIER_API_KEY=...                # server-side only
FREE_TIER_MODEL=gemini-2.0-flash
FREE_TIER_DAILY_LIMIT=15             # runs per IP per day
UPSTASH_REDIS_REST_URL=...           # optional; in-memory limiter when unset
UPSTASH_REDIS_REST_TOKEN=...
```
