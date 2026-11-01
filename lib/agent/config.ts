// Agent workflow constants. Client-safe: no server modules, no zod.

export const AGENT_STEP_BUDGET = 6;
export const AGENT_TOKEN_BUDGET = 50_000;
/** A new step does not start when fewer tokens than this remain. */
export const AGENT_MIN_TOKENS_FOR_STEP = 2_000;
/** How many times "Continue with a new budget" can extend the limits. */
export const AGENT_MAX_BUDGET_RESETS = 2;
/** Tokens charged when a provider returns null usage, so null cannot evade the budget. */
export const AGENT_NULL_USAGE_ESTIMATE = 4_000;
export const AGENT_PLANNER_TIMEOUT_MS = 20_000;
export const AGENT_MAX_STEP_RECORDS = 40;
export const AGENT_JD_MAX = 10_000;
/** Smaller of whyThem (800) and hook (600), so both presets accept it. */
export const AGENT_NOTES_MAX = 600;
export const AGENT_TEXT_MAX = 200;
export const AGENT_URL_MAX = 500;

export const AGENT_TOOLS = [
  "fit_check",
  "tailor_resume",
  "cover_letter",
  "outreach_message",
  "finish",
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number];
export type AgentWorkTool = Exclude<AgentToolName, "finish">;

export const AGENT_WORK_TOOLS: readonly AgentWorkTool[] = [
  "fit_check",
  "tailor_resume",
  "cover_letter",
  "outreach_message",
];

export const AGENT_TOOL_PRESETS: Record<AgentWorkTool, string> = {
  fit_check: "job-fit-check",
  tailor_resume: "tailor-resume",
  cover_letter: "cover-letter",
  outreach_message: "cold-recruiter-message",
};

export const AGENT_TOOL_LABELS: Record<AgentWorkTool, string> = {
  fit_check: "Fit check",
  tailor_resume: "Tailor resume",
  cover_letter: "Cover letter",
  outreach_message: "Outreach message",
};
