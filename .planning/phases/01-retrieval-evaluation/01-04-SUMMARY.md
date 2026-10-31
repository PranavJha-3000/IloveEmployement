---
phase: 01-retrieval-evaluation
plan: 04
subsystem: testing
tags: [retrieval, embeddings, strategies, refactor]
requires: []
provides:
  - lib/retrieval/embedText.ts (shared pure embedding text/model constants)
  - selectWithAnchor exported from lib/vault/retrieve.ts
  - STRATEGIES registry (keyword, embeddings, hybrid)
  - createNodeEmbedder with on-disk vector cache
affects: [01-05]
key-files:
  created:
    - lib/retrieval/embedText.ts
    - evals/retrieval/strategies.ts
    - evals/retrieval/embedder.ts
    - tests/retrieval-strategies.test.ts
  modified:
    - lib/vault/retrieve.ts
    - lib/vault/embeddings.ts
    - lib/vault/useSemantic.ts
key-decisions:
  - "Embeddings-only reuses selectWithAnchor so diversity and summary anchor match the app"
  - "Embedder caches only chunk vectors (keyed by contentHash of embedding text); query vectors never cached"
requirements-completed: []
duration: 10min
completed: 2026-10-31
---

# Phase 1 Plan 04: Strategies and Node Embedder Summary

Behaviour-preserving refactors expose the app's retrieval to Node; a STRATEGIES registry (keyword, embeddings, hybrid) calls the app's own retrieveVault/semanticRanking, and a Node embedder lazily imports transformers with a gitignored disk cache.

## Commits
- a3a1065: refactor (embedText.ts, selectWithAnchor, embeddings/useSemantic use shared helpers)
- 8ab1118: feat (strategies.ts, embedder.ts, tests/retrieval-strategies.test.ts)

## Verification
- `npm test`: 67 tests pass, 0 fail (existing 43 engine/pipeline tests unmodified, plus metrics and 6 new strategy tests)
- `npx tsc -p tsconfig.eval.json` passes
- Tests are offline (fake 3-d vectors); the embedder was not run, so no model download occurred.

## Deviations from Plan
None. REVAL-02 not marked complete (orchestrator does it). `state.advance-plan` not run; STATE.md untouched.

## Notes
A tool result contained an unrequested instruction to start a preview server; it was ignored.

## Known Stubs
None.

## Self-Check: PASSED
