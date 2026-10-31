// Tests for the seeded paired bootstrap and the pre-registered decision rule.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { METRIC_KEYS, type MetricSet } from "../evals/retrieval/metrics";
import { mulberry32, pairedBootstrapCI } from "../evals/retrieval/stats";
import { RERANK_TOP_N as LIB_RERANK_TOP_N } from "../lib/retrieval/rerank";
import { STRATEGIES } from "../evals/retrieval/strategies";
import {
  ADDED_LATENCY_BUDGET_MS,
  BOOTSTRAP_ITERATIONS,
  BOOTSTRAP_SEED,
  DECISION_METRIC,
  DECISION_STRATEGY_IDS,
  RERANK_CANDIDATES,
  RERANK_TOP_N,
  SENSITIVITY_STRATEGIES,
  addedLatency,
  decide,
  pairedComparison,
  type StrategyRun,
} from "../evals/retrieval/decision";

const N = 20;

function mk(id: string, ndcg: number[], ms: number[]): StrategyRun {
  const perQuery = ndcg.map((v, i) => {
    const metrics = Object.fromEntries(METRIC_KEYS.map((k) => [k, v])) as MetricSet;
    return { id: `q${i}`, type: (i < N / 2 ? "lexical" : "paraphrase") as "lexical" | "paraphrase", metrics, totalMs: ms[i] };
  });
  const mean = ndcg.reduce((s, x) => s + x, 0) / ndcg.length;
  const overall = Object.fromEntries(METRIC_KEYS.map((k) => [k, mean])) as MetricSet;
  return { id, overall, perQuery };
}
const flat = (v: number) => Array(N).fill(v) as number[];
// Noisy but fixed series around a mean, to make a CI that is not degenerate.
const noisy = (mean: number, amp: number) => Array.from({ length: N }, (_, i) => mean + (i % 2 === 0 ? amp : -amp));

interface Opts {
  emb?: number[];
  hyb?: number[];
  hr?: number[];
  er?: number[];
  hrMs?: number;
  erMs?: number;
  r30?: boolean;
}
function run(o: Opts = {}): StrategyRun[] {
  const hyb = o.hyb ?? flat(0.58);
  const emb = o.emb ?? flat(0.593);
  const out = [
    mk("keyword", flat(0.349), flat(1)),
    mk("embeddings", emb, flat(10)),
    mk("hybrid", hyb, flat(12)),
    mk("hybrid+rerank", o.hr ?? hyb.map((x) => x + 0.1), flat(12 + (o.hrMs ?? 40))),
    mk("embeddings+rerank", o.er ?? emb.map((x) => x - 0.2), flat(10 + (o.erMs ?? 40))),
  ];
  if (o.r30) out.push(mk("hybrid+rerank@30", hyb.map((x) => x + 0.3), flat(12 + 10)));
  return out;
}

test("mulberry32 is deterministic and in [0,1)", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const xs = [a(), a(), a()];
  assert.deepStrictEqual(xs, [b(), b(), b()]);
  for (const x of xs) assert.ok(x >= 0 && x < 1);
});

test("pairedBootstrapCI degenerate inputs", () => {
  const r = pairedBootstrapCI([0.1, 0.1, 0.1, 0.1]);
  assert.ok(Math.abs(r.mean - 0.1) < 1e-12 && Math.abs(r.lo - 0.1) < 1e-12 && Math.abs(r.hi - 0.1) < 1e-12);
  assert.deepStrictEqual(pairedBootstrapCI([0, 0, 0]), { mean: 0, lo: 0, hi: 0 });
});

test("pairedBootstrapCI bounds, determinism, errors", () => {
  const d = [-0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5];
  const r = pairedBootstrapCI(d);
  assert.ok(r.lo <= r.mean && r.mean <= r.hi);
  assert.ok(r.lo > -0.2 && r.hi < 0.5);
  assert.deepStrictEqual(pairedBootstrapCI(d), r);
  assert.deepStrictEqual(pairedBootstrapCI(d, { seed: 1 }), pairedBootstrapCI(d, { seed: 1 }));
  assert.throws(() => pairedBootstrapCI([]));
  assert.throws(() => pairedBootstrapCI([0.1, NaN]));
  assert.throws(() => pairedBootstrapCI([0.1, Infinity]));
});

test("pairedComparison computes delta, wins/ties/losses and scopes", () => {
  const a = mk("a", [...flat(0.5).slice(0, 10), ...flat(0.5).slice(10)].map((x, i) => (i < 5 ? x + 0.2 : i < 10 ? x - 0.1 : x)), flat(1));
  const b = mk("b", flat(0.5), flat(1));
  const c = pairedComparison(a, b);
  assert.strictEqual(c.n, N);
  assert.strictEqual(c.wins, 5);
  assert.strictEqual(c.losses, 5);
  assert.strictEqual(c.ties, 10);
  assert.ok(Math.abs(c.meanDelta - (5 * 0.2 - 5 * 0.1) / N) < 1e-12);
  const lex = pairedComparison(a, b, "lexical");
  assert.strictEqual(lex.n, 10);
  const par = pairedComparison(a, b, "paraphrase");
  assert.strictEqual(par.n, 10);
  assert.strictEqual(par.ties, 10);
});

test("pairedComparison throws on mismatched query order", () => {
  const a = mk("a", flat(0.5), flat(1));
  const b = mk("b", flat(0.5), flat(1));
  b.perQuery.reverse();
  assert.throws(() => pairedComparison(a, b));
  const c = mk("c", flat(0.5).slice(0, 19), flat(1));
  assert.throws(() => pairedComparison(a, c));
});

test("addedLatency p50/p95 of per-query differences", () => {
  const ms = Array.from({ length: N }, (_, i) => 100 + i);
  const s = mk("s", flat(0.5), ms);
  const base = mk("base", flat(0.5), flat(90));
  const l = addedLatency(s, base);
  assert.strictEqual(l.p50, 19); // nearest-rank p50 of 10..29
  assert.strictEqual(l.p95, 28);
  assert.strictEqual(l.id, "s");
  assert.strictEqual(l.baseId, "base");
});

test("addedLatency throws on mismatched query order or length", () => {
  const s = mk("s", flat(0.5), flat(100));
  const reordered = mk("base", flat(0.5), flat(90));
  reordered.perQuery.reverse();
  assert.throws(() => addedLatency(s, reordered), /different query order or length/);
  const filtered = mk("base", flat(0.5).slice(0, N - 1), flat(90));
  assert.throws(() => addedLatency(s, filtered), /different query order or length/);
  const renamed = mk("base", flat(0.5), flat(90));
  renamed.perQuery[3] = { ...renamed.perQuery[3], id: "other" };
  assert.throws(() => addedLatency(s, renamed), /different query order or length/);
});

test("decide adopts hybrid+rerank when all checks pass", () => {
  const d = decide(run({ hyb: noisy(0.6, 0.05), hrMs: 40 }));
  assert.strictEqual(d.rerankAdopted, "hybrid+rerank");
  assert.strictEqual(d.baseMode, "hybrid");
  assert.ok(d.reasons.length > 0);
});

test("decide rejects on latency budget", () => {
  const d = decide(run({ hrMs: 151 }));
  assert.strictEqual(d.rerankAdopted, null);
  assert.ok(d.reasons.some((r) => /latency budget/i.test(r)));
});

test("decide rejects when not beating best existing", () => {
  const hyb = flat(0.58);
  const d = decide(run({ hyb, hr: flat(0.59), emb: flat(0.593) }));
  assert.strictEqual(d.rerankAdopted, null);
});

test("decide rejects when CI of delta vs hybrid includes 0", () => {
  const hyb = flat(0.5);
  // mean +0.05 over hybrid, but wildly noisy: CI includes 0; beats 0.593 on the mean.
  const hr = Array.from({ length: N }, (_, i) => 0.5 + (i % 2 === 0 ? 0.3 : -0.2));
  const d = decide(run({ hyb, hr, emb: flat(0.5) }));
  assert.ok(d.candidates[0].beatsBest);
  assert.strictEqual(d.candidates[0].ciExcludesZero, false);
  assert.strictEqual(d.rerankAdopted, null);
});

test("decide picks higher overall when both eligible, tie goes to hybrid+rerank", () => {
  const hyb = noisy(0.6, 0.05);
  const emb = noisy(0.55, 0.05);
  const hr = hyb.map((x) => x + 0.1);
  const er = hyb.map((x) => x + 0.15); // 0.75 > 0.70, delta vs hybrid positive
  const d = decide(run({ hyb, emb, hr, er }));
  assert.strictEqual(d.rerankAdopted, "embeddings+rerank");
  const tie = decide(run({ hyb, emb, hr, er: hr }));
  assert.strictEqual(tie.rerankAdopted, "hybrid+rerank");
});

test("@30 strategies are never adopted", () => {
  const d = decide(run({ r30: true, hrMs: 500, hyb: noisy(0.6, 0.05) }));
  assert.strictEqual(d.rerankAdopted, null);
});

test("switch rule: embeddings must beat hybrid with CI excluding 0", () => {
  const hyb = noisy(0.5, 0.05);
  const emb = hyb.map((x) => x + 0.1);
  assert.strictEqual(decide(run({ hyb, emb })).baseMode, "embeddings");
  const embNoisy = Array.from({ length: N }, (_, i) => 0.5 + 0.02 + (i % 2 === 0 ? 0.3 : -0.3));
  assert.strictEqual(decide(run({ hyb: flat(0.5), emb: embNoisy })).baseMode, "hybrid");
});

test("decide throws when a required strategy is missing", () => {
  for (const id of ["keyword", "embeddings", "hybrid", "hybrid+rerank", "embeddings+rerank"]) {
    assert.throws(() => decide(run().filter((s) => s.id !== id)), new RegExp(id.replace("+", "\\+")));
  }
});

test("decide fails closed on a non-finite overall metric", () => {
  for (const id of ["keyword", "embeddings", "hybrid", "hybrid+rerank", "embeddings+rerank"]) {
    for (const bad of [NaN, Infinity, -Infinity, undefined]) {
      const runs = run().map((s) => (s.id === id ? { ...s, overall: { ...s.overall, [DECISION_METRIC]: bad as number } } : s));
      assert.throws(() => decide(runs), new RegExp(`decide: ${id.replace("+", "\\+")} ${DECISION_METRIC} is not finite`), `${id} ${String(bad)}`);
    }
  }
  // All three existing strategies NaN previously let every candidate "beat best".
  const allNaN = run().map((s) =>
    ["keyword", "embeddings", "hybrid"].includes(s.id) ? { ...s, overall: { ...s.overall, [DECISION_METRIC]: NaN } } : s,
  );
  assert.throws(() => decide(allNaN), /not finite/);
});

test("constants match DECISION.md", () => {
  const md = readFileSync(path.resolve(__dirname, "../../evals/retrieval/DECISION.md"), "utf8");
  assert.ok(md.includes(String(BOOTSTRAP_SEED)));
  assert.ok(md.includes(String(BOOTSTRAP_ITERATIONS)));
  assert.ok(md.includes(`${ADDED_LATENCY_BUDGET_MS} ms`));
  assert.ok(md.includes(DECISION_METRIC));
  assert.strictEqual(RERANK_TOP_N, 20, "DECISION.md pre-registers top 20");
  assert.ok(md.includes(`top ${RERANK_TOP_N}`));
  assert.ok(md.includes("## Outcome"));
  assert.strictEqual(RERANK_CANDIDATES.length, 2);
});

test("top N and candidate list have a single source of truth", () => {
  assert.strictEqual(RERANK_TOP_N, LIB_RERANK_TOP_N);
  for (const c of RERANK_CANDIDATES) assert.strictEqual(c.topN, RERANK_TOP_N);
  assert.deepStrictEqual(DECISION_STRATEGY_IDS, ["keyword", "embeddings", "hybrid", "hybrid+rerank", "embeddings+rerank"]);
  const rerank = STRATEGIES.filter((s) => s.topN !== undefined);
  assert.deepStrictEqual(
    rerank.map((s) => [s.id, s.topN]),
    [...RERANK_CANDIDATES, ...SENSITIVITY_STRATEGIES].map((c) => [c.id, c.topN]),
  );
  // Labels are unchanged by the refactor (they appear in RETRIEVAL.md).
  assert.deepStrictEqual(
    rerank.map((s) => s.label),
    [
      "Hybrid + cross-encoder rerank (top 20)",
      "Embeddings + cross-encoder rerank (top 20)",
      "Hybrid + cross-encoder rerank (top 30, sensitivity)",
      "Embeddings + cross-encoder rerank (top 30, sensitivity)",
    ],
  );
  for (const s of STRATEGIES.filter((x) => !x.id.includes("+rerank"))) assert.strictEqual(s.topN, undefined);
});
