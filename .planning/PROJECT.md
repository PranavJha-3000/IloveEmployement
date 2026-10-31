# iLoveEmployment

## What This Is

"iLovePDF, but for your career": 46 focused job-search and workplace tools (fit checks, resume tailoring, outreach, interview prep, offer comparison, resignation letters, fun roasts) built on six shared AI engines and one local-first Career Vault. It serves job seekers who want speed without AI inventing their experience, and it doubles as the author's resume showcase for RAG, context engineering and applied AI engineering.

## Core Value

Nothing about the user gets invented: every generated claim traces to the user's own material, and every quality claim the project makes about itself is backed by a measured number.

## Requirements

### Validated

<!-- Shipped in PR #1 (feat/engine-restructure), verified by tests and browser checks; not yet verified against a live model. -->

- ✓ Six engines (message, match, tailor, interview, offer, fun) with 46 public presets on one route and one page template
- ✓ Career Vault in IndexedDB with structure-aware chunking, BM25 retrieval, opt-in on-device embeddings and RRF hybrid fusion
- ✓ Knowledge-base RAG (37 playbooks), token-budgeted context assembler, untrusted-text fencing, injection gate
- ✓ Deterministic scoring (fit, ATS, offers, interview signals, fun) and grounding finalizers (citation scrubbing, verbatim quotes, invented-figure check)
- ✓ Drafter → reviewer → revise loop on resume and cover letter
- ✓ Free tier with per-IP limit or bring-your-own-key across 9 providers
- ✓ 43 tests (unit + pipeline with a scripted model), 10-case behavioural eval harness, CI
- ✓ Retrieval evaluation: 85 graded queries over 3 synthetic resumes, recall@k / MRR / nDCG per strategy in `evals/RETRIEVAL.md`, keyword baseline gated in CI — Validated in Phase 1: Retrieval Evaluation
- ✓ Reranker evaluated against a pre-registered rule (paired bootstrap CI, latency budget) and rejected with recorded numbers; app stays on hybrid — Validated in Phase 2: Reranking

### Active

<!-- Milestone: AI engineering depth. Each item must end in a measured, publishable result. -->

- [ ] Real-model eval runs with model comparison, cost, citation precision and a calibrated LLM judge
- [ ] Bounded tool-calling "Apply to this job" agent workflow with human approval checkpoints
- [ ] Structured profile extraction with skill normalization and resume versions
- [ ] Per-run observability traces

### Out of Scope

- Hosted vector database — vault is local-first and small; brute-force cosine in IndexedDB is the right tool at this scale
- Queues / async workers — every run is a single bounded request; no workload needs them
- OCR — scanned resumes are rare; text extraction from PDF/DOCX covers real users
- Recommendation systems / training models for show — only measured, honest ML (retrieval quality, calibration)
- Accounts and server-side profile storage — breaks the local-first privacy promise
- Auto-applying to jobs, scraping behind logins — ethics and ToS

## Context

- Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind v4, Vercel AI SDK 4.3, zod, Transformers.js (`Xenova/all-MiniLM-L6-v2`), IndexedDB, node test runner, GitHub Actions.
- Architecture reference: `platform.md`; history: `docs/RESTRUCTURE_PLAN.md`; graph: `graphify-out/`.
- Key seams: `setModelFactory` (lib/engine/run.ts) for scripted models; `retrieveVault(chunks, query, limit, semanticOrder?)` (lib/vault/retrieve.ts); `reciprocalRankFusion` (lib/retrieval/fusion.ts); LLM eval harness `evals/llm/run.ts` + `evals/cases.ts`; retrieval eval `evals/retrieval/run.ts`.
- Known gap: no live model output has ever been verified. The app has no logging.
- PR #1 (feat/engine-restructure → main) is open; there are uncommitted UI changes in the working tree that are not part of this milestone.

## Constraints

- **Privacy**: Vault data and embeddings stay on-device; only top-k chunks leave the browser — core product promise
- **Budget**: Free-tier model keys (e.g. Gemini) for evals; anything that needs no key should run in CI
- **Honesty**: Resume claims must come from reproducible scripts in the repo, not hand-picked runs
- **Bundle**: Heavy models (embedder, reranker) lazy-load only on opt-in; first-load JS unchanged

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Engines + presets instead of per-tool pages | One pipeline gets every guardrail; adding a tool is config | ✓ Good |
| Local-first vault, BYOK + free tier | Privacy and zero-account onboarding | ✓ Good |
| Scores computed in code, model only classifies | Explainable, testable, no vibe scores | ✓ Good |
| Measure retrieval before adding a reranker | Avoid features that can't show a win | ✓ Good — Phase 1: embeddings-only nDCG@8 0.593 beats shipped hybrid RRF 0.580 overall (hybrid wins lexical 0.664 vs 0.641, loses paraphrase 0.485 vs 0.538); Phase 2 must beat 0.593 |
| Paraphrase queries share no keywords with targets | Isolates semantic recall | ⚠️ Revisit — makes BM25 paraphrase score 0 by construction (review WR-04); report as an upper bound, not a finding |
| Agent workflow composes existing engines as tools | Reuses guardrails; bounded steps keep it testable | — Pending |
| On-device cross-encoder reranker (Phase 2) | Pre-registered rule in evals/retrieval/DECISION.md: beat best existing ndcg@8, CI of delta vs shipped hybrid excludes 0, p50 added latency <= 150 ms at top 20 | Rejected — best variant hybrid+rerank ndcg@8 0.561 vs hybrid 0.580 (delta -0.019, 95% CI [-0.052, +0.014]), added p50 168.5 ms; nothing ships |
| App retrieval mode after Phase 2 | Phase 1 + 2 data, rule R2 (embeddings must beat hybrid with CI excluding 0) | Stay on hybrid — embeddings minus hybrid +0.013, 95% CI [-0.004, +0.031] includes 0 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-01 after Phase 2 (Reranking)*
