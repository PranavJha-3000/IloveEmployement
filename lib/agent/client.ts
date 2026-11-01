// Client half of the agent loop as pure reducers. Client-safe: no zod, no ai, no server modules.
// Shared by the UI, the resume test and the eval runner. Every reducer returns a new record
// (updatedAt = the `now` it is given) and never mutates its input. Records never carry config.

import { checkGrounding } from "../engine/grounding";
import type { VaultChunk, VaultContextChunk, VaultProfile } from "../engine/types";
import { getPresetById } from "../presets";
import { DEFAULT_VAULT_LIMIT } from "../presets/types";
import type { AiRequestConfig } from "../types";
import { retrieveVault, WHOLE_RESUME_LIMIT } from "../vault/retrieve";
import {
  AGENT_MAX_BUDGET_RESETS,
  AGENT_NULL_USAGE_ESTIMATE,
  AGENT_TOOL_PRESETS,
  type AgentWorkTool,
} from "./config";
import { budgetLimits, countUsage, finiteCount, finiteUsage, latestFitStep, nextAction } from "./policy";
import type {
  AgentApprovals,
  AgentJob,
  AgentNextAction,
  AgentRunRecord,
  AgentRunStatus,
  AgentStepRecord,
  AgentStepRequest,
  AgentStepResponse,
  AgentStepSummary,
} from "./types";

type RetrievalMode = "hybrid" | "keyword" | "whole";

export interface ToolRetrieval {
  vault: Partial<Record<AgentWorkTool, VaultContextChunk[]>>;
  retrieval: Partial<Record<AgentWorkTool, RetrievalMode>>;
}

export interface StepRequestContext {
  vault: Partial<Record<AgentWorkTool, VaultContextChunk[]>>;
  retrieval?: Partial<Record<AgentWorkTool, RetrievalMode>>;
  profile?: Partial<VaultProfile>;
  config?: AiRequestConfig;
}

function jobInputs(job: AgentJob): Record<string, string> {
  return {
    jobDescription: job.description,
    company: job.company || "[Company]",
    role: job.role || "[Role]",
    ...(job.notes ? { whyThem: job.notes, hook: job.notes } : {}),
  };
}

/** Retrieve vault chunks per tool using each preset's own query and limit. */
export function retrieveForTools(
  chunks: VaultChunk[],
  job: AgentJob,
  tools: AgentWorkTool[],
  semanticOrder?: string[],
): ToolRetrieval {
  const vault: ToolRetrieval["vault"] = {};
  const retrieval: ToolRetrieval["retrieval"] = {};
  const inputs = jobInputs(job);
  for (const tool of tools) {
    const preset = getPresetById(AGENT_TOOL_PRESETS[tool]);
    if (!preset || !preset.usesVault) continue;
    const limit = preset.vaultLimit ?? DEFAULT_VAULT_LIMIT;
    const whole = limit > WHOLE_RESUME_LIMIT;
    const order = whole ? undefined : semanticOrder;
    vault[tool] = retrieveVault(chunks, preset.vaultQuery(inputs), limit, order);
    retrieval[tool] = whole ? "whole" : order ? "hybrid" : "keyword";
  }
  return { vault, retrieval };
}

export function summarizeStep(s: AgentStepRecord): AgentStepSummary {
  return {
    id: s.id,
    tool: s.tool,
    status: s.status,
    // Records saved while usage was NaN hold null here; the request schema needs finite numbers.
    usage: finiteUsage(s.usage),
    ...(s.verdict !== undefined ? { verdict: s.verdict } : {}),
    ...(s.invalidated !== undefined ? { invalidated: s.invalidated } : {}),
  };
}

export function localNextAction(record: AgentRunRecord): AgentNextAction {
  // An in-flight placeholder (beginStep) is the step being decided now, not a finished one.
  const steps = record.steps.filter((s) => s.status !== "running").map(summarizeStep);
  const usage = countUsage(steps);
  return nextAction(
    { steps, approvals: record.approvals },
    {
      stepsUsed: Math.max(usage.stepsUsed, finiteCount(record.budget.stepsUsed)),
      tokensUsed: Math.max(usage.tokensUsed, finiteCount(record.budget.tokensUsed)),
    },
    budgetLimits(record.budget.resets),
  );
}

/** Step summaries only (no artifacts) and vault chunks only for tools the policy allows now. */
export function buildStepRequest(record: AgentRunRecord, ctx: StepRequestContext): AgentStepRequest {
  const action = localNextAction(record);
  const allowed = action.kind === "step" ? action.allowed : [];
  const vault: AgentStepRequest["vault"] = {};
  const retrieval: NonNullable<AgentStepRequest["retrieval"]> = {};
  for (const tool of allowed) {
    const chunks = ctx.vault[tool];
    if (chunks) vault[tool] = chunks;
    const mode = ctx.retrieval?.[tool];
    if (mode) retrieval[tool] = mode;
  }
  const req: AgentStepRequest = {
    runId: record.id,
    job: record.job,
    steps: record.steps.map(summarizeStep),
    approvals: record.approvals,
    budget: {
      resets: record.budget.resets,
      claimedStepsUsed: Math.trunc(finiteCount(record.budget.stepsUsed)),
      claimedTokensUsed: finiteCount(record.budget.tokensUsed),
    },
    vault,
    ...(Object.keys(retrieval).length ? { retrieval } : {}),
    ...(ctx.profile ? { profile: ctx.profile } : {}),
    ...(ctx.config ? { config: ctx.config } : {}),
  };
  return req;
}

function statusFor(record: AgentRunRecord, next: AgentNextAction): AgentRunStatus {
  switch (next.kind) {
    case "gate":
      return "awaiting_approval";
    case "stop":
      return "stopped";
    case "complete":
      return "completed";
    case "step":
      return "running";
  }
}

/** Re-derives status (and stopReason) from the local policy after a reducer changed the record. */
function settle(record: AgentRunRecord, now: number): AgentRunRecord {
  const next = localNextAction(record);
  const out: AgentRunRecord = { ...record, status: statusFor(record, next), updatedAt: now };
  if (next.kind === "stop") out.stopReason = { kind: next.reason, message: next.message, at: now };
  else delete out.stopReason;
  return out;
}

export function applyStepResponse(record: AgentRunRecord, res: AgentStepResponse, now: number): AgentRunRecord {
  const budget = {
    ...record.budget,
    stepsUsed: res.budget.stepsUsed,
    tokensUsed: res.budget.tokensUsed,
    stepBudget: res.budget.stepBudget,
    tokenBudget: res.budget.tokenBudget,
    rejectedChoices: res.budget.rejectedChoices,
  };
  // The server's step replaces the in-flight placeholder (beginStep).
  const settled = record.steps.filter((s) => s.status !== "running");
  const steps = res.kind === "blocked" ? settled : [...settled, res.step];
  const out: AgentRunRecord = { ...record, steps, budget, updatedAt: now };
  const next = res.next;
  delete out.stopReason;
  switch (next.kind) {
    case "gate":
      out.status = "awaiting_approval";
      break;
    case "complete":
      out.status = "completed";
      break;
    case "stop":
      out.status = "stopped";
      out.stopReason = { kind: next.reason, message: next.message, at: now };
      break;
    case "step":
      if (res.kind === "step" && res.step.status === "error") out.status = "error";
      else if (res.kind === "step" && record.pauseAfterStep) out.status = "paused";
      else out.status = "running";
      break;
  }
  return out;
}

/**
 * The advance loop's view of a run. `latest` is the record the UI last committed (it may hold a
 * pause toggle or a saved edit made while a step was in flight); `own` is the loop's copy.
 * `current` is false when the UI switched to another run or the user stopped this one.
 */
export function loopBase(
  latest: AgentRunRecord | null,
  own: AgentRunRecord,
): { record: AgentRunRecord; current: boolean } {
  if (!latest || latest.id !== own.id) return { record: own, current: false };
  return { record: latest, current: latest.status !== "stopped" };
}

/**
 * Applies a step response onto the latest committed record instead of the loop's stale copy, so
 * changes made while the step ran survive. A user stop made meanwhile wins: the paid step is kept,
 * the run stays stopped. `current` false tells the loop to stop driving the run.
 */
export function rebaseStepResponse(
  latest: AgentRunRecord | null,
  own: AgentRunRecord,
  res: AgentStepResponse,
  now: number,
): { record: AgentRunRecord; current: boolean } {
  const base = loopBase(latest, own);
  const applied = applyStepResponse(base.record, res, now);
  if (base.record.status === "stopped") {
    const kept: AgentRunRecord = { ...applied, status: "stopped" };
    if (base.record.stopReason) kept.stopReason = base.record.stopReason;
    return { record: kept, current: false };
  }
  return { record: applied, current: base.current };
}

export const STEP_TIMEOUT_MESSAGE =
  "The step took too long and the server stopped it. It may still count toward your budget";

/** The parts of a fetch Response the loop reads, so this can be tested without a server. */
export interface StepHttpResponse {
  ok: boolean;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

/**
 * Reads /api/agent/step. A platform timeout or proxy error is HTML or empty, not JSON: that
 * becomes a fixed message (never the raw parser error) and counts as interrupted, since the
 * server may have run the step before it was killed.
 */
export async function readStepResponse(
  res: StepHttpResponse,
): Promise<{ ok: true; json: AgentStepResponse } | { ok: false; message: string; interrupted: boolean }> {
  const type = res.headers.get("content-type") ?? "";
  let body: unknown;
  if (/application\/json/i.test(type)) {
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
  }
  if (typeof body !== "object" || body === null) return { ok: false, message: STEP_TIMEOUT_MESSAGE, interrupted: true };
  const obj = body as Record<string, unknown>;
  if (!res.ok || "error" in obj) {
    const error = obj.error;
    return { ok: false, message: typeof error === "string" && error ? error : "Something went wrong.", interrupted: false };
  }
  return { ok: true, json: body as AgentStepResponse };
}

/** Marks the latest committed record (not the loop's stale copy) as errored. A user stop wins. */
export function markRunError(
  latest: AgentRunRecord | null,
  own: AgentRunRecord,
  now: number,
  opts: { interrupted?: boolean } = {},
): AgentRunRecord {
  const base = loopBase(latest, own).record;
  // A clean server error ran nothing: drop the placeholder. A lost response may have run: keep it, charged.
  const steps = opts.interrupted
    ? base.steps.map((s) => (s.status === "running" ? { ...s, status: "interrupted" as const } : s))
    : base.steps.filter((s) => s.status !== "running");
  if (base.status === "stopped") return { ...base, steps };
  return { ...base, steps, status: "error", updatedAt: now };
}

/**
 * Saves an in-flight placeholder before the request is sent, so a step whose response never
 * arrives (stop, closed tab, lost network) is still charged and shows as interrupted on resume.
 * Build the request from the record before calling this: the server must not see the placeholder.
 */
export function beginStep(record: AgentRunRecord, tool: AgentWorkTool, id: string, now: number): AgentRunRecord {
  const placeholder: AgentStepRecord = {
    id,
    tool,
    status: "running",
    plannedBy: "policy-fallback",
    inputs: {},
    usage: { planner: 0, tool: 0, total: AGENT_NULL_USAGE_ESTIMATE },
    startedAt: now,
  };
  return { ...record, steps: [...record.steps, placeholder], updatedAt: now };
}

/** Turns in-flight placeholders into interrupted steps (the request was aborted). */
export function interruptRunning(record: AgentRunRecord, now: number): AgentRunRecord {
  if (!record.steps.some((s) => s.status === "running")) return record;
  return {
    ...record,
    steps: record.steps.map((s) => (s.status === "running" ? { ...s, status: "interrupted" as const } : s)),
    updatedAt: now,
  };
}

/** Gate A "Edit": replace the job inputs, invalidate every later step, clear approvals. Usage keeps counting. */
export function rerunFitCheck(record: AgentRunRecord, patch: Partial<AgentJob>, now: number): AgentRunRecord {
  const steps = record.steps.map((s) =>
    s.invalidated ? s : { ...s, invalidated: { reason: "fit_rerun" as const, at: now } },
  );
  const out: AgentRunRecord = {
    ...record,
    job: { ...record.job, ...patch },
    steps,
    approvals: {},
    status: "running",
    updatedAt: now,
  };
  delete out.stopReason;
  return out;
}

export function approveGateA(record: AgentRunRecord, now: number): AgentRunRecord {
  const fit = latestFitStep(record.steps.map(summarizeStep));
  if (!fit) return record;
  const approvals: AgentApprovals = { ...record.approvals, gateA: { fitStepId: fit.id, approvedAt: now } };
  return settle({ ...record, approvals }, now);
}

export function overrideSkip(record: AgentRunRecord, now: number): AgentRunRecord {
  const fit = latestFitStep(record.steps.map(summarizeStep));
  if (!fit) return record;
  const approvals: AgentApprovals = { ...record.approvals, skipOverride: { fitStepId: fit.id, confirmedAt: now } };
  return settle({ ...record, approvals }, now);
}

export function approveGateB(
  record: AgentRunRecord,
  opts: {
    recipientName?: string;
    recipientRole?: "recruiter" | "hiring-manager" | "team-member";
    channel?: "linkedin-note" | "linkedin-message" | "email";
  },
  now: number,
): AgentRunRecord {
  const gateB: NonNullable<AgentApprovals["gateB"]> = { decision: "draft", approvedAt: now };
  if (opts.recipientName) gateB.recipientName = opts.recipientName;
  if (opts.recipientRole) gateB.recipientRole = opts.recipientRole;
  if (opts.channel) gateB.channel = opts.channel;
  return settle({ ...record, approvals: { ...record.approvals, gateB } }, now);
}

export function declineOutreach(record: AgentRunRecord, now: number): AgentRunRecord {
  const gateB = { decision: "decline" as const, approvedAt: now };
  return settle({ ...record, approvals: { ...record.approvals, gateB } }, now);
}

export function stopRun(record: AgentRunRecord, now: number): AgentRunRecord {
  return {
    ...record,
    status: "stopped",
    stopReason: { kind: "user", message: "Stopped by you. Your finished steps are saved.", at: now },
    updatedAt: now,
  };
}

/** Mirrors the server's limits via budgetLimits(resets); capped so a user cannot grow it freely. */
export function continueWithNewBudget(record: AgentRunRecord, now: number): AgentRunRecord {
  if (record.budget.resets >= AGENT_MAX_BUDGET_RESETS) return record;
  const resets = record.budget.resets + 1;
  const limits = budgetLimits(resets);
  return settle({ ...record, budget: { ...record.budget, resets, ...limits } }, now);
}

export function saveArtifactEdit(
  record: AgentRunRecord,
  stepId: string,
  edit: { subject?: string; body: string },
  now: number,
): AgentRunRecord {
  const target = record.steps.find((s) => s.id === stepId);
  if (!target) return record;
  const text = [edit.subject ?? "", edit.body].filter(Boolean).join("\n");
  const source = Object.values(target.inputs).join("\n");
  const grounding = checkGrounding(text, [], target.output?.sent ?? [], source).problems;
  const saved: NonNullable<AgentStepRecord["edit"]> = { body: edit.body, editedAt: now, grounding };
  if (edit.subject !== undefined) saved.subject = edit.subject;
  return {
    ...record,
    steps: record.steps.map((s) => (s.id === stepId ? { ...s, edit: saved } : s)),
    updatedAt: now,
  };
}

export function revertArtifactEdit(record: AgentRunRecord, stepId: string, now: number): AgentRunRecord {
  return {
    ...record,
    steps: record.steps.map((s) => {
      if (s.id !== stepId || !s.edit) return s;
      const { edit: _removed, ...rest } = s;
      return rest;
    }),
    updatedAt: now,
  };
}
