// Stub (RED phase). Implemented in the GREEN commit.
import { PRIMARY_METRIC, type MetricKey, type MetricSet } from "./metrics";

export const DECISION_RULE_VERSION = 1;
export const DECISION_METRIC: MetricKey = PRIMARY_METRIC;
export const BOOTSTRAP_ITERATIONS = 10000;
export const BOOTSTRAP_SEED = 20261031;
export const BOOTSTRAP_CONFIDENCE = 0.95;
export const ADDED_LATENCY_BUDGET_MS = 150;
export const SHIPPED_STRATEGY = "hybrid";
export const EXISTING_STRATEGIES = ["keyword", "embeddings", "hybrid"] as const;
export const RERANK_CANDIDATES = [
  { id: "hybrid+rerank", base: "hybrid" },
  { id: "embeddings+rerank", base: "embeddings" },
] as const;
export const SENSITIVITY_STRATEGIES = [
  { id: "hybrid+rerank@30", base: "hybrid" },
  { id: "embeddings+rerank@30", base: "embeddings" },
] as const;
export const TIE_EPSILON = 1e-9;

export interface StrategyRun {
  id: string;
  overall: MetricSet;
  perQuery: { id: string; type: "lexical" | "paraphrase"; metrics: MetricSet; totalMs: number }[];
}
export type Scope = "overall" | "lexical" | "paraphrase";
export interface PairedComparison {
  a: string;
  b: string;
  scope: Scope;
  metric: MetricKey;
  n: number;
  meanDelta: number;
  lo: number;
  hi: number;
  wins: number;
  ties: number;
  losses: number;
}
export interface AddedLatency {
  id: string;
  baseId: string;
  p50: number;
  p95: number;
}
export interface CandidateCheck {
  id: string;
  base: string;
  value: number;
  beatsBest: boolean;
  deltaVsShipped: PairedComparison;
  ciExcludesZero: boolean;
  addedLatencyP50: number;
  latencyOk: boolean;
  eligible: boolean;
}
export interface Decision {
  ruleVersion: number;
  metric: MetricKey;
  bestExisting: { id: string; value: number };
  candidates: CandidateCheck[];
  rerankAdopted: "hybrid+rerank" | "embeddings+rerank" | null;
  switchCheck: { delta: PairedComparison; switchToEmbeddings: boolean };
  baseMode: "hybrid" | "embeddings";
  reasons: string[];
}

export function pairedComparison(
  _a: StrategyRun,
  _b: StrategyRun,
  _scope: Scope = "overall",
  _metric: MetricKey = DECISION_METRIC,
): PairedComparison {
  throw new Error("not implemented");
}

export function addedLatency(_s: StrategyRun, _base: StrategyRun): AddedLatency {
  throw new Error("not implemented");
}

export function decide(_strategies: StrategyRun[]): Decision {
  throw new Error("not implemented");
}
