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
