// Rubric and price-table tests. No model calls.
import assert from "node:assert";
import { test } from "node:test";
import { PRICE_TABLE, estimateCostUsd, lookupPrice } from "../evals/llm/prices";
import { RUBRIC_DIMENSIONS, loadRubric, rubricHash } from "../evals/llm/rubric";

test("RUBRIC.md contains every dimension and the metric section", () => {
  const text = loadRubric();
  for (const d of RUBRIC_DIMENSIONS) assert.ok(text.includes(d), `missing ${d}`);
  assert.ok(text.includes("## Metric definitions"));
});

test("rubricHash is non-empty and stable", () => {
  const a = rubricHash(loadRubric());
  const b = rubricHash(loadRubric());
  assert.ok(a.length > 0);
  assert.strictEqual(a, b);
});

test("PRICE_TABLE rows are well-formed", () => {
  assert.ok(PRICE_TABLE.length >= 3);
  for (const r of PRICE_TABLE) {
    assert.match(r.sourceUrl, /^https:\/\/.+/);
    assert.match(r.retrieved, /^\d{4}-\d{2}-\d{2}$/);
    for (const n of [r.inputPerMTok, r.outputPerMTok, r.longInputPerMTok ?? 0, r.longOutputPerMTok ?? 0]) {
      assert.ok(Number.isFinite(n) && n >= 0);
    }
    if (r.freeTierAvailable) assert.strictEqual(r.freeTierBilledUsd, 0);
  }
});

test("lookupPrice: exact, then prefix, else null", () => {
  assert.strictEqual(lookupPrice("google", "gemini-2.5-flash")?.model, "gemini-2.5-flash");
  assert.strictEqual(lookupPrice("google", "gemini-2.5-flash-lite")?.model, "gemini-2.5-flash-lite");
  assert.strictEqual(lookupPrice("google", "gemini-2.5-flash-preview-09")?.model, "gemini-2.5-flash");
  assert.strictEqual(lookupPrice("google", "no-such-model"), null);
  assert.strictEqual(lookupPrice("openai", "gemini-2.5-flash"), null);
});

test("estimateCostUsd: price, thoughts at output price, nulls", () => {
  const row = lookupPrice("google", "gemini-2.5-flash");
  assert.ok(row);
  assert.strictEqual(
    estimateCostUsd({ promptTokens: 1_000_000, completionTokens: 1_000_000, thoughtsTokens: 0 }, row),
    row.inputPerMTok + row.outputPerMTok,
  );
  assert.strictEqual(
    estimateCostUsd({ promptTokens: 0, completionTokens: 0, thoughtsTokens: 1_000_000 }, row),
    row.outputPerMTok,
  );
  assert.strictEqual(estimateCostUsd({ promptTokens: NaN, completionTokens: 1 }, row), null);
  assert.strictEqual(estimateCostUsd({ promptTokens: 1, completionTokens: null }, row), null);
  assert.strictEqual(estimateCostUsd({ promptTokens: 1, completionTokens: 1 }, null), null);
});

test("estimateCostUsd: long-context tier applies above the threshold", () => {
  const row = lookupPrice("google", "gemini-2.5-pro");
  assert.ok(row && row.longContextThresholdTokens && row.longInputPerMTok && row.longOutputPerMTok);
  const short = estimateCostUsd({ promptTokens: row.longContextThresholdTokens, completionTokens: 1_000_000 }, row);
  const long = estimateCostUsd({ promptTokens: row.longContextThresholdTokens + 1, completionTokens: 1_000_000 }, row);
  assert.ok(short !== null && long !== null);
  assert.ok(Math.abs(short - (row.longContextThresholdTokens * row.inputPerMTok / 1e6 + row.outputPerMTok)) < 1e-9);
  assert.ok(Math.abs(long - ((row.longContextThresholdTokens + 1) * row.longInputPerMTok / 1e6 + row.longOutputPerMTok)) < 1e-9);
});
