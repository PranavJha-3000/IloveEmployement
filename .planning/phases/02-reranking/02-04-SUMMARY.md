---
phase: 02-reranking
plan: 04
subsystem: retrieval
tags: [rerank, retrieval, tdd, refactor]
requires: []
provides:
  - Pure rerank core (lib/retrieval/rerank.ts) with injected PairScorer
  - rankVault and rankBySemantic extracted from retrieveVault / embeddings strategy
  - createRerankStrategy factory (evals/retrieval/strategies.ts), not yet registered
affects: [02-05, 02-07]
tech-stack:
  added: []
  patterns: [injected scorer so Node eval and browser share rerank code, fake-scorer offline tests]
key-files:
  created:
    - lib/retrieval/rerank.ts
    - tests/retrieval-rerank.test.ts
  modified:
    - lib/vault/retrieve.ts
    - evals/retrieval/strategies.ts
key-decisions:
  - "Rerank strategy requires prepare() before retrieve(); the scorer call happens inside retrieve() so timing includes scoring"
  - "Whole-resume limits (> WHOLE_RESUME_LIMIT) bypass the scorer and defer to retrieveVault"
metrics:
  duration: short
  completed: 2026-11-01
---

# Phase 2 Plan 04: Rerank core and strategy factory Summary

Environment-agnostic `rerankCandidates` (stable, validated, tail-preserving) in lib/, a behaviour-preserving `rankVault`/`rankBySemantic` extraction from retrieve.ts, and `createRerankStrategy` gated offline by fake-scorer tests.

## Commits

- Task 1 `3c55189`: rerank.ts, retrieve.ts refactor, core tests
- Task 2 `d1326c4`: createRerankStrategy, embeddings strategy onto rankBySemantic, factory tests

## Results

- `npm test`: 119 tests, 119 pass, 0 fail (includes unchanged keyword/hybrid parity and registry-order tests).
- `npm run typecheck` clean; `npm run eval:retrieval -- --ci` exits 0, "Baseline gate passed", keyword metrics unchanged.
- No rerank strategy registered in STRATEGIES; strategies.ts has no embedder/reranker/transformers import.
- Threat mitigations T-02-11 (wrong length / non-finite scores rejected) and T-02-12 (selectWithAnchor always applied) are covered by tests.

## Deviations from Plan

- [Rule 1 - Bug] Two test assertions initially passed a possibly-sync union return to `assert.rejects`, failing typecheck; wrapped in `async () =>`. Test-only fix.

## Known Stubs

None.

## Self-Check: PASSED
