// Offline parity tests: strategies must equal the app's own retrieval calls.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { VaultChunk } from "../lib/engine/types";
import { cosine, semanticRanking } from "../lib/retrieval/fusion";
import { retrieveVault } from "../lib/vault/retrieve";
import { STRATEGIES } from "../evals/retrieval/strategies";

const mk = (id: string, kind: VaultChunk["kind"], title: string, text: string): VaultChunk => ({
  id, kind, title, text, source: "resume", createdAt: 1,
});

const chunks: VaultChunk[] = [
  mk("s", "summary", "Summary", "Backend engineer building payment systems in Go"),
  mk("b1", "bullet", "Eng @ Zeta", "Cut checkout latency using ledger redesign"),
  mk("b2", "bullet", "Eng @ Zeta", "Migrated services to Kubernetes"),
  mk("b3", "bullet", "Eng @ Zeta", "Mentored junior engineers on call"),
  mk("b4", "bullet", "Eng @ Zeta", "Wrote Kafka consumers for events"),
  mk("b5", "bullet", "Eng @ Acme", "Built reconciliation service for transactions"),
  mk("b6", "bullet", "Eng @ Acme", "Contract testing reduced integration bugs"),
  mk("sk", "skill", "Skills", "Go PostgreSQL Kafka Kubernetes gRPC AWS"),
];
const vec: Record<string, number[]> = {
  s: [1, 0, 0], b1: [0.9, 0.1, 0], b2: [0.1, 0.9, 0], b3: [0, 0, 1], b4: [0.8, 0.3, 0],
  b5: [0.7, 0.2, 0.1], b6: [-1, 0, 0], sk: [0.5, 0.5, 0],
};
const chunkVectors = chunks.map((c) => ({ id: c.id, vector: vec[c.id] }));
const queryVector = [1, 0.1, 0];
const query = "latency kubernetes payments";
const get = (id: string) => STRATEGIES.find((s) => s.id === id)!;
const ids = (r: { id: string }[]) => r.map((c) => c.id);

test("registry order and flags", () => {
  assert.deepStrictEqual(STRATEGIES.map((s) => s.id), [
    "keyword", "embeddings", "hybrid", "hybrid+rerank", "embeddings+rerank", "hybrid+rerank@30", "embeddings+rerank@30",
  ]);
  assert.deepStrictEqual(STRATEGIES.map((s) => s.needsEmbeddings), [false, true, true, true, true, true, true]);
  for (const s of STRATEGIES.filter((x) => x.id.includes("rerank"))) assert.strictEqual(typeof s.prepare, "function");
});

test("keyword equals retrieveVault", async () => {
  const out = await get("keyword").retrieve({ chunks, query, limit: 8 });
  assert.deepStrictEqual(ids(out), ids(retrieveVault(chunks, query, 8)));
});

test("hybrid equals retrieveVault with semanticRanking", async () => {
  const out = await get("hybrid").retrieve({ chunks, query, limit: 8, embeddings: { queryVector, chunkVectors } });
  assert.deepStrictEqual(ids(out), ids(retrieveVault(chunks, query, 8, semanticRanking(queryVector, chunkVectors))));
});

test("embeddings: summary first, semantic order, 3 per title, threshold", async () => {
  const out = await get("embeddings").retrieve({ chunks, query, limit: 8, embeddings: { queryVector, chunkVectors } });
  assert.strictEqual(out[0].id, "s");
  assert.ok(out.length <= 8);
  const expected = semanticRanking(queryVector, chunkVectors).filter((id) => id !== "s");
  const perTitle = new Map<string, number>();
  const exp: string[] = [];
  for (const id of expected) {
    const t = chunks.find((c) => c.id === id)!.title;
    const n = perTitle.get(t) ?? 0;
    if (n >= 3) continue;
    perTitle.set(t, n + 1);
    exp.push(id);
  }
  assert.deepStrictEqual(ids(out).slice(1), exp);
  for (const c of out) assert.ok(cosine(queryVector, vec[c.id]) >= 0.15);
  assert.ok(!ids(out).includes("b6"));
  assert.ok(!ids(out).includes("b3"));
  assert.ok(Math.max(...perTitle.values()) <= 3);
});

test("embeddings without vectors throws", () => {
  assert.throws(() => get("embeddings").retrieve({ chunks, query, limit: 8 }), /needs embeddings/);
});

test("strategies module does not load transformers", () => {
  const source = readFileSync(require.resolve("../evals/retrieval/strategies.js"), "utf8");
  assert.ok(
    !/require\(["'](@huggingface\/transformers|\.\/embedder|\.\/reranker)/.test(source),
    "strategies.ts must not statically import the embedder, reranker or transformers",
  );
});
