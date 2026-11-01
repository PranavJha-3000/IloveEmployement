// Agent run record helpers. Client-safe and dependency-free (no zod): lib/vault/store.ts
// imports this and ships in many client chunks. Records never carry an API key or request config.

import { AGENT_STEP_BUDGET, AGENT_TOKEN_BUDGET, AGENT_TOOLS } from "./config";
import type { RunMeta } from "../engine/types";
import type {
  AgentApprovals,
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

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Usage counters: finite, or null where an old build saved NaN (charged as an estimate on load). */
const isCounter = (v: unknown) => isNum(v) || v === null;
const isOptStr = (v: unknown) => v === undefined || typeof v === "string";

function isUsage(v: unknown): boolean {
  return isObj(v) && isCounter(v.planner) && isCounter(v.tool) && isCounter(v.total);
}

function isJob(v: unknown): boolean {
  return (
    isObj(v) &&
    typeof v.description === "string" &&
    typeof v.company === "string" &&
    typeof v.role === "string" &&
    isOptStr(v.url) &&
    isOptStr(v.notes)
  );
}

function isBudget(v: unknown): boolean {
  return (
    isObj(v) &&
    isCounter(v.stepsUsed) &&
    isCounter(v.tokensUsed) &&
    isNum(v.stepBudget) &&
    isNum(v.tokenBudget) &&
    isCounter(v.rejectedChoices) &&
    isNum(v.resets)
  );
}

function isApprovals(v: unknown): boolean {
  if (!isObj(v)) return false;
  const { gateA, gateB, skipOverride } = v;
  if (gateA !== undefined && !(isObj(gateA) && typeof gateA.fitStepId === "string" && isNum(gateA.approvedAt))) return false;
  if (gateB !== undefined && !(isObj(gateB) && (gateB.decision === "draft" || gateB.decision === "decline") && isNum(gateB.approvedAt))) {
    return false;
  }
  if (
    skipOverride !== undefined &&
    !(isObj(skipOverride) && typeof skipOverride.fitStepId === "string" && isNum(skipOverride.confirmedAt))
  ) {
    return false;
  }
  return true;
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
    isUsage(v.usage) &&
    typeof v.startedAt === "number"
  );
}

export function isAgentRunRecord(v: unknown): v is AgentRunRecord {
  if (!isObj(v)) return false;
  if (typeof v.id !== "string" || v.id.length === 0) return false;
  if (v.schemaVersion !== 1) return false;
  if (typeof v.createdAt !== "number" || typeof v.updatedAt !== "number") return false;
  if (typeof v.status !== "string" || !(RUN_STATUSES as readonly string[]).includes(v.status)) return false;
  if (!isJob(v.job)) return false;
  if (!Array.isArray(v.steps) || !v.steps.every(isStep)) return false;
  if (!isApprovals(v.approvals) || !isBudget(v.budget)) return false;
  if (typeof v.pauseAfterStep !== "boolean") return false;
  return true;
}

const SECRET_KEY = /api.?key|secret|token|password/i;

/** Only string values, and never a key-like field name. */
function storableInputs(inputs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs ?? {})) {
    if (typeof v === "string" && !SECRET_KEY.test(k)) out[k] = v;
  }
  return out;
}

function storableOutput(o: NonNullable<AgentStepRecord["output"]>): NonNullable<AgentStepRecord["output"]> {
  const meta = Object.fromEntries(
    Object.entries(o.meta ?? {}).filter(([k]) => !SECRET_KEY.test(k)),
  ) as unknown as RunMeta;
  const sent = (Array.isArray(o.sent) ? o.sent : []).map((c) => ({ id: c.id, kind: c.kind, title: c.title, text: c.text }));
  return { data: o.data, meta, sent };
}

function storableEdit(e: NonNullable<AgentStepRecord["edit"]>): NonNullable<AgentStepRecord["edit"]> {
  const out: NonNullable<AgentStepRecord["edit"]> = { body: e.body, editedAt: e.editedAt, grounding: [...(e.grounding ?? [])] };
  if (e.subject !== undefined) out.subject = e.subject;
  return out;
}

function storableTarget(t: NonNullable<AgentStepRecord["target"]>): NonNullable<AgentStepRecord["target"]> {
  return { jobTitle: t.jobTitle, company: t.company, ...(t.jobUrl !== undefined ? { jobUrl: t.jobUrl } : {}) };
}

function storableApprovals(a: AgentApprovals): AgentApprovals {
  const out: AgentApprovals = {};
  if (a.gateA) out.gateA = { fitStepId: a.gateA.fitStepId, approvedAt: a.gateA.approvedAt };
  if (a.gateB) {
    const b = a.gateB;
    out.gateB = { decision: b.decision, approvedAt: b.approvedAt };
    if (b.recipientName !== undefined) out.gateB.recipientName = b.recipientName;
    if (b.recipientRole !== undefined) out.gateB.recipientRole = b.recipientRole;
    if (b.channel !== undefined) out.gateB.channel = b.channel;
  }
  if (a.skipOverride) out.skipOverride = { fitStepId: a.skipOverride.fitStepId, confirmedAt: a.skipOverride.confirmedAt };
  return out;
}

function storableStep(s: AgentStepRecord): AgentStepRecord {
  const out: AgentStepRecord = {
    id: s.id,
    tool: s.tool,
    status: s.status,
    plannedBy: s.plannedBy,
    inputs: storableInputs(s.inputs),
    usage: { planner: s.usage.planner, tool: s.usage.tool, total: s.usage.total },
    startedAt: s.startedAt,
  };
  if (s.requestedTool !== undefined) out.requestedTool = s.requestedTool;
  if (s.presetId !== undefined) out.presetId = s.presetId;
  if (s.output !== undefined) out.output = storableOutput(s.output);
  if (s.verdict !== undefined) out.verdict = s.verdict;
  if (s.edit !== undefined) out.edit = storableEdit(s.edit);
  if (s.target !== undefined) out.target = storableTarget(s.target);
  if (s.finishedAt !== undefined) out.finishedAt = s.finishedAt;
  if (s.durationMs !== undefined) out.durationMs = s.durationMs;
  if (s.error !== undefined) out.error = s.error;
  if (s.invalidated !== undefined) out.invalidated = { reason: s.invalidated.reason, at: s.invalidated.at };
  return out;
}

/**
 * Whitelist rebuild, nested objects included: unknown keys (a stray config or apiKey) never reach
 * storage or export. Preset output `data` is kept as is; `meta` drops any key-like field.
 */
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
    approvals: storableApprovals(r.approvals),
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
  if (r.stopReason !== undefined) {
    out.stopReason = { kind: r.stopReason.kind, message: r.stopReason.message, at: r.stopReason.at };
  }
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
  const role = typeof job.role === "string" ? job.role.trim() : "";
  const company = typeof job.company === "string" ? job.company.trim() : "";
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
