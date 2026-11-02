// Refinement helpers: convert the model-facing profile shape to a StructuredProfile
// and merge a refined extraction with the deterministic one. Isomorphic and pure.
// Nothing here accepts a confidence number; confidence is always recomputed.
import { z } from "zod";
import { contentHash } from "../retrieval/fusion";
import { normalizeSkills } from "../skills/normalize";
import { computeConfidence, groundingText, isGrounded } from "./confidence";
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

/** The schema allows 20 matchedFrom entries of 200 characters; the model can return more casings than that. */
const capMatchedFrom = <S extends { matchedFrom: string[] }>(skills: S[]): S[] =>
  skills.map((s) => ({ ...s, matchedFrom: s.matchedFrom.slice(0, 20).map((m) => m.slice(0, 200)) }));

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
    skills: capMatchedFrom(normalizeSkills(o.skills.map((s) => clip(s, 200)).filter(Boolean)).slice(0, 150)),
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

// ─── Merge ───────────────────────────────────────────────────────────────────

const CONTACT_SCALARS = ["name", "email", "phone", "location"] as const;

const linkKey = (l: string) => l.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

/**
 * Field-by-field merge of the deterministic and refined extractions. A refined
 * value enters only when its code-computed confidence clears the threshold, so
 * an invented (ungrounded) refined value never reaches the profile:
 * - contact fields fall back to the deterministic value, never to an ungrounded refined one;
 * - roles, education and projects are merged item by item, keeping only refined
 *   items whose identifying fields are grounded, and inside a kept item every
 *   ungrounded detail (dates, location, bullets, links) is dropped;
 * - refined links and skills are only taken when grounded.
 * Confidence of the merged profile is recomputed from the source text.
 */
export function mergeExtractions(det: ExtractionResult, refined: ExtractionResult, sourceText: string): ExtractionResult {
  const ok = (r: ExtractionResult, path: string) => (r.confidence[path] ?? 0) >= LOW_CONFIDENCE_THRESHOLD;
  const rOk = (path: string) => ok(refined, path);
  const norm = groundingText(sourceText);

  const dc = det.profile.contact;
  const rc = refined.profile.contact;
  const merged: StructuredProfile = {
    contact: { name: "", email: "", phone: "", location: "", links: [] },
    roles: [],
    education: [],
    skills: [],
    projects: [],
  };
  for (const k of CONTACT_SCALARS) {
    const path = `contact.${k}`;
    if (rc[k] && rOk(path)) merged.contact[k] = rc[k];
    else merged.contact[k] = dc[k];
  }

  const links: string[] = [];
  const seen = new Set<string>();
  const pushLink = (l: string) => {
    const key = linkKey(l);
    if (!key || seen.has(key) || links.length >= 10) return;
    seen.add(key);
    links.push(l);
  };
  dc.links.forEach(pushLink);
  rc.links.forEach((l, i) => {
    if (rOk(`contact.links.${i}`)) pushLink(l);
  });
  merged.contact.links = links;

  const groundedCount = (r: ExtractionResult, section: "roles" | "education" | "projects", keys: string[]) => {
    const list = r.profile[section] as unknown[];
    let n = 0;
    for (let i = 0; i < list.length; i++) if (keys.every((k) => ok(r, `${section}.${i}.${k}`))) n += 1;
    return n;
  };
  // Refined items whose identifying fields are grounded, with ungrounded details removed.
  const keptRoles = refined.profile.roles.flatMap((r, i) => {
    const at = (k: string) => `roles.${i}.${k}`;
    if (!rOk(at("title")) || !rOk(at("company"))) return [];
    return [
      {
        ...r,
        location: rOk(at("location")) ? r.location : "",
        start: rOk(at("start")) ? r.start : null,
        end: rOk(at("end")) ? r.end : null,
        current: r.current && rOk(at("end")),
        bullets: r.bullets.filter((b) => isGrounded(b, norm)),
      },
    ];
  });
  const keptEducation = refined.profile.education.flatMap((e, i) => {
    const at = (k: string) => `education.${i}.${k}`;
    if (!rOk(at("degree")) || !rOk(at("institution"))) return [];
    return [
      {
        ...e,
        detail: rOk(at("detail")) ? e.detail : "",
        startYear: rOk(at("startYear")) ? e.startYear : null,
        endYear: rOk(at("endYear")) ? e.endYear : null,
      },
    ];
  });
  const keptProjects = refined.profile.projects.flatMap((pr, i) => {
    const at = (k: string) => `projects.${i}.${k}`;
    if (!rOk(at("name"))) return [];
    return [
      {
        ...pr,
        description: rOk(at("description")) ? pr.description : "",
        link: rOk(at("link")) ? pr.link : "",
        skills: pr.skills.filter((sk) => isGrounded(sk, norm)),
      },
    ];
  });
  // The refined list wins only when it has at least as many grounded items as the deterministic one.
  const pick = <T,>(section: "roles" | "education" | "projects", keys: string[], d: T[], kept: T[]): T[] =>
    kept.length > 0 && kept.length >= groundedCount(det, section, keys) ? kept : d;
  merged.roles = pick("roles", ["title", "company"], det.profile.roles, keptRoles);
  merged.education = pick("education", ["degree", "institution"], det.profile.education, keptEducation);
  merged.projects = pick("projects", ["name"], det.profile.projects, keptProjects);

  const rawSkills = det.profile.skills.flatMap((s) => (s.matchedFrom.length ? s.matchedFrom : [s.name]));
  refined.profile.skills.forEach((s, i) => {
    if (ok(refined, `skills.${i}`)) rawSkills.push(...(s.matchedFrom.length ? s.matchedFrom : [s.name]));
  });
  merged.skills = capMatchedFrom(normalizeSkills(rawSkills).slice(0, 150));

  const profile = StructuredProfileSchema.parse(merged);
  return {
    profile,
    confidence: computeConfidence(profile, sourceText),
    method: "refined",
    sourceHash: det.sourceHash,
    warnings: [...new Set([...det.warnings, ...refined.warnings])],
  };
}
