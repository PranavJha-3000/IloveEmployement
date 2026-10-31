---
phase: 02-reranking
plan: 06
subsystem: evals
tags: [retrieval, rerank, paired-bootstrap, report]
requires: ["02-01", "02-02", "02-03", "02-05"]
provides:
  - RetrievalRunResult.rerankModel, embeddingCache, bootstrap, comparisons, addedLatency, decision
  - Report sections Paired deltas, Added latency, Decision
affects: [02-07]
key-files:
  modified:
    - evals/retrieval/run.ts
    - evals/retrieval/report.ts
    - tests/retrieval-report.test.ts
key-decisions:
  - "decision is non-null only when keyword, embeddings, hybrid, hybrid+rerank and embeddings+rerank are all selected; --ci and partial runs carry null"
metrics:
  completed: 2026-11-01
---

# Phase 2 Plan 06: Runner comparisons, added latency, decision output Summary

The runner now computes paired ndcg@8 bootstrap deltas (overall, lexical, paraphrase), added latency versus each base and the mechanical decide() output into the results JSON, and report.ts renders them with the reranker rows, with no hand-typed numbers.

## Commits

- `7350233` feat(02-06): run.ts, report.ts and the extended report test in one commit (the two tasks were coupled by the shared result type, so they were committed together).

## Verification

- `npm test`: 122 tests, 122 pass, 0 fail
- `npm run typecheck` clean
- `npm run eval:retrieval -- --ci`: "Baseline gate passed"; results JSON has `decision: null`, `rerankModel: null`, `comparisons: []`
- Trial full run (report written to the scratchpad temp dir, not the repo): exit 0, report has "## Paired deltas (ndcg@8)", "## Added latency", "## Decision", the "Hybrid + cross-encoder rerank (top 20)" row, and the console printed a `DECISION rerank=... baseMode=...` line. The numbers are trial only and are not recorded in any committed file; 02-07 produces the published run.
- evals/RETRIEVAL.md and baseline.json unchanged.

## Deviations from Plan

None - plan executed exactly as written (single commit for both tasks).

## Known Stubs

None.

## Self-Check: PASSED
