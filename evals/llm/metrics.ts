// ─── Metric aggregation ──────────────────────────────────────────────────────
// Pure functions (no fs, no clock) implementing evals/llm/RUBRIC.md
// "Metric definitions". Division by zero yields null, never NaN or 0.
// Errored cases count as behavioural failures and are excluded from every
// judge, citation and fabrication denominator. Outputs whose judge call failed
// are excluded from judged denominators and reported as `judgeErrors`.

import type { RunMeta } from "../../lib/engine/types";
import type { CitationUnit } from "./citations";
import type { JudgeResult } from "./judge";
import { estimateCostUsd, type PriceRow } from "./prices";
import type { CallRecord } from "./recordingModel";
import { RUBRIC_DIMENSIONS, type RubricDimension } from "./rubric";

/** Price row for a model key such as "google:gemini-3.6-flash", or null when unknown. */
export type PriceLookup = (modelKey: string) => PriceRow | null;

export interface CaseOutcome {
  caseId: string;
  engine: string;
  tags: string[];
  modelKey: string;
  ok: boolean;
  error?: string;
  passed: boolean;
  failures: string[];
  meta?: RunMeta;
  calls: CallRecord[];
  judgeCalls: CallRecord[];
  units: CitationUnit[];
  judge?: JudgeResult;
}

export interface TokenTotals {
  prompt: number;
  completion: number;
  thoughts: number;
  total: number;
  /** A component is partial when some successful call did not report it. */
  partial: { prompt: boolean; completion: boolean; thoughts: boolean };
}

export interface CaseMetrics {
  tokens: TokenTotals;
  judgeTokens: TokenTotals;
  latencyMs: number | null;
  costUsd: number | null;
  judgeCostUsd: number | null;
  callsByRole: Record<string, number>;
  failedCalls: number;
  guardrails: { injectionFlags: number; droppedCitations: number; unsupportedFigureWarnings: number; reviewIssues: number; revised: boolean };
  citation: { units: number; validIds: number; supports: number; partial: number; doesNotSupport: number; unjudged: number; judged: boolean };
  fabrication: {
    supportedClaims: number;
    unsupportedClaims: number;
    judgeFlag: boolean | null;
    figureFlag: boolean;
    combinedFlag: boolean | null;
  };
}

/** Nearest rank, the convention used in evals/retrieval: sorted[min(n-1, floor(n*q))]. */
export function percentile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

function tokenTotals(calls: CallRecord[]): TokenTotals {
  const t: TokenTotals = { prompt: 0, completion: 0, thoughts: 0, total: 0, partial: { prompt: false, completion: false, thoughts: false } };
  for (const c of calls) {
    if (c.error) continue;
    if (c.promptTokens === null) t.partial.prompt = true; else t.prompt += c.promptTokens;
    if (c.completionTokens === null) t.partial.completion = true; else t.completion += c.completionTokens;
    if (c.thoughtsTokens === null) t.partial.thoughts = true; else t.thoughts += c.thoughtsTokens;
  }
  t.total = t.prompt + t.completion + t.thoughts;
  return t;
}

/** Sum of per-call estimates; null when there is no successful call, no price, or an unknown token count. */
function callsCost(calls: CallRecord[], priceLookup: PriceLookup): number | null {
  const good = calls.filter((c) => !c.error);
  if (good.length === 0) return null;
  let total = 0;
  for (const c of good) {
    const cost = estimateCostUsd(
      { promptTokens: c.promptTokens, completionTokens: c.completionTokens, thoughtsTokens: c.thoughtsTokens },
      priceLookup(c.modelKey),
    );
    if (cost === null) return null;
    total += cost;
  }
  return total;
}

export function caseMetrics(outcome: CaseOutcome, priceLookup: PriceLookup): CaseMetrics {
  const gen = outcome.calls.filter((c) => c.purpose === "generation");
  const goodGen = gen.filter((c) => !c.error);
  const callsByRole: Record<string, number> = {};
  for (const c of goodGen) callsByRole[c.role] = (callsByRole[c.role] ?? 0) + 1;
  const latencies = goodGen.map((c) => c.latencyMs).filter((l): l is number => l !== null);

  // Same counters as evals/run.ts.
  const meta = outcome.meta;
  const guardrails = {
    injectionFlags: meta ? meta.injection.reduce((n, i) => n + i.findings.length, 0) : 0,
    droppedCitations: meta ? meta.grounding.filter((g) => g.startsWith("Dropped")).length : 0,
    unsupportedFigureWarnings: meta ? meta.grounding.filter((g) => g.includes("figures")).length : 0,
    reviewIssues: meta?.review?.issues.filter((i) => i.severity !== "low").length ?? 0,
    revised: meta?.review?.revised ?? false,
  };

  const judge = outcome.judge;
  const judged = outcome.ok && judge?.ok === true;
  const validUnits = outcome.units.filter((u) => u.idValid);
  let supports = 0;
  let partial = 0;
  let doesNotSupport = 0;
  let unjudged = 0;
  let supportedClaims = 0;
  let unsupportedClaims = 0;
  if (judged && judge?.ok) {
    for (const u of validUnits) {
      const v = judge.citationVerdicts[u.index];
      if (v === "supports") supports++;
      else if (v === "partial") partial++;
      else if (v === "does_not_support") doesNotSupport++;
      else unjudged++;
    }
    for (const c of judge.claims) {
      if (c.status === "supported") supportedClaims++;
      else unsupportedClaims++;
    }
  }
  const figureFlag = guardrails.unsupportedFigureWarnings > 0;
  const judgeFlag = judged ? unsupportedClaims > 0 : null;

  return {
    tokens: tokenTotals(gen),
    judgeTokens: tokenTotals(outcome.judgeCalls),
    latencyMs: latencies.length ? sum(latencies) : null,
    costUsd: callsCost(gen, priceLookup),
    judgeCostUsd: callsCost(outcome.judgeCalls, priceLookup),
    callsByRole,
    failedCalls: gen.length - goodGen.length,
    guardrails,
    citation: { units: outcome.units.length, validIds: validUnits.length, supports, partial, doesNotSupport, unjudged, judged },
    fabrication: { supportedClaims, unsupportedClaims, judgeFlag, figureFlag, combinedFlag: judgeFlag === null ? null : judgeFlag || figureFlag },
  };
}

export interface ModelSummary {
  cases: number;
  passed: number;
  passRate: number | null;
  errors: number;
  judged: number;
  judgeErrors: number;
  outputsWithUnits: number;
  citationIdValidity: number | null;
  citationPrecisionStrict: number | null;
  citationPrecisionLenient: number | null;
  citation: { units: number; validIds: number; supports: number; partial: number; doesNotSupport: number; unjudged: number };
  claimFabricationRate: number | null;
  outputFabricationRate: number | null;
  figureOnlyFabricationRate: number | null;
  judgeMeans: Record<RubricDimension, number | null>;
  tokens: { prompt: number; completion: number; thoughts: number; total: number; meanPerCase: number | null; partialCases: number };
  judgeTokens: { prompt: number; completion: number; thoughts: number; total: number };
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  costTotalUsd: number | null;
  costPerCaseUsd: number | null;
  costKnownCases: number;
  costUnknownCases: number;
  judgeCostTotalUsd: number | null;
  judgeCostUnknownOutputs: number;
}

export function modelSummary(outcomes: CaseOutcome[], priceLookup: PriceLookup): ModelSummary {
  const per = outcomes.map((o) => ({ o, m: caseMetrics(o, priceLookup) }));
  const okOnes = per.filter((p) => p.o.ok);
  const judgedOnes = per.filter((p) => p.m.citation.judged);
  const passed = per.filter((p) => p.o.ok && p.o.passed).length;

  // Citation id validity: deterministic, over every non-errored output.
  const allUnits = sum(okOnes.map((p) => p.m.citation.units));
  const validUnits = sum(okOnes.map((p) => p.m.citation.validIds));

  // Precision: judged outputs only; invalid ids stay in the denominator, unjudged units leave it.
  const jUnits = sum(judgedOnes.map((p) => p.m.citation.units));
  const jUnjudged = sum(judgedOnes.map((p) => p.m.citation.unjudged));
  const supports = sum(judgedOnes.map((p) => p.m.citation.supports));
  const partial = sum(judgedOnes.map((p) => p.m.citation.partial));
  const doesNotSupport = sum(judgedOnes.map((p) => p.m.citation.doesNotSupport));
  const precisionDen = jUnits - jUnjudged;

  const supported = sum(judgedOnes.map((p) => p.m.fabrication.supportedClaims));
  const unsupported = sum(judgedOnes.map((p) => p.m.fabrication.unsupportedClaims));

  const judgeMeans = {} as Record<RubricDimension, number | null>;
  for (const d of RUBRIC_DIMENSIONS) {
    const scores = judgedOnes.map((p) => (p.o.judge?.ok ? p.o.judge.scores[d] : 0));
    judgeMeans[d] = div(sum(scores), scores.length);
  }

  const tokenParts = per.map((p) => p.m.tokens);
  const tokenTotal = sum(tokenParts.map((t) => t.total));
  const casesWithTokens = per.filter((p) => p.m.callsByRole && Object.keys(p.m.callsByRole).length > 0).length;
  const jt = per.map((p) => p.m.judgeTokens);

  const latencies = okOnes.map((p) => p.m.latencyMs).filter((l): l is number => l !== null);
  const costs = per.map((p) => p.m.costUsd).filter((c): c is number => c !== null);
  const judgeCosts = per.map((p) => p.m.judgeCostUsd);
  const knownJudgeCosts = judgeCosts.filter((c): c is number => c !== null);
  const withJudgeCalls = per.filter((p) => p.o.judgeCalls.length > 0).length;

  return {
    cases: outcomes.length,
    passed,
    passRate: div(passed, outcomes.length),
    errors: per.filter((p) => !p.o.ok).length,
    judged: judgedOnes.length,
    judgeErrors: okOnes.filter((p) => p.o.judge && !p.o.judge.ok).length,
    outputsWithUnits: okOnes.filter((p) => p.m.citation.units > 0).length,
    citationIdValidity: div(validUnits, allUnits),
    citationPrecisionStrict: div(supports, precisionDen),
    citationPrecisionLenient: div(supports + partial, precisionDen),
    citation: { units: jUnits, validIds: sum(judgedOnes.map((p) => p.m.citation.validIds)), supports, partial, doesNotSupport, unjudged: jUnjudged },
    claimFabricationRate: div(unsupported, supported + unsupported),
    outputFabricationRate: div(judgedOnes.filter((p) => p.m.fabrication.combinedFlag === true).length, judgedOnes.length),
    figureOnlyFabricationRate: div(judgedOnes.filter((p) => p.m.fabrication.figureFlag).length, judgedOnes.length),
    judgeMeans,
    tokens: {
      prompt: sum(tokenParts.map((t) => t.prompt)),
      completion: sum(tokenParts.map((t) => t.completion)),
      thoughts: sum(tokenParts.map((t) => t.thoughts)),
      total: tokenTotal,
      meanPerCase: div(tokenTotal, casesWithTokens),
      partialCases: tokenParts.filter((t) => t.partial.prompt || t.partial.completion).length,
    },
    judgeTokens: {
      prompt: sum(jt.map((t) => t.prompt)),
      completion: sum(jt.map((t) => t.completion)),
      thoughts: sum(jt.map((t) => t.thoughts)),
      total: sum(jt.map((t) => t.total)),
    },
    latencyP50Ms: percentile(latencies, 0.5),
    latencyP95Ms: percentile(latencies, 0.95),
    costTotalUsd: costs.length ? sum(costs) : null,
    costPerCaseUsd: div(sum(costs), costs.length),
    costKnownCases: costs.length,
    costUnknownCases: per.length - costs.length,
    judgeCostTotalUsd: knownJudgeCosts.length ? sum(knownJudgeCosts) : null,
    judgeCostUnknownOutputs: withJudgeCalls - knownJudgeCosts.length,
  };
}
