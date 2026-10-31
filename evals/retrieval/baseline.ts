// Keyword baseline comparison for the offline --ci gate. Pure; no fs access.
import { METRIC_KEYS, type MetricSet } from "./metrics";

export const BASELINE_EPSILON = 0.005;

export interface KeywordBaseline {
  strategy: "keyword";
  fingerprint: string;
  recordedAt: string;
  overall: MetricSet;
  byType: { lexical: MetricSet; paraphrase: MetricSet };
}

export interface BaselineComparison {
  ok: boolean;
  regressions: string[];
  improvements: string[];
  fingerprintMismatch: boolean;
}

export function compareToBaseline(
  baseline: KeywordBaseline,
  current: Omit<KeywordBaseline, "recordedAt">,
): BaselineComparison {
  const regressions: string[] = [];
  const improvements: string[] = [];
  const fingerprintMismatch = baseline.fingerprint !== current.fingerprint;

  const scopes: [string, MetricSet, MetricSet][] = [
    ["overall", baseline.overall, current.overall],
    ["lexical", baseline.byType.lexical, current.byType.lexical],
    ["paraphrase", baseline.byType.paraphrase, current.byType.paraphrase],
  ];
  for (const [scope, base, cur] of scopes) {
    for (const key of METRIC_KEYS) {
      const b = base?.[key];
      const c = cur?.[key];
      if (typeof b !== "number" || typeof c !== "number" || !Number.isFinite(b) || !Number.isFinite(c)) {
        regressions.push(`${scope} ${key}: non-numeric (baseline=${String(b)}, current=${String(c)})`);
        continue;
      }
      if (cur[key] < base[key] - BASELINE_EPSILON) {
        regressions.push(`${scope} ${key}: ${cur[key].toFixed(4)} < ${base[key].toFixed(4)}`);
      } else if (cur[key] > base[key] + BASELINE_EPSILON) {
        improvements.push(`${scope} ${key}: ${cur[key].toFixed(4)} > ${base[key].toFixed(4)}`);
      }
    }
  }

  if (fingerprintMismatch) {
    regressions.push(
      "dataset fingerprint differs from baseline: run `npm run eval:retrieval -- --update-baseline` and commit the new baseline.json together with the dataset change",
    );
  }

  return { ok: regressions.length === 0 && !fingerprintMismatch, regressions, improvements, fingerprintMismatch };
}

export type BaselineValidation = { ok: true; baseline: KeywordBaseline } | { ok: false; problems: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function validateBaseline(raw: unknown): BaselineValidation {
  if (!isObject(raw)) return { ok: false, problems: ["baseline is not a JSON object"] };
  const problems: string[] = [];
  if (raw.strategy !== "keyword") problems.push(`strategy must be "keyword" (got ${JSON.stringify(raw.strategy)})`);
  if (typeof raw.fingerprint !== "string" || raw.fingerprint === "") problems.push("fingerprint must be a non-empty string");
  if (typeof raw.recordedAt !== "string") problems.push("recordedAt must be a string");
  const byType = isObject(raw.byType) ? raw.byType : undefined;
  if (!byType) problems.push("byType is missing or not an object");
  const scopes: [string, unknown][] = [
    ["overall", raw.overall],
    ["lexical", byType?.lexical],
    ["paraphrase", byType?.paraphrase],
  ];
  for (const [scope, value] of scopes) {
    if (!isObject(value)) {
      problems.push(`${scope} is missing or not an object`);
      continue;
    }
    for (const key of METRIC_KEYS) {
      const v = value[key];
      if (typeof v !== "number" || !Number.isFinite(v)) problems.push(`${scope} ${key}: expected a finite number (got ${JSON.stringify(v)})`);
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, baseline: raw as unknown as KeywordBaseline };
}

export interface BaselineUpdatePlan {
  write: boolean;
  warnings: string[];
  errors: string[];
  improvements: string[];
}

export function planBaselineUpdate(oldRaw: unknown | null, next: KeywordBaseline, allowRegression: boolean): BaselineUpdatePlan {
  const plan: BaselineUpdatePlan = { write: true, warnings: [], errors: [], improvements: [] };
  if (oldRaw === null || oldRaw === undefined) return plan;
  const old = validateBaseline(oldRaw);
  if (!old.ok) {
    plan.warnings.push(`previous baseline.json is invalid: ${old.problems.join("; ")}`);
    return plan;
  }
  const { recordedAt: _recordedAt, ...rest } = next;
  void _recordedAt;
  const cmp = compareToBaseline(old.baseline, { ...rest, fingerprint: old.baseline.fingerprint });
  for (const r of cmp.regressions) plan.warnings.push(`baseline would drop: ${r}`);
  plan.improvements.push(...cmp.improvements);
  if (old.baseline.fingerprint !== next.fingerprint) {
    plan.warnings.push(`dataset fingerprint changes ${old.baseline.fingerprint} -> ${next.fingerprint}`);
  }
  if (cmp.regressions.length > 0 && !allowRegression) {
    plan.write = false;
    plan.errors.push(
      "Refusing to lower the baseline. Pass --allow-regression to accept the drop and explain it in the commit message.",
    );
  }
  return plan;
}
