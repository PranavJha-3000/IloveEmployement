// Hand-computed tests for the pure retrieval metrics. Run with `npm test`.
import assert from "node:assert";
import { test } from "node:test";
import {
  METRIC_KEYS,
  PRIMARY_METRIC,
  RELEVANCE_THRESHOLD,
  aggregate,
  ndcgAtK,
  percentile,
  recallAtK,
  reciprocalRank,
  scoreQuery,
  type MetricSet,
} from "../evals/retrieval/metrics";

const EPS = 1e-4;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < EPS, `${a} != ${b}`);
const rel = (o: Record<string, number>) => new Map(Object.entries(o));

test("constants", () => {
  assert.strictEqual(RELEVANCE_THRESHOLD, 2);
  assert.strictEqual(PRIMARY_METRIC, "ndcg@8");
  assert.deepStrictEqual([...METRIC_KEYS], ["recall@3", "recall@5", "recall@8", "mrr", "ndcg@3", "ndcg@5", "ndcg@8"]);
});

test("recallAtK counts only grade >= 2", () => {
  const r = rel({ a: 3, b: 2, c: 1 });
  const ranked = ["x", "a", "y", "b"];
  near(recallAtK(ranked, r, 3), 0.5);
  near(recallAtK(ranked, r, 5), 1);
});

test("recallAtK edge cases", () => {
  const r = rel({ a: 3 });
  near(recallAtK([], r, 3), 0);
  near(recallAtK(["a"], r, 100), 1);
  near(recallAtK(["a"], rel({ c: 1 }), 3), 0);
  near(recallAtK(["a"], new Map(), 3), 0);
});

test("reciprocalRank", () => {
  const r = rel({ a: 3 });
  near(reciprocalRank(["x", "a"], r), 0.5);
  near(reciprocalRank(["x", "y"], r), 0);
  near(reciprocalRank([], r), 0);
  near(reciprocalRank(["a"], r), 1);
});

test("ndcgAtK graded", () => {
  const r = rel({ a: 3, b: 1 });
  near(ndcgAtK(["b", "a"], r, 2), 0.7098);
  near(ndcgAtK(["a", "b"], r, 2), 1);
});

test("ndcgAtK edge cases and dedupe", () => {
  const r = rel({ a: 3, b: 1 });
  near(ndcgAtK([], r, 3), 0);
  near(ndcgAtK(["a", "b"], r, 50), 1);
  near(ndcgAtK(["a", "b"], new Map(), 3), 0);
  near(ndcgAtK(["a", "a", "b"], r, 3), 1);
});

test("scoreQuery returns all keys", () => {
  const s = scoreQuery(["x", "a"], rel({ a: 3 }));
  for (const k of METRIC_KEYS) assert.ok(k in s);
  near(s.mrr, 0.5);
  near(s["recall@3"], 1);
});

test("aggregate means", () => {
  const zero = aggregate([]);
  for (const k of METRIC_KEYS) assert.strictEqual(zero[k], 0);
  const a = scoreQuery(["a"], rel({ a: 3 }));
  const b = scoreQuery(["x"], rel({ a: 3 }));
  const m: MetricSet = aggregate([a, b]);
  near(m.mrr, 0.5);
  near(m["recall@8"], 0.5);
});

test("percentile nearest-rank", () => {
  assert.strictEqual(percentile([1, 2, 3, 4], 50), 2);
  assert.strictEqual(percentile(Array.from({ length: 20 }, (_, i) => i + 1), 95), 19);
  assert.strictEqual(percentile([], 50), 0);
  assert.strictEqual(percentile([4, 1, 3, 2], 50), 2);
});
