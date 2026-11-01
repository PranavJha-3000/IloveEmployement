// Agent run record helpers. Client-safe and dependency-free (no zod): lib/vault/store.ts
// imports this and ships in many client chunks. Records never carry an API key or request config.

import { AGENT_STEP_BUDGET, AGENT_TOKEN_BUDGET, AGENT_TOOLS } from "./config";
import type {
  AgentJob,
  AgentRunRecord,
  AgentRunStatus,
  AgentStepRecord,
  AgentStepStatus,
} from "./types";

const RUN_STATUSES: readonly AgentRunStatus[] = [
  "idle",
  "running",
  "awaiting_approval",
  "paused",
  "stopped",
  "completed",
  "error",
];
const STEP_STATUSES: readonly AgentStepStatus[] = ["running", "done", "error", "rejected", "interrupted"];

export function createRunRecord(job: AgentJob, opts: { id: string; now: number }): AgentRunRecord {
  return {
    id: opts.id,
    schemaVersion: 1,
    createdAt: opts.now,
    updatedAt: opts.now,
    status: "idle",
    job: { ...job },
    steps: [],
    approvals: {},
    budget: {
      stepsUsed: 0,
      tokensUsed: 0,
      stepBudget: AGENT_STEP_BUDGET,
      tokenBudget: AGENT_TOKEN_BUDGET,
      rejectedChoices: 0,
      resets: 0,
    },
    pauseAfterStep: false,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStep(v: unknown): v is AgentStepRecord {
  if (!isObj(v)) return false;
  return (
    typeof v.id === "string" &&
    typeof v.tool === "string" &&
    (AGENT_TOOLS as readonly string[]).includes(v.tool) &&
    typeof v.status === "string" &&
    (STEP_STATUSES as readonly string[]).includes(v.status) &&
    isObj(v.inputs) &&
    isObj(v.usage) &&
    typeof v.startedAt === "number"
  );
}

export function isAgentRunRecord(v: unknown): v is AgentRunRecord {
  if (!isObj(v)) return false;
  if (typeof v.id !== "string" || v.id.length === 0) return false;
  if (v.schemaVersion !== 1) return false;
  if (typeof v.createdAt !== "number" || typeof v.updatedAt !== "number") return false;
  if (typeof v.status !== "string" || !(RUN_STATUSES as readonly string[]).includes(v.status)) return false;
  if (!isObj(v.job) || typeof v.job.description !== "string") return false;
  if (!Array.isArray(v.steps) || !v.steps.every(isStep)) return false;
  if (!isObj(v.approvals) || !isObj(v.budget)) return false;
  if (typeof v.pauseAfterStep !== "boolean") return false;
  return true;
}

function storableStep(s: AgentStepRecord): AgentStepRecord {
  const out: AgentStepRecord = {
    id: s.id,
    tool: s.tool,
    status: s.status,
    plannedBy: s.plannedBy,
    inputs: s.inputs,
    usage: s.usage,
    startedAt: s.startedAt,
  };
  if (s.requestedTool !== undefined) out.requestedTool = s.requestedTool;
  if (s.presetId !== undefined) out.presetId = s.presetId;
  if (s.output !== undefined) out.output = s.output;
  if (s.verdict !== undefined) out.verdict = s.verdict;
  if (s.edit !== undefined) out.edit = s.edit;
  if (s.target !== undefined) out.target = s.target;
  if (s.finishedAt !== undefined) out.finishedAt = s.finishedAt;
  if (s.durationMs !== undefined) out.durationMs = s.durationMs;
  if (s.error !== undefined) out.error = s.error;
  if (s.invalidated !== undefined) out.invalidated = s.invalidated;
  return out;
}

/** Whitelist rebuild: unknown keys (a stray config or apiKey) never reach storage or export. */
export function toStorable(r: AgentRunRecord): AgentRunRecord {
  const out: AgentRunRecord = {
    id: r.id,
    schemaVersion: 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    status: r.status,
    job: {
      description: r.job.description,
      company: r.job.company,
      role: r.job.role,
      ...(r.job.url !== undefined ? { url: r.job.url } : {}),
      ...(r.job.notes !== undefined ? { notes: r.job.notes } : {}),
    },
    steps: r.steps.map(storableStep),
    approvals: r.approvals,
    budget: {
      stepsUsed: r.budget.stepsUsed,
      tokensUsed: r.budget.tokensUsed,
      stepBudget: r.budget.stepBudget,
      tokenBudget: r.budget.tokenBudget,
      rejectedChoices: r.budget.rejectedChoices,
      resets: r.budget.resets,
    },
    pauseAfterStep: r.pauseAfterStep,
  };
  if (r.stopReason !== undefined) out.stopReason = r.stopReason;
  return out;
}

/** A step that was mid-flight when the page closed is restarted, not assumed done. */
export function normalizeForResume(r: AgentRunRecord): AgentRunRecord {
  const hasRunning = r.steps.some((s) => s.status === "running");
  if (!hasRunning && r.status !== "running") return r;
  return {
    ...r,
    status: r.status === "running" ? "paused" : r.status,
    steps: r.steps.map((s) => (s.status === "running" ? { ...s, status: "interrupted" as const } : s)),
  };
}

export function jobLabel(job: Pick<AgentJob, "role" | "company">): string {
  const role = job.role.trim();
  const company = job.company.trim();
  if (role && company) return `${role} at ${company}`;
  return role || company || "this job";
}

export function runBadge(status: AgentRunStatus): string {
  switch (status) {
    case "awaiting_approval":
      return "Needs approval";
    case "stopped":
    case "error":
      return "Stopped";
    case "completed":
      return "Completed";
    default:
      return "In progress";
  }
}
