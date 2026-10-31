---
phase: 01-retrieval-evaluation
plan: 01
subsystem: testing
tags: [retrieval, eval, dataset, bm25, chunker]
requires: []
provides:
  - Retrieval eval dataset types, resolver and validator (resolveDataset/loadDataset/DatasetError)
  - Three synthetic resumes (RESUMES) chunking to 31/25/28 chunks
  - Chunk dump CLI for labelling
affects: [01-02, 01-03, 01-04, 01-05]
tech-stack:
  added: []
  patterns: [stable-key labels (kind + text fragment) resolved to random chunk ids at load time, aggregated validation errors]
key-files:
  created:
    - evals/retrieval/dataset/types.ts
    - evals/retrieval/dataset/load.ts
    - evals/retrieval/dataset/resumes.ts
    - evals/retrieval/dataset/queries.ts
    - evals/retrieval/dump.ts
    - tests/retrieval-dataset.test.ts
  modified: []
key-decisions:
  - "Labels resolve by kind + case-sensitive text substring; exactly one hit required"
  - "Paraphrase overlap check compares stemmed tokenize() output against chunk title + text"
requirements-completed: [REVAL-01]
duration: 15min
completed: 2026-10-31
---

# Phase 1 Plan 01: Retrieval Dataset Foundation Summary

Stable-key relevance labelling with loud aggregated validation, plus three fictional resumes (junior frontend, mid data analyst, senior ops manager) that chunk through the real `chunkResume`.

## Tasks
1. Types, resolver/validator, tests: 79e3f2d
2. Synthetic resumes, dump CLI, resume tests: 8532ffb

## Verification
- `node --test .test-build/tests/retrieval-dataset.test.js`: 9 pass, 0 fail
- Dump CLI prints junior-frontend (31 chunks), mid-data-analyst (25), senior-ops-manager (28)
- `npm run typecheck`: no errors reported

## Deviations from Plan
None. One test-authoring note: BM25 tokens are stemmed ("kubernetes" becomes "kubernet"), so the overlap test asserts on the stemmed token.

## Known Stubs
`QUERIES` in evals/retrieval/dataset/queries.ts is intentionally empty; plan 01-02 populates it. `loadDataset()` will throw the minimum-queries error until then.

## Self-Check: PASSED
