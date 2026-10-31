// The Phase 2 decision rule (evals/retrieval/DECISION.md) as a pure function.
// Imports metrics, stats and the pure rerank constants only; never run.ts. No clock,
// no files, no randomness beyond the seeded bootstrap, so the same results JSON
// always gives the same decision.
import { RERANK_TOP_N } from "../../lib/retrieval/rerank";
import { PRIMARY_METRIC, percentile, type MetricKey, type MetricSet } from "./metrics";
import { pairedBootstrapCI } from "./stats";

// Single source of truth: the strategies rerank exactly this N (lib/retrieval/rerank.ts).
export { RERANK_TOP_N };

export const DECISION_RULE_VERSION = 1;
export const DECISION_METRIC: MetricKey = PRIMARY_METRIC;
export const BOOTSTRAP_ITERATIONS = 10000;
export const BOOTSTRAP_SEED = 20261031;
export const BOOTSTRAP_CONFIDENCE = 0.95;
export const ADDED_LATENCY_BUDGET_MS = 150;
/** Sensitivity top N; reported but never adopted by the decision rule. */
export const SENSITIVITY_TOP_N = 30;
export const SHIPPED_STRATEGY = "hybrid";
export const EXISTING_STRATEGIES = ["keyword", "embeddings", "hybrid"] as const;
export const RERANK_CANDIDATES = [
  { id: "hybrid+rerank", base: "hybrid", topN: RERANK_TOP_N },
  { id: "embeddings+rerank", base: "embeddings", topN: RERANK_TOP_N },
] as const;
export const SENSITIVITY_STRATEGIES = [
  { id: "hybrid+rerank@30", base: "hybrid", topN: SENSITIVITY_TOP_N },
  { id: "embeddings+rerank@30", base: "embeddings", topN: SENSITIVITY_TOP_N },
] as const;
/** Every strategy decide() needs; run.ts only calls decide() when all of them ran. */
export const DECISION_STRATEGY_IDS: readonly string[] = [...EXISTING_STRATEGIES, ...RERANK_CANDIDATES.map((c) => c.id)];
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
  a: StrategyRun,
  b: StrategyRun,
  scope: Scope = "overall",
  metric: MetricKey = DECISION_METRIC,
): PairedComparison {
  if (a.perQuery.length !== b.perQuery.length || a.perQuery.some((q, i) => q.id !== b.perQuery[i].id)) {
    throw new Error(`pairedComparison: ${a.id} and ${b.id} have different query order or length`);
  }
  const deltas: number[] = [];
  for (let i = 0; i < a.perQuery.length; i++) {
    if (scope !== "overall" && a.perQuery[i].type !== scope) continue;
    deltas.push(a.perQuery[i].metrics[metric] - b.perQuery[i].metrics[metric]);
  }
  const { mean, lo, hi } = pairedBootstrapCI(deltas, {
    iterations: BOOTSTRAP_ITERATIONS,
    seed: BOOTSTRAP_SEED,
    confidence: BOOTSTRAP_CONFIDENCE,
  });
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (const d of deltas) {
    if (Math.abs(d) <= TIE_EPSILON) ties++;
    else if (d > 0) wins++;
    else losses++;
  }
  return { a: a.id, b: b.id, scope, metric, n: deltas.length, meanDelta: mean, lo, hi, wins, ties, losses };
}

export function addedLatency(s: StrategyRun, base: StrategyRun): AddedLatency {
  // Same guard as pairedComparison: differences are taken by position, so the
  // query ids must line up one to one.
  if (s.perQuery.length !== base.perQuery.length || s.perQuery.some((q, i) => q.id !== base.perQuery[i].id)) {
    throw new Error(`addedLatency: ${s.id} and ${base.id} have different query order or length`);
  }
  const diffs = s.perQuery.map((q, i) => q.totalMs - base.perQuery[i].totalMs);
  return { id: s.id, baseId: base.id, p50: percentile(diffs, 50), p95: percentile(diffs, 95) };
}

const f4 = (x: number) => x.toFixed(4);
const f2 = (x: number) => x.toFixed(2);

export function decide(strategies: StrategyRun[]): Decision {
  const byId = new Map(strategies.map((s) => [s.id, s]));
  const need = (id: string): StrategyRun => {
    const s = byId.get(id);
    if (!s) throw new Error(`decide: missing required strategy "${id}"`);
    return s;
  };
  for (const id of DECISION_STRATEGY_IDS) need(id);

  const metric = DECISION_METRIC;
  const reasons: string[] = [];

  let bestExisting = { id: "", value: -Infinity };
  for (const id of EXISTING_STRATEGIES) {
    const v = need(id).overall[metric];
    if (v > bestExisting.value) bestExisting = { id, value: v };
  }
  reasons.push(`Best existing strategy on ${metric}: ${bestExisting.id} = ${f4(bestExisting.value)}.`);

  const shipped = need(SHIPPED_STRATEGY);
  const candidates: CandidateCheck[] = [];
  for (const c of RERANK_CANDIDATES) {
    const s = need(c.id);
    const value = s.overall[metric];
    const beatsBest = value > bestExisting.value;
    const delta = pairedComparison(s, shipped);
    const ciExcludesZero = delta.lo > 0;
    const lat = addedLatency(s, need(c.base));
    const latencyOk = lat.p50 <= ADDED_LATENCY_BUDGET_MS;
    const eligible = beatsBest && ciExcludesZero && latencyOk;
    candidates.push({
      id: c.id,
      base: c.base,
      value,
      beatsBest,
      deltaVsShipped: delta,
      ciExcludesZero,
      addedLatencyP50: lat.p50,
      latencyOk,
      eligible,
    });
    reasons.push(
      `${c.id} (top ${c.topN}): ${metric} ${f4(value)} ${beatsBest ? ">" : "<="} best existing ${f4(bestExisting.value)}; ` +
        `delta vs ${SHIPPED_STRATEGY} ${f4(delta.meanDelta)} 95% CI [${f4(delta.lo)}, ${f4(delta.hi)}] ` +
        `${ciExcludesZero ? "excludes" : "includes"} 0; ` +
        `added p50 latency ${f2(lat.p50)} ms ${latencyOk ? "within" : "exceeds"} the ${ADDED_LATENCY_BUDGET_MS} ms latency budget; ` +
        `${eligible ? "eligible" : "not eligible"}.`,
    );
  }

  const eligible = candidates.filter((c) => c.eligible);
  let rerankAdopted: Decision["rerankAdopted"] = null;
  if (eligible.length > 0) {
    // Strict > keeps the earlier (hybrid+rerank) candidate on an exact tie.
    let best = eligible[0];
    for (const c of eligible.slice(1)) if (c.value > best.value) best = c;
    rerankAdopted = best.id as "hybrid+rerank" | "embeddings+rerank";
    reasons.push(`R1: adopt ${rerankAdopted} (${metric} ${f4(best.value)}).`);
  } else {
    reasons.push("R1: no candidate is eligible; no reranker ships.");
  }

  const emb = need("embeddings");
  const switchDelta = pairedComparison(emb, shipped);
  const switchToEmbeddings = emb.overall[metric] > shipped.overall[metric] && switchDelta.lo > 0;
  const baseMode: Decision["baseMode"] = switchToEmbeddings ? "embeddings" : "hybrid";
  reasons.push(
    `R2: embeddings minus hybrid ${f4(switchDelta.meanDelta)} 95% CI [${f4(switchDelta.lo)}, ${f4(switchDelta.hi)}]; ` +
      `base mode ${baseMode}.`,
  );

  return {
    ruleVersion: DECISION_RULE_VERSION,
    metric,
    bestExisting,
    candidates,
    rerankAdopted,
    switchCheck: { delta: switchDelta, switchToEmbeddings },
    baseMode,
    reasons,
  };
}
