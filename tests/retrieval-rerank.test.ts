// Offline tests of the rerank core with fake scorers (no model download).
import assert from "node:assert";
import { test } from "node:test";
import type { VaultChunk } from "../lib/engine/types";
import { semanticRanking } from "../lib/retrieval/fusion";
import { rerankCandidates, rerankPassage, type PairScorer } from "../lib/retrieval/rerank";
import { rankBySemantic, rankVault, retrieveVault, selectWithAnchor } from "../lib/vault/retrieve";

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
const ids = (r: { id: string }[]) => r.map((c) => c.id);

const items = ["a", "b", "c", "d"].map((id) => ({ id, title: `T${id}`, text: `text ${id}` }));

test("rerankCandidates reorders head by score and keeps the tail", async () => {
  const out = await rerankCandidates("q", items, async () => [1, 3, 2], 3);
  assert.deepStrictEqual(ids(out), ["b", "c", "a", "d"]);
  assert.deepStrictEqual(ids(items), ["a", "b", "c", "d"]);
});

test("equal scores keep original order", async () => {
  const out = await rerankCandidates("q", items, async (_q, p) => p.map(() => 1), 4);
  assert.deepStrictEqual(ids(out), ["a", "b", "c", "d"]);
});

test("scorer receives min(topN, length) passages and truncated query", async () => {
  let seen: { q: string; p: string[] } | undefined;
  const scorer: PairScorer = async (q, p) => {
    seen = { q, p };
    return p.map((_, i) => -i);
  };
  await rerankCandidates("x".repeat(3000), items, scorer, 2);
  assert.strictEqual(seen!.q.length, 2000);
  assert.deepStrictEqual(seen!.p, [rerankPassage(items[0]), rerankPassage(items[1])]);
  assert.strictEqual(seen!.p[0], "Ta: text a");
  await rerankCandidates("q", items.slice(0, 3), scorer, 20);
  assert.strictEqual(seen!.p.length, 3);
});

test("empty query or fewer than 2 candidates skips the scorer", async () => {
  const scorer: PairScorer = async () => {
    throw new Error("must not be called");
  };
  assert.deepStrictEqual(ids(await rerankCandidates("   ", items, scorer)), ["a", "b", "c", "d"]);
  assert.deepStrictEqual(ids(await rerankCandidates("q", items.slice(0, 1), scorer)), ["a"]);
  assert.deepStrictEqual(await rerankCandidates("q", [], scorer), []);
});

test("bad scorer output rejects", async () => {
  await assert.rejects(rerankCandidates("q", items, async () => [1, 2], 3), /2 scores for 3 passages/);
  await assert.rejects(rerankCandidates("q", items, async () => [1, NaN, 2], 3), /index 1/);
});

test("rankVault + selectWithAnchor equals retrieveVault", () => {
  const semantic = semanticRanking(queryVector, chunkVectors);
  for (const [q, sem] of [[query, undefined], [query, semantic], ["", undefined]] as const) {
    const { summary, ranked } = rankVault(chunks, q, sem as string[] | undefined);
    assert.deepStrictEqual(selectWithAnchor(summary, ranked, 8), retrieveVault(chunks, q, 8, sem as string[] | undefined));
  }
});

test("rankBySemantic excludes the summary and keeps semantic order", () => {
  const semantic = semanticRanking(queryVector, chunkVectors);
  const { summary, ranked } = rankBySemantic(chunks, semantic);
  assert.strictEqual(summary!.id, "s");
  assert.deepStrictEqual(ids(ranked), semantic.filter((id) => id !== "s"));
  const out = selectWithAnchor(summary, ranked, 8);
  assert.strictEqual(out[0].id, "s");
});
