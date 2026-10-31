// Pure, environment-agnostic reranking. The (query, passages) scorer is injected,
// so the Node eval and the browser app run the same code; only model loading differs.
import type { VaultChunk } from "../engine/types";
import { embeddingQuery, embeddingText } from "./embedText";

/** Scores each passage against the query; higher is more relevant. One score per passage. */
export type PairScorer = (query: string, passages: string[]) => Promise<number[]>;

// Plan 02-05 verifies the primary model loads in Node and switches RERANK_MODEL to
// the fallback only if it cannot, recording the reason in evals/retrieval/DECISION.md.
export const RERANK_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2";
export const RERANK_DTYPE = "q8" as const;
export const RERANK_TOP_N = 20;
export const RERANK_FALLBACK_MODEL = "mixedbread-ai/mxbai-rerank-xsmall-v1";

/** Passage text the reranker sees: identical to what the embedder sees. */
export function rerankPassage(c: Pick<VaultChunk, "title" | "text">): string {
  return embeddingText(c);
}

/**
 * Reorders the top `topN` of `ranked` by scorer output (stable on ties) and keeps
 * the tail in place. Never mutates the input.
 */
export async function rerankCandidates<T extends Pick<VaultChunk, "title" | "text">>(
  query: string,
  ranked: T[],
  score: PairScorer,
  topN: number = RERANK_TOP_N,
): Promise<T[]> {
  const n = Math.min(topN, ranked.length);
  if (!query.trim() || n < 2) return [...ranked];

  const head = ranked.slice(0, n);
  const scores = await score(embeddingQuery(query), head.map(rerankPassage));
  if (!Array.isArray(scores) || scores.length !== head.length) {
    throw new Error(`Reranker returned ${Array.isArray(scores) ? scores.length : "no"} scores for ${head.length} passages`);
  }
  scores.forEach((s, i) => {
    if (typeof s !== "number" || !Number.isFinite(s)) throw new Error(`Reranker returned a non-finite score at index ${i}`);
  });

  const order = head
    .map((item, index) => ({ item, index, s: scores[index] }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.item);
  return [...order, ...ranked.slice(n)];
}
