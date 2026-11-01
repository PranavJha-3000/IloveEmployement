// Structured profile contract. One zod schema for everything that produces,
// stores or imports a typed resume profile. Isomorphic: zod plus type-only
// imports. Confidence is deliberately NOT part of the profile schema; it is
// computed in code (confidence.ts) and unknown keys, including a
// model-supplied "confidence", are stripped by parse.
import { z } from "zod";
import type { NormalizedSkill } from "../skills/normalize";

// ─── Messages (exact UI-SPEC copy; the UI reuses these) ──────────────────────

export const MSG_NAME_REQUIRED = "Add your name to confirm.";
export const MSG_EMAIL = "Enter an email like name@example.com.";
export const MSG_DATE_ORDER = "End date is before the start date.";
export const MSG_YEAR_RANGE = "Enter a year between 1950 and {next year}.";
export const MSG_PHONE = "Enter a phone number with at least 7 digits.";

export const LOW_CONFIDENCE_THRESHOLD = 0.8;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const YearMonthSchema = z.object({
  year: z.number().int().min(1950).max(2100),
  month: z.number().int().min(1).max(12).nullable(),
});
export type YearMonth = z.infer<typeof YearMonthSchema>;

const short = z.string().max(200);

export const ContactSchema = z.object({
  name: short,
  email: z.string().max(254),
  phone: z.string().max(40),
  location: short,
  links: z.array(z.string().max(300)).max(10),
});

export const RoleSchema = z.object({
  title: short,
  company: short,
  location: short,
  start: YearMonthSchema.nullable(),
  end: YearMonthSchema.nullable(),
  current: z.boolean(),
  bullets: z.array(z.string().max(600)).max(40),
});

export const EducationSchema = z.object({
  degree: short,
  institution: short,
  detail: z.string().max(600),
  startYear: z.number().int().nullable(),
  endYear: z.number().int().nullable(),
});

export const SkillSchema = z.object({
  name: short,
  canonicalId: z.string().max(100).nullable(),
  matchedFrom: z.array(short).max(20),
});

export const ProjectSchema = z.object({
  name: short,
  description: z.string().max(1000),
  link: z.string().max(300),
  skills: z.array(short).max(30),
});

export const StructuredProfileSchema = z.object({
  contact: ContactSchema,
  roles: z.array(RoleSchema).max(30),
  education: z.array(EducationSchema).max(30),
  skills: z.array(SkillSchema).max(150),
  projects: z.array(ProjectSchema).max(30),
});
export type StructuredProfile = z.infer<typeof StructuredProfileSchema>;

// Skills are stored exactly as the normalizer returns them.
const _skillShape: NormalizedSkill = {} as z.infer<typeof SkillSchema>;
void _skillShape;

/** "contact.name", "contact.links.0", "roles.2.start", "roles.2.bullets", "education.0.endYear", "skills.3", "projects.1.name" */
export type FieldPath = string;

export interface ExtractionResult {
  profile: StructuredProfile;
  confidence: Record<FieldPath, number>;
  method: "deterministic" | "refined";
  sourceHash: string;
  warnings: string[];
}

export const ConfirmedProfileSchema = z.object({
  profile: StructuredProfileSchema,
  confirmedAt: z.number().int(),
  sourceHash: z.string().max(64),
  method: z.enum(["deterministic", "refined"]),
});
export type ConfirmedProfile = z.infer<typeof ConfirmedProfileSchema>;

export function emptyProfile(): StructuredProfile {
  return { contact: { name: "", email: "", phone: "", location: "", links: [] }, roles: [], education: [], skills: [], projects: [] };
}

// ─── Field paths ─────────────────────────────────────────────────────────────

export function fieldPaths(p: StructuredProfile): FieldPath[] {
  const out: FieldPath[] = ["contact.name", "contact.email", "contact.phone", "contact.location"];
  p.contact.links.forEach((_, i) => out.push(`contact.links.${i}`));
  p.roles.forEach((_, i) => {
    for (const f of ["title", "company", "location", "start", "end", "bullets"]) out.push(`roles.${i}.${f}`);
  });
  p.education.forEach((_, i) => {
    for (const f of ["degree", "institution", "startYear", "endYear", "detail"]) out.push(`education.${i}.${f}`);
  });
  p.skills.forEach((_, i) => out.push(`skills.${i}`));
  p.projects.forEach((_, i) => {
    for (const f of ["name", "description", "link"]) out.push(`projects.${i}.${f}`);
  });
  return out;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Bounded, regex-free email check: local part 1..64, labels 1..63, TLD 2..24 letters. */
function validEmail(email: string): boolean {
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || /\s/.test(email)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.length > 10) return false;
  for (const l of labels) {
    if (l.length < 1 || l.length > 63 || !/^[A-Za-z0-9-]+$/.test(l) || l.startsWith("-") || l.endsWith("-")) return false;
  }
  return /^[A-Za-z]{2,24}$/.test(labels[labels.length - 1]);
}

const digitCount = (s: string) => (s.match(/[0-9]/g) ?? []).length;

function yearRangeMessage(now: Date): string {
  return MSG_YEAR_RANGE.replace("{next year}", String(now.getFullYear() + 1));
}

/** Path to message. An empty record means the profile can be confirmed. */
export function validateProfile(p: StructuredProfile, now: Date = new Date()): Record<FieldPath, string> {
  const errors: Record<FieldPath, string> = {};
  const maxYear = now.getFullYear() + 1;
  const badYear = (y: number) => y < 1950 || y > maxYear;

  if (!p.contact.name.trim()) errors["contact.name"] = MSG_NAME_REQUIRED;
  if (p.contact.email.trim() && !validEmail(p.contact.email.trim())) errors["contact.email"] = MSG_EMAIL;
  if (p.contact.phone.trim() && digitCount(p.contact.phone) < 7) errors["contact.phone"] = MSG_PHONE;

  p.roles.forEach((r, i) => {
    if (r.start && badYear(r.start.year)) errors[`roles.${i}.start`] = yearRangeMessage(now);
    if (r.current) return; // the end date of a current role is ignored
    if (r.end && badYear(r.end.year)) {
      errors[`roles.${i}.end`] = yearRangeMessage(now);
    } else if (r.start && r.end) {
      const before = r.end.year < r.start.year || (r.end.year === r.start.year && r.start.month !== null && r.end.month !== null && r.end.month < r.start.month);
      if (before) errors[`roles.${i}.end`] = MSG_DATE_ORDER;
    }
  });

  p.education.forEach((e, i) => {
    if (e.startYear !== null && badYear(e.startYear)) errors[`education.${i}.startYear`] = yearRangeMessage(now);
    if (e.endYear !== null && badYear(e.endYear)) errors[`education.${i}.endYear`] = yearRangeMessage(now);
    else if (e.startYear !== null && e.endYear !== null && e.endYear < e.startYear) errors[`education.${i}.endYear`] = MSG_DATE_ORDER;
  });

  return errors;
}
