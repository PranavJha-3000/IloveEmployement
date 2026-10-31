// ─── Vault retrieval ─────────────────────────────────────────────────────────
// Runs in the browser so the whole vault never has to leave the device:
// rank chunks against the task with BM25, diversify so one role can't take
// every slot, and always include the summary as an anchor. Only the result
// of this function is sent with a run.

import { Bm25Index } from "../retrieval/bm25";
import type { VaultChunk, VaultContextChunk } from "../engine/types";

/** Kinds that hold specific, citable evidence get a small boost over containers. */
const KIND_WEIGHT: Partial<Record<VaultChunk["kind"], number>> = {
  bullet: 1.15,
  story: 1.25,
  win: 1.2,
  project: 1.05,
  experience: 0.8,
};

export function retrieveVault(chunks: VaultChunk[], query: string, limit = 8): VaultContextChunk[] {
  if (!chunks.length) return [];
  const toContext = (c: VaultChunk): VaultContextChunk => ({ id: c.id, kind: c.kind, title: c.title, text: c.text });

  const summary = chunks.find((c) => c.kind === "summary");
  const pool = chunks.filter((c) => c !== summary);
  const byId = new Map(pool.map((c) => [c.id, c]));

  let ranked: VaultChunk[];
  if (query.trim()) {
    const index = new Bm25Index(pool.map((c) => ({ id: c.id, text: `${c.title} ${c.text}` })));
    ranked = index
      .search(query, pool.length)
      .map((h) => ({ chunk: byId.get(h.id)!, score: h.score * (KIND_WEIGHT[byId.get(h.id)!.kind] ?? 1) }))
      .sort((a, b) => b.score - a.score)
      .map((h) => h.chunk);
  } else {
    // No query: most recent evidence first.
    ranked = [...pool].filter((c) => c.kind !== "experience").sort((a, b) => b.createdAt - a.createdAt);
  }

  // Diversity: at most 3 chunks under the same role/title.
  const perTitle = new Map<string, number>();
  const picked: VaultChunk[] = [];
  for (const c of ranked) {
    const n = perTitle.get(c.title) ?? 0;
    if (n >= 3) continue;
    perTitle.set(c.title, n + 1);
    picked.push(c);
    if (picked.length >= limit - (summary ? 1 : 0)) break;
  }

  return [...(summary ? [summary] : []), ...picked].map(toContext);
}
