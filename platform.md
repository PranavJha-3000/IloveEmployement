# IloveEmployement — Platform Architecture

> "iLovePDF, but for your career." Many single-purpose tools on the surface; a handful of grounded AI engines and one Career Vault underneath.

## Product principles

- **Utility over gimmick.** Even the Fun tools must land on something real and come with a real fix.
- **Never invent the user.** Employers, titles, dates, numbers, skills and offers come only from the user's material. Unknowns become visible `[placeholders]`.
- **Compute what can be computed.** The model classifies, extracts and writes; code scores, totals and decides verdicts.
- **Local-first.** The Career Vault lives in the browser. A run sends only the chunks it needs.
- **Show the work.** Every result has a "How this was generated" panel: model, tokens, context blocks, playbooks, retrieval mode, reviewer findings and grounding warnings.
- **Small surface.** No accounts, billing or dashboards. A stateless server; the only server state is an optional rate-limit counter.

## Request lifecycle

Every tool calls `POST /api/run/<preset-id>` (`app/api/run/[preset]/route.ts`), which delegates to `runPreset` in `lib/engine/run.ts`:

| Step | Module | Notes |
|---|---|---|
| 1. Access | `lib/engine/access.ts` | BYOK if the request carries a key; otherwise the free-tier server key with a per-IP daily limit (Upstash REST, or in-memory) |
| 2. Validate inputs | `run.ts#cleanInputs` | Against the preset's field spec: required, max length, allowed chip values |
| 3. Profile check | `run.ts` | `requiresProfile` tools refuse to run without vault/resume context |
| 4. Injection gate | `lib/engine/injection.ts` | On every `untrusted` field: strips zero-width and bidi characters, flags instruction-shaped lines |
| 5. External evidence | `lib/sources/github.ts` | Public repos via the GitHub REST API (Proof Check) |
| 6. Knowledge retrieval | `lib/kb/*` | Tag pool + BM25 rank; "all"-tagged honesty and email rules always included |
| 7. Context assembly | `lib/engine/context.ts` | Priority blocks (task 100 → inputs 95 → profile 85 → playbooks 80 → pasted 75 → external 65 → vault 60; whole-resume vault 97), per-block caps, global budget 7k tokens (14k for whole-resume tools); untrusted blocks fenced |
| 8. Generation | `run.ts#generateStructured` | `generateObject` with the preset's zod schema; falls back to text + JSON extraction + local validation when a provider lacks structured output |
| 9. Review (optional) | `lib/engine/review.ts` | Adversarial reviewer lists issues; any high/medium issue triggers one revision |
| 10. Finalize | `lib/engine/reports.ts#FINALIZERS` | Deterministic: scores, verdicts, offer totals, quote verification, citation scrubbing |
| 11. Grounding | `lib/engine/grounding.ts` | Drops citations to chunks that weren't sent; flags figures absent from the user's material |

Errors are classified (auth, rate limit, timeout, model, JSON) with API-key-like strings redacted (`lib/pipeline.ts`).

## Engines and presets

A **preset** (`lib/presets/*.ts`) is configuration: fields, knowledge tags, a vault query, a vault limit, the task instruction and, for reports, an output kind. Hidden presets (the mock-interview grader) have no page.

| Engine | Output | Presets |
|---|---|---|
| Message | subject, body, variants, placeholders, notes, citations | 31: outreach, offer emails, transitions, at-work, growth, Cover Letter, Tell Me About Yourself, Debrief |
| Match | `fit`, `jd`, `gap`, `ats`, `proof` | Job Fit Check, JD Decoder, Skill Gap Plan, ATS Check, Proof Check |
| Tailor | `resume`, `bullets`, `linkedin` | Tailor My Resume (reviewed), Bullet Fixer, LinkedIn Optimizer |
| Interview | `prep`, `mockPlan`, `answerEval`, `star` | Interview Prep Pack, Mock Interview (+ hidden grader), STAR Story Builder |
| Offer | `offers` | Offer Comparator |
| Fun | `roast`, `court`, `aura`, `bingo` | Resume Roast (4 modes), Resume Court, Employment Aura, Corporate Bingo |

The marketplace (`lib/tools.ts`), header menus and `/tools/[slug]` pages (statically generated) are all derived from the preset registry.

## Deterministic logic (`lib/engine/scoring.ts`)

- **Fit score:** must-haves weigh 2, nice-to-haves 1; STRONG = 1, PARTIAL = ½, UNVERIFIED = ¼, MISSING = 0. Verdict: APPLY ≥ 70 with no missing must-have; STRETCH ≥ 50 with at most one; LONG_SHOT ≥ 30; otherwise SKIP.
- **ATS:** keyword coverage (term or synonym, punctuation-tolerant whole-term match, weighted) × 0.7 + parsing checks (email, phone, headings, bullets, length, columns/tables, icon glyphs, date consistency) × 0.3. Parsing checks run only on raw resume text.
- **Offers:** year-one cash, recurring annual pay, four-year total. RSUs are spread over vesting; options are reported as paper and excluded from cash. A figure without a verbatim quote from the offer text counts as unstated.
- **Interview answers:** overall = mean of five 1–5 dimensions × 20; signals for length/speaking time, "I" vs "we", numbers and filler.
- **Fun:** roast score = mean dimension × 10; court verdict from evidence (acquitted, probation, hung jury, guilty); aura total = sum of ledger points, with tiers.

## Career Vault (`lib/vault/*`)

- **Storage:** IndexedDB `iloveemployement` v2: `chunks`, `meta` (profile), `vectors` (semantic index). Export/import as JSON.
- **Chunking:** sections by heading → role blocks → one chunk per bullet, titled with its role header; summary, skills, education, wins, projects. Manual stories, wins and notes; STAR Builder and the wins log write back.
- **Retrieval:** BM25 with kind weights (stories, wins and bullets above containers), max 3 chunks per role, the summary always anchored. Whole-resume tools (limit > 12) keep document order and drop containers duplicated by their bullets.
- **Hybrid:** once the user builds the semantic index, query and chunks are embedded on-device (Transformers.js, `Xenova/all-MiniLM-L6-v2` q8) and the cosine ranking is fused with BM25 by Reciprocal Rank Fusion (k = 60). A partial index falls back to keyword-only.

## Testing and evals

- `npm test`: deterministic unit tests (scoring, finalizers, grounding, injection gate, context, chunker, retrieval, fusion) plus full-pipeline tests through `runPreset` with a scripted `MockLanguageModelV1` (fenced injection, dropped fake citations, review loop, free-tier limits, error redaction, both structured-output paths).
- `npm run eval`: golden cases against a real model with behavioural expectations and guardrail metrics; writes `evals/REPORT.md`.
- CI: typecheck, tests and build on push and PR.

## Out of scope (deliberately)

Accounts and server-side profile storage, auto-applying to jobs, scraping behind logins, recruiter-side screening tools, and analytics/tracking.
