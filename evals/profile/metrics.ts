// Field-level precision / recall for profile extraction. Pure: no fs, no
// network. Predicted roles and schools are aligned to gold one-to-one before
// their fields are compared, so a shuffled order is not an error but a swapped
// title/company or a hallucinated role is.
import type { StructuredProfile, YearMonth } from "../../lib/profile/schema";
import { canonicalizeSkill } from "../../lib/skills/normalize";

export const FIELD_KEYS = [
  "contact.name",
  "contact.email",
  "contact.phone",
  "contact.location",
  "contact.links",
  "roles.title",
  "roles.company",
  "roles.start",
  "roles.end",
  "roles.bullets",
  "education.degree",
  "education.institution",
  "education.endYear",
  "skills.canonical",
  "projects.name",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

type Counts = { tp: number; fp: number; fn: number };
export type FieldCounts = Record<FieldKey, Counts> & {
  exact: { contact: { hit: number; total: number }; roles: { hit: number; total: number } };
};

function emptyCounts(): FieldCounts {
  const base = {} as Record<FieldKey, Counts>;
  for (const k of FIELD_KEYS) base[k] = { tp: 0, fp: 0, fn: 0 };
  return { ...base, exact: { contact: { hit: 0, total: 0 }, roles: { hit: 0, total: 0 } } };
}

// ─── Normalisation ───────────────────────────────────────────────────────────

const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function normText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().replace(EDGE_PUNCT, "");
}
const normPhone = (s: string) => s.replace(/[^0-9]/g, "");
const normEmail = (s: string) => s.trim().toLowerCase();
function normLink(s: string): string {
  return s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}
function normSkill(name: string): string {
  const c = canonicalizeSkill(name);
  return c.entry ? c.entry.name.toLowerCase() : normText(c.name);
}

// ─── Comparison helpers ──────────────────────────────────────────────────────

function addScalar(c: Counts, pred: string, gold: string) {
  if (!pred && !gold) return;
  if (!pred) c.fn += 1;
  else if (pred === gold) c.tp += 1;
  else {
    c.fp += 1;
    if (gold) c.fn += 1;
  }
}

function addSet(c: Counts, pred: string[], gold: string[]) {
  const p = new Set(pred.filter(Boolean));
  const g = new Set(gold.filter(Boolean));
  for (const x of p) {
    if (g.has(x)) c.tp += 1;
    else c.fp += 1;
  }
  for (const x of g) if (!p.has(x)) c.fn += 1;
}

const sameYm = (a: YearMonth | null, b: YearMonth | null) => (a === null && b === null) || (a !== null && b !== null && a.year === b.year && a.month === b.month);

function addYearMonth(c: Counts, pred: YearMonth | null, gold: YearMonth | null) {
  if (!pred && !gold) return;
  if (!pred) c.fn += 1;
  else if (sameYm(pred, gold)) c.tp += 1;
  else {
    c.fp += 1;
    if (gold) c.fn += 1;
  }
}

function addNumber(c: Counts, pred: number | null, gold: number | null) {
  if (pred === null && gold === null) return;
  if (pred === null) c.fn += 1;
  else if (pred === gold) c.tp += 1;
  else {
    c.fp += 1;
    if (gold !== null) c.fn += 1;
  }
}

// ─── Alignment ───────────────────────────────────────────────────────────────

const ALIGN_THRESHOLD = 0.5;

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Greedy one-to-one alignment, highest similarity first. Returns [predIndex, goldIndex] pairs. */
function align(pred: string[], gold: string[]): [number, number][] {
  const pt = pred.map(tokens);
  const gt = gold.map(tokens);
  const pairs: { p: number; g: number; s: number }[] = [];
  for (let p = 0; p < pt.length; p++) {
    for (let g = 0; g < gt.length; g++) {
      const s = jaccard(pt[p], gt[g]);
      if (s >= ALIGN_THRESHOLD) pairs.push({ p, g, s });
    }
  }
  pairs.sort((a, b) => b.s - a.s || a.g - b.g || a.p - b.p);
  const usedP = new Set<number>();
  const usedG = new Set<number>();
  const out: [number, number][] = [];
  for (const { p, g } of pairs) {
    if (usedP.has(p) || usedG.has(g)) continue;
    usedP.add(p);
    usedG.add(g);
    out.push([p, g]);
  }
  return out;
}

type Role = StructuredProfile["roles"][number];
type Edu = StructuredProfile["education"][number];

function roleBullets(r: Role): string[] {
  return r.bullets.map(normText).filter(Boolean);
}

function addUnalignedRole(c: FieldCounts, r: Role, side: "fp" | "fn") {
  if (normText(r.title)) c["roles.title"][side] += 1;
  if (normText(r.company)) c["roles.company"][side] += 1;
  if (r.start) c["roles.start"][side] += 1;
  if (r.end) c["roles.end"][side] += 1;
  c["roles.bullets"][side] += new Set(roleBullets(r)).size;
}

function addUnalignedEdu(c: FieldCounts, e: Edu, side: "fp" | "fn") {
  if (normText(e.degree)) c["education.degree"][side] += 1;
  if (normText(e.institution)) c["education.institution"][side] += 1;
  if (e.endYear !== null) c["education.endYear"][side] += 1;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function scoreProfile(pred: StructuredProfile, gold: StructuredProfile): FieldCounts {
  const c = emptyCounts();
  const pc = pred.contact;
  const gc = gold.contact;

  const contactPairs: [FieldKey, string, string][] = [
    ["contact.name", normText(pc.name), normText(gc.name)],
    ["contact.email", normEmail(pc.email), normEmail(gc.email)],
    ["contact.phone", normPhone(pc.phone), normPhone(gc.phone)],
    ["contact.location", normText(pc.location), normText(gc.location)],
  ];
  let contactHit = true;
  for (const [key, p, g] of contactPairs) {
    addScalar(c[key], p, g);
    if (p !== g) contactHit = false;
  }
  addSet(c["contact.links"], pc.links.map(normLink), gc.links.map(normLink));
  c.exact.contact.total = 1;
  c.exact.contact.hit = contactHit ? 1 : 0;

  // Roles
  const roleMap = align(
    pred.roles.map((r) => `${r.title} ${r.company}`),
    gold.roles.map((r) => `${r.title} ${r.company}`),
  );
  const matchedP = new Set(roleMap.map(([p]) => p));
  const matchedG = new Set(roleMap.map(([, g]) => g));
  c.exact.roles.total = gold.roles.length;
  for (const [pi, gi] of roleMap) {
    const p = pred.roles[pi];
    const g = gold.roles[gi];
    const titleOk = normText(p.title) === normText(g.title);
    const companyOk = normText(p.company) === normText(g.company);
    addScalar(c["roles.title"], normText(p.title), normText(g.title));
    addScalar(c["roles.company"], normText(p.company), normText(g.company));
    addYearMonth(c["roles.start"], p.start, g.start);
    addYearMonth(c["roles.end"], p.end, g.end);
    addSet(c["roles.bullets"], roleBullets(p), roleBullets(g));
    if (titleOk && companyOk && sameYm(p.start, g.start) && sameYm(p.end, g.end)) c.exact.roles.hit += 1;
  }
  pred.roles.forEach((r, i) => {
    if (!matchedP.has(i)) addUnalignedRole(c, r, "fp");
  });
  gold.roles.forEach((r, i) => {
    if (!matchedG.has(i)) addUnalignedRole(c, r, "fn");
  });

  // Education
  const eduMap = align(
    pred.education.map((e) => `${e.degree} ${e.institution}`),
    gold.education.map((e) => `${e.degree} ${e.institution}`),
  );
  const eP = new Set(eduMap.map(([p]) => p));
  const eG = new Set(eduMap.map(([, g]) => g));
  for (const [pi, gi] of eduMap) {
    const p = pred.education[pi];
    const g = gold.education[gi];
    addScalar(c["education.degree"], normText(p.degree), normText(g.degree));
    addScalar(c["education.institution"], normText(p.institution), normText(g.institution));
    addNumber(c["education.endYear"], p.endYear, g.endYear);
  }
  pred.education.forEach((e, i) => {
    if (!eP.has(i)) addUnalignedEdu(c, e, "fp");
  });
  gold.education.forEach((e, i) => {
    if (!eG.has(i)) addUnalignedEdu(c, e, "fn");
  });

  addSet(c["skills.canonical"], pred.skills.map((s) => normSkill(s.name)), gold.skills.map((s) => normSkill(s.name)));
  addSet(c["projects.name"], pred.projects.map((p) => normText(p.name)), gold.projects.map((p) => normText(p.name)));
  return c;
}

export function aggregateCounts(list: FieldCounts[]): FieldCounts {
  const out = emptyCounts();
  for (const item of list) {
    for (const k of FIELD_KEYS) {
      out[k].tp += item[k].tp;
      out[k].fp += item[k].fp;
      out[k].fn += item[k].fn;
    }
    out.exact.contact.hit += item.exact.contact.hit;
    out.exact.contact.total += item.exact.contact.total;
    out.exact.roles.hit += item.exact.roles.hit;
    out.exact.roles.total += item.exact.roles.total;
  }
  return out;
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

/** Empty denominators are null (n/a), never a perfect score. support = tp + fn (the gold count). */
export function prf(c: Counts): { precision: number | null; recall: number | null; f1: number | null; support: number } {
  const precision = c.tp + c.fp > 0 ? round4(c.tp / (c.tp + c.fp)) : null;
  const recall = c.tp + c.fn > 0 ? round4(c.tp / (c.tp + c.fn)) : null;
  const denom = 2 * c.tp + c.fp + c.fn;
  const f1 = denom > 0 ? round4((2 * c.tp) / denom) : null;
  return { precision, recall, f1, support: c.tp + c.fn };
}
