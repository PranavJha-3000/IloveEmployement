---
phase: 02-reranking
fixed_at: 2026-11-01T00:00:00Z
review_path: .planning/phases/02-reranking/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-01
**Source review:** .planning/phases/02-reranking/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, WR-01..WR-06; Info findings out of scope)
- Fixed: 7 (CR-01 was already fixed before this run; WR-01..WR-06 fixed here)
- Skipped: 0

Verification after all fixes: `npm test` 129/129 pass (122 before), `npm run eval:retrieval -- --ci` passes against the unchanged `evals/retrieval/baseline.json` (keyword ndcg@8 0.349, identical to before), and `tsc --noEmit -p .` is clean. The model eval was not re-run and `evals/RETRIEVAL.md` was not regenerated.

## Fixed Issues

### CR-01: `console.log` runs inside every timed rerank call and inflates the R1 (c) latency

**Files modified:** `evals/retrieval/reranker.ts` (earlier run)
**Commit:** 5e46b43 (fix), 1e7c833 (RETRIEVAL.md and DECISION.md regenerated)
**Applied fix:** Already fixed before this run. The logits shape is logged once, outside the timed scoring path. Not redone.

### WR-01: The top-N and candidate list are hardcoded in four places with nothing keeping them in sync

**Files modified:** `evals/retrieval/decision.ts`, `evals/retrieval/strategies.ts`, `evals/retrieval/run.ts`, `tests/retrieval-decision.test.ts`
**Commit:** 449a2d5
**Applied fix:** `decision.ts` imports and re-exports `RERANK_TOP_N` from `lib/retrieval/rerank.ts`, adds `SENSITIVITY_TOP_N = 30`, carries `topN` on each `RERANK_CANDIDATES`/`SENSITIVITY_STRATEGIES` entry, and exports `DECISION_STRATEGY_IDS`. `decide()` uses that list and `c.topN` in its reason text. The rerank strategies are now built from those two lists, and `RetrievalStrategy` exposes `topN`. `run.ts` uses `DECISION_STRATEGY_IDS`, takes `rerankIds` from `topN !== undefined`, and reads `topN` from the strategy instead of parsing ids. This is a pure refactor. A new test pins the lib/decision constant equality, the ids, the `topN` values, the exact label strings (unchanged), and `top ${RERANK_TOP_N}` in DECISION.md.

### WR-02: `addedLatency` pairs queries by index without checking query ids

**Files modified:** `evals/retrieval/decision.ts`, `tests/retrieval-decision.test.ts`
**Commit:** 0c5f9f6
**Applied fix:** Uses the same guard as `pairedComparison` (same length and the same id at each index). It throws "different query order or length". New tests cover a reordered run, a filtered run and a renamed id.

### WR-03: For whole-resume limits, `embeddings+rerank` ignores its base strategy

**Files modified:** `evals/retrieval/strategies.ts`, `tests/retrieval-rerank.test.ts`
**Commit:** edf8207
**Applied fix:** Only the hybrid base takes the whole-resume shortcut, and it now calls `retrieveVault(chunks, query, limit, semantic)`, exactly like the hybrid strategy. The embeddings base has no whole-resume path and ranks at every limit, so `embeddings+rerank` now reranks at every limit too. This differs a little from the reviewer's first suggestion (return the base without reranking). It keeps "rerank of base X" true at all limits, and the order-preserving parity holds either way. Tests: parity with an order-preserving scorer at limits 5, 8, 12, 13 and 20 for both bases. A new test checks that embeddings+rerank reorders at limit 20. The hybrid bypass test now also checks equality with the hybrid strategy. The eval runs at limit 8, so no recorded number changes.
**Status:** fixed: requires human verification (this is a logic change in how the whole-resume path behaves).

### WR-04: Phase 1 WR-03 is only partly closed: the baseline can still be lowered without `--allow-regression`

**Files modified:** `evals/retrieval/baseline.ts`, `evals/retrieval/run.ts`, `tests/retrieval-baseline.test.ts`
**Commit:** 8c7d734
**Applied fix:** `planBaselineUpdate(oldRaw, next, { allowRegression, datasetChanged })` now fails closed in two cases:
- If the old baseline is invalid or unparseable, it sets `write = false` with an error unless `--allow-regression` is passed.
- If the dataset fingerprint changed, it sets `write = false` unless the new `--dataset-changed` flag is passed. `--allow-regression` alone does not count.

Drops beyond epsilon still need `--allow-regression`, so a dataset change plus a drop needs both flags. `run.ts` parses `--dataset-changed`. The `--ci` fingerprint-mismatch hint now names the flag. Tests cover every combination of the flags and three kinds of invalid baseline. The optional CI diff against `origin/main` was not added.
**Status:** fixed: requires human verification (gate semantics changed).

### WR-05: Phase 1 WR-04 is closed only in the report: the paraphrase gate scope still can never fire

**Files modified:** `evals/retrieval/baseline.ts`, `evals/retrieval/run.ts`, `evals/retrieval/report.ts`, `tests/retrieval-baseline.test.ts`, `tests/retrieval-report.test.ts`
**Commit:** c9ca128
**Applied fix:** A new constant `GATED_SCOPES = ["overall", "lexical"]` has a doc comment explaining that paraphrase keyword scores are ~0 by dataset construction, so that scope can never fire. `compareToBaseline` gates only those scopes. Paraphrase stays in `baseline.json` and `validateBaseline` still requires it, for reporting. The file format is unchanged, so the baseline was not re-recorded, and `--ci` passes against the existing file with identical values. `--ci` now prints "Baseline gate passed for keyword scopes overall, lexical (epsilon 0.005); paraphrase is not gated (keyword ~0 by construction)." The report renderer's paraphrase paragraph gains one sentence saying the same. The committed `evals/RETRIEVAL.md` does not contain that sentence until it is next regenerated (it was not regenerated, as instructed). Tests: a lexical regression is still caught, and paraphrase drops or NaN no longer trip the gate.

### WR-06: A NaN in an existing strategy's metric makes R1 (a) fail open

**Files modified:** `evals/retrieval/decision.ts`, `tests/retrieval-decision.test.ts`
**Commit:** 5fd5dec
**Applied fix:** At the top of `decide()`, every strategy in `DECISION_STRATEGY_IDS` must exist, and its `overall[DECISION_METRIC]` must be a finite number. Otherwise it throws `decide: <id> <metric> is not finite`. Tests cover NaN, +/-Infinity and undefined for each of the five required strategies, and the case where all three existing strategies are NaN.

---

_Fixed: 2026-11-01_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
