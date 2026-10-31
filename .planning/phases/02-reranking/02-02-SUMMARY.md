---
phase: 02-reranking
plan: 02
subsystem: testing
tags: [retrieval, eval, embedding-cache, report]
requires: []
provides:
  - embeddingCacheFile, embeddingEntryKey, isValidVector, sanitizeCache, EMBEDDING_DIM
  - report method notes for WR-04, IN-02, IN-04
affects: [02-reranking]
key-files:
  modified:
    - evals/retrieval/embedder.ts
    - evals/retrieval/report.ts
  created:
    - tests/retrieval-embedder-cache.test.ts
    - tests/retrieval-report.test.ts
key-decisions:
  - "Cache file name binds model, dtype, pooling, normalize, transformers version, cache version via hashed config"
requirements-completed: []
duration: 15min
completed: 2026-11-01
---

# Phase 2 Plan 02: Embedding cache and report honesty Summary

Node embedding cache is now keyed by full pipeline config with sha256 entry keys and shape-validated vectors, and the report states that paraphrase BM25 ~0 is by construction, that the summary anchor caps MRR/nDCG, and how latency is really measured (closes WR-06, WR-04, IN-02, IN-04).

## Commits
- 07ada50: embedder cache hardening plus offline tests
- 39aa96f: report.ts method notes plus renderReport fixture test

## Deviations from Plan
- [Rule 1] A TypeScript narrowing error (`never`.length) in the invalid-vector error message was fixed by typing the value as unknown. Otherwise none.

## Verification
`npm test`: 91 pass, 0 fail. RETRIEVAL.md, embedText.ts, fusion.ts unchanged. No stubs. Embedder not run; old cache file name no longer matches, so the next full run recomputes vectors once (expected). User uncommitted files untouched.

## Self-Check: PASSED
