---
phase: 02-reranking
plan: 05
subsystem: retrieval
tags: [rerank, cross-encoder, transformers-js, eval]
requires: ["02-01", "02-03", "02-04"]
provides:
  - createNodeReranker (evals/retrieval/reranker.ts)
  - rerank-smoke verification script
  - Four registered rerank strategies and getRerankInfo()
affects: [02-07]
key-files:
  created:
    - evals/retrieval/reranker.ts
    - evals/retrieval/rerank-smoke.ts
  modified:
    - evals/retrieval/strategies.ts
    - tests/retrieval-strategies.test.ts
key-decisions:
  - "Primary model Xenova/ms-marco-MiniLM-L-6-v2 (q8) kept; no fallback needed"
  - "No reranker score cache so timed retrieve() includes real scoring"
metrics:
  completed: 2026-11-01
---

# Phase 2 Plan 05: Node cross-encoder loader and rerank strategies Summary

Transformers.js 3.8.1 cross-encoder loaded in Node via AutoTokenizer + AutoModelForSequenceClassification (text_pair), verified by a smoke check, and registered as four strategies sharing one lazy model load.

## Commits

- Task 1 `9c76ced`: reranker.ts, rerank-smoke.ts
- Task 2 `f9dd442`: strategies registered, registry test updated

## Smoke check results

- Model: Xenova/ms-marco-MiniLM-L-6-v2, dtype q8, transformers 3.8.1 (primary; no fallback, lib/retrieval/rerank.ts untouched)
- Load time: 4138 ms (includes first download)
- Logits dims: [n, 1] (column 0 used)
- Scores for "reduced warehouse picking errors": warehouse passage 5.6397; React tests -11.3951; marketing newsletter -11.3854 (warehouse highest, exit 0)
- Median for 20 pairs: 18.5 ms (early read only, not the measurement)

## Verification

- `npm test`: 119 tests, 119 pass, 0 fail (registry test now asserts seven ids and prepare on rerank strategies; transformers-not-loaded source test passes)
- `npm run typecheck` clean
- `npm run eval:retrieval -- --ci`: keyword only, no model loading output, "Baseline gate passed"
- evals/RETRIEVAL.md and baseline.json unchanged; evals/results stays ignored

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
