---
phase: 02-reranking
reviewed: 2026-11-01T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - evals/retrieval/baseline.ts
  - evals/retrieval/decision.ts
  - evals/retrieval/stats.ts
  - evals/retrieval/embedder.ts
  - evals/retrieval/report.ts
  - evals/retrieval/rerank-smoke.ts
  - evals/retrieval/reranker.ts
  - evals/retrieval/run.ts
  - evals/retrieval/strategies.ts
  - lib/retrieval/rerank.ts
  - lib/vault/retrieve.ts
  - tests/retrieval-baseline.test.ts
  - tests/retrieval-decision.test.ts
  - tests/retrieval-embedder-cache.test.ts
  - tests/retrieval-report.test.ts
  - tests/retrieval-rerank.test.ts
  - tests/retrieval-strategies.test.ts
findings:
  critical: 1
  warning: 6
  info: 7
  total: 14
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

I reviewed the Phase 2 reranking work: the seeded bootstrap, the decision rule, the Node cross-encoder, the shared rerank core, the `lib/vault/retrieve.ts` extraction, the eval runner and report, and the tests. I also checked whether Phase 1 findings WR-02..WR-06 are closed.

These parts are correct:

- **Paired bootstrap** (`stats.ts`). Deltas are computed per query before resampling, so pairing holds. mulberry32 is seeded once per call. `Float64Array.prototype.sort` sorts numerically. The percentile indices for B=10000 and 95% come out to 250 and 9749 (checked in Node, no float drift). The function is deterministic, and NaN and Infinity inputs throw.
- **`decide()` against DECISION.md**. R1 (a) uses a strict `>` against the best of keyword/embeddings/hybrid. R1 (b) is `lo > 0` versus hybrid. R1 (c) is p50 of per-query added latency versus the candidate's own base, `<= 150`. On a tie the strict `>` keeps `hybrid+rerank`, and @30 rows are never considered. R2 requires both a strict mean win and `lo > 0`. The code matches the document.
- **Cross-encoder scoring**. The tokenizer gets query as text and passage as `text_pair`, which is the right order for ms-marco. Padding and truncation are on. A `[n,1]` logit is used raw, which is fine because sigmoid is monotonic and not needed for ranking. The output length is checked.
- **Rerank selection rules**. The summary is excluded from `ranked` and re-anchored by `selectWithAnchor`. The 3-per-title cap runs after reranking. The sort is stable on ties, the tail keeps its place, and the input is not mutated.
- **`lib/vault/retrieve.ts` extraction**. This is a pure refactor. `retrieveVault` is now `rankVault` + `selectWithAnchor` with the same logic. The two app callers (`components/engine/PresetRunner.tsx:196`, `components/engine/MockSession.tsx:67`) are unchanged, and a parity test pins the behaviour.
- **Phase 1 findings**. WR-02, WR-05 and WR-06 are closed. I confirmed that the compiled `.test-build/evals/retrieval/strategies.js` is CommonJS, so the WR-05 regex can fail. WR-03 is only partly closed (WR-04 below). WR-04 is closed by documentation only (WR-05 below).

The main defect is in the latency timing region. The reranker writes a `console.log` line inside every timed `retrieve()` call, and latency is the R1 (c) gate.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `console.log` runs inside every timed rerank call and inflates the R1 (c) latency

**File:** `evals/retrieval/reranker.ts:51`, `evals/retrieval/strategies.ts:56`, `evals/retrieval/run.ts:161-163`
**Issue:** `score()` calls `log(\`logits dims [...]\`)` on every call. `loadNodeScorer` wires `onProgress` to `console.log`. `score()` runs inside `rerankCandidates`, which runs inside the `performance.now()` window in `run.ts:161-163`. So every timed rerank sample includes a write to stdout: 85 queries x 3 repeats x 4 rerank strategies, about 1000 lines. Base strategies do not log. On Windows a console/TTY write is synchronous and can take noticeable time, and that time lands entirely in "added latency", the quantity gated against the 150 ms budget. The recorded outcome failed (c) by a small margin (169.49 ms and 158.98 ms against 150 ms). The decision does not change, because (a) and (b) also fail. But the harness reports a contaminated number as authoritative, and a future re-run near the budget could be decided by terminal I/O. `rerank-smoke.ts:8-12` already de-duplicates this message, so the noise was known, but it was not removed from the timed path.
**Fix:** Log the logits shape once, at load time or on the first call, and keep it out of the scoring hot path:
```ts
let loggedDims = false;
const score: PairScorer = async (query, passages) => {
  ...
  if (!loggedDims) { loggedDims = true; log(`logits dims [${dims.join(", ")}]`); }
  return out;
};
```
Better still, run one shape-check pair inside `createNodeReranker` (untimed) and never call `log` from `score`. Then re-run `eval:retrieval` and update the DECISION.md Outcome latency figures.

## Warnings

### WR-01: The top-N and candidate list are hardcoded in four places with nothing keeping them in sync

**File:** `evals/retrieval/decision.ts:13`, `lib/retrieval/rerank.ts:13`, `evals/retrieval/run.ts:209`, `evals/retrieval/run.ts:212`, `evals/retrieval/strategies.ts:97,104`
**Issue:**
- `RERANK_TOP_N = 20` is declared separately in `decision.ts` and `lib/retrieval/rerank.ts`. `decide()` only uses its copy in the reason text.
- The strategies use the lib constant. `run.ts:212` hardcodes `20` for non-`@` ids, `run.ts:209` re-lists `decisionIds` instead of using `EXISTING_STRATEGIES`/`RERANK_CANDIDATES`, and the labels hardcode "(top 20)".

If someone changes the lib `RERANK_TOP_N`, candidates silently rerank a different N. `decide()`, the report ("top N 20") and the DECISION.md "top 20" assertion would all still say 20. The pre-registered parameter is not enforced.
**Fix:** In `decision.ts`, `import { RERANK_TOP_N } from "../../lib/retrieval/rerank"` and re-export it. Build `decisionIds` from `[...EXISTING_STRATEGIES, ...RERANK_CANDIDATES.map(c => c.id)]`. Have `createRerankStrategy` expose `topN` so `run.ts` reads it instead of parsing ids. Optionally assert `RERANK_TOP_N === 20` in the DECISION.md constants test.

### WR-02: `addedLatency` pairs queries by index without checking query ids

**File:** `evals/retrieval/decision.ts:103-108`
**Issue:** `pairedComparison` checks that both runs have the same query ids in the same order. `addedLatency` only checks the length, then subtracts `base.perQuery[i].totalMs` by position. If `decide()` gets a reordered or filtered results JSON (it is described as a pure function of the results JSON, so it may be re-run offline), the latency check compares different queries and still passes.
**Fix:** Reuse the same guard:
```ts
if (s.perQuery.length !== base.perQuery.length || s.perQuery.some((q, i) => q.id !== base.perQuery[i].id))
  throw new Error(`addedLatency: ${s.id} and ${base.id} have different query order or length`);
```

### WR-03: For whole-resume limits, `embeddings+rerank` ignores its base strategy

**File:** `evals/retrieval/strategies.ts:145`
**Issue:** When `limit > WHOLE_RESUME_LIMIT`, every rerank strategy returns keyword `retrieveVault(chunks, query, limit)`. That matches `hybrid`, because `retrieveVault`'s whole-resume branch ignores `semanticOrder`. It does not match `embeddings`, which still goes through `rankBySemantic` + `selectWithAnchor` at any limit (`strategies.ts:80-84`). So for limits above 12, `embeddings+rerank` and `embeddings` return different sets even with an order-preserving scorer, and the "rerank of base X" premise breaks. The test "order-preserving scorer reproduces the base strategy" only runs at limit 8, and the whole-resume test only covers `hybrid`.
**Fix:** Delegate to the base strategy's behaviour for whole-resume limits, for example `return opts.base === "hybrid" ? retrieveVault(chunks, query, limit, semantic) : selectWithAnchor(...rankBySemantic(...), limit)`. Alternatively, make the embeddings strategy also use the whole-resume path. Add a limit-20 parity test for both bases.

### WR-04: Phase 1 WR-03 is only partly closed: the baseline can still be lowered without `--allow-regression`

**File:** `evals/retrieval/baseline.ts:99-103`, `evals/retrieval/baseline.ts:106`
**Issue:**
- If the existing `baseline.json` fails validation, `planBaselineUpdate` returns `write: true` with only a warning. Corrupting one key in the old baseline is therefore enough to write a lower baseline without `--allow-regression`.
- On a dataset change, the comparison overrides the fingerprint and compares new-dataset metrics against old-dataset metrics. A dataset change that raises keyword scores can hide a code regression in the same PR, which is the scenario WR-03 described.
- Nothing in CI compares `baseline.json` against the merge base, so lowering it by hand is still ungated.
**Fix:** When the old baseline is invalid, refuse (`write = false`) unless `--allow-regression` is passed. For a fingerprint change, require `--allow-regression` (or a separate `--dataset-changed` flag), so a reviewer always sees a deliberate re-record. Optionally, add a CI step that diffs `baseline.json` against `origin/main` and fails on any decrease without a fingerprint change.

### WR-05: Phase 1 WR-04 is closed only in the report: the paraphrase gate scope still can never fire

**File:** `evals/retrieval/baseline.ts:29-33`
**Issue:** The fix added an explanatory paragraph to the report (`report.ts:69`). But `compareToBaseline` still checks the `paraphrase` scope, which is about 0 by construction, so `cur < 0 - 0.005` can never be true. The gate prints "Baseline gate passed" across three scopes and still overstates its coverage, which is the first half of WR-04.
**Fix:** Gate keyword on `overall` and `lexical` only (keep paraphrase in the baseline file for reporting), or skip the paraphrase scope in `compareToBaseline` with a comment that it is dead by construction. Update the baseline tests to match.

### WR-06: A NaN in an existing strategy's metric makes R1 (a) fail open

**File:** `evals/retrieval/decision.ts:126-130`, `evals/retrieval/decision.ts:138`
**Issue:** `v > bestExisting.value` is false for NaN, so a NaN overall metric is silently skipped. If all three existing strategies are NaN (for example from a broken aggregate), `bestExisting` stays `{ id: "", value: -Infinity }` and every candidate "beats best". The rest of the phase was hardened to fail closed on non-finite metrics (WR-02, `pairedBootstrapCI`), but `decide()` was not. Non-finite per-query metrics do throw in the bootstrap, but `overall` values are never validated.
**Fix:** At the top of `decide()`, check every required strategy's `overall[metric]`:
```ts
for (const id of required) {
  const v = need(id).overall[metric];
  if (!Number.isFinite(v)) throw new Error(`decide: ${id} ${metric} is not finite (${v})`);
}
```

## Info

### IN-01: `pairedBootstrapCI` does not validate `iterations` or `confidence`

**File:** `evals/retrieval/stats.ts:23-40`
**Issue:** `iterations: 0` returns `lo`/`hi` as `undefined` (typed as `number`). `confidence` outside (0,1) indexes out of range. Today it is only called with constants, but it is exported.
**Fix:** Throw unless `Number.isInteger(iterations) && iterations > 0 && confidence > 0 && confidence < 1`.

### IN-02: The two-logit branch assumes label 1 means relevant

**File:** `evals/retrieval/reranker.ts:47`
**Issue:** `dims[1] === 2 -> r[1]` is an unverified assumption, because neither the primary nor the fallback model has two outputs. It should read the model's `config.id2label`, or fail loudly instead of guessing.
**Fix:** Remove the branch (throw on anything except `[n,1]`), or resolve the positive index from `id2label`.

### IN-03: A failed scorer load stays cached forever in each rerank strategy

**File:** `evals/retrieval/strategies.ts:133`
**Issue:** `loadNodeScorer` clears `scorerMemo` on failure, but `loading ??= opts.loadScorer()` keeps the rejected promise per strategy, so a retry is impossible. The two memo layers behave inconsistently.
**Fix:** `loading = opts.loadScorer().catch((e) => { loading = undefined; throw e; })`.

### IN-04: New lib exports are not used by the app

**File:** `lib/vault/retrieve.ts:85`, `lib/retrieval/rerank.ts`
**Issue:** `rankBySemantic` and the whole rerank module are imported only by evals and tests. That is acceptable given the "no reranker ships" outcome, but they are untracked app surface.
**Fix:** Note in the header that they are eval-only until a decision adopts them, or move them under `evals/` until then.

### IN-05: Phase 1 IN-01 is still open: eval limit hardcoded to 8

**File:** `evals/retrieval/run.ts:143,162`
**Issue:** The limit is the literal `8`, while the report says "Limit 8 = DEFAULT_VAULT_LIMIT".
**Fix:** Import `DEFAULT_VAULT_LIMIT`.

### IN-06: Report headings hardcode values that come from config

**File:** `evals/retrieval/report.ts:91,98,109`
**Issue:** "Paired deltas (ndcg@8)", the "95% CI" column header and "applies to the top 20" are literals, while the text next to them uses `result.primaryMetric`/`result.bootstrap.confidence`.
**Fix:** Interpolate those values.

### IN-07: Test gaps around the decision boundaries and import isolation

**File:** `tests/retrieval-decision.test.ts:127-131,179-188`, `tests/retrieval-strategies.test.ts:77-83`
**Issue:**
- The latency test uses 151 ms but never pins that exactly 150 ms is accepted (`<=`).
- There is no `lo == 0` case to pin the strict `>` for (b).
- The DECISION.md constants test is a substring search (`md.includes("10000")` would match any number containing those digits).
- The isolation test only catches direct static imports from `strategies.ts`, not a transitive one through `lib/`.
- `tests/retrieval-decision.test.ts:85` builds its fixture through a no-op `slice` + spread.

**Fix:** Add the boundary cases. Match exact phrases in DECISION.md (for example `/10000 resamples, seed 20261031/`). For isolation, optionally spawn `node` with a resolve hook that throws on `@huggingface/transformers` and `require` the compiled strategies module.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
