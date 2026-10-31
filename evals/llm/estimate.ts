// ─── Request estimator ───────────────────────────────────────────────────────
// Counts calls before a run: the reviewer loop (1-2 extra calls per review
// preset), judge calls, one probe per model; cases already complete in the
// cache are subtracted. Review flags come from the preset registry.

import { getPresetById } from "../../lib/presets";
import type { EvalCase } from "../cases";
import type { DiskCache } from "./cache";
import type { ModelSpec } from "./env";

export interface ModelEstimate {
  modelKey: string;
  cases: number;
  cachedCases: number;
  generationLower: number;
  generationUpper: number;
  judgeCalls: number;
  probeCalls: number;
}

export interface Estimate {
  perModel: ModelEstimate[];
  judgeKey: string | null;
  /** One probe for the judge model when it is not also a generation model. */
  judgeProbeCalls: number;
  lower: number;
  upper: number;
  /** Extra calls if every generation needed a JSON-fallback retry (equals total generationUpper). */
  fallbackWorstCase: number;
}

export function estimateRequests(opts: { cases: EvalCase[]; models: ModelSpec[]; judge: ModelSpec | null; cache: DiskCache | null }): Estimate {
  const perModel: ModelEstimate[] = opts.models.map((m) => {
    let cachedCases = 0;
    let generationLower = 0;
    let generationUpper = 0;
    let uncached = 0;
    for (const c of opts.cases) {
      if (opts.cache?.caseDone(c.id, m.key)) {
        cachedCases++;
        continue;
      }
      uncached++;
      const review = Boolean(getPresetById(c.presetId)?.review);
      generationLower += 1 + (review ? 1 : 0);
      generationUpper += 1 + (review ? 2 : 0);
    }
    return {
      modelKey: m.key, cases: opts.cases.length, cachedCases, generationLower, generationUpper,
      judgeCalls: opts.judge ? uncached : 0, probeCalls: 1,
    };
  });
  const judgeProbeCalls = opts.judge && !opts.models.some((m) => m.key === opts.judge!.key) ? 1 : 0;
  const sum = (f: (e: ModelEstimate) => number) => perModel.reduce((a, e) => a + f(e), 0);
  return {
    perModel,
    judgeKey: opts.judge?.key ?? null,
    judgeProbeCalls,
    lower: sum((e) => e.generationLower + e.judgeCalls + e.probeCalls) + judgeProbeCalls,
    upper: sum((e) => e.generationUpper + e.judgeCalls + e.probeCalls) + judgeProbeCalls,
    fallbackWorstCase: sum((e) => e.generationUpper),
  };
}

export function formatEstimate(est: Estimate): string {
  const lines = est.perModel.map((e) => {
    const judge = e.judgeCalls ? `, +${e.judgeCalls} judge calls on ${est.judgeKey}` : "";
    return `${e.modelKey}: ${e.cases} cases (${e.cachedCases} cached) -> ${e.generationLower}-${e.generationUpper} generation calls (reviewer loop included)${judge}, +${e.probeCalls} probe`;
  });
  lines.push(`Total: ${est.lower}-${est.upper} requests (worst case with JSON fallbacks: +${est.fallbackWorstCase})`);
  return lines.join("\n");
}
