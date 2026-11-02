// Pure IR metrics for the retrieval eval. No browser, fs or vault imports.

export const METRIC_KEYS = ["recall@3", "recall@5", "recall@8", "mrr", "ndcg@3", "ndcg@5", "ndcg@8"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type MetricSet = Record<MetricKey, number>;

/** A chunk counts as relevant for recall and MRR when its grade is >= this. */
export const RELEVANCE_THRESHOLD = 2;

// Primary metric: nDCG@8. It is graded (rewards the evidence bullet over its
// container), covers the full 8-chunk context the app sends
// (DEFAULT_VAULT_LIMIT = 8), and is order-sensitive because the context
// assembler may truncate under token budget. Phase 2's reranker adoption
// decision reads this constant.
export const PRIMARY_METRIC: MetricKey = "ndcg@8";

type Relevance = Map<string, number>;

function dedupe(ranked: string[]): string[] {
  return [...new Set(ranked)];
}

export function recallAtK(ranked: string[], relevance: Relevance, k: number): number {
  let total = 0;
  for (const g of relevance.values()) if (g >= RELEVANCE_THRESHOLD) total++;
  if (total === 0) return 0;
  let hit = 0;
  for (const id of dedupe(ranked).slice(0, k)) if ((relevance.get(id) ?? 0) >= RELEVANCE_THRESHOLD) hit++;
  return hit / total;
}

/**
 * Reciprocal rank of the first relevant chunk. The mean over queries is MRR;
 * since strategies return at most 8 items it is effectively MRR@8.
 */
export function reciprocalRank(ranked: string[], relevance: Relevance): number {
  const list = dedupe(ranked);
  for (let i = 0; i < list.length; i++) {
    if ((relevance.get(list[i]) ?? 0) >= RELEVANCE_THRESHOLD) return 1 / (i + 1);
  }
  return 0;
}

const gain = (g: number) => Math.pow(2, g) - 1;

function dcg(grades: number[], k: number): number {
  let sum = 0;
  for (let i = 0; i < Math.min(k, grades.length); i++) sum += gain(grades[i]) / Math.log2(i + 2);
  return sum;
}

export function ndcgAtK(ranked: string[], relevance: Relevance, k: number): number {
  const actual = dcg(dedupe(ranked).map((id) => relevance.get(id) ?? 0), k);
  const ideal = dcg([...relevance.values()].filter((g) => g > 0).sort((a, b) => b - a), k);
  return ideal === 0 ? 0 : actual / ideal;
}

export function scoreQuery(ranked: string[], relevance: Relevance): MetricSet {
  return {
    "recall@3": recallAtK(ranked, relevance, 3),
    "recall@5": recallAtK(ranked, relevance, 5),
    "recall@8": recallAtK(ranked, relevance, 8),
    mrr: reciprocalRank(ranked, relevance),
    "ndcg@3": ndcgAtK(ranked, relevance, 3),
    "ndcg@5": ndcgAtK(ranked, relevance, 5),
    "ndcg@8": ndcgAtK(ranked, relevance, 8),
  };
}

export function aggregate(sets: MetricSet[]): MetricSet {
  const out = Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) as MetricSet;
  if (sets.length === 0) return out;
  for (const k of METRIC_KEYS) out[k] = sets.reduce((s, m) => s + m[k], 0) / sets.length;
  return out;
}

/** Nearest-rank percentile on a sorted copy; 0 for empty input. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}
