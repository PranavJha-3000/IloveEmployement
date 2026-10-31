import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderReport } from "../evals/retrieval/report";
import { METRIC_KEYS, type MetricSet } from "../evals/retrieval/metrics";
import type { RetrievalRunResult } from "../evals/retrieval/run";

const set = (v: number): MetricSet => Object.fromEntries(METRIC_KEYS.map((k) => [k, v])) as MetricSet;

export function makeResult(): RetrievalRunResult {
  const strategy = (id: string, label: string, v: number) => ({
    id,
    label,
    overall: set(v),
    byType: { lexical: set(v), paraphrase: set(v / 2) },
    byResume: { r1: set(v) },
    latency: { p50: 1, p95: 2, embedP50: 3 },
    perQuery: [
      { id: "q1", type: "lexical" as const, query: "react", metrics: set(v), rankedIds: ["a"], totalMs: 1 },
      { id: "q2", type: "paraphrase" as const, query: "ui library", metrics: set(v / 2), rankedIds: ["b"], totalMs: 1 },
    ],
  });
  return {
    generatedAt: "2026-01-01T00:00:00Z",
    command: "test",
    gitSha: "abc",
    node: "v20",
    platform: "test",
    repeat: 3,
    dataset: { fingerprint: "fp", resumes: [{ id: "r1", seniority: "senior", domain: "web", chunks: 10 }], queries: 2, lexical: 1, paraphrase: 1 },
    embeddingModel: null,
    primaryMetric: "ndcg@8",
    relevanceThreshold: 2,
    strategies: [strategy("keyword", "Keyword", 0.5), strategy("hybrid", "Hybrid", 0.6)],
  };
}

describe("renderReport method notes", () => {
  const md = renderReport(makeResult());
  it("states paraphrase BM25 ~0 is by construction", () => {
    assert.ok(md.includes("by construction"));
    assert.ok(md.includes("## Paraphrase queries"));
  });
  it("states the summary anchor caps MRR and nDCG", () => {
    assert.ok(md.includes("MRR is at most 0.5"));
  });
  it("describes latency as measured", () => {
    assert.ok(md.includes("query-embedding timing"));
    assert.ok(!md.includes("including the query embedding for embedding strategies"));
  });
});
