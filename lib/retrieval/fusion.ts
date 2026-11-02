// ─── Hybrid retrieval math ───────────────────────────────────────────────────
// Reciprocal Rank Fusion combines a lexical ranking (BM25) and a semantic one
// (embedding cosine) without having to calibrate their very different score
// scales: each list contributes 1 / (k + rank). k = 60 is the standard choice
// from the original RRF paper; it damps the dominance of any single top hit.

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Ids ordered by similarity to the query vector, best first. */
export function semanticRanking(query: ArrayLike<number>, vectors: { id: string; vector: ArrayLike<number> }[], minScore = 0.15): string[] {
  return vectors
    .map((v) => ({ id: v.id, score: cosine(query, v.vector) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);
}

export function reciprocalRankFusion(rankings: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Stable short hash of a string (FNV-1a), used to detect chunks whose text changed. */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
