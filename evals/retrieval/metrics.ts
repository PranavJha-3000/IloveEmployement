// Stub (RED phase).
export const METRIC_KEYS = ["recall@3", "recall@5", "recall@8", "mrr", "ndcg@3", "ndcg@5", "ndcg@8"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type MetricSet = Record<MetricKey, number>;
export const RELEVANCE_THRESHOLD = 0;
export const PRIMARY_METRIC: MetricKey = "mrr";
export const recallAtK = (_r: string[], _rel: Map<string, number>, _k: number): number => 0;
export const reciprocalRank = (_r: string[], _rel: Map<string, number>): number => 0;
export const ndcgAtK = (_r: string[], _rel: Map<string, number>, _k: number): number => 0;
export const scoreQuery = (_r: string[], _rel: Map<string, number>): MetricSet =>
  Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) as MetricSet;
export const aggregate = (_s: MetricSet[]): MetricSet => scoreQuery([], new Map());
export const percentile = (_v: number[], _p: number): number => 0;
