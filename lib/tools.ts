// ─── Tool Marketplace Data ──────────────────────────────────────────────────
// Maps every tool card on the landing page to its category, icon, and the
// existing section it activates. No new backend — targets are anchor IDs on
// the home page (#analyzer) or internal routes (/jd-translator opens as an in-page overlay on the home page, or standalone at the route).

export type CategoryId =
  "all" | "analyze" | "optimize" | "investigate" | "prepare" | "chaos";

export interface Category {
  id: CategoryId;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: "all", label: "All" },
  { id: "analyze", label: "Analyze" },
  { id: "optimize", label: "Optimize" },
  { id: "investigate", label: "Investigate" },
  { id: "prepare", label: "Prepare" },
  { id: "chaos", label: "Chaos" },
];

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: Exclude<CategoryId, "all">;
  /** simple line-art SVG path(s) drawn on a 24x24 viewBox */
  iconPaths: string[];
  /** accent color for the icon tile */
  accent: string;
  /** background tint behind the icon */
  tint: string;
  /** anchor id on the page this tool activates */
  target: string;
}

// ─── Icon paths (24x24, stroke-based, lucide-style) ─────────────────────────
const I = {
  fileSearch:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M11.5 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M14.5 15.5 17 18",
  target:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  robot:
    "M12 2v4 M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M9 11h.01 M15 11h.01 M9 15h6",
  languages: "m5 8 6 6 M4 14l6-6 2-3 M2 5h12 M7 2h1 M22 22l-5-10-5 10 M14 18h6",
  flame:
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  glasses:
    "M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M9 12a3 3 0 0 1 6 0 M3 12H2 M22 12h-1",
  penLine: "M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z",
  wrench:
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  listChecks: "m3 17 2 2 4-4 M3 7l2 2 4-4 M13 6h8 M13 12h8 M13 18h8",
  linkedin:
    "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v1.5A5.98 5.98 0 0 1 16 8z M6 9H2v12h4z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6 12 13 2 6",
  shieldAlert: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01",
  gap: "M3 3v18h18 M7 15l4-6 4 3 5-8",
  github:
    "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
  scale:
    "M12 3v18 M7 21h10 M5 7l7-4 7 4 M5 7 2 13a3 3 0 0 0 6 0z M19 7l-3 6a3 3 0 0 0 6 0z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  messages:
    "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5",
  swords:
    "M14.5 17.5 3 6V3h3l11.5 11.5 M13 19l6-6 M16 16l4 4 M19 21l2-2 M3 21l6-6 M5 18l-2 2",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z",
  userCircle:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 10h.01 M15 10h.01 M8.5 16.5a5 5 0 0 1 7 0",
  zap: "M13 2 3 14h9l-1 8 10-12h-9z",
  gauge: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 12l4-4 M12 9v3",
  skull:
    "M12 2a8 8 0 0 0-8 8c0 2.5 1.2 4.7 3 6.1V19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.9c1.8-1.4 3-3.6 3-6.1a8 8 0 0 0-8-8z M9 12h.01 M15 12h.01 M10 17h4",
  gavel:
    "m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10 M16 16l6-6 M8 8l6-6 M9 7l8 8 M21 11l-8-8",
  bug: "M8 2l1.5 3 M16 2l-1.5 3 M9 5h6a4 4 0 0 1 4 4v3a7 7 0 0 1-14 0V9a4 4 0 0 1 4-4z M3 10h2 M19 10h2 M3 15h2.5 M18.5 15H21 M9 21l1-3 M15 21l-1-3",
};

// ─── Tools ───────────────────────────────────────────────────────────────────
export const TOOLS: Tool[] = [
  // ANALYZE
  {
    id: "resume-analyzer",
    name: "Resume Analyzer",
    description: "Find out how badly your resume matches the job.",
    category: "analyze",
    iconPaths: I.fileSearch.split(" "),
    accent: "#2563eb",
    tint: "#eff6ff",
    target: "/resume-analyzer",
  },
  {
    id: "resume-roast",
    name: "Resume Roast",
    description:
      "A brutally honest diagnosis of what a recruiter is really thinking.",
    category: "analyze",
    iconPaths: I.flame.split(" "),
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "/resume-roast",
  },
  {
    id: "resume-rewriter",
    name: "Resume Rewriter",
    description:
      "Reposition your real experience for the target job. Truth filter always on.",
    category: "optimize",
    iconPaths: I.penLine.split(" "),
    accent: "#2563eb",
    tint: "#eff6ff",
    target: "/resume-rewriter",
  },
  {
    id: "resume-fixer",
    name: "Resume Fixer",
    description:
      "Find the weak sections and fix only what needs fixing. No full rewrite.",
    category: "optimize",
    iconPaths: I.wrench.split(" "),
    accent: "#059669",
    tint: "#ecfdf5",
    target: "/resume-fixer",
  },
  {
    id: "job-fit",
    name: "Job Fit Checker",
    description: "Should you apply, or are you absolutely cooked?",
    category: "analyze",
    iconPaths: I.target.split(" "),
    accent: "#059669",
    tint: "#ecfdf5",
    target: "/job-fit-checker",
  },
  {
    id: "delulu-detector",
    name: "Delulu Detector",
    description:
      "Are you qualified, or are we being delulu? Career-reality check.",
    category: "analyze",
    iconPaths: I.glasses.split(" "),
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/delulu-detector",
  },
  {
    id: "ats-checker",
    name: "ATS Checker",
    description: "See whether the resume robots can actually understand you.",
    category: "analyze",
    iconPaths: I.robot.split(" "),
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/ats-checker",
  },
  {
    id: "jd-translator",
    name: "JD Translator",
    description: "Decode corporate yapping into human language.",
    category: "analyze",
    iconPaths: I.languages.split(" "),
    accent: "#d97706",
    tint: "#fffbeb",
    target: "/jd-translator",
  },
  {
    id: "resume-roast",
    name: "Resume Roast",
    description:
      "Find out what is wrong with your resume before a recruiter does.",
    category: "analyze",
    iconPaths: I.flame.split(" "),
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "analyzer",
  },
  {
    id: "delulu-detector",
    name: "Delulu Detector",
    description: "Reality-check your dream job.",
    category: "analyze",
    iconPaths: I.glasses.split(" "),
    accent: "#db2777",
    tint: "#fdf2f8",
    target: "analyzer",
  },

  // OPTIMIZE
  {
    id: "resume-rewriter",
    name: "Resume Rewriter",
    description:
      "Tailor your resume to the job without inventing a whole new career.",
    category: "optimize",
    iconPaths: I.penLine.split(" "),
    accent: "#059669",
    tint: "#ecfdf5",
    target: "analyzer",
  },
  {
    id: "resume-fixer",
    name: "Resume Fixer",
    description: "Fix weak sections, bullets and positioning.",
    category: "optimize",
    iconPaths: I.wrench.split(" "),
    accent: "#2563eb",
    tint: "#eff6ff",
    target: "analyzer",
  },
  {
    id: "bullet-fixer",
    name: "Bullet Point Fixer",
    description:
      "Turn weak resume bullets into something recruiters might actually read.",
    category: "optimize",
    iconPaths: I.listChecks.split(" "),
    accent: "#0891b2",
    tint: "#ecfeff",
    target: "analyzer",
  },
  {
    id: "linkedin-optimizer",
    name: "LinkedIn Optimizer",
    description: "Make your LinkedIn less NPC.",
    category: "optimize",
    iconPaths: I.linkedin.split(" "),
    accent: "#1d4ed8",
    tint: "#eff6ff",
    target: "analyzer",
  },
  {
    id: "cover-letter",
    name: "Cover Letter Generator",
    description:
      "Write a job-specific cover letter without sounding like ChatGPT.",
    category: "optimize",
    iconPaths: I.mail.split(" "),
    accent: "#d97706",
    tint: "#fffbeb",
    target: "analyzer",
  },
  {
    id: "recruiter-message",
    name: "Recruiter Message",
    description:
      "Generate a cold message that doesn't immediately scream desperation.",
    category: "optimize",
    iconPaths: I.messages.split(" "),
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "analyzer",
  },

  // INVESTIGATE
  {
    id: "jd-red-flags",
    name: "JD Red Flag Scanner",
    description: "Find the suspicious parts of the job description.",
    category: "investigate",
    iconPaths: I.shieldAlert.split(" "),
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "/jd-translator",
  },
  {
    id: "skill-gap",
    name: "Skill Gap Analyzer",
    description: "See exactly what you're missing for the role.",
    category: "investigate",
    iconPaths: I.gap.split(" "),
    accent: "#2563eb",
    tint: "#eff6ff",
    target: "analyzer",
  },
  {
    id: "github-check",
    name: "GitHub Resume Checker",
    description: "Find out whether your GitHub actually backs up your resume.",
    category: "investigate",
    iconPaths: I.github.split(" "),
    accent: "#0f172a",
    tint: "#f1f5f9",
    target: "analyzer",
  },
  {
    id: "truth-detector",
    name: "Resume Truth Detector",
    description: "Separate actual evidence from trust-me-bro claims.",
    category: "investigate",
    iconPaths: I.scale.split(" "),
    accent: "#d97706",
    tint: "#fffbeb",
    target: "analyzer",
  },
  {
    id: "recruiter-simulator",
    name: "Recruiter Simulator",
    description: "See what a recruiter is likely to notice in 30 seconds.",
    category: "investigate",
    iconPaths: I.eye.split(" "),
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "analyzer",
  },

  // PREPARE
  {
    id: "interview-prep",
    name: "Interview Prep",
    description: "Generate questions based on your resume and the actual JD.",
    category: "prepare",
    iconPaths: I.messages.split(" "),
    accent: "#0891b2",
    tint: "#ecfeff",
    target: "analyzer",
  },
  {
    id: "boss-fight",
    name: "Interview Boss Fight",
    description: "Get interrogated before the interviewer gets the chance.",
    category: "prepare",
    iconPaths: I.swords.split(" "),
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "analyzer",
  },
  {
    id: "star-builder",
    name: "STAR Answer Builder",
    description: "Turn your messy experience into interview-ready answers.",
    category: "prepare",
    iconPaths: I.star.split(" "),
    accent: "#d97706",
    tint: "#fffbeb",
    target: "analyzer",
  },
  {
    id: "tell-me-about",
    name: "Tell Me About Yourself",
    description: "Build the answer everyone asks and nobody likes preparing.",
    category: "prepare",
    iconPaths: I.userCircle.split(" "),
    accent: "#059669",
    tint: "#ecfdf5",
    target: "analyzer",
  },
  {
    id: "weakness-detector",
    name: "Weakness Detector",
    description: "Find the questions most likely to expose your skill gaps.",
    category: "prepare",
    iconPaths: I.zap.split(" "),
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "analyzer",
  },

  // CHAOS
  {
    id: "employment-aura",
    name: "Employment Aura",
    description: "Measure your current employment aura.",
    category: "chaos",
    iconPaths: I.gauge.split(" "),
    accent: "#db2777",
    tint: "#fdf2f8",
    target: "analyzer",
  },
  {
    id: "rizz-score",
    name: "Rizz Score",
    description: "How convincing is this application, really?",
    category: "chaos",
    iconPaths: I.flame.split(" "),
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "analyzer",
  },
  {
    id: "cooked-meter",
    name: "Cooked Meter",
    description: "See how cooked you are for this particular job.",
    category: "chaos",
    iconPaths: I.skull.split(" "),
    accent: "#525252",
    tint: "#f5f5f5",
    target: "analyzer",
  },
  {
    id: "resume-court",
    name: "Resume Court",
    description: "Put your resume claims on trial.",
    category: "chaos",
    iconPaths: I.gavel.split(" "),
    accent: "#b45309",
    tint: "#fffbeb",
    target: "analyzer",
  },
  {
    id: "ats-boss-fight",
    name: "ATS Boss Fight",
    description: "Fight the robots. Again.",
    category: "chaos",
    iconPaths: I.robot.split(" "),
    accent: "#4f46e5",
    tint: "#eef2ff",
    target: "analyzer",
  },
  {
    id: "skill-issue",
    name: "Skill Issue",
    description: "Find out exactly why you're getting rejected.",
    category: "chaos",
    iconPaths: I.bug.split(" "),
    accent: "#059669",
    tint: "#ecfdf5",
    target: "analyzer",
  },
];
