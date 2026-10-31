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

// ─── createRerankStrategy ────────────────────────────────────────────────────
import { STRATEGIES, createRerankStrategy } from "../evals/retrieval/strategies";

const get = (id: string) => STRATEGIES.find((s) => s.id === id)!;
const embeddings = { queryVector, chunkVectors };
const orderPreserving: PairScorer = async (_q, p) => p.map((_, i) => -i);
const build = (base: "hybrid" | "embeddings", topN: number, scorer: PairScorer) =>
  createRerankStrategy({ id: `r-${base}`, label: "r", base, topN, loadScorer: async () => scorer });

test("order-preserving scorer reproduces the base strategy", async () => {
  for (const limit of [5, 8, 12, 13, 20]) {
    for (const base of ["hybrid", "embeddings"] as const) {
      const s = build(base, 20, orderPreserving);
      await s.prepare!();
      const out = await s.retrieve({ chunks, query, limit, embeddings });
      const expected = await get(base).retrieve({ chunks, query, limit, embeddings });
      assert.deepStrictEqual(ids(out), ids(expected), `${base} at limit ${limit}`);
    }
  }
});

test("embeddings+rerank still reranks at whole-resume limits, like its base ranks", async () => {
  // The embeddings base ranks by cosine at every limit (no whole-resume path).
  const base = await get("embeddings").retrieve({ chunks, query, limit: 20, embeddings });
  assert.deepStrictEqual(ids(base), ["s", "b1", "b5", "b4", "sk", "b2"]);
  const favourB2: PairScorer = async (_q, p) => p.map((t) => (t === rerankPassage(chunks.find((c) => c.id === "b2")!) ? 10 : 0));
  const s = build("embeddings", 20, favourB2);
  await s.prepare!();
  const out = await s.retrieve({ chunks, query, limit: 20, embeddings });
  assert.deepStrictEqual(ids(out), ["s", "b2", "b1", "b5", "b4", "sk"]);
});

test("favoured chunk is promoted inside topN and not pulled in outside it", async () => {
  const base = await get("hybrid").retrieve({ chunks, query, limit: 8, embeddings });
  const baseIds = ids(base).slice(1);
  assert.ok(baseIds.length >= 3);
  const favour = (target: string): PairScorer => async (_q, p) =>
    p.map((t) => (t === rerankPassage(chunks.find((c) => c.id === target)!) ? 10 : 0));

  const inside = baseIds[1];
  const s1 = build("hybrid", 2, favour(inside));
  await s1.prepare!();
  const out1 = await s1.retrieve({ chunks, query, limit: 8, embeddings });
  assert.strictEqual(out1[0].id, "s");
  assert.strictEqual(out1[1].id, inside);

  const outside = baseIds[2];
  const s2 = build("hybrid", 2, favour(outside));
  await s2.prepare!();
  const out2 = await s2.retrieve({ chunks, query, limit: 8, embeddings });
  assert.deepStrictEqual(ids(out2), ids(base));
});

test("selection rules still apply after rerank", async () => {
  const loves: PairScorer = async (_q, p) => p.map((t) => (t.startsWith("Eng @ Zeta") ? 10 : 0));
  const s = build("hybrid", 20, loves);
  await s.prepare!();
  const out = await s.retrieve({ chunks, query, limit: 5, embeddings });
  assert.strictEqual(out[0].id, "s");
  assert.ok(out.length <= 5);
  assert.ok(out.filter((c) => c.title === "Eng @ Zeta").length <= 3);
});

test("retrieve before prepare rejects; prepare is memoised", async () => {
  let loads = 0;
  const s = createRerankStrategy({
    id: "r", label: "r", base: "hybrid", topN: 5,
    loadScorer: async () => {
      loads++;
      return orderPreserving;
    },
  });
  await assert.rejects(async () => s.retrieve({ chunks, query, limit: 8, embeddings }), /prepare/);
  await s.prepare!();
  await s.prepare!();
  assert.strictEqual(loads, 1);
});

test("rerank retrieve without embeddings rejects", async () => {
  const s = build("hybrid", 5, orderPreserving);
  await s.prepare!();
  await assert.rejects(async () => s.retrieve({ chunks, query, limit: 8 }), /needs embeddings/);
});

test("whole-resume limit bypasses the scorer for hybrid", async () => {
  const s = build("hybrid", 5, async () => {
    throw new Error("must not be called");
  });
  await s.prepare!();
  const out = await s.retrieve({ chunks, query, limit: 20, embeddings });
  assert.deepStrictEqual(out, retrieveVault(chunks, query, 20));
  assert.deepStrictEqual(out, await get("hybrid").retrieve({ chunks, query, limit: 20, embeddings }));
});
