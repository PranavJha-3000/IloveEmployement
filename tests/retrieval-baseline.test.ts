import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASELINE_EPSILON,
  compareToBaseline,
  planBaselineUpdate,
  validateBaseline,
  type KeywordBaseline,
} from "../evals/retrieval/baseline";
import { METRIC_KEYS, type MetricSet } from "../evals/retrieval/metrics";

const set = (v: number): MetricSet => Object.fromEntries(METRIC_KEYS.map((k) => [k, v])) as MetricSet;

const baseline: KeywordBaseline = {
  strategy: "keyword",
  fingerprint: "abc",
  recordedAt: "2026-01-01T00:00:00.000Z",
  overall: set(0.5),
  byType: { lexical: set(0.6), paraphrase: set(0.4) },
};
const { recordedAt: _r, ...same } = baseline;
void _r;

describe("compareToBaseline", () => {
  it("passes when metrics are within epsilon or better", () => {
    const res = compareToBaseline(baseline, {
      ...same,
      overall: set(0.5 - BASELINE_EPSILON + 0.001),
      byType: { lexical: set(0.7), paraphrase: set(0.4) },
    });
    assert.equal(res.ok, true);
    assert.deepEqual(res.regressions, []);
    assert.ok(res.improvements.length > 0);
  });

  it("reports metrics lower than baseline minus epsilon", () => {
    const overall = { ...set(0.5), "ndcg@8": 0.4 };
    const res = compareToBaseline(baseline, { ...same, overall });
    assert.equal(res.ok, false);
    assert.deepEqual(res.regressions, ["overall ndcg@8: 0.4000 < 0.5000"]);
    const para = compareToBaseline(baseline, { ...same, byType: { lexical: set(0.6), paraphrase: { ...set(0.4), mrr: 0.1 } } });
    assert.equal(para.ok, false);
    assert.ok(para.regressions[0].startsWith("paraphrase mrr:"));
  });

  it("fails on fingerprint mismatch with update instructions", () => {
    const res = compareToBaseline(baseline, { ...same, fingerprint: "x" });
    assert.equal(res.ok, false);
    assert.equal(res.fingerprintMismatch, true);
    assert.ok(res.regressions.join(" ").includes("npm run eval:retrieval -- --update-baseline"));
  });
});

const clone = (): Record<string, any> => JSON.parse(JSON.stringify(baseline));

describe("validateBaseline", () => {
  it("accepts a well-formed baseline", () => {
    const res = validateBaseline(clone());
    assert.equal(res.ok, true);
  });

  it("names the offending key for each malformed shape", () => {
    const cases: [string, (b: Record<string, any>) => void, string][] = [
      ["deleted key", (b) => delete b.overall["ndcg@8"], "ndcg@8"],
      ["string value", (b) => (b.byType.lexical.mrr = "0.5"), "mrr"],
      ["NaN value", (b) => (b.overall.mrr = NaN), "mrr"],
      ["null value", (b) => (b.overall["recall@3"] = null), "recall@3"],
      ["wrong strategy", (b) => (b.strategy = "hybrid"), "strategy"],
      ["empty fingerprint", (b) => (b.fingerprint = ""), "fingerprint"],
      ["missing paraphrase", (b) => delete b.byType.paraphrase, "paraphrase"],
    ];
    for (const [name, mutate, needle] of cases) {
      const b = clone();
      mutate(b);
      const res = validateBaseline(b);
      assert.equal(res.ok, false, name);
      if (!res.ok) assert.ok(res.problems.join(" ").includes(needle), `${name}: ${res.problems.join(" | ")}`);
    }
  });

  it("rejects arrays and null", () => {
    assert.equal(validateBaseline([]).ok, false);
    assert.equal(validateBaseline(null).ok, false);
  });
});

describe("compareToBaseline fail-closed", () => {
  it("reports non-numeric when current is NaN", () => {
    const res = compareToBaseline(baseline, { ...same, overall: { ...set(0.5), "ndcg@8": NaN } });
    assert.equal(res.ok, false);
    assert.ok(res.regressions.join(" ").includes("non-numeric"));
  });

  it("reports non-numeric when baseline value is undefined", () => {
    const b = clone();
    delete b.overall["ndcg@8"];
    const res = compareToBaseline(b as KeywordBaseline, same);
    assert.equal(res.ok, false);
    assert.ok(res.regressions.join(" ").includes("non-numeric"));
  });
});

describe("planBaselineUpdate", () => {
  const lowered = (by: number): KeywordBaseline => ({
    ...baseline,
    overall: { ...baseline.overall, "ndcg@8": baseline.overall["ndcg@8"] + by },
  });

  it("writes on first recording", () => {
    const plan = planBaselineUpdate(null, baseline, false);
    assert.equal(plan.write, true);
    assert.deepEqual(plan.errors, []);
  });

  it("refuses a drop without the flag and warns", () => {
    const plan = planBaselineUpdate(baseline, lowered(-0.01), false);
    assert.equal(plan.write, false);
    assert.ok(plan.errors.length > 0);
    assert.ok(plan.warnings.join("\n").includes("overall ndcg@8"));
  });

  it("allows a drop with allowRegression and keeps warnings", () => {
    const plan = planBaselineUpdate(baseline, lowered(-0.01), true);
    assert.equal(plan.write, true);
    assert.ok(plan.warnings.join("\n").includes("overall ndcg@8"));
  });

  it("writes improvements and within-epsilon changes", () => {
    const up = planBaselineUpdate(baseline, lowered(0.05), false);
    assert.equal(up.write, true);
    assert.deepEqual(up.errors, []);
    assert.ok(up.improvements.length > 0);
    const tiny = planBaselineUpdate(baseline, lowered(-BASELINE_EPSILON / 2), false);
    assert.equal(tiny.write, true);
  });

  it("fingerprint change alone writes; with a drop it is still refused", () => {
    const fp = planBaselineUpdate(baseline, { ...baseline, fingerprint: "zzz" }, false);
    assert.equal(fp.write, true);
    assert.ok(fp.warnings.join("\n").includes("abc"));
    const both = planBaselineUpdate(baseline, { ...lowered(-0.01), fingerprint: "zzz" }, false);
    assert.equal(both.write, false);
  });

  it("writes with a warning when the old baseline is invalid", () => {
    const plan = planBaselineUpdate({ nope: true }, baseline, false);
    assert.equal(plan.write, true);
    assert.ok(plan.warnings.join("\n").includes("previous baseline.json is invalid"));
  });
});
