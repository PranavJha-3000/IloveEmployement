---
phase: 02-reranking
plan: 07
subsystem: evals
tags: [retrieval, rerank, decision, measurement]
requires: ["02-03", "02-06"]
provides:
  - Published evals/RETRIEVAL.md with rerank rows, paired deltas, added latency, Decision
  - DECISION.md Outcome (RERANK_ADOPTED none, APP_BASE_MODE hybrid)
  - PROJECT.md Key Decisions rows
affects: [02-08, 02-09]
key-files:
  modified:
    - evals/RETRIEVAL.md
    - evals/retrieval/DECISION.md
    - .planning/PROJECT.md
key-decisions:
  - "Reranker rejected by pre-registered rule: RERANK_ADOPTED none"
  - "App base mode stays hybrid: APP_BASE_MODE hybrid"
metrics:
  completed: 2026-11-01
---

# Phase 2 Plan 07: Published reranker measurement and decision Summary

The cross-encoder (Xenova/ms-marco-MiniLM-L-6-v2, q8) does not beat embeddings or hybrid on this dataset, so the pre-registered rule yields RERANK_ADOPTED none and APP_BASE_MODE hybrid; the app is unchanged.

## Commits

- `ecd611a` docs(02-07): publish reranker comparison (only evals/RETRIEVAL.md)
- `c7500f1` docs(02-07): record reranker decision (DECISION.md Outcome, PROJECT.md)

## Checks

- DECISION.md last changed in 901509a (predates the measurement), working tree clean, baseline.json clean, `npm run eval:retrieval -- --ci` passes before and after.
- REPRO OK: two consecutive full runs identical on overall, byType, byResume for every strategy and on decision.
- PHASE1 OK: fingerprint 1jxooun; keyword/embeddings/hybrid overall 0.349/0.593/0.580, lexical 0.655/0.641/0.664, paraphrase 0.004/0.538/0.485.
- `npm test`: 122 pass, 0 fail.
- The report header git sha (e76522c) is HEAD; the working tree also contains the user's unrelated uncommitted UI edits.

## Results (ndcg@8, overall / lexical / paraphrase)

| Strategy | Overall | Lexical | Paraphrase |
|---|---|---|---|
| keyword | 0.349 | 0.655 | 0.004 |
| embeddings | 0.593 | 0.641 | 0.538 |
| hybrid | 0.580 | 0.664 | 0.485 |
| hybrid+rerank 20 | 0.561 | 0.659 | 0.451 |
| embeddings+rerank 20 | 0.553 | 0.643 | 0.452 |
| hybrid+rerank 30 | 0.561 | 0.659 | 0.451 |
| embeddings+rerank 30 | 0.553 | 0.643 | 0.451 |

Paired overall deltas (95% CI): hybrid+rerank vs hybrid -0.019 [-0.052, +0.014], vs embeddings -0.032 [-0.067, +0.002]; embeddings+rerank vs hybrid -0.026 [-0.060, +0.007], vs embeddings -0.039 [-0.073, -0.007]; embeddings vs hybrid +0.013 [-0.004, +0.031]. Added p50/p95 (top 20): hybrid+rerank 169.49/276.89 ms, embeddings+rerank 158.98/269.08 ms (limit 150 ms p50).

Decision lines: `RERANK_ADOPTED: none`, `APP_BASE_MODE: hybrid`. Candidates fail (a) and (b) and (c).

## Latency gap investigation

Plan 02-05's 18.5 ms smoke figure was for 20 pairs of ~13-word synthetic passages. In the timed eval, passages are real resume chunks, and cost scales with token length because the batch is padded to the longest passage. A direct re-measurement with the same loader gave 20.0 ms (13 words), 52.1 ms (39 words), 120.4 ms (78 words) for 20 pairs. The ~160-170 ms added latency is consistent with real chunk lengths plus a long-tail padded batch. The timed region contains only retrieve() (tokenize, forward pass, tolist, rerank bookkeeping); there is no per-call model load and warm-up is untimed. No measurement bug found; measurement code unchanged. The latency failure is moot for the decision since (a) and (b) also fail.

## Deviations from Plan

None. Requirements not marked complete per instructions; state.* commands skipped.
