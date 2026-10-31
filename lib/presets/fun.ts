// ─── Fun Engine Presets ──────────────────────────────────────────────────────
// Shareable, funny, and still grounded: roasts and court charges must quote the
// resume verbatim (unquotable ones are dropped), court verdicts follow the
// evidence classification, and aura / roast scores are computed in code.

import { area, chips, jobDescription, joinQuery, resume } from "./fields";
import type { ReportPreset } from "./types";

const ROAST_DIMENSIONS: Record<string, string> = {
  roast: "Clarity, Impact, Specificity, Originality (no NPC phrases), Recruiter skim-ability",
  rizz: "Hook (first 5 seconds), Confidence without cap, Proof density, Relevance to the job, Memorability",
  "skill-issue": "Evidence of core skills, Seniority signals, Results shown, Positioning for the target role, Presentation",
  "ats-boss": "Keyword coverage, Parse-ability, Title alignment, Section structure, Survival odds vs the bot",
};

export const FUN_PRESETS: ReportPreset[] = [
  {
    id: "resume-roast",
    slug: "resume-roast",
    engine: "fun",
    output: "roast",
    category: "fun",
    name: "Resume Roast",
    tagline: "Get roasted, then get fixed. Rizz score and ATS boss fight included.",
    description:
      "A brutally funny roast of your resume where every burn quotes your actual resume and comes with a real fix. Switch modes for a Rizz Score, a Skill Issue diagnosis or an ATS Boss Fight.",
    icon: "flame",
    fields: [
      resume(),
      chips("mode", "Mode", [
        ["roast", "Classic roast"],
        ["rizz", "Rizz score"],
        ["skill-issue", "Skill issue"],
        ["ats-boss", "ATS boss fight"],
      ]),
      chips("heat", "Heat", [
        ["mild", "Mild"],
        ["spicy", "Spicy"],
        ["nuclear", "Nuclear"],
      ], "spicy"),
      jobDescription(),
    ],
    kbTags: ["resume", "ats"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: (i) => joinQuery(i.jobDescription?.slice(0, 1500)),
    vaultLimit: 50,
    task: (i) =>
      `Mode: ${i.mode || "roast"}. Heat: ${i.heat || "spicy"}. Score exactly these dimensions 1–10: ${ROAST_DIMENSIONS[i.mode] ?? ROAST_DIMENSIONS.roast}.` +
      (i.jobDescription ? " Judge against the pasted job." : " Judge against the roles the resume is clearly aiming for.") +
      " Write 5–8 burns, each quoting the exact resume text it's about and each with a real fix. Point out buried gold the resume undersells. Don't output an overall score; it's computed from the dimensions.",
  },
  {
    id: "resume-court",
    slug: "resume-court",
    engine: "fun",
    output: "court",
    category: "fun",
    name: "Resume Court",
    tagline: "Your resume's claims, on trial. The evidence decides.",
    description:
      "Put your resume's boldest claims on trial. Each gets a charge, a prosecution, the best defence from your own material, and a verdict that follows the evidence, plus the sentence: the fix that makes it stand up.",
    icon: "gavel",
    fields: [resume()],
    kbTags: ["resume", "github"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: () => "",
    vaultLimit: 50,
    task: () =>
      "Pick the 5–8 boldest claims in the resume (skills, scale, leadership, impact, adjectives). Quote each verbatim. Classify its evidence from the rest of the material: STRONG, PARTIAL, MISSING. Verdicts are assigned in code from your classification, so be fair. Prosecute with wit, defend with the user's real evidence (cite chunk ids), and sentence each with a concrete fix.",
  },
  {
    id: "employment-aura",
    slug: "employment-aura",
    engine: "fun",
    output: "aura",
    category: "fun",
    name: "Employment Aura",
    tagline: "Measure your career aura. Gained and lost, with receipts.",
    description:
      "An aura reading of your career: points gained and lost for real things in your resume and recent career events, a total computed from them, your archetype, and the moves that would raise it.",
    icon: "gauge",
    fields: [resume(), area("events", "Recent career events", { maxLength: 2000, placeholder: "Optional: shipped something, got ghosted, got promoted, rage-quit a standup…" })],
    kbTags: ["resume", "growth"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: (i) => joinQuery(i.events),
    vaultLimit: 40,
    task: () =>
      "Give 6–10 aura events, each tied to something real in the material (cite chunk ids) or the user's recent events: big positive points for real impact, ownership and proof; negative for NPC phrasing, vague claims, missing proof. Use a wide range (e.g. +400 for a quantified flagship win, −150 for 'team player'). The total is summed in code. Name a playful archetype and give concrete glow-up moves.",
  },
  {
    id: "corporate-bingo",
    slug: "corporate-bingo",
    engine: "fun",
    output: "bingo",
    category: "fun",
    name: "Corporate Bingo",
    tagline: "A bingo card for your next all-hands. Click when they say it.",
    description:
      "Generate a playable corporate jargon bingo card, either from a real meeting transcript, all-hands email or job post you paste (every square is found in the text), or the classic board.",
    icon: "listChecks",
    fields: [
      chips("theme", "Board", [
        ["meeting", "Team meeting"],
        ["all-hands", "All-hands"],
        ["jd", "Job posting"],
        ["linkedin", "LinkedIn feed"],
      ]),
      area("text", "Paste real text (optional)", { untrusted: true, maxLength: 10000, placeholder: "A transcript, an email or a job post. Squares will come from it." }),
    ],
    kbTags: ["jargon"],
    usesVault: false,
    vaultQuery: () => "",
    task: (i) =>
      i.text
        ? "Find 24 distinct jargon phrases that actually appear in the pasted text; copy each phrase's source text verbatim into quote. If fewer than 24 exist, fill the rest with phrases typical of this kind of text and leave their quote empty. Add one line of commentary."
        : `Create a classic ${i.theme || "meeting"} bingo board of 24 short, instantly recognisable corporate phrases. Leave every quote empty. Add one line of commentary.`,
  },
];
