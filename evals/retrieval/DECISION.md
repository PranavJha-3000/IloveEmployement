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

Not yet measured. Plan 02-07 fills this section from the generated Decision section of evals/RETRIEVAL.md.
