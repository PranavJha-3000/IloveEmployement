// Code-computed confidence. A field is high confidence only when its value is
// grounded in the resume text (whole-token match after normalisation) AND it
// passes validation. There is no parameter through which a caller or a model
// can supply a confidence number.
import {
  LOW_CONFIDENCE_THRESHOLD,
  fieldPaths,
  validateProfile,
  type FieldPath,
  type StructuredProfile,
  type YearMonth,
} from "./schema";
import { findEmails, findPhones, findUrls } from "./patterns";

export const CONFIDENCE = { grounded: 1, ungrounded: 0.4, invalid: 0.3, missing: 0 } as const;

const MAX_SOURCE_CHARS = 60_000;

/** Lowercase, every run outside [a-z0-9+#] becomes one space, padded with one space each side. */
export function groundingText(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;
}

/** Whole-token containment of `value` in an already normalised source (see groundingText). */
export function isGrounded(value: string, sourceNorm: string): boolean {
  const n = groundingText(value);
  if (n.trim() === "") return false;
  return sourceNorm.includes(n);
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "january|jan",
  "february|feb",
  "march|mar",
  "april|apr",
  "may",
  "june|jun",
  "july|jul",
  "august|aug",
  "september|sept|sep",
  "october|oct",
  "november|nov",
  "december|dec",
];

// One literal, bounded pattern per month, built once at module load.
const MONTH_PATTERNS: RegExp[] = MONTH_NAMES.map((names, i) => {
  const m = i + 1;
  const mm = String(m).padStart(2, "0");
  return new RegExp(`\\b(?:${names})\\b|(?<![0-9])0?${m}/|[-./]${mm}(?![0-9])`, "i");
});

export function dateGrounded(d: YearMonth, sourceLines: string[]): boolean {
  const year = new RegExp(`(?<![0-9])${d.year}(?![0-9])`);
  const month = d.month ? MONTH_PATTERNS[d.month - 1] : null;
  return sourceLines.some((line) => year.test(line) && (month === null || month.test(line)));
}

// ─── Per-field confidence ────────────────────────────────────────────────────

function linkForms(link: string): string[] {
  const l = link.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return l ? [l, l.replace(/^www\./, "")] : [];
}

export function computeConfidence(p: StructuredProfile, sourceText: string): Record<FieldPath, number> {
  const src = sourceText.length > MAX_SOURCE_CHARS ? sourceText.slice(0, MAX_SOURCE_CHARS) : sourceText;
  const norm = groundingText(src);
  // Exact matches against what the pattern finders see, so a fragment or a run of unrelated digits never counts as grounded.
  const emails = new Set(findEmails(src).map((e) => e.toLowerCase()));
  const phones = new Set(findPhones(src).map((ph) => ph.replace(/\D/g, "")));
  const urls = new Set(findUrls(src).flatMap(linkForms));
  const lines = src.split(/\r?\n/);
  const errors = validateProfile(p);

  const text = (v: string) => (v.trim() === "" ? null : isGrounded(v, norm));
  const link = (v: string) => (v.trim() === "" ? null : linkForms(v).some((f) => urls.has(f)));
  const year = (v: number | null) => (v === null ? null : isGrounded(String(v), norm));
  const yearMonth = (v: YearMonth | null) => (v === null ? null : dateGrounded(v, lines));

  // null = empty value, boolean = present and grounded or not.
  const probe = (path: FieldPath): boolean | null => {
    const [section, a, b] = path.split(".");
    const i = Number(a);
    switch (section) {
      case "contact": {
        const c = p.contact;
        if (a === "name") return text(c.name);
        if (a === "email") return c.email.trim() === "" ? null : emails.has(c.email.trim().toLowerCase());
        if (a === "phone") {
          const d = c.phone.replace(/\D/g, "");
          if (!d) return null;
          return d.length >= 7 ? phones.has(d) : text(c.phone);
        }
        if (a === "location") return text(c.location);
        if (a === "links") return link(c.links[Number(b)] ?? "");
        return null;
      }
      case "roles": {
        const r = p.roles[i];
        if (b === "title") return text(r.title);
        if (b === "company") return text(r.company);
        if (b === "location") return text(r.location);
        if (b === "start") return yearMonth(r.start);
        if (b === "end") {
          if (r.current && r.end === null) return true; // a current role has no end date to verify
          return yearMonth(r.end);
        }
        const bullets = r.bullets.filter((x) => x.trim() !== "");
        return bullets.length === 0 ? null : bullets.every((x) => isGrounded(x, norm));
      }
      case "education": {
        const e = p.education[i];
        if (b === "degree") return text(e.degree);
        if (b === "institution") return text(e.institution);
        if (b === "startYear") return year(e.startYear);
        if (b === "endYear") return year(e.endYear);
        return text(e.detail);
      }
      case "skills": {
        const s = p.skills[i];
        if (s.name.trim() === "") return null;
        const forms = s.matchedFrom.length ? s.matchedFrom : [s.name];
        return forms.some((f) => isGrounded(f, norm));
      }
      case "projects": {
        const pr = p.projects[i];
        if (b === "name") return text(pr.name);
        if (b === "description") return text(pr.description);
        return link(pr.link);
      }
      default:
        return null;
    }
  };

  const out: Record<FieldPath, number> = {};
  for (const path of fieldPaths(p)) {
    const grounded = probe(path);
    if (grounded === null) out[path] = CONFIDENCE.missing;
    else if (errors[path]) out[path] = CONFIDENCE.invalid;
    else out[path] = grounded ? CONFIDENCE.grounded : CONFIDENCE.ungrounded;
  }
  return out;
}

export function needsLookCount(confidence: Record<FieldPath, number>): number {
  let n = 0;
  for (const v of Object.values(confidence)) if (v < LOW_CONFIDENCE_THRESHOLD) n += 1;
  return n;
}
