// ─── Tool Marketplace Data ──────────────────────────────────────────────────
// Maps every tool card on the landing page to its category, icon, and the
// route it opens. Every tool lives at its own route under app/<tool>/ —
// app/page.tsx pushes tool.target via the router. (JD Translator additionally
// opens as an in-page overlay on the home page via the navbar/footer.)

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
  /** route path on the site this tool card opens */
  target: `/${string}`;
  /**
   * Set when the tool has an in-page panel on the home page. The header/footer
   * then open that panel instead of navigating, and the route is the fallback.
   */
  overlay?: boolean;
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

  // Added so every tool has a unique glyph. See the icon audit below.
  /** clipboard with lines — prepping/notes */
  clipboardList:
    "M8 2h8a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 12h6 M9 16h6",
  /** four-point sparkle — charm / rizz */
  sparkles:
    "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z",
  /** game controller — boss fight */
  gamepad:
    "M6 11h4 M8 9v4 M15 12h.01 M18 10h.01 M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z",
};

// ─── Tools ───────────────────────────────────────────────────────────────────
export const TOOLS: Tool[] = [
  // ANALYZE
  {
    id: "resume-analyzer",
    name: "Resume Analyzer",
    description: "Find out how badly your resume matches the job.",
    category: "analyze",
    iconPaths: [I.fileSearch],
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
    iconPaths: [I.flame],
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
    iconPaths: [I.penLine],
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
    iconPaths: [I.wrench],
    accent: "#059669",
    tint: "#ecfdf5",
    target: "/resume-fixer",
  },
  {
    id: "bullet-point-fixer",
    name: "Bullet Point Fixer",
    description:
      "Transform weak bullets into impact-oriented statements. Fix that bullet.",
    category: "optimize",
    iconPaths: [I.listChecks],
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/bullet-point-fixer",
  },
  {
    id: "job-fit",
    name: "Job Fit Checker",
    description: "Should you apply, or are you absolutely cooked?",
    category: "analyze",
    iconPaths: [I.target],
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
    iconPaths: [I.glasses],
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/delulu-detector",
  },
  {
    id: "ats-checker",
    name: "ATS Checker",
    description: "See whether the resume robots can actually understand you.",
    category: "analyze",
    iconPaths: [I.robot],
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/ats-checker",
  },
  {
    id: "jd-translator",
    name: "JD Translator",
    description: "Decode corporate yapping into human language.",
    category: "analyze",
    iconPaths: [I.languages],
    accent: "#d97706",
    tint: "#fffbeb",
    target: "/jd-translator",
    overlay: true,
  },

  // OPTIMIZE
  {
    id: "linkedin-optimizer",
    name: "LinkedIn Optimizer",
    description: "Make your LinkedIn less NPC.",
    category: "optimize",
    iconPaths: [I.linkedin],
    accent: "#1d4ed8",
    tint: "#eff6ff",
    target: "/linkedin-optimizer",
  },
  {
    id: "cover-letter",
    name: "Cover Letter Generator",
    description:
      "Write a job-specific cover letter without sounding like ChatGPT.",
    category: "optimize",
    iconPaths: [I.mail],
    accent: "#d97706",
    tint: "#fffbeb",
    target: "/cover-letter-generator",
  },
  {
    id: "recruiter-message",
    name: "Recruiter Message",
    description:
      "Generate a cold message that doesn't immediately scream desperation.",
    category: "optimize",
    iconPaths: [I.messages],
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/recruiter-message",
  },

  // INVESTIGATE
  {
    id: "jd-red-flags",
    name: "JD Red Flag Scanner",
    description: "Find the suspicious parts of the job description.",
    category: "investigate",
    iconPaths: [I.shieldAlert],
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "/jd-red-flag-scanner",
  },
  {
    id: "skill-gap",
    name: "Skill Gap Analyzer",
    description: "See exactly what you're missing for the role.",
    category: "investigate",
    iconPaths: [I.gap],
    accent: "#2563eb",
    tint: "#eff6ff",
    target: "/skill-gap-analyzer",
  },
  {
    id: "github-check",
    name: "GitHub Resume Checker",
    description: "Find out whether your GitHub actually backs up your resume.",
    category: "investigate",
    iconPaths: [I.github],
    accent: "#0f172a",
    tint: "#f1f5f9",
    target: "/github-resume-checker",
  },
  {
    id: "truth-detector",
    name: "Resume Truth Detector",
    description: "Separate actual evidence from trust-me-bro claims.",
    category: "investigate",
    iconPaths: [I.scale],
    accent: "#d97706",
    tint: "#fffbeb",
    target: "/resume-truth-detector",
  },
  {
    id: "recruiter-simulator",
    name: "Recruiter Simulator",
    description: "See what a recruiter is likely to notice in 30 seconds.",
    category: "investigate",
    iconPaths: [I.eye],
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/recruiter-simulator",
  },

  // PREPARE
  {
    id: "interview-prep",
    name: "Interview Prep",
    description: "Generate questions based on your resume and the actual JD.",
    category: "prepare",
    iconPaths: [I.clipboardList],
    accent: "#0891b2",
    tint: "#ecfeff",
    target: "/interview-prep",
  },
  {
    id: "boss-fight",
    name: "Interview Boss Fight",
    description: "Get interrogated before the interviewer gets the chance.",
    category: "prepare",
    iconPaths: [I.swords],
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "/interview-boss-fight",
  },
  {
    id: "star-builder",
    name: "STAR Answer Builder",
    description: "Turn your messy experience into interview-ready answers.",
    category: "prepare",
    iconPaths: [I.star],
    accent: "#d97706",
    tint: "#fffbeb",
    target: "/star-answer-builder",
  },
  {
    id: "tell-me-about",
    name: "Tell Me About Yourself",
    description: "Build the answer everyone asks and nobody likes preparing.",
    category: "prepare",
    iconPaths: [I.userCircle],
    accent: "#059669",
    tint: "#ecfdf5",
    target: "/tell-me-about-yourself",
  },
  {
    id: "weakness-detector",
    name: "Weakness Detector",
    description: "Find the questions most likely to expose your skill gaps.",
    category: "prepare",
    iconPaths: [I.zap],
    accent: "#7c3aed",
    tint: "#f5f3ff",
    target: "/weakness-detector",
  },

  // CHAOS
  {
    id: "employment-aura",
    name: "Employment Aura",
    description: "Measure your current employment aura.",
    category: "chaos",
    iconPaths: [I.gauge],
    accent: "#db2777",
    tint: "#fdf2f8",
    target: "/employment-aura",
  },
  {
    id: "rizz-score",
    name: "Rizz Score",
    description: "How convincing is this application, really?",
    category: "chaos",
    iconPaths: [I.sparkles],
    accent: "#dc2626",
    tint: "#fef2f2",
    target: "/rizz-score",
  },
  {
    id: "cooked-meter",
    name: "Cooked Meter",
    description: "See how cooked you are for this particular job.",
    category: "chaos",
    iconPaths: [I.skull],
    accent: "#525252",
    tint: "#f5f5f5",
    target: "/cooked-meter",
  },
  {
    id: "resume-court",
    name: "Resume Court",
    description: "Put your resume claims on trial.",
    category: "chaos",
    iconPaths: [I.gavel],
    accent: "#b45309",
    tint: "#fffbeb",
    target: "/resume-court",
  },
  {
    id: "ats-boss-fight",
    name: "ATS Boss Fight",
    description: "Fight the robots. Again.",
    category: "chaos",
    iconPaths: [I.gamepad],
    accent: "#4f46e5",
    tint: "#eef2ff",
    target: "/ats-boss-fight",
  },
  {
    id: "skill-issue",
    name: "Skill Issue",
    description: "Find out exactly why you're getting rejected.",
    category: "chaos",
    iconPaths: [I.bug],
    accent: "#059669",
    tint: "#ecfdf5",
    target: "/skill-issue",
  },
];

// Guards the marketplace against duplicate entries sneaking back in: the grid
// keys cards by `id`, so a repeated id renders the same tool twice and React
// logs a non-unique-key error. Static config means a duplicate is always a
// bug, so fail loudly in development rather than rendering it silently.
if (process.env.NODE_ENV !== "production") {
  const seen = new Set<string>();
  for (const tool of TOOLS) {
    if (seen.has(tool.id)) {
      throw new Error(
        `lib/tools: duplicate tool id "${tool.id}" — each tool must be listed exactly once.`,
      );
    }
    seen.add(tool.id);
  }
}
