import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASELINE_EPSILON, compareToBaseline, type KeywordBaseline } from "../evals/retrieval/baseline";
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
