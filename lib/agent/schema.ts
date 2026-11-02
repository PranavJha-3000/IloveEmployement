// Request schema for POST /api/agent/step. Server-only (zod). The whole body is untrusted:
// every string and array is capped, tools/status/verdict/channel are enums.

import { z } from "zod";
import { MAX_VAULT_LIMIT } from "../presets/types";
import {
  AGENT_JD_MAX,
  AGENT_MAX_BUDGET_RESETS,
  AGENT_MAX_STEP_RECORDS,
  AGENT_NOTES_MAX,
  AGENT_TEXT_MAX,
  AGENT_TOOLS,
  AGENT_URL_MAX,
} from "./config";
import type { AgentStepRequest } from "./types";

const TOKEN_CAP = 10_000_000;
const tokens = z.number().finite().min(0).max(TOKEN_CAP);
const text = (max: number) => z.string().max(max);

const jobSchema = z.object({
  description: z.string().min(1).max(AGENT_JD_MAX),
  company: text(AGENT_TEXT_MAX),
  role: text(AGENT_TEXT_MAX),
  url: z
    .string()
    .max(AGENT_URL_MAX)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "url must be http(s)")
    .optional(),
  notes: text(AGENT_NOTES_MAX).optional(),
});

const stepSchema = z.object({
  id: z.string().min(1).max(64),
  tool: z.enum(AGENT_TOOLS),
  status: z.enum(["running", "done", "error", "rejected", "interrupted"]),
  verdict: z.enum(["APPLY", "STRETCH", "LONG_SHOT", "SKIP"]).optional(),
  usage: z.object({ planner: tokens, tool: tokens, total: tokens }),
  invalidated: z
    .object({ reason: z.literal("fit_rerun"), at: z.number().finite().min(0).max(1e15) })
    .optional(),
});

const approvalsSchema = z.object({
  gateA: z
    .object({ fitStepId: z.string().max(64), approvedAt: z.number().finite().min(0).max(1e15) })
    .optional(),
  gateB: z
    .object({
      decision: z.enum(["draft", "decline"]),
      approvedAt: z.number().finite().min(0).max(1e15),
      recipientName: text(AGENT_TEXT_MAX).optional(),
      recipientRole: z.enum(["recruiter", "hiring-manager", "team-member"]).optional(),
      channel: z.enum(["linkedin-note", "linkedin-message", "email"]).optional(),
    })
    .optional(),
  skipOverride: z
    .object({ fitStepId: z.string().max(64), confirmedAt: z.number().finite().min(0).max(1e15) })
    .optional(),
});

const chunkSchema = z.object({
  id: z.string().max(64),
  kind: z.string().max(20),
  title: z.string().max(120),
  text: z.string().max(1500),
});
const chunks = z.array(chunkSchema).max(MAX_VAULT_LIMIT);

const retrievalMode = z.enum(["hybrid", "keyword", "whole"]);

const profileSchema = z.object({
  name: text(300).optional(),
  headline: text(300).optional(),
  location: text(300).optional(),
  targetRole: text(300).optional(),
  links: text(300).optional(),
});

const configSchema = z.object({
  provider: z.string().max(40),
  apiKey: z.string().max(400),
  model: z.string().max(200),
  baseUrl: z.string().max(500).optional(),
});

export const agentStepRequestSchema = z.object({
  runId: z.string().min(1).max(64),
  job: jobSchema,
  steps: z.array(stepSchema).max(AGENT_MAX_STEP_RECORDS),
  approvals: approvalsSchema,
  budget: z.object({
    resets: z.number().int().min(0).max(AGENT_MAX_BUDGET_RESETS),
    claimedStepsUsed: z.number().int().min(0).max(1_000_000),
    claimedTokensUsed: tokens,
  }),
  vault: z.object({
    fit_check: chunks.optional(),
    tailor_resume: chunks.optional(),
    cover_letter: chunks.optional(),
    outreach_message: chunks.optional(),
  }),
  retrieval: z
    .object({
      fit_check: retrievalMode.optional(),
      tailor_resume: retrievalMode.optional(),
      cover_letter: retrievalMode.optional(),
      outreach_message: retrievalMode.optional(),
    })
    .optional(),
  profile: profileSchema.optional(),
  config: configSchema.optional(),
});

/** Never echoes the body: it may carry an API key. */
export function parseAgentStepRequest(
  raw: unknown,
): { ok: true; value: AgentStepRequest } | { ok: false; message: string } {
  const parsed = agentStepRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Invalid agent step request." };
  return { ok: true, value: parsed.data as AgentStepRequest };
}
