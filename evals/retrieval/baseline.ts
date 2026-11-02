// Keyword baseline comparison for the offline --ci gate. Pure; no fs access.
import { METRIC_KEYS, type MetricSet } from "./metrics";

export const BASELINE_EPSILON = 0.005;

/**
 * Scopes the keyword gate checks. Paraphrase is deliberately not gated: the dataset
 * validator guarantees paraphrase queries share no BM25 token with their labelled
 * chunks, so keyword scores ~0 there by construction and `cur < ~0 - epsilon` can
 * never fire. Paraphrase stays in baseline.json (and is still validated) for reporting.
 */
export const GATED_SCOPES = ["overall", "lexical"] as const;

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

  const pick = (src: Pick<KeywordBaseline, "overall" | "byType">, scope: (typeof GATED_SCOPES)[number]): MetricSet | undefined =>
    scope === "overall" ? src?.overall : src?.byType?.[scope];
  for (const scope of GATED_SCOPES) {
    const base = pick(baseline, scope);
    const cur = pick(current, scope);
    for (const key of METRIC_KEYS) {
      const b = base?.[key];
      const c = cur?.[key];
      if (typeof b !== "number" || typeof c !== "number" || !Number.isFinite(b) || !Number.isFinite(c)) {
        regressions.push(`${scope} ${key}: non-numeric (baseline=${String(b)}, current=${String(c)})`);
        continue;
      }
      if (c < b - BASELINE_EPSILON) {
        regressions.push(`${scope} ${key}: ${c.toFixed(4)} < ${b.toFixed(4)}`);
      } else if (c > b + BASELINE_EPSILON) {
        improvements.push(`${scope} ${key}: ${c.toFixed(4)} > ${b.toFixed(4)}`);
      }
    }
  }

  if (fingerprintMismatch) {
    regressions.push(
      "dataset fingerprint differs from baseline: run `npm run eval:retrieval -- --update-baseline --dataset-changed` and commit the new baseline.json together with the dataset change",
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

export interface BaselineUpdateOptions {
  /** --allow-regression: accept lower metrics, or overwrite an unreadable/invalid old baseline. */
  allowRegression: boolean;
  /** --dataset-changed: accept a new dataset fingerprint (a deliberate re-record). */
  datasetChanged?: boolean;
}

/**
 * Decides whether --update-baseline may overwrite baseline.json. Fails closed: an
 * invalid old baseline (nothing to compare against) needs --allow-regression, a
 * dataset fingerprint change needs --dataset-changed, and any drop beyond epsilon
 * needs --allow-regression, so a reviewer always sees a deliberate flag.
 */
export function planBaselineUpdate(oldRaw: unknown | null, next: KeywordBaseline, opts: BaselineUpdateOptions): BaselineUpdatePlan {
  const { allowRegression, datasetChanged = false } = opts;
  const plan: BaselineUpdatePlan = { write: true, warnings: [], errors: [], improvements: [] };
  if (oldRaw === null || oldRaw === undefined) return plan;
  const old = validateBaseline(oldRaw);
  if (!old.ok) {
    plan.warnings.push(`previous baseline.json is invalid: ${old.problems.join("; ")}`);
    if (!allowRegression) {
      plan.write = false;
      plan.errors.push(
        "Refusing to overwrite an invalid baseline.json: without a valid previous baseline a drop cannot be detected. " +
          "Restore it from git, or pass --allow-regression and explain the re-record in the commit message.",
      );
    }
    return plan;
  }
  const { recordedAt: _recordedAt, ...rest } = next;
  void _recordedAt;
  const cmp = compareToBaseline(old.baseline, { ...rest, fingerprint: old.baseline.fingerprint });
  for (const r of cmp.regressions) plan.warnings.push(`baseline would drop: ${r}`);
  plan.improvements.push(...cmp.improvements);
  if (old.baseline.fingerprint !== next.fingerprint) {
    plan.warnings.push(`dataset fingerprint changes ${old.baseline.fingerprint} -> ${next.fingerprint}`);
    if (!datasetChanged) {
      plan.write = false;
      plan.errors.push(
        "Refusing to re-record the baseline for a changed dataset. Pass --dataset-changed to confirm the dataset change is " +
          "intended, and commit baseline.json together with it.",
      );
    }
  }
  if (cmp.regressions.length > 0 && !allowRegression) {
    plan.write = false;
    plan.errors.push(
      "Refusing to lower the baseline. Pass --allow-regression to accept the drop and explain it in the commit message.",
    );
  }
  return plan;
}
