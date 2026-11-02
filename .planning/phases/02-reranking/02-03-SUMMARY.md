---
phase: 02-reranking
plan: 03
subsystem: evals
tags: [retrieval, decision-rule, bootstrap, tdd]
requires: []
provides:
  - Pre-registered decision rule (evals/retrieval/DECISION.md)
  - mulberry32 and pairedBootstrapCI (evals/retrieval/stats.ts)
  - pairedComparison, addedLatency, decide and rule constants (evals/retrieval/decision.ts)
affects: [02-07]
tech-stack:
  added: []
  patterns: [pre-registered rule committed before measurement, seeded percentile bootstrap]
key-files:
  created:
    - evals/retrieval/DECISION.md
    - evals/retrieval/stats.ts
    - evals/retrieval/decision.ts
    - tests/retrieval-decision.test.ts
  modified: []
key-decisions:
  - "Rule thresholds fixed as planned: beat best existing ndcg@8 (Phase 1: 0.593), CI lower bound of delta vs hybrid > 0, p50 added latency <= 150 ms at top 20; bootstrap 10000 resamples, seed 20261031"
metrics:
  duration: short
  completed: 2026-11-01
---

# Phase 2 Plan 03: Decision rule and seeded paired bootstrap Summary

Pre-registered reranker adoption and base-mode switch rule (DECISION.md) committed before any reranker measurement, implemented as a pure, deterministic `decide()` over a seeded paired bootstrap.

## Commits

- RED `901509a`: test(02-03) DECISION.md, failing tests, stubs. **DECISION.md sha: 901509ab03e59eebc75033c4898b66051b17cbce** (plan 02-07 must check this predates its measurement commit).
- GREEN `22f9907`: feat(02-03) stats.ts and decision.ts.

## Results

- RED: 13 of the 14 new tests failed against stubs, all existing tests passed.
- GREEN: `npm test` 106 tests, 106 pass, 0 fail.
- Constants cross-checked against DECISION.md by test (seed, iterations, 150 ms, ndcg@8, "top 20", "## Outcome").
- No Math.random, Date.now or readFileSync in stats.ts or decision.ts; decision.ts does not import run.ts.

## Deviations from Plan

None. One small addition: exported `RERANK_TOP_N = 20` in decision.ts, used in the human-readable reasons.

## Known Stubs

None.

## Self-Check: PASSED

Files exist, commits 901509a and 22f9907 present, no user working-tree files staged.
