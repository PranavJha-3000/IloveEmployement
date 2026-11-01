// Refinement helpers: convert the model-facing profile shape to a StructuredProfile
// and merge a refined extraction with the deterministic one. Isomorphic and pure.
// Nothing here accepts a confidence number; confidence is always recomputed.
import { z } from "zod";
import { contentHash } from "../retrieval/fusion";
import { normalizeSkills } from "../skills/normalize";
import { computeConfidence } from "./confidence";
import { parseYearMonth } from "./patterns";
import { LOW_CONFIDENCE_THRESHOLD, StructuredProfileSchema, type ExtractionResult, type StructuredProfile } from "./schema";

/** The shape the model is asked for (no confidence anywhere). Defined here so it is importable without reports.ts. */
export const ModelProfileSchema = z.object({
  contact: z.object({
    name: z.string().describe("Full name exactly as written in the resume; empty if not stated"),
    email: z.string().describe("Email exactly as written; empty if not stated"),
    phone: z.string().describe("Phone number exactly as written; empty if not stated"),
    location: z.string().describe("City or region exactly as written; empty if not stated"),
    links: z.array(z.string()).describe("URLs exactly as written in the resume"),
  }),
  roles: z.array(
    z.object({
      title: z.string().describe("Job title copied verbatim"),
      company: z.string().describe("Employer copied verbatim"),
      location: z.string().describe("Role location copied verbatim; empty if absent"),
      start: z.string().describe('Start date as "YYYY-MM" or "YYYY"; empty string when not stated'),
      end: z.string().describe('End date as "YYYY-MM" or "YYYY"; empty string when not stated or current'),
      current: z.boolean().describe("True only if the resume says Present/Current for this role"),
      bullets: z.array(z.string()).describe("Achievement bullets copied verbatim"),
    }),
  ),
  education: z.array(
    z.object({
      degree: z.string().describe("Degree copied verbatim"),
      institution: z.string().describe("School copied verbatim"),
      startYear: z.string().describe("Four-digit year or empty"),
      endYear: z.string().describe("Four-digit year or empty"),
      detail: z.string().describe("Honours or notes copied verbatim; empty if absent"),
    }),
  ),
  skills: z.array(z.string()).describe("Skills as written in the resume; never add skills that are not listed"),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().describe("Copied verbatim"),
      link: z.string(),
      skills: z.array(z.string()),
    }),
  ),
});
export type ModelProfile = z.infer<typeof ModelProfileSchema>;

const clip = (s: string, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const year = (s: string): number | null => {
  const m = /^\s*(\d{4})\s*$/.exec(s ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2100 ? y : null;
};

export function fromModelProfile(o: ModelProfile): StructuredProfile {
  const profile: StructuredProfile = {
    contact: {
      name: clip(o.contact.name, 200),
      email: clip(o.contact.email, 254),
      phone: clip(o.contact.phone, 40),
      location: clip(o.contact.location, 200),
      links: o.contact.links.map((l) => clip(l, 300)).filter(Boolean).slice(0, 10),
    },
    roles: o.roles.slice(0, 30).map((r) => ({
      title: clip(r.title, 200),
      company: clip(r.company, 200),
      location: clip(r.location, 200),
      start: r.start.trim() ? parseYearMonth(r.start.trim()) : null,
      end: r.end.trim() ? parseYearMonth(r.end.trim()) : null,
      current: Boolean(r.current),
      bullets: r.bullets.map((b) => clip(b, 600)).filter(Boolean).slice(0, 40),
    })),
    education: o.education.slice(0, 30).map((e) => ({
      degree: clip(e.degree, 200),
      institution: clip(e.institution, 200),
      detail: clip(e.detail, 600),
      startYear: year(e.startYear),
      endYear: year(e.endYear),
    })),
    skills: normalizeSkills(o.skills.map((s) => clip(s, 200)).filter(Boolean)).slice(0, 150),
    projects: o.projects.slice(0, 30).map((p) => ({
      name: clip(p.name, 200),
      description: clip(p.description, 1000),
      link: clip(p.link, 300),
      skills: p.skills.map((s) => clip(s, 200)).filter(Boolean).slice(0, 30),
    })),
  };
  return StructuredProfileSchema.parse(profile);
}

/** Builds the refined ExtractionResult with code-computed confidence. */
export function refinedResult(o: ModelProfile, resumeText: string): ExtractionResult {
  const profile = fromModelProfile(o);
  return {
    profile,
    confidence: computeConfidence(profile, resumeText),
    method: "refined",
    sourceHash: contentHash(resumeText),
    warnings: [],
  };
}
