// ─── Vault retrieval ─────────────────────────────────────────────────────────
// Runs in the browser so the whole vault never has to leave the device:
// rank chunks against the task with BM25, diversify so one role can't take
// every slot, and always include the summary as an anchor. Only the result
// of this function is sent with a run.

import { Bm25Index } from "../retrieval/bm25";
import { reciprocalRankFusion } from "../retrieval/fusion";
import type { VaultChunk, VaultContextChunk } from "../engine/types";

/** Kinds that hold specific, citable evidence get a small boost over containers. */
const KIND_WEIGHT: Partial<Record<VaultChunk["kind"], number>> = {
  bullet: 1.15,
  story: 1.25,
  win: 1.2,
  project: 1.05,
  experience: 0.8,
};

/** Above this, a tool wants the whole resume rather than the most relevant slice. */
export const WHOLE_RESUME_LIMIT = 12;

/**
 * @param semanticOrder chunk ids ranked by embedding similarity to the query.
 *   When given, it's fused with the BM25 ranking (hybrid retrieval); when not,
 *   retrieval is keyword-only.
 */
export function retrieveVault(chunks: VaultChunk[], query: string, limit = 8, semanticOrder?: string[]): VaultContextChunk[] {
  if (!chunks.length) return [];
  const toContext = (c: VaultChunk): VaultContextChunk => ({ id: c.id, kind: c.kind, title: c.title, text: c.text });

  if (limit > WHOLE_RESUME_LIMIT) {
    // Whole-resume tools (tailoring, ATS, fit) need structure, not ranking: keep
    // document order, and drop role/project containers whose bullets are present
    // (each bullet's title already carries the role heading).
    const titlesWithBullets = new Set(chunks.filter((c) => c.kind === "bullet").map((c) => c.title));
    const whole = chunks.filter((c) => !((c.kind === "experience" || c.kind === "project") && titlesWithBullets.has(c.title)));
    if (whole.length <= limit) return whole.map(toContext);
    // Too big: keep the most relevant, still in document order.
    const index = new Bm25Index(whole.map((c) => ({ id: c.id, text: `${c.title} ${c.text}` })));
    const keep = new Set(index.search(query, limit).map((h) => h.id));
    for (const c of whole) if (keep.size < limit) keep.add(c.id);
    return whole.filter((c) => keep.has(c.id)).map(toContext);
  }

  const { summary, ranked } = rankVault(chunks, query, semanticOrder);
  return selectWithAnchor(summary, ranked, limit);
}

/**
 * The pre-selection ranking behind retrieveVault: summary anchor plus the pool
 * ranked by BM25 (optionally RRF-fused with semanticOrder), or recency with no query.
 */
export function rankVault(chunks: VaultChunk[], query: string, semanticOrder?: string[]): { summary: VaultChunk | undefined; ranked: VaultChunk[] } {
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
    if (semanticOrder?.length) {
      // Hybrid: semantic recall catches paraphrases BM25 misses ("shipped faster" vs
      // "reduced lead time"); BM25 keeps exact terms like tool names on top.
      const semantic = semanticOrder.filter((id) => byId.has(id));
      ranked = reciprocalRankFusion([ranked.map((c) => c.id), semantic]).map((id) => byId.get(id)!);
    }
  } else {
    // No query: most recent evidence first.
    ranked = [...pool].filter((c) => c.kind !== "experience").sort((a, b) => b.createdAt - a.createdAt);
  }

  return { summary, ranked };
}

/**
 * Embeddings-only ranking, measured in the eval and available to the app if the
 * Phase 2 decision switches modes.
 */
export function rankBySemantic(chunks: VaultChunk[], semanticOrder: string[]): { summary: VaultChunk | undefined; ranked: VaultChunk[] } {
  const summary = chunks.find((c) => c.kind === "summary");
  const pool = chunks.filter((c) => c !== summary);
  const byId = new Map(pool.map((c) => [c.id, c]));
  const ranked = semanticOrder.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  return { summary, ranked };
}

/**
 * Diversity (at most 3 chunks per title) plus summary anchoring. Exported for
 * the retrieval eval harness so embeddings-only and the rerank strategies are
 * measured on equal terms.
 */
export function selectWithAnchor(summary: VaultChunk | undefined, ranked: VaultChunk[], limit: number): VaultContextChunk[] {
  const toContext = (c: VaultChunk): VaultContextChunk => ({ id: c.id, kind: c.kind, title: c.title, text: c.text });
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
