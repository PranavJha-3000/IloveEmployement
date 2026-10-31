import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderReport } from "../evals/retrieval/report";
import { METRIC_KEYS, type MetricSet } from "../evals/retrieval/metrics";
import type { RetrievalRunResult } from "../evals/retrieval/run";

const set = (v: number): MetricSet => Object.fromEntries(METRIC_KEYS.map((k) => [k, v])) as MetricSet;

function makeResultWith(ids: [string, string, number][]): RetrievalRunResult {
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
    embeddingCache: null,
    rerankModel: null,
    bootstrap: { iterations: 10000, seed: 1, confidence: 0.95 },
    comparisons: [],
    addedLatency: [],
    decision: null,
    primaryMetric: "ndcg@8",
    relevanceThreshold: 2,
    strategies: ids.map(([id, label, v]) => strategy(id, label, v)),
  };
}

export function makeResult(): RetrievalRunResult {
  return makeResultWith([["keyword", "Keyword", 0.5], ["hybrid", "Hybrid", 0.6]]);
}

export function makeRerankResult(): RetrievalRunResult {
  const r = makeResultWith([
    ["keyword", "Keyword", 0.5],
    ["embeddings", "Embeddings", 0.55],
    ["hybrid", "Hybrid", 0.6],
    ["hybrid+rerank", "Hybrid + cross-encoder rerank (top 20)", 0.7],
    ["embeddings+rerank", "Embeddings + cross-encoder rerank (top 20)", 0.65],
    ["hybrid+rerank@30", "Hybrid + cross-encoder rerank (top 30)", 0.7],
    ["embeddings+rerank@30", "Embeddings + cross-encoder rerank (top 30)", 0.65],
  ]);
  const cmp = (a: string, b: string, scope: "overall" | "lexical" | "paraphrase") => ({
    a, b, scope, metric: "ndcg@8" as const, n: 2, meanDelta: 0.1, lo: 0.05, hi: 0.15, wins: 2, ties: 0, losses: 0,
  });
  r.rerankModel = { id: "Xenova/test", dtype: "q8", transformersVersion: "3.8.1", loadMs: 1234, topN: [20, 30] };
  r.comparisons = (["overall", "lexical", "paraphrase"] as const).map((sc) => cmp("hybrid+rerank", "hybrid", sc));
  r.addedLatency = [{ id: "hybrid+rerank", baseId: "hybrid", p50: 20.5, p95: 30.25 }];
  r.decision = {
    ruleVersion: 1,
    metric: "ndcg@8",
    bestExisting: { id: "hybrid", value: 0.6 },
    candidates: [],
    rerankAdopted: "hybrid+rerank",
    switchCheck: { delta: cmp("embeddings", "hybrid", "overall"), switchToEmbeddings: false },
    baseMode: "hybrid",
    reasons: ["R1: adopt hybrid+rerank.", "R2: base mode hybrid."],
  };
  return r;
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

describe("renderReport rerank sections", () => {
  const md = renderReport(makeRerankResult());
  it("shows rerank rows and new headings", () => {
    assert.ok(md.includes("| Hybrid + cross-encoder rerank (top 20) |"));
    assert.ok(md.includes("## Paired deltas (ndcg@8)"));
    assert.ok(md.includes("## Added latency"));
    assert.ok(md.includes("## Decision"));
    assert.ok(md.includes("Reranker model: Xenova/test (q8)"));
  });
  it("emits greppable decision lines exactly once", () => {
    assert.equal(md.split("RERANK_ADOPTED: ").length - 1, 1);
    assert.equal(md.split("APP_BASE_MODE: ").length - 1, 1);
    assert.ok(md.includes("\n- RERANK_ADOPTED: hybrid+rerank\n"));
    assert.ok(md.includes("\n- APP_BASE_MODE: hybrid\n"));
  });
  it("renders no decision without one", () => {
    const none = renderReport(makeResult());
    assert.ok(none.includes("No decision in this run"));
    assert.ok(!none.includes("RERANK_ADOPTED"));
    assert.ok(!none.includes("## Paired deltas"));
  });
});
