---
phase: 01-retrieval-evaluation
reviewed: 2026-10-31T14:30:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .github/workflows/ci.yml
  - evals/retrieval/baseline.ts
  - evals/retrieval/dataset/load.ts
  - evals/retrieval/dataset/types.ts
  - evals/retrieval/dump.ts
  - evals/retrieval/embedder.ts
  - evals/retrieval/metrics.ts
  - evals/retrieval/report.ts
  - evals/retrieval/run.ts
  - evals/retrieval/strategies.ts
  - lib/retrieval/embedText.ts
  - lib/vault/embeddings.ts
  - lib/vault/retrieve.ts
  - lib/vault/useSemantic.ts
  - package.json
  - tests/retrieval-baseline.test.ts
  - tests/retrieval-dataset.test.ts
  - tests/retrieval-metrics.test.ts
  - tests/retrieval-strategies.test.ts
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-31T14:30:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I traced the metrics, strategies, runner, baseline gate, embedder cache and the `lib/vault` refactor. The core pieces are correct:

- **Metrics.** `recallAtK`, `reciprocalRank` and `ndcgAtK` are correct. IDCG is built from every label with grade > 0, not only the retrieved ones (`metrics.ts:54`). Dedupe is applied before scoring. I recomputed the hand-checked nDCG value (0.7098) and it is right.
- **Strategies.** `keyword` and `hybrid` call `retrieveVault` and `semanticRanking` from `lib/` directly. `embeddings` is the only composition the app does not have, and it reuses the app's `selectWithAnchor`.
- **Refactor.** The `lib/vault` refactor keeps behaviour: `selectWithAnchor` is a straight extraction, `embeddingText` / `embeddingQuery` match the old inline expressions byte for byte, and `EMBEDDING_DTYPE` is still `"q8"`.
- **Determinism.** The keyword CI path is deterministic. BM25 and RRF sorts are stable and break ties by document order, not by the random chunk ids, so the gate should not flake.

No blockers. The problems are in what the gate actually protects, and in silent-pass paths.

## Warnings

### WR-01: The CI gate only covers keyword retrieval, so regressions in hybrid and semantic code ship ungated

**File:** `evals/retrieval/run.ts:66`, `.github/workflows/ci.yml:22`
**Issue:** `--ci` forces `requested = ["keyword"]`. Changes to `semanticRanking` (including `minScore = 0.15`), `reciprocalRankFusion`, `embeddingText` / `embeddingQuery`, or the semantic branch of `retrieveVault` (`retrieve.ts:58-63`) never affect any gated number. Only the parity unit tests use those paths, and they compare a function against itself. Phase 2 plans to adopt a reranker based on this harness, and the code it will change is exactly the code that is not gated.
**Fix:** Add a second, offline-safe gate for the fused path that does not need the model. Commit a small fixed fixture of chunk/query vectors (for example in `evals/results`-independent `evals/retrieval/fixtures/vectors.json`, generated once by the Node embedder), run `hybrid` and `embeddings` against it in `--ci`, and record their metrics in `baseline.json` next to keyword:
```ts
const requested = update || ci ? ["keyword", "hybrid", "embeddings"] : ...;
// in --ci, load committed vectors instead of calling createNodeEmbedder()
```
Or, at minimum, say clearly in `RETRIEVAL.md` and the CI comment that semantic and hybrid code is not regression-gated.

### WR-02: Missing keys or NaN metrics pass the baseline gate silently

**File:** `evals/retrieval/baseline.ts:285-289`, `evals/retrieval/run.ts:232`
**Issue:** `baseline.json` is cast with `as KeywordBaseline` and never validated. If a metric key is deleted or renamed in the baseline (for example when `METRIC_KEYS` gains a key, or after a hand edit), `base[key]` is `undefined`. Then both `cur < undefined - eps` and `cur > undefined + eps` are false, so nothing is reported and `ok` stays true. The same happens if the current run produces `NaN`, for example from a future metric dividing by zero. In both cases the gate fails open.
**Fix:**
```ts
for (const key of METRIC_KEYS) {
  const b = base[key], c = cur[key];
  if (!Number.isFinite(b) || !Number.isFinite(c)) {
    regressions.push(`${scope} ${key}: non-numeric (baseline=${b}, current=${c})`);
    continue;
  }
  ...
}
```
Also check `baseline.strategy === "keyword"` and the shape of `byType` in `run.ts` before calling `compareToBaseline`.

### WR-03: A dataset change forces a baseline rewrite, which hides any code regression made in the same PR

**File:** `evals/retrieval/baseline.ts:293-297`, `evals/retrieval/run.ts:212-223`
**Issue:** On a fingerprint mismatch, the only fix is `--update-baseline`. That re-records every metric from the current code. A PR that touches both `queries.ts` and `lib/vault/retrieve.ts` gets a new baseline that already includes the retrieval regression, and CI passes. `--update-baseline` also writes unconditionally, with no report of how far metrics moved. More generally, nothing stops a PR from lowering `baseline.json` by hand. The gate is advisory, but the CI comment says "Retrieval regression gate".
**Fix:** In `--update-baseline`, print a diff against the old baseline (reuse `compareToBaseline` and list its regressions). Refuse to lower any metric unless `--allow-regression` is passed. Optionally, in CI, compare `baseline.json` against the merge-base version (`git show origin/main:evals/retrieval/baseline.json`) and fail if a metric decreased without a matching dataset fingerprint change.

### WR-04: The paraphrase scope of the gate can never fire, and the dataset rule forces keyword to zero by construction

**File:** `evals/retrieval/dataset/load.ts:86-95`, `evals/retrieval/baseline.json:24-32`
**Issue:** The validator requires paraphrase queries to share no BM25 tokens with any labelled chunk. It uses the same `tokenize` and the same `title + text` string that `retrieveVault` indexes. So BM25 can never retrieve a labelled chunk for a paraphrase query. The keyword paraphrase baseline is therefore exactly 0 for recall and MRR, and about 0.004 for nDCG (only from the anchored summary). `cur < 0 - 0.005` can never be true, so 21 of the 21 paraphrase comparisons, and most of the "overall" signal, are dead for regression detection.

There is a second effect. 40 of the 85 queries are built so keyword scores 0. The headline "Overall" table therefore mostly reflects the query mix (keyword overall nDCG@8 is 0.349, against 0.655 on lexical queries), not real retrieval quality, and it biases any comparison toward the embedding strategies.
**Fix:** Drop the `paraphrase` scope from the keyword gate (or gate keyword on `lexical` only) so the gate does not suggest coverage it lacks. In `RETRIEVAL.md`, lead with the per-type tables and state that keyword paraphrase is 0 by construction. If a realistic mix is wanted, relax the rule to "the grade-3 chunk shares no tokens" rather than "every labelled chunk".

### WR-05: The "strategies module does not load transformers" test always passes

**File:** `tests/retrieval-strategies.test.ts:73-75`
**Issue:** The test checks `require.cache` for `@huggingface`. `embedder.ts` loads transformers through `await import(...)` inside `createNodeEmbedder`. Under `module: node16` that stays a native ESM `import()`, which never fills `require.cache`, and it only runs when the function is called. So even if `strategies.ts` imported `embedder.ts` statically (the thing this test is meant to prevent), the test would still pass.
**Fix:** Check the module graph directly:
```ts
import fs from "node:fs";
const src = fs.readFileSync(require.resolve("../evals/retrieval/strategies.js"), "utf8");
assert.ok(!/embedder|@huggingface/.test(src));
```
Alternatively, spawn `node -e "require('./.test-build/evals/retrieval/strategies.js')"` with `--experimental-loader`/`--import` and a hook that throws on resolving `@huggingface/transformers`.

### WR-06: Embedding cache key misses pipeline settings and the cache is never validated

**File:** `evals/retrieval/embedder.ts:182-211`
**Issue:**
- **Incomplete key.** The cache file name includes model and dtype, and entries are keyed by `contentHash(embeddingText(c))`. Neither covers `pooling: "mean"`, `normalize: true`, or the transformers/onnxruntime version. Changing pooling or normalization, or bumping `@huggingface/transformers` (it is pinned today, but the pin is one edit away), keeps serving stale vectors. The comparison report would then silently mix old chunk vectors with new query vectors.
- **Weak hash.** `contentHash` is a 32-bit FNV-1a, which is weak for a cache that only grows. A collision returns another chunk's vector with no error.
- **No shape check.** A truncated write is caught by the `try` and resets the cache. But valid JSON of the wrong shape, such as an array or vectors of the wrong length, is used as-is.

**Fix:** Put the full config in the cache file name or a header, and check vector length:
```ts
const CACHE_VERSION = 1;
const cfg = { model: EMBEDDING_MODEL, dtype: EMBEDDING_DTYPE, pooling: "mean", normalize: true,
  tf: require("@huggingface/transformers/package.json").version, v: CACHE_VERSION };
const cacheFile = path.join(vecDir, `${contentHash(JSON.stringify(cfg))}.json`);
// on load: discard entries where !Array.isArray(v) || v.length !== 384
```
Key entries by the full text, or by a 64-bit or larger hash such as `crypto.createHash("sha1")`, rather than the 32-bit FNV.

## Info

### IN-01: Eval limit hardcoded to 8 instead of DEFAULT_VAULT_LIMIT

**File:** `evals/retrieval/run.ts:120,139`
**Issue:** `limit: 8` is a literal, while the report claims "Limit 8 = DEFAULT_VAULT_LIMIT". If `lib/presets/types.ts:77` changes, the eval silently measures a different context size from the app. Presets that override `vaultLimit` are not measured at all.
**Fix:** `import { DEFAULT_VAULT_LIMIT } from "../../lib/presets/types";` and use it in both places. Render the value into the report from `result`.

### IN-02: The report describes latency inaccurately

**File:** `evals/retrieval/report.ts:348`, `evals/retrieval/run.ts:129-145`
**Issue:** The report says latency is "the median of N timed calls ... including the query embedding". In fact the query embedding is timed once per query, outside the repeat loop, and that single sample is added to the median retrieval time. The same `embedMs` value is also counted for both `embeddings` and `hybrid`.
**Fix:** Either repeat the embedding inside the loop, or change the wording to "median of N retrieval calls plus one query-embedding timing".

### IN-03: The report does not flag a dirty working tree

**File:** `evals/retrieval/run.ts:166-171`
**Issue:** `git rev-parse --short HEAD` is recorded without a dirty flag. A report generated from uncommitted edits (as in the current working tree) is attributed to a clean SHA.
**Fix:** Use `git describe --always --dirty` or append `-dirty` when `git status --porcelain` is non-empty.

### IN-04: Summary anchoring caps MRR and nDCG, and one query gets MRR = 1 for free

**File:** `lib/vault/retrieve.ts:85-88`, `evals/retrieval/metrics.ts:36-56`, `evals/retrieval/dataset/queries.ts`
**Issue:**
- **MRR ceiling.** The summary always takes rank 1. With a grade below 2, MRR is at most 0.5 for every strategy, which explains the roughly 0.50 lexical MRR. One query labels the summary at grade 2 or higher, so it scores MRR = 1 no matter which strategy runs.
- **Unreachable IDCG.** IDCG ignores the anchor and the 3-per-title cap, so nDCG = 1 cannot be reached.

This is documented in one line, but readers of the tables will misread absolute values.
**Fix:** Also report "MRR excluding anchored summary", or note the ceiling next to the tables.

### IN-05: Out-of-order import and needless alias in embeddings.ts

**File:** `lib/vault/embeddings.ts:13,48`
**Issue:** The new import sits after the local imports, separated by a blank line, and `const chunkText = embeddingText;` is an alias that adds nothing.
**Fix:** Merge the import with the others and call `embeddingText` directly.

### IN-06: Paths are relative to the working directory

**File:** `evals/retrieval/run.ts:44,196`, `evals/retrieval/embedder.ts:171`
**Issue:** The baseline, results and cache paths all depend on `process.cwd()`. Running from a subdirectory makes `--ci` report "No baseline recorded" (it fails closed), makes `--update-baseline` crash with ENOENT, and writes the caches elsewhere.
**Fix:** Resolve the paths from `__dirname` (for example `path.resolve(__dirname, "../../../evals/retrieval/baseline.json")`) or from `git rev-parse --show-toplevel`.

### IN-07: No metric test covers an unretrieved high-grade label lowering nDCG

**File:** `tests/retrieval-metrics.test.ts:50-62`
**Issue:** The tests cover reordering and dedupe. None asserts that an unretrieved relevant label lowers nDCG (for example `ndcgAtK(["b"], rel({a:3,b:1}), 2) ≈ 1/7.6309`). That is the property that guards against an IDCG built from retrieved items only.
**Fix:** Add that assertion.

---

_Reviewed: 2026-10-31T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
