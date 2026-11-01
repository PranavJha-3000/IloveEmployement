// Shared scripted model for agent tests (not a *.test.ts file, so node --test does not run it).
// One factory drives planner tool calls AND every preset generation, fully offline.

import { MockLanguageModelV1 } from "ai/test";
import { setModelFactory } from "../lib/engine/run";
import type { VaultContextChunk } from "../lib/engine/types";

export const AGENT_VAULT: VaultContextChunk[] = [
  { id: "c1", kind: "summary", title: "Summary", text: "Backend engineer, four years of Go and PostgreSQL in fintech." },
  { id: "c2", kind: "bullet", title: "Senior Engineer, Zeta Payments | 2023 – Present", text: "Cut checkout API p99 latency from 900ms to 280ms." },
  { id: "c3", kind: "bullet", title: "Senior Engineer, Zeta Payments | 2023 – Present", text: "Led migration of 40 services to Kubernetes." },
  { id: "c4", kind: "bullet", title: "Engineer, Orbit Labs | 2020 – 2023", text: "Built Go services on PostgreSQL handling 3000 requests per second." },
];

const req = (requirement: string, evidence: "STRONG" | "MISSING", chunkIds: string[]) => ({
  requirement,
  importance: "must" as const,
  evidence,
  proof: evidence === "STRONG" ? "Shown in the vault" : "",
  chunkIds,
});

export const FIT_APPLY = {
  headline: "Strong match for this backend role",
  summary: "Direct Go, PostgreSQL and Kubernetes evidence.",
  requirements: [req("Go", "STRONG", ["c1", "c4"]), req("PostgreSQL", "STRONG", ["c1"]), req("Kubernetes", "STRONG", ["c3"])],
  strengths: [{ text: "Latency work at Zeta", chunkIds: ["c2"] }],
  gaps: [],
  interviewRisks: [],
};

export const FIT_SKIP = {
  headline: "This is a different career",
  summary: "None of the must-haves are evidenced.",
  requirements: [req("Swift", "MISSING", []), req("Embedded C", "MISSING", []), req("Firmware", "MISSING", [])],
  strengths: [],
  gaps: [{ gap: "No Swift", severity: "high" as const, howToAddress: "Build a small iOS app" }],
  interviewRisks: [],
};

export const TAILORED = {
  headline: "Backend Engineer",
  summary: { text: "Backend engineer with Go and PostgreSQL depth.", chunkIds: ["c1"] },
  sections: [
    {
      title: "Experience",
      entries: [
        {
          heading: "Senior Engineer, Zeta Payments | 2023 – Present",
          bullets: [
            { text: "Cut checkout API p99 latency from 900ms to 280ms", chunkIds: ["c2"], change: "kept" as const },
            { text: "Led migration of 40 services to Kubernetes", chunkIds: ["c3"], change: "reworded" as const },
          ],
        },
      ],
    },
  ],
  skills: ["Go", "PostgreSQL"],
  changes: ["Led with latency work"],
  gapsLeft: [],
};

export const COVER = {
  subject: "",
  body: "I cut checkout latency to 280ms at Zeta Payments and grew revenue.",
  variants: [],
  placeholders: [],
  notes: [],
  citations: [
    { chunkId: "c2", claim: "cut latency to 280ms" },
    { chunkId: "c99", claim: "grew revenue" },
  ],
};

export const OUTREACH = {
  subject: "",
  body: "Hi, I led a migration of 40 services to Kubernetes and would love to chat about the role.",
  variants: [],
  placeholders: [],
  notes: [],
  citations: [{ chunkId: "c3", claim: "migrated 40 services to Kubernetes" }],
};

export const REVIEW_SHIP = {
  issues: [{ severity: "low", where: "intro", problem: "Slightly long", fix: "Trim a clause" }],
  verdict: "ship",
};

export interface ScriptAgentOptions {
  /** Planner tool names in order; the last repeats once exhausted. */
  plan: string[];
  usage?: { promptTokens: number; completionTokens: number };
  outputs?: Partial<Record<"fit" | "resume" | "cover" | "outreach", unknown>>;
}

export function scriptAgentModel(opts: ScriptAgentOptions) {
  const usage = opts.usage ?? { promptTokens: 100, completionTokens: 50 };
  const prompts: string[] = [];
  let planner = 0;
  let generations = 0;
  const outputs = {
    fit: FIT_APPLY,
    resume: TAILORED,
    cover: COVER,
    outreach: OUTREACH,
    ...opts.outputs,
  };

  setModelFactory(
    () =>
      new MockLanguageModelV1({
        doGenerate: async (options) => {
          const raw = { rawCall: { rawPrompt: null, rawSettings: {} }, usage };
          const mode = options.mode as { type: string; tools?: unknown[] };
          if (mode.type === "regular" && Array.isArray(mode.tools) && mode.tools.length > 0) {
            const toolName = opts.plan[Math.min(planner, opts.plan.length - 1)];
            planner += 1;
            return {
              ...raw,
              finishReason: "tool-calls" as const,
              text: undefined,
              toolCalls: [{ toolCallType: "function" as const, toolCallId: `t${planner}`, toolName, args: "{}" }],
            };
          }
          generations += 1;
          const prompt = JSON.stringify(options.prompt);
          prompts.push(prompt);
          let next: unknown;
          if (prompt.includes("draft_to_review")) next = REVIEW_SHIP;
          else if (prompt.includes("Task — Job Fit Check")) next = outputs.fit;
          else if (prompt.includes("Task — Tailor My Resume")) next = outputs.resume;
          else if (prompt.includes("Task — Cover Letter")) next = outputs.cover;
          else next = outputs.outreach;
          return { ...raw, finishReason: "stop" as const, text: JSON.stringify(next) };
        },
      }),
  );
  return { plannerCalls: () => planner, generationCalls: () => generations, prompts };
}
