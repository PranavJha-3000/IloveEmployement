# Phase 2 decision rule: reranking and retrieval mode

This rule was committed before any reranker measurement existed. Plan 02-07 applies it without changes, mechanically, through `decide()` in `evals/retrieval/decision.ts`. The thresholds are not tuned after the fact.

## Inputs

- One full `npm run eval:retrieval` run on the Phase 1 dataset (fingerprint 1jxooun, 85 queries).
- Metric: ndcg@8 (`PRIMARY_METRIC`).
- All comparisons use full-precision values from `evals/results/retrieval-latest.json`, as rendered in the Decision section of `evals/RETRIEVAL.md`.

## Statistics

- Per-query paired delta of ndcg@8 between two strategies (same queries, same order).
- Paired bootstrap over queries: 10000 resamples, seed 20261031, mulberry32 PRNG, one PRNG seeded once per call.
- Each resample draws n indices with `Math.floor(rand() * n)` and takes the resample mean. The B means are sorted ascending. With alpha = 1 - 0.95, the 95% CI is lo = sorted[floor((alpha / 2) * B)] and hi = sorted[ceil((1 - alpha / 2) * B) - 1].
- Wins, ties and losses are counted per query with tie tolerance 1e-9.

## Rule

### R1 (rerank adoption)

Candidates are `hybrid+rerank` and `embeddings+rerank`, each reranking the top 20 candidates of its base ranking. The top 30 rows are sensitivity rows and cannot be adopted.

A candidate is eligible only if all three hold:

- (a) its overall ndcg@8 is strictly greater than the best overall ndcg@8 among keyword, embeddings and hybrid in the same run (Phase 1: embeddings 0.593);
- (b) the lower bound of the 95% CI of its paired delta versus hybrid (the shipped strategy) is strictly greater than 0;
- (c) the p50 of its per-query added latency versus its own base strategy (same run, Node, CPU) is at most 150 ms.

If no candidate is eligible, no reranker ships in the app. If both are eligible, adopt the one with the higher overall ndcg@8; on an exact tie, `hybrid+rerank`.

### R2 (base mode)

Independently of R1, the app's default (no reranker) mode switches from hybrid to embeddings-only only if embeddings' overall ndcg@8 is strictly greater than hybrid's and the lower bound of the 95% CI of the paired delta embeddings minus hybrid is strictly greater than 0. Otherwise the app stays on hybrid (no change without evidence).

### App consequence

The app's default retrieval is the R2 base mode. If R1 adopts a candidate, the reranker is an opt-in on the vault semantic-search panel; when the user opts in, retrieval uses the adopted candidate. The app's behaviour must match this outcome.

## Model

Primary: Xenova/ms-marco-MiniLM-L-6-v2 (q8). Fallback: mixedbread-ai/mxbai-rerank-xsmall-v1, only if the primary cannot load and score pairs in Node. At most two models are tried. The reason for any fallback is recorded in the Outcome.

## Outcome

Measured 2026-10-31 (report date 2026-10-31T19:00:15Z), git sha e76522c, reranker Xenova/ms-marco-MiniLM-L-6-v2 (q8, transformers 3.8.1); the primary model loaded, no fallback was used. Dataset fingerprint 1jxooun, 85 queries. Values below are copied from evals/RETRIEVAL.md.

- RERANK_ADOPTED: none
- APP_BASE_MODE: hybrid

Overall ndcg@8: keyword 0.349, embeddings 0.593, hybrid 0.580, hybrid+rerank (top 20) 0.561, embeddings+rerank (top 20) 0.553, hybrid+rerank (top 30) 0.561, embeddings+rerank (top 30) 0.553.

R1 checks (top 20):

- hybrid+rerank: (a) FAIL, 0.5607 <= best existing 0.5927. (b) FAIL, delta vs hybrid -0.019, 95% CI [-0.052, +0.014]; versus embeddings -0.032, CI [-0.067, +0.002]. (c) FAIL, added p50 169.49 ms (p95 276.89 ms) exceeds 150 ms.
- embeddings+rerank: (a) FAIL, 0.5533 <= best existing 0.5927. (b) FAIL, delta vs hybrid -0.026, 95% CI [-0.060, +0.007]; versus embeddings -0.039, CI [-0.073, -0.007]. (c) FAIL, added p50 158.98 ms (p95 269.08 ms) exceeds 150 ms.
- Top 30 sensitivity (not eligible by rule): hybrid+rerank@30 0.561, delta vs hybrid -0.019 CI [-0.052, +0.014], added p50 166.65 ms; embeddings+rerank@30 0.553, delta vs hybrid -0.027 CI [-0.060, +0.006], added p50 163.46 ms.

R2: embeddings minus hybrid +0.013, 95% CI [-0.004, +0.031] (CI includes 0), so the app stays on hybrid.

App consequence: no reranker ships in the app (not even as an opt-in) and the default retrieval stays hybrid, so the app is unchanged.
