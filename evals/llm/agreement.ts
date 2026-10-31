// ─── Judge-vs-human agreement ────────────────────────────────────────────────
// Pure statistics (no fs, no clock): Cohen's kappa, quadratic-weighted kappa,
// raw and within-1 agreement, and a seeded percentile bootstrap that resamples
// outputs (items). Definitions: evals/llm/RUBRIC.md "Agreement with human labels".
// A kappa whose expected agreement is 1 has no variance to explain and is null
// (rendered "n/a"), never 0 or NaN.

import { mulberry32 } from "../retrieval/stats";
import { AGREEMENT_SEED, BOOTSTRAP_ITERATIONS, RUBRIC_DIMENSIONS, type RubricDimension } from "./rubric";

const EPS = 1e-12;

export function rawAgreement<T>(pairs: Array<readonly [T, T]>): number | null {
  if (pairs.length === 0) return null;
  return pairs.filter(([a, b]) => a === b).length / pairs.length;
}

export function withinOneAgreement(pairs: Array<readonly [number, number]>): number | null {
  if (pairs.length === 0) return null;
  return pairs.filter(([a, b]) => Math.abs(a - b) <= 1).length / pairs.length;
}

/** Cohen's kappa over any category labels; null when there are no pairs or expected agreement is 1. */
export function cohenKappa<T>(pairs: Array<readonly [T, T]>): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  const rowA = new Map<T, number>();
  const rowB = new Map<T, number>();
  let agree = 0;
  for (const [a, b] of pairs) {
    rowA.set(a, (rowA.get(a) ?? 0) + 1);
    rowB.set(b, (rowB.get(b) ?? 0) + 1);
    if (a === b) agree++;
  }
  let pe = 0;
  for (const [cat, count] of rowA) pe += (count / n) * ((rowB.get(cat) ?? 0) / n);
  if (1 - pe < EPS) return null;
  return (agree / n - pe) / (1 - pe);
}

/** Quadratic-weighted kappa over ordinal categories (default 1..4); null when expected agreement is 1. */
export function weightedKappa(pairs: Array<readonly [number, number]>, categories: readonly number[] = [1, 2, 3, 4]): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  const k = categories.length;
  const idx = new Map(categories.map((c, i) => [c, i]));
  const w = (i: number, j: number) => 1 - ((i - j) / (k - 1)) ** 2;
  const pa = new Array<number>(k).fill(0);
  const pb = new Array<number>(k).fill(0);
  let po = 0;
  for (const [a, b] of pairs) {
    const i = idx.get(a);
    const j = idx.get(b);
    if (i === undefined || j === undefined) throw new Error(`weightedKappa: rating outside categories (${a}, ${b})`);
    pa[i] += 1 / n;
    pb[j] += 1 / n;
    po += w(i, j) / n;
  }
  let pe = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) pe += w(i, j) * pa[i] * pb[j];
  if (1 - pe < EPS) return null;
  return (po - pe) / (1 - pe);
}

export interface BootstrapResult {
  value: number | null;
  lo: number | null;
  hi: number | null;
  /** Resamples whose statistic was null (for example no variance) and were left out of the interval. */
  skipped: number;
}

/**
 * Percentile bootstrap over items. Same convention as pairedBootstrapCI:
 * lo = sorted[floor((alpha/2) * m)], hi = sorted[ceil((1 - alpha/2) * m) - 1], m = usable resamples.
 */
export function bootstrapStat<T>(
  items: T[],
  statFn: (items: T[]) => number | null,
  opts: { iterations?: number; seed?: number; confidence?: number } = {},
): BootstrapResult {
  const { iterations = BOOTSTRAP_ITERATIONS, seed = AGREEMENT_SEED, confidence = 0.95 } = opts;
  const n = items.length;
  const value = n ? statFn(items) : null;
  if (n === 0) return { value, lo: null, hi: null, skipped: 0 };
  const rand = mulberry32(seed);
  const stats: number[] = [];
  let skipped = 0;
  const sample = new Array<T>(n);
  for (let b = 0; b < iterations; b++) {
    for (let i = 0; i < n; i++) sample[i] = items[Math.floor(rand() * n)];
    const s = statFn(sample);
    if (s === null || !Number.isFinite(s)) skipped++;
    else stats.push(s);
  }
  if (stats.length === 0) return { value, lo: null, hi: null, skipped };
  stats.sort((a, b) => a - b);
  const alpha = 1 - confidence;
  const m = stats.length;
  return { value, lo: stats[Math.floor((alpha / 2) * m)], hi: stats[Math.ceil((1 - alpha / 2) * m) - 1], skipped };
}

// ─── Pairing human and judge labels ──────────────────────────────────────────

export type Verdict = "supports" | "partial" | "does_not_support";

export interface Rating {
  scores: Record<RubricDimension, number>;
  /** Human: yes/no. Judge: at least one unsupported claim. */
  fabricationPresent: boolean;
  /** unit index -> verdict */
  citations: Record<number, Verdict>;
}

export interface AgreementPair {
  itemId: string;
  human: Rating;
  judge: Rating;
}

export interface Ci {
  lo: number | null;
  hi: number | null;
  skipped: number;
}

export interface AgreementSummary {
  items: number;
  dimensions: Record<RubricDimension, { n: number; exact: number | null; withinOne: number | null; weightedKappa: number | null; ci: Ci }>;
  fabrication: { n: number; raw: number | null; kappa: number | null; ci: Ci };
  /** Strict: `supports` vs anything else, over units both raters labelled. */
  citationSupport: { nItems: number; nUnits: number; raw: number | null; kappa: number | null; ci: Ci };
  seed: number;
  iterations: number;
}

const ci = (r: BootstrapResult): Ci => ({ lo: r.lo, hi: r.hi, skipped: r.skipped });

/** [human strict, judge strict] for every unit index both raters labelled. */
function unitPairs(p: AgreementPair): Array<readonly [boolean, boolean]> {
  const out: Array<readonly [boolean, boolean]> = [];
  for (const key of Object.keys(p.human.citations)) {
    const i = Number(key);
    if (i in p.judge.citations) out.push([p.human.citations[i] === "supports", p.judge.citations[i] === "supports"] as const);
  }
  return out;
}

export function computeAgreement(
  pairs: AgreementPair[],
  opts: { iterations?: number; seed?: number; confidence?: number } = {},
): AgreementSummary {
  const o = { iterations: opts.iterations ?? BOOTSTRAP_ITERATIONS, seed: opts.seed ?? AGREEMENT_SEED, confidence: opts.confidence ?? 0.95 };

  const dimensions = {} as AgreementSummary["dimensions"];
  for (const d of RUBRIC_DIMENSIONS) {
    const toPairs = (items: AgreementPair[]) => items.map((p) => [p.human.scores[d], p.judge.scores[d]] as const);
    dimensions[d] = {
      n: pairs.length,
      exact: rawAgreement(toPairs(pairs)),
      withinOne: withinOneAgreement(toPairs(pairs)),
      weightedKappa: weightedKappa(toPairs(pairs)),
      ci: ci(bootstrapStat(pairs, (items) => weightedKappa(toPairs(items)), o)),
    };
  }

  const fabPairs = (items: AgreementPair[]) => items.map((p) => [p.human.fabricationPresent, p.judge.fabricationPresent] as const);
  const fabrication = {
    n: pairs.length,
    raw: rawAgreement(fabPairs(pairs)),
    kappa: cohenKappa(fabPairs(pairs)),
    ci: ci(bootstrapStat(pairs, (items) => cohenKappa(fabPairs(items)), o)),
  };

  // Cluster bootstrap: resample items, pool the units of the resampled items.
  const pooled = (items: AgreementPair[]) => items.flatMap(unitPairs);
  const allUnits = pooled(pairs);
  const citationSupport = {
    nItems: pairs.filter((p) => unitPairs(p).length > 0).length,
    nUnits: allUnits.length,
    raw: rawAgreement(allUnits),
    kappa: cohenKappa(allUnits),
    ci: ci(bootstrapStat(pairs, (items) => cohenKappa(pooled(items)), o)),
  };

  return { items: pairs.length, dimensions, fabrication, citationSupport, seed: o.seed, iterations: o.iterations };
}
