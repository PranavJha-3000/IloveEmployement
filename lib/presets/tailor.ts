// ─── Tailor Engine Presets ───────────────────────────────────────────────────
// Rewrites of the user's own material. Every rewritten line must cite the vault
// chunk it came from; the finalizer flags lines that don't and strips skills
// that appear nowhere in the source. High-stakes outputs get a reviewer pass.

import { area, chips, company, jobDescription, joinQuery, recipient, resume, role, text, tone } from "./fields";
import type { MessagePreset, ReportPreset } from "./types";

const jdQuery = (i: Record<string, string>) => joinQuery(i.role, i.jobDescription?.slice(0, 3000));

export const TAILOR_PRESETS: (ReportPreset | MessagePreset)[] = [
  {
    id: "tailor-resume",
    slug: "resume-tailor",
    engine: "tailor",
    output: "resume",
    category: "materials",
    name: "Tailor My Resume",
    tagline: "Rewrite your resume for one job. Every line traced to the truth.",
    description:
      "Reposition your real experience for a specific job: reorder, reword and surface buried evidence, with every bullet citing where it came from. A second AI reviews the draft for invented claims before you see it.",
    icon: "penLine",
    fields: [
      jobDescription(true),
      resume(),
      chips("intensity", "How much change?", [
        ["light", "Light polish"],
        ["standard", "Standard tailoring"],
        ["aggressive", "Restructure around the job"],
      ], "standard"),
    ],
    kbTags: ["resume", "ats"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 50,
    review: true,
    task: (i) =>
      `Rewrite the user's resume for this job (${i.intensity === "light" ? "light polish: keep structure and most wording" : i.intensity === "aggressive" ? "restructure: reorder sections and bullets around the job's top requirements and cut what's irrelevant" : "standard tailoring: reorder and reword for relevance"}). Keep every role heading (organisation, title, dates) exactly as in the source. Each bullet: strong verb, what was done, the result, and the job's own terms where the user's evidence genuinely matches. Keep the user's real numbers; never add new ones. Every bullet and the summary cite their chunk ids. List requirements you deliberately did not address in gapsLeft.`,
  },
  {
    id: "bullet-fixer",
    slug: "resume-bullet-point-fixer",
    engine: "tailor",
    output: "bullets",
    category: "materials",
    name: "Bullet Point Fixer",
    tagline: "Turn 'responsible for' into impact. No fake numbers.",
    description:
      "Paste weak resume bullets and get impact-first rewrites in a few styles, plus the exact question to answer so you can add a real metric instead of an invented one.",
    icon: "listChecks",
    fields: [
      area("bullets", "Bullets to fix", { required: true, maxLength: 4000, placeholder: "One per line" }),
      role(false, "Target role"),
      jobDescription(),
    ],
    kbTags: ["resume"],
    usesVault: false,
    vaultQuery: () => "",
    task: () =>
      "For each bullet: name its main problem, then give 2–3 rewrites with different angles (impact-first, scope/scale, technical depth). Use only the facts in the bullet. Where a number would help but none was given, write a [placeholder] like [X%] and ask a question that would let the user find the real figure. Note patterns that repeat across bullets.",
  },
  {
    id: "cover-letter",
    slug: "cover-letter-generator",
    engine: "message",
    format: "letter",
    category: "materials",
    name: "Cover Letter",
    tagline: "A cover letter that sounds like you, not like ChatGPT.",
    description:
      "Write a short, specific cover letter for one job from your real experience, with each claim cited to your Career Vault and a reviewer pass that strips generic filler and invented claims.",
    icon: "mail",
    fields: [company(), role(), recipient("Hiring manager's name"), jobDescription(true), resume(), area("whyThem", "Why this company?", { maxLength: 800, placeholder: "Optional, but it's what makes the letter yours" }), tone],
    kbTags: ["cover-letter", "email"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 16,
    review: true,
    task: () =>
      "Write a cover letter of about 250–350 words: an opening that names the role and a specific reason for this company (use the user's reason if given; otherwise a [placeholder], never invented flattery), two short paragraphs mapping the job's top two or three requirements to cited evidence, and a confident close with one clear next step. No restating the resume line by line. Provide one shorter variant (~150 words) suitable for an application form.",
  },
  {
    id: "linkedin-optimizer",
    slug: "linkedin-profile-optimizer",
    engine: "tailor",
    output: "linkedin",
    category: "materials",
    name: "LinkedIn Optimizer",
    tagline: "Make your LinkedIn findable and a lot less NPC.",
    description:
      "Get headline options, an About section, experience entries and a skills order built from your real experience and tuned for recruiter search on the roles you want.",
    icon: "linkedin",
    fields: [
      role(true, "Roles you want to be found for"),
      resume(),
      area("currentAbout", "Your current About section", { maxLength: 2600, placeholder: "Optional" }),
      text("location", "Location / remote preference", { placeholder: "Optional" }),
    ],
    kbTags: ["linkedin", "resume"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: (i) => joinQuery(i.role),
    vaultLimit: 40,
    task: () =>
      "Write 3 headline options under 220 characters with different angles (role + specialty + proof, value proposition, searchable keywords). Write an About section in first person, about 150–250 words, opening with a hook in the first two lines (what shows before 'see more'), then evidence and what the user wants next. Rewrite the 2–4 most relevant experience entries as short paragraphs or bullets with chunk ids. Order the top 10 skills for recruiter search, using only skills present in the material. Suggest Featured items and quick fixes.",
  },
];
