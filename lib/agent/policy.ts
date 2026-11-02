// Pure order, gate and budget policy for the agent workflow.
// Client-safe: imports config and types only. Used by the server step and the client loop.

import {
  AGENT_MAX_BUDGET_RESETS,
  AGENT_MIN_TOKENS_FOR_STEP,
  AGENT_NULL_USAGE_ESTIMATE,
  AGENT_STEP_BUDGET,
  AGENT_TOKEN_BUDGET,
  AGENT_WORK_TOOLS,
  type AgentWorkTool,
} from "./config";
import type { AgentApprovals, AgentNextAction, AgentStepSummary, AgentUsage } from "./types";

export interface AgentPolicyState {
  steps: AgentStepSummary[];
  approvals: AgentApprovals;
}

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/**
 * Tokens for one model call. The AI SDK reports a provider's missing usage as NaN (not null),
 * so any non-finite count is charged the null-usage estimate and cannot evade the budget.
 */
export function usageTokens(u: { promptTokens: number; completionTokens: number } | null | undefined): number {
  const p = u?.promptTokens;
  const c = u?.completionTokens;
  return isCount(p) && isCount(c) ? p + c : AGENT_NULL_USAGE_ESTIMATE;
}

/** Step usage with every field finite. A non-finite total (NaN, saved as null) is charged the estimate. */
export function finiteUsage(u: Partial<AgentUsage> | null | undefined): AgentUsage {
  return {
    planner: isCount(u?.planner) ? u.planner : 0,
    tool: isCount(u?.tool) ? u.tool : 0,
    total: isCount(u?.total) ? u.total : AGENT_NULL_USAGE_ESTIMATE,
  };
}

/** A non-finite budget counter falls back to 0; usage is recounted from the steps anyway. */
export function finiteCount(n: unknown): number {
  return isCount(n) ? n : 0;
}

export function countUsage(steps: AgentStepSummary[]): {
  stepsUsed: number;
  tokensUsed: number;
  rejectedChoices: number;
} {
  let stepsUsed = 0;
  let tokensUsed = 0;
  let rejectedChoices = 0;
  for (const s of steps) {
    if (
      s.status === "done" ||
      s.status === "error" ||
      s.status === "rejected" ||
      s.status === "interrupted" ||
      s.status === "running"
    ) {
      stepsUsed += 1;
      tokensUsed += s.usage ? finiteUsage(s.usage).total : 0;
    }
    if (s.status === "rejected") rejectedChoices += 1;
  }
  return { stepsUsed, tokensUsed, rejectedChoices };
}

/** Rejected planner choices since the last step that ran (invalidated steps are skipped). */
export function trailingRejections(steps: AgentStepSummary[]): number {
  let n = 0;
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.invalidated) continue;
    if (s.status !== "rejected") break;
    n += 1;
  }
  return n;
}

export function budgetLimits(resets: number): { stepBudget: number; tokenBudget: number } {
  const n = Number.isFinite(resets) ? Math.trunc(resets) : 0;
  const r = Math.min(AGENT_MAX_BUDGET_RESETS, Math.max(0, n));
  return {
    stepBudget: AGENT_STEP_BUDGET * (1 + r),
    tokenBudget: AGENT_TOKEN_BUDGET * (1 + r),
  };
}

/** The last non-invalidated fit_check with status done. */
export function latestFitStep(steps: AgentStepSummary[]): AgentStepSummary | undefined {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.tool === "fit_check" && s.status === "done" && !s.invalidated) return s;
  }
  return undefined;
}

export function doneTools(steps: AgentStepSummary[]): Set<AgentWorkTool> {
  const out = new Set<AgentWorkTool>();
  for (const s of steps) {
    if (s.status === "done" && !s.invalidated && s.tool !== "finish") out.add(s.tool);
  }
  return out;
}

export function stopMessage(
  reason: "step_budget" | "token_budget" | "skip_verdict",
  used: number,
  limit: number,
): string {
  if (reason === "step_budget") {
    return `Stopped: step limit reached (${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} steps). Your finished steps are saved below.`;
  }
  if (reason === "token_budget") {
    return `Stopped: token limit reached (${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} tokens). Your finished steps are saved below.`;
  }
  return "Stopped: this looks like a poor fit. The fit check verdict is SKIP, so we haven't run the other steps.";
}

export function nextAction(
  state: AgentPolicyState,
  usage: { stepsUsed: number; tokensUsed: number },
  limits: { stepBudget: number; tokenBudget: number },
): AgentNextAction {
  const { steps, approvals } = state;
  const fit = latestFitStep(steps);

  let allowed: AgentWorkTool[];
  if (!fit) {
    allowed = ["fit_check"];
  } else {
    if (fit.verdict === "SKIP" && approvals.skipOverride?.fitStepId !== fit.id) {
      return {
        kind: "stop",
        reason: "skip_verdict",
        message: stopMessage("skip_verdict", 0, 0),
      };
    }
    if (approvals.gateA?.fitStepId !== fit.id) return { kind: "gate", gate: "A" };

    const done = doneTools(steps);
    const materials = (["tailor_resume", "cover_letter"] as const).filter((t) => !done.has(t));
    if (materials.length > 0) {
      allowed = [...materials];
    } else if (!approvals.gateB) {
      return { kind: "gate", gate: "B" };
    } else if (approvals.gateB.decision === "decline" || done.has("outreach_message")) {
      return { kind: "complete" };
    } else {
      allowed = ["outreach_message"];
    }
  }

  if (usage.stepsUsed >= limits.stepBudget) {
    return {
      kind: "stop",
      reason: "step_budget",
      message: stopMessage("step_budget", usage.stepsUsed, limits.stepBudget),
    };
  }
  if (limits.tokenBudget - usage.tokensUsed < AGENT_MIN_TOKENS_FOR_STEP) {
    return {
      kind: "stop",
      reason: "token_budget",
      message: stopMessage("token_budget", usage.tokensUsed, limits.tokenBudget),
    };
  }
  return { kind: "step", allowed };
}

export function validateChoice(
  action: AgentNextAction,
  toolName: string,
): { ok: true; tool: AgentWorkTool } | { ok: false; reason: string } {
  if (toolName === "finish") {
    return { ok: false, reason: "finish is not allowed while work remains" };
  }
  const tool = (AGENT_WORK_TOOLS as readonly string[]).includes(toolName)
    ? (toolName as AgentWorkTool)
    : undefined;
  if (!tool) return { ok: false, reason: `unknown tool: ${String(toolName).slice(0, 40)}` };
  if (action.kind !== "step") {
    return { ok: false, reason: `no tool may run now (${action.kind})` };
  }
  if (!action.allowed.includes(tool)) {
    return { ok: false, reason: `${tool} is not allowed at this point` };
  }
  return { ok: true, tool };
}
