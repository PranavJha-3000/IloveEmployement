import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASELINE_EPSILON,
  GATED_SCOPES,
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
    const lex = compareToBaseline(baseline, { ...same, byType: { lexical: { ...set(0.6), mrr: 0.1 }, paraphrase: set(0.4) } });
    assert.equal(lex.ok, false);
    assert.deepEqual(lex.regressions, ["lexical mrr: 0.1000 < 0.6000"]);
  });

  it("gates overall and lexical only; paraphrase is reported, not gated", () => {
    assert.deepEqual([...GATED_SCOPES], ["overall", "lexical"]);
    const para = compareToBaseline(baseline, { ...same, byType: { lexical: set(0.6), paraphrase: set(0) } });
    assert.equal(para.ok, true);
    assert.deepEqual(para.regressions, []);
    assert.deepEqual(para.improvements, []);
    // A NaN in the ungated scope does not trip the gate either; validateBaseline still requires it in the file.
    const nan = compareToBaseline(baseline, { ...same, byType: { lexical: set(0.6), paraphrase: { ...set(0.4), mrr: NaN } } });
    assert.equal(nan.ok, true);
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
  const strict = { allowRegression: false };
  const lowered = (by: number): KeywordBaseline => ({
    ...baseline,
    overall: { ...baseline.overall, "ndcg@8": baseline.overall["ndcg@8"] + by },
  });

  it("writes on first recording", () => {
    const plan = planBaselineUpdate(null, baseline, strict);
    assert.equal(plan.write, true);
    assert.deepEqual(plan.errors, []);
  });

  it("refuses a drop without the flag and warns", () => {
    const plan = planBaselineUpdate(baseline, lowered(-0.01), strict);
    assert.equal(plan.write, false);
    assert.ok(plan.errors.length > 0);
    assert.ok(plan.warnings.join("\n").includes("overall ndcg@8"));
  });

  it("allows a drop with allowRegression and keeps warnings", () => {
    const plan = planBaselineUpdate(baseline, lowered(-0.01), { allowRegression: true });
    assert.equal(plan.write, true);
    assert.ok(plan.warnings.join("\n").includes("overall ndcg@8"));
  });

  it("writes improvements and within-epsilon changes", () => {
    const up = planBaselineUpdate(baseline, lowered(0.05), strict);
    assert.equal(up.write, true);
    assert.deepEqual(up.errors, []);
    assert.ok(up.improvements.length > 0);
    const tiny = planBaselineUpdate(baseline, lowered(-BASELINE_EPSILON / 2), strict);
    assert.equal(tiny.write, true);
  });

  it("fingerprint change is refused without --dataset-changed", () => {
    const fp = planBaselineUpdate(baseline, { ...baseline, fingerprint: "zzz" }, strict);
    assert.equal(fp.write, false);
    assert.ok(fp.errors.join("\n").includes("--dataset-changed"));
    assert.ok(fp.warnings.join("\n").includes("abc"));
    // --allow-regression alone does not accept a dataset change.
    assert.equal(planBaselineUpdate(baseline, { ...baseline, fingerprint: "zzz" }, { allowRegression: true }).write, false);
    const ok = planBaselineUpdate(baseline, { ...baseline, fingerprint: "zzz" }, { allowRegression: false, datasetChanged: true });
    assert.equal(ok.write, true);
    assert.deepEqual(ok.errors, []);
  });

  it("fingerprint change with a drop needs both flags", () => {
    const next = { ...lowered(-0.01), fingerprint: "zzz" };
    assert.equal(planBaselineUpdate(baseline, next, { allowRegression: false, datasetChanged: true }).write, false);
    assert.equal(planBaselineUpdate(baseline, next, { allowRegression: true, datasetChanged: false }).write, false);
    assert.equal(planBaselineUpdate(baseline, next, { allowRegression: true, datasetChanged: true }).write, true);
  });

  it("refuses to overwrite an invalid old baseline without --allow-regression", () => {
    const corrupted = clone();
    corrupted.overall.mrr = "x";
    for (const bad of [{ nope: true }, "not json {", corrupted]) {
      const plan = planBaselineUpdate(bad, lowered(-0.2), strict);
      assert.equal(plan.write, false);
      assert.ok(plan.warnings.join("\n").includes("previous baseline.json is invalid"));
      assert.ok(plan.errors.join("\n").includes("--allow-regression"));
    }
  });

  it("overwrites an invalid old baseline with --allow-regression and keeps the warning", () => {
    const plan = planBaselineUpdate({ nope: true }, baseline, { allowRegression: true });
    assert.equal(plan.write, true);
    assert.deepEqual(plan.errors, []);
    assert.ok(plan.warnings.join("\n").includes("previous baseline.json is invalid"));
  });
});
