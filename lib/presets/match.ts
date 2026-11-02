// ─── Match Engine Presets ────────────────────────────────────────────────────
// Job ↔ profile analysis. The model classifies evidence per requirement; the
// finalizers in lib/engine/reports.ts compute every score and verdict.

import { area, chips, jobDescription, joinQuery, resume, text } from "./fields";
import type { ReportPreset } from "./types";

const jdQuery = (i: Record<string, string>) => joinQuery(i.role, i.jobDescription?.slice(0, 3000));

export const MATCH_PRESETS: ReportPreset[] = [
  {
    id: "job-fit-check",
    slug: "job-fit-checker",
    engine: "match",
    output: "fit",
    category: "target",
    name: "Job Fit Check",
    tagline: "Should you apply, or are you cooked? With receipts.",
    description:
      "Check every requirement in a job posting against your real experience. Each is rated strong, partial or missing with the evidence quoted, and the verdict is computed from them, not guessed.",
    icon: "target",
    fields: [jobDescription(true), resume()],
    kbTags: ["jd", "resume"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 40,
    task: () =>
      "Extract the 8–14 substantive requirements from the job description (skip boilerplate like 'team player'), mark each must or nice, and classify the user's evidence for each with proof and chunk ids. Then list strengths to lead with, real gaps with how to address each honestly, and interview risks. Do not output a score; it is computed from your classifications.",
  },
  {
    id: "jd-decoder",
    slug: "job-description-decoder",
    engine: "match",
    output: "jd",
    category: "target",
    name: "JD Decoder",
    tagline: "What the job posting actually means, red flags included.",
    description:
      "Translate a job description into plain English: the real role, must-haves vs nice-to-haves, corporate jargon decoded, red and green flags quoted from the posting, and questions to ask the recruiter.",
    icon: "languages",
    fields: [
      jobDescription(true),
      text("company", "Company", { placeholder: "Optional" }),
      text("salary", "Salary info, if listed elsewhere", { placeholder: "Optional" }),
    ],
    kbTags: ["jd", "jargon"],
    usesVault: false,
    vaultQuery: () => "",
    task: () =>
      "Decode the posting. Every red and green flag must quote the posting verbatim in its quote field; a flag you can't quote is interpretation and belongs in translations instead. Don't accuse; describe what the text signals and how sure you are. Separate real requirements from wish-list items. Quality is computed from your flags, so don't output a score.",
  },
  {
    id: "skill-gap-plan",
    slug: "skill-gap-analyzer",
    engine: "match",
    output: "gap",
    category: "target",
    name: "Skill Gap Plan",
    tagline: "Exactly what you're missing, and the fastest honest way to close it.",
    description:
      "Map a target role's requirements against your evidence, find transferable skills that partially cover the gaps, and get a prioritised plan: what to reframe, what to build, what to learn, and what needs real time.",
    icon: "gap",
    fields: [
      jobDescription(true),
      resume(),
      chips("timeframe", "How much time do you have?", [
        ["2-weeks", "2 weeks"],
        ["2-months", "2 months"],
        ["6-months", "6 months+"],
      ], "2-months"),
    ],
    kbTags: ["jd", "resume", "growth"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 40,
    task: (i) =>
      `Classify evidence per requirement as for a fit check. Identify transferable skills (real connections only). Then build a prioritised plan sized to ${i.timeframe?.replace("-", " ") || "two months"}: route each gap as reframe (evidence exists but is buried), project (build visible proof), learn (enough to discuss credibly) or long-term (needs real experience; say so). Actions must be specific: name the project, the resource type, the deliverable.`,
  },
  {
    id: "ats-check",
    slug: "ats-resume-checker",
    engine: "match",
    output: "ats",
    category: "materials",
    name: "ATS Check",
    tagline: "See your resume the way the robots do.",
    description:
      "Measure keyword coverage against the job and check parsing basics (contact info, headings, columns, icons, dates) with deterministic rules. Missing keywords you genuinely have are separated from real gaps you shouldn't stuff.",
    icon: "robot",
    fields: [jobDescription(true), resume()],
    kbTags: ["ats", "resume"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 40,
    task: () =>
      "Extract the 12–25 keywords an ATS or recruiter search would match for this job: hard skills, tools, certifications, title terms. Give common synonyms and abbreviations. For each, list vault chunk ids that show the user genuinely has the capability even if worded differently. Coverage and format checks are computed in code from the resume text, so don't estimate them. Add short, specific advice and comment on title alignment.",
  },
  {
    id: "proof-check",
    slug: "resume-proof-check",
    engine: "match",
    output: "proof",
    category: "materials",
    name: "Proof Check",
    tagline: "Does your GitHub back up your resume? Claims vs receipts.",
    description:
      "Put your resume's claims next to the evidence: your own bullets and your public GitHub repos, fetched live. See which claims are proven, which are vague, and how to make each one provable.",
    icon: "github",
    fields: [
      resume(),
      text("githubUrl", "GitHub profile", { placeholder: "https://github.com/you (optional)", maxLength: 200 }),
      area("portfolio", "Portfolio / other proof", { maxLength: 2000, placeholder: "Optional: links or descriptions of public work" }),
    ],
    kbTags: ["resume", "github"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: () => "",
    vaultLimit: 40,
    sources: ["github"],
    task: () =>
      "Pick the 6–12 most important claims in the resume (skills, scale, leadership, impact). For each, classify how well it is evidenced across the resume detail and the fetched GitHub repos (UNVERIFIED if GitHub couldn't be fetched and the claim depends on it). Name supporting repos exactly as listed. For each claim give a concrete fix that makes it provable: a metric to add, a repo to pin, a README to write, or wording to make precise. Be candid but never accuse the user of lying.",
  },
];
