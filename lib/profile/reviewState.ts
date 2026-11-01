// Pure state for the Profile Review panel. Every transition returns new
// objects (inputs are never mutated) so the confirm and confidence rules can be
// tested without a DOM.
import type { NormalizedSkill } from "../skills/normalize";
import {
  fieldPaths,
  LOW_CONFIDENCE_THRESHOLD,
  validateProfile,
  type ConfirmedProfile,
  type ExtractionResult,
  type FieldPath,
  type StructuredProfile,
  type YearMonth,
} from "./schema";

export type FieldFlag = { edited: boolean; confirmed: boolean };
export type ItemGroup = "roles" | "education" | "projects" | "links";

export interface ReviewState {
  profile: StructuredProfile;
  original: StructuredProfile;
  confidence: Record<FieldPath, number>;
  flags: Record<FieldPath, FieldFlag>;
  errors: Record<FieldPath, string>;
  touched: Record<FieldPath, boolean>;
  attemptedConfirm: boolean;
}

export type ReviewAction =
  | { type: "edit"; path: FieldPath; value: unknown }
  | { type: "blur"; path: FieldPath }
  | { type: "toggleConfirm"; path: FieldPath }
  | { type: "confirmAllHigh" }
  | { type: "addItem"; group: ItemGroup }
  | { type: "removeItem"; group: ItemGroup; index: number }
  | { type: "setSkills"; skills: NormalizedSkill[] }
  | { type: "attemptConfirm" };

export type FieldStatus = "high" | "low" | "empty" | "edited" | "confirmed" | "invalid";

const NO_FLAG: FieldFlag = { edited: false, confirmed: false };

// ─── Paths ───────────────────────────────────────────────────────────────────

/** Reads the value a path points at. Unknown paths return undefined. */
export function getFieldValue(p: StructuredProfile, path: FieldPath): unknown {
  const parts = path.split(".");
  if (parts[0] === "contact") {
    if (parts[1] === "links") return p.contact.links[Number(parts[2])];
    return (p.contact as Record<string, unknown>)[parts[1]];
  }
  if (parts[0] === "skills") return p.skills[Number(parts[1])]?.name;
  const list = (p as unknown as Record<string, Record<string, unknown>[] | undefined>)[parts[0]];
  const item = list?.[Number(parts[1])];
  return item ? item[parts[2]] : undefined;
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// ─── Init ────────────────────────────────────────────────────────────────────

export function initReview(input: { result: ExtractionResult } | { saved: ConfirmedProfile }): ReviewState {
  if ("saved" in input) {
    const profile = structuredClone(input.saved.profile);
    const confidence: Record<FieldPath, number> = {};
    const flags: Record<FieldPath, FieldFlag> = {};
    for (const path of fieldPaths(profile)) {
      confidence[path] = 1;
      flags[path] = { edited: false, confirmed: true };
    }
    return { profile, original: structuredClone(profile), confidence, flags, errors: {}, touched: {}, attemptedConfirm: false };
  }
  const profile = structuredClone(input.result.profile);
  const confidence: Record<FieldPath, number> = {};
  for (const path of fieldPaths(profile)) confidence[path] = input.result.confidence[path] ?? 0;
  return { profile, original: structuredClone(profile), confidence, flags: {}, errors: {}, touched: {}, attemptedConfirm: false };
}

// ─── Status ──────────────────────────────────────────────────────────────────

export function fieldStatus(s: ReviewState, path: FieldPath): FieldStatus {
  if (s.errors[path]) return "invalid";
  const flag = s.flags[path] ?? NO_FLAG;
  if (flag.confirmed) return "confirmed";
  if (flag.edited) return "edited";
  const low = (s.confidence[path] ?? 1) < LOW_CONFIDENCE_THRESHOLD;
  if (low && isEmptyValue(getFieldValue(s.profile, path))) return "empty";
  return low ? "low" : "high";
}

export function summaryCounts(s: ReviewState): { needsLook: number; confirmed: number; total: number; invalid: number } {
  const paths = fieldPaths(s.profile);
  let needsLook = 0;
  let confirmed = 0;
  let invalid = 0;
  for (const path of paths) {
    const st = fieldStatus(s, path);
    if (st === "low" || st === "empty") needsLook += 1;
    else if (st === "confirmed") confirmed += 1;
    else if (st === "invalid") invalid += 1;
  }
  return { needsLook, confirmed, total: paths.length, invalid };
}

/** Paths in panel order that still need a look (low or empty). */
export function needsLookPaths(s: ReviewState): FieldPath[] {
  return fieldPaths(s.profile).filter((p) => {
    const st = fieldStatus(s, p);
    return st === "low" || st === "empty";
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function visibleErrors(profile: StructuredProfile, touched: Record<FieldPath, boolean>, attempted: boolean): Record<FieldPath, string> {
  const all = validateProfile(profile);
  if (attempted) return all;
  const out: Record<FieldPath, string> = {};
  for (const [path, msg] of Object.entries(all)) if (touched[path]) out[path] = msg;
  return out;
}

function withErrors(s: ReviewState): ReviewState {
  return { ...s, errors: visibleErrors(s.profile, s.touched, s.attemptedConfirm) };
}

const toYearMonth = (v: unknown): YearMonth | null => {
  if (!v || typeof v !== "object") return null;
  const { year, month } = v as { year?: unknown; month?: unknown };
  if (typeof year !== "number" || !Number.isFinite(year)) return null;
  return { year: Math.trunc(year), month: typeof month === "number" && month >= 1 && month <= 12 ? Math.trunc(month) : null };
};

const toYear = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^\d{1,4}$/.test(v.trim())) return Number(v.trim());
  return null;
};

const toText = (v: unknown): string => (typeof v === "string" ? v : "");

export function splitBullets(v: unknown): string[] {
  const lines = Array.isArray(v) ? v.map(toText) : toText(v).split("\n");
  return lines.map((l) => l.trim()).filter(Boolean);
}

function replaceAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((x, i) => (i === index ? next : x));
}

/** Applies a value to the profile by path; returns the same profile when the path is not editable. */
function applyEdit(p: StructuredProfile, path: FieldPath, value: unknown): { profile: StructuredProfile; also?: FieldPath } {
  const parts = path.split(".");
  const idx = Number(parts[1] ?? parts[2]);
  if (parts[0] === "contact") {
    if (parts[1] === "links") {
      const i = Number(parts[2]);
      if (i >= p.contact.links.length) return { profile: p };
      return { profile: { ...p, contact: { ...p.contact, links: replaceAt(p.contact.links, i, toText(value)) } } };
    }
    if (["name", "email", "phone", "location"].includes(parts[1])) return { profile: { ...p, contact: { ...p.contact, [parts[1]]: toText(value) } } };
    return { profile: p };
  }
  if (parts[0] === "roles") {
    const r = p.roles[idx];
    if (!r) return { profile: p };
    const f = parts[2];
    let next = r;
    let also: FieldPath | undefined;
    if (f === "title" || f === "company" || f === "location") next = { ...r, [f]: toText(value) };
    else if (f === "start") next = { ...r, start: toYearMonth(value) };
    else if (f === "end") next = { ...r, end: toYearMonth(value) };
    else if (f === "bullets") next = { ...r, bullets: splitBullets(value) };
    else if (f === "current") {
      const current = value === true;
      next = { ...r, current, end: current ? null : r.end };
      also = `roles.${idx}.end`;
    } else return { profile: p };
    return { profile: { ...p, roles: replaceAt(p.roles, idx, next) }, also };
  }
  if (parts[0] === "education") {
    const e = p.education[idx];
    if (!e) return { profile: p };
    const f = parts[2];
    let next = e;
    if (f === "degree" || f === "institution" || f === "detail") next = { ...e, [f]: toText(value) };
    else if (f === "startYear" || f === "endYear") next = { ...e, [f]: toYear(value) };
    else return { profile: p };
    return { profile: { ...p, education: replaceAt(p.education, idx, next) } };
  }
  if (parts[0] === "projects") {
    const pr = p.projects[idx];
    if (!pr) return { profile: p };
    const f = parts[2];
    let next = pr;
    if (f === "name" || f === "description" || f === "link") next = { ...pr, [f]: toText(value) };
    else if (f === "skills") next = { ...pr, skills: Array.isArray(value) ? value.map(toText).filter(Boolean) : pr.skills };
    else return { profile: p };
    return { profile: { ...p, projects: replaceAt(p.projects, idx, next) } };
  }
  return { profile: p };
}

/** Drops the keys of the removed item and shifts later items down one index. */
function rekey<T>(map: Record<FieldPath, T>, group: ItemGroup, index: number): Record<FieldPath, T> {
  const re = group === "links" ? /^contact\.links\.(\d+)$/ : new RegExp(`^${group}\\.(\\d+)(\\..+)?$`);
  const out: Record<FieldPath, T> = {};
  for (const [key, value] of Object.entries(map)) {
    const m = re.exec(key);
    if (!m) {
      out[key] = value;
      continue;
    }
    const n = Number(m[1]);
    if (n === index) continue;
    const newN = n > index ? n - 1 : n;
    out[group === "links" ? `contact.links.${newN}` : `${group}.${newN}${m[2] ?? ""}`] = value;
  }
  return out;
}

function addMissingPaths(s: ReviewState, profile: StructuredProfile): Record<FieldPath, number> {
  const confidence = { ...s.confidence };
  for (const path of fieldPaths(profile)) if (!(path in confidence)) confidence[path] = 0;
  return confidence;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function reviewReducer(s: ReviewState, a: ReviewAction): ReviewState {
  switch (a.type) {
    case "edit": {
      const { profile, also } = applyEdit(s.profile, a.path, a.value);
      if (profile === s.profile) return s;
      const flags = { ...s.flags, [a.path]: { edited: true, confirmed: false } };
      if (also) flags[also] = { edited: true, confirmed: false };
      return withErrors({ ...s, profile, flags });
    }
    case "blur": {
      return withErrors({ ...s, touched: { ...s.touched, [a.path]: true } });
    }
    case "toggleConfirm": {
      const cur = s.flags[a.path] ?? NO_FLAG;
      return { ...s, flags: { ...s.flags, [a.path]: { ...cur, confirmed: !cur.confirmed } } };
    }
    case "confirmAllHigh": {
      const flags = { ...s.flags };
      for (const path of fieldPaths(s.profile)) {
        if (fieldStatus(s, path) === "high") flags[path] = { ...(flags[path] ?? NO_FLAG), confirmed: true };
      }
      return { ...s, flags };
    }
    case "addItem": {
      let profile: StructuredProfile;
      if (a.group === "links") profile = { ...s.profile, contact: { ...s.profile.contact, links: [...s.profile.contact.links, ""] } };
      else if (a.group === "roles") {
        profile = { ...s.profile, roles: [...s.profile.roles, { title: "", company: "", location: "", start: null, end: null, current: false, bullets: [] }] };
      } else if (a.group === "education") {
        profile = { ...s.profile, education: [...s.profile.education, { degree: "", institution: "", detail: "", startYear: null, endYear: null }] };
      } else {
        profile = { ...s.profile, projects: [...s.profile.projects, { name: "", description: "", link: "", skills: [] }] };
      }
      return withErrors({ ...s, profile, confidence: addMissingPaths(s, profile) });
    }
    case "removeItem": {
      const p = s.profile;
      let profile: StructuredProfile;
      if (a.group === "links") profile = { ...p, contact: { ...p.contact, links: p.contact.links.filter((_, i) => i !== a.index) } };
      else if (a.group === "roles") profile = { ...p, roles: p.roles.filter((_, i) => i !== a.index) };
      else if (a.group === "education") profile = { ...p, education: p.education.filter((_, i) => i !== a.index) };
      else profile = { ...p, projects: p.projects.filter((_, i) => i !== a.index) };
      return withErrors({
        ...s,
        profile,
        confidence: rekey(s.confidence, a.group, a.index),
        flags: rekey(s.flags, a.group, a.index),
        touched: rekey(s.touched, a.group, a.index),
        errors: rekey(s.errors, a.group, a.index),
      });
    }
    case "setSkills": {
      const old = new Map(s.profile.skills.map((sk, i) => [sk.name.toLowerCase(), i]));
      const confidence: Record<FieldPath, number> = {};
      const flags: Record<FieldPath, FieldFlag> = {};
      for (const [k, v] of Object.entries(s.confidence)) if (!k.startsWith("skills.")) confidence[k] = v;
      for (const [k, v] of Object.entries(s.flags)) if (!k.startsWith("skills.")) flags[k] = v;
      a.skills.forEach((sk, i) => {
        const from = old.get(sk.name.toLowerCase());
        if (from === undefined) {
          // Added or renamed by the user: they have vouched for it.
          confidence[`skills.${i}`] = 1;
          flags[`skills.${i}`] = { edited: true, confirmed: false };
        } else {
          confidence[`skills.${i}`] = s.confidence[`skills.${from}`] ?? 1;
          const f = s.flags[`skills.${from}`];
          if (f) flags[`skills.${i}`] = f;
        }
      });
      return { ...s, profile: { ...s.profile, skills: a.skills.map((sk) => ({ ...sk, matchedFrom: [...sk.matchedFrom] })) }, confidence, flags };
    }
    case "attemptConfirm": {
      return { ...s, attemptedConfirm: true, errors: validateProfile(s.profile) };
    }
  }
}

/** The confirm button is enabled when a name is present and no displayed field is invalid; the rest is checked on click. */
export function canConfirm(s: ReviewState): boolean {
  return s.profile.contact.name.trim() !== "" && summaryCounts(s).invalid === 0;
}
