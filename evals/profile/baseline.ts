// Deterministic profile-extraction baseline for the offline --ci gate. Pure; no fs access.
import { FIELD_KEYS, type FieldKey } from "./metrics";

export const PROFILE_EPSILON = 0.005;

export interface ProfileBaseline {
  kind: "profile-deterministic";
  fingerprint: string;
  extractorVersion: string;
  taxonomyVersion: string;
  recordedAt: string;
  fields: Record<FieldKey, { precision: number | null; recall: number | null; support: number }>;
  exact: { contact: number | null; roles: number | null };
}

export interface ProfileBaselineComparison {
  ok: boolean;
  regressions: string[];
  improvements: string[];
  fingerprintMismatch: boolean;
}

const UPDATE_CMD = "npm run eval:profile -- --update-baseline --dataset-changed";
const fmt = (v: number | null) => (v === null ? "n/a" : v.toFixed(4));

function checkMetric(label: string, b: number | null, c: number | null, regressions: string[], improvements: string[]) {
  if (b === null && c === null) return;
  if (b !== null && c === null) {
    regressions.push(`${label}: metric disappeared (baseline ${fmt(b)}, current n/a)`);
    return;
  }
  if (b === null && c !== null) {
    improvements.push(`${label}: ${fmt(c)} (baseline n/a)`);
    return;
  }
  if (c! < b! - PROFILE_EPSILON) regressions.push(`${label}: ${fmt(c)} < ${fmt(b)}`);
  else if (c! > b! + PROFILE_EPSILON) improvements.push(`${label}: ${fmt(c)} > ${fmt(b)}`);
}

export function compareProfileBaseline(
  base: ProfileBaseline,
  cur: Omit<ProfileBaseline, "recordedAt">,
): ProfileBaselineComparison {
  const regressions: string[] = [];
  const improvements: string[] = [];
  const fingerprintMismatch =
    base.fingerprint !== cur.fingerprint ||
    base.extractorVersion !== cur.extractorVersion ||
    base.taxonomyVersion !== cur.taxonomyVersion;

  for (const key of FIELD_KEYS) {
    const b = base.fields?.[key];
    const c = cur.fields?.[key];
    checkMetric(`${key} precision`, b?.precision ?? null, c?.precision ?? null, regressions, improvements);
    checkMetric(`${key} recall`, b?.recall ?? null, c?.recall ?? null, regressions, improvements);
  }
  checkMetric("exact contact", base.exact?.contact ?? null, cur.exact?.contact ?? null, regressions, improvements);
  checkMetric("exact roles", base.exact?.roles ?? null, cur.exact?.roles ?? null, regressions, improvements);

  if (fingerprintMismatch) {
    regressions.push(
      `dataset fingerprint, extractor version or taxonomy version differs from baseline (baseline ${base.fingerprint}/${base.extractorVersion}/${base.taxonomyVersion}, current ${cur.fingerprint}/${cur.extractorVersion}/${cur.taxonomyVersion}): run \`${UPDATE_CMD}\` and commit the new baseline.json together with the change`,
    );
  }
  return { ok: regressions.length === 0, regressions, improvements, fingerprintMismatch };
}

export type ProfileBaselineValidation = { ok: true; baseline: ProfileBaseline } | { ok: false; problems: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const numOrNull = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

export function validateProfileBaseline(raw: unknown): ProfileBaselineValidation {
  if (!isObject(raw)) return { ok: false, problems: ["baseline is not a JSON object"] };
  const problems: string[] = [];
  if (raw.kind !== "profile-deterministic") problems.push(`kind must be "profile-deterministic" (got ${JSON.stringify(raw.kind)})`);
  for (const k of ["fingerprint", "extractorVersion", "taxonomyVersion"] as const) {
    if (typeof raw[k] !== "string" || raw[k] === "") problems.push(`${k} must be a non-empty string`);
  }
  if (typeof raw.recordedAt !== "string") problems.push("recordedAt must be a string");
  const fields = isObject(raw.fields) ? raw.fields : undefined;
  if (!fields) problems.push("fields is missing or not an object");
  else {
    for (const key of FIELD_KEYS) {
      const f = fields[key];
      if (!isObject(f)) {
        problems.push(`fields.${key} is missing or not an object`);
        continue;
      }
      if (!numOrNull(f.precision)) problems.push(`fields.${key}.precision must be a number or null`);
      if (!numOrNull(f.recall)) problems.push(`fields.${key}.recall must be a number or null`);
      if (typeof f.support !== "number" || !Number.isFinite(f.support)) problems.push(`fields.${key}.support must be a number`);
    }
  }
  const exact = isObject(raw.exact) ? raw.exact : undefined;
  if (!exact) problems.push("exact is missing or not an object");
  else {
    if (!numOrNull(exact.contact)) problems.push("exact.contact must be a number or null");
    if (!numOrNull(exact.roles)) problems.push("exact.roles must be a number or null");
  }
  return problems.length ? { ok: false, problems } : { ok: true, baseline: raw as unknown as ProfileBaseline };
}
