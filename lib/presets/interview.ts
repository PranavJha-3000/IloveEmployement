// ─── Interview Engine Presets ────────────────────────────────────────────────
// Prep, practice and stories. Mock Interview is a loop: "mock-interview" plans
// the questions, then the hidden "mock-answer" preset grades each answer; the
// UI (components/engine/MockInterview.tsx) drives the turns.

import { area, chips, company, jobDescription, joinQuery, resume, role, text } from "./fields";
import type { MessagePreset, ReportPreset } from "./types";

const stage = chips("stage", "Which round?", [
  ["recruiter", "Recruiter screen"],
  ["hiring-manager", "Hiring manager"],
  ["technical", "Technical"],
  ["final", "Final / panel"],
], "hiring-manager");

const jdQuery = (i: Record<string, string>) => joinQuery(i.role, i.jobDescription?.slice(0, 3000));

export const INTERVIEW_PRESETS: (ReportPreset | MessagePreset)[] = [
  {
    id: "interview-prep-pack",
    slug: "interview-prep",
    engine: "interview",
    output: "prep",
    category: "interview",
    name: "Interview Prep Pack",
    tagline: "The questions they'll ask you, and where you're exposed.",
    description:
      "Get the questions this interviewer is likely to ask for this job and your background, how risky each one is for you, which of your real experiences to use, what a recruiter sees in your resume in 30 seconds, and smart questions to ask back.",
    icon: "clipboardList",
    fields: [jobDescription(true), resume(), company(false), stage],
    kbTags: ["interview"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 40,
    task: (i) =>
      `Prepare the user for the ${i.stage?.replace("-", " ") || "hiring manager"} round. Predict 10–14 likely questions mixing behavioral, technical, role-specific, motivation and one curveball, weighted toward the job's core requirements and toward claims in the resume an interviewer would probe. Rate the user's risk on each from their actual evidence, and give a truthful answer plan that names which real experience to use (with chunk ids). Identify weak spots with an honest bridge for each, never a bluff. Describe the 30-second recruiter scan of this resume for this job. Suggest questions to ask that show real interest and test for red flags.`,
  },
  {
    id: "mock-interview",
    slug: "mock-interview",
    engine: "interview",
    output: "mockPlan",
    category: "interview",
    name: "Mock Interview",
    tagline: "Practice out loud. Get graded on every answer.",
    description:
      "A mock interview built from the job and your resume: escalating questions, then a score on structure, specificity, relevance, ownership and credibility for each answer, a stronger version built from your real experience, and the follow-up they'd ask next.",
    icon: "swords",
    fields: [
      jobDescription(true),
      resume(),
      stage,
      chips("style", "Interviewer", [
        ["friendly", "Friendly"],
        ["neutral", "Neutral"],
        ["tough", "Tough"],
      ], "neutral"),
    ],
    kbTags: ["interview", "mock"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 40,
    task: (i) =>
      `Plan a ${i.style || "neutral"} ${i.stage?.replace("-", " ") || "hiring manager"} interview of 5–6 questions for this job and candidate: start with a warm-up, escalate, and make the final question target this candidate's biggest real gap for the role. Write the opener in character.`,
  },
  {
    id: "mock-answer",
    slug: "mock-answer",
    engine: "interview",
    output: "answerEval",
    category: "interview",
    hidden: true,
    name: "Mock Interview — answer grading",
    tagline: "",
    description: "",
    icon: "swords",
    fields: [
      text("question", "Question", { required: true, maxLength: 600 }),
      area("answer", "Your answer", { required: true, maxLength: 5000 }),
      jobDescription(),
      text("style", "Interviewer style", { maxLength: 20 }),
    ],
    kbTags: ["interview", "mock"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.question, i.answer),
    vaultLimit: 8,
    task: () =>
      "Grade the candidate's answer to the question as a fair, experienced interviewer for this job. Score each dimension 1–5 (3 = acceptable, 5 = exceptional). Be specific about what worked and the 1–3 changes that matter most. Write a stronger answer that uses only facts from their answer and the Career Vault (cite chunk ids), keeping their voice, with [placeholders] for missing results. Then give the follow-up question a sharp interviewer would ask.",
  },
  {
    id: "star-story-builder",
    slug: "star-story-builder",
    engine: "interview",
    output: "star",
    category: "interview",
    name: "STAR Story Builder",
    tagline: "Turn a messy memory into a story you can tell in 90 seconds.",
    description:
      "Describe something you did in your own words and get a Situation-Task-Action-Result story, a spoken version, the questions it answers, and what's missing to make it land. Save it to your Career Vault so every other tool can use it.",
    icon: "star",
    fields: [
      area("story", "What happened?", { required: true, maxLength: 4000, placeholder: "Messy is fine: the problem, what you did, what changed" }),
      text("question", "Question you're preparing for", { placeholder: "Optional, e.g. 'Tell me about a conflict'", maxLength: 300 }),
      role(false, "Target role"),
    ],
    kbTags: ["interview", "star"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.story, i.question),
    vaultLimit: 8,
    task: () =>
      "Structure the user's story as STAR. Action must be first person singular and specific about what they did. Result uses only outcomes the user stated; otherwise a [placeholder] and a 'missing' question to find the real figure. The spoken version should take 60–120 seconds and sound natural. Cite vault chunks that corroborate details. List other common questions the story answers.",
  },
  {
    id: "tell-me-about-yourself",
    slug: "tell-me-about-yourself",
    engine: "message",
    format: "script",
    category: "interview",
    name: "Tell Me About Yourself",
    tagline: "The answer everyone gets asked and nobody prepares.",
    description:
      "Build your answer to 'tell me about yourself' for one specific job: present, past, why this role, at the length you need, from your real experience.",
    icon: "userCircle",
    fields: [
      role(),
      company(false),
      jobDescription(),
      resume(),
      chips("length", "Length", [
        ["30", "30 seconds"],
        ["60", "60 seconds"],
        ["90", "90 seconds"],
      ], "60"),
    ],
    kbTags: ["interview"],
    usesVault: true,
    requiresProfile: true,
    vaultQuery: jdQuery,
    vaultLimit: 16,
    task: (i) =>
      `Write a spoken "tell me about yourself" answer of about ${i.length || "60"} seconds (~${Math.round((Number(i.length) || 60) * 2.3)} words): present role and focus, one or two proof points most relevant to this job (cited), how they got here in a sentence, and why this role is the logical next step. Conversational, not a resume readout. Give one variant at the other end of the length range.`,
  },
  {
    id: "interview-debrief",
    slug: "interview-debrief",
    engine: "message",
    format: "doc",
    category: "interview",
    name: "Interview Debrief",
    tagline: "Learn from the round you just had, while it's fresh.",
    description:
      "Debrief right after an interview: what went well, what to fix before the next round, likely concerns to address, and a thank-you note referencing what you actually discussed.",
    icon: "listChecks",
    fields: [
      company(),
      role(),
      stage,
      area("questions", "Questions they asked", { required: true, maxLength: 3000 }),
      area("howItWent", "How it went, honestly", { required: true, maxLength: 3000 }),
      text("interviewers", "Interviewer names", { placeholder: "Optional" }),
    ],
    kbTags: ["interview", "thank-you"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.questions, i.role),
    task: () =>
      "Write a debrief with sections: What went well, What to fix before the next round (specific, with a better answer outline for the weakest question using vault evidence), Concerns they may have and how to address them, Next steps and timing. Leave the subject empty. Give the thank-you email as the variant, referencing specific topics discussed.",
  },
];
