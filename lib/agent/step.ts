// One stateless agent step. The client sends the whole run state; this validates it, applies the
// shared policy, asks the planner for a tool, and runs it through the unchanged runPreset pipeline.
// Server-only. Never log the request: it may carry a BYOK key.

import { resolveAccess } from "../engine/access";
import { screenUntrusted } from "../engine/injection";
import { runPreset } from "../engine/run";
import { classifyAIError } from "../pipeline";
import { getPresetById } from "../presets";
import {
  AGENT_NULL_USAGE_ESTIMATE,
  AGENT_TOOLS,
  AGENT_TOOL_PRESETS,
  AGENT_WORK_TOOLS,
  type AgentToolName,
  type AgentWorkTool,
} from "./config";
import { planNextTool } from "./planner";
import { budgetLimits, countUsage, nextAction, validateChoice } from "./policy";
import { parseAgentStepRequest } from "./schema";
import type {
  AgentApprovals,
  AgentBudgetView,
  AgentJob,
  AgentStepRecord,
  AgentStepResponse,
  AgentStepSummary,
  AgentUsage,
} from "./types";

if (process.env.NODE_ENV !== "production") {
  for (const tool of AGENT_WORK_TOOLS) {
    if (!getPresetById(AGENT_TOOL_PRESETS[tool])) {
      throw new Error(`Agent tool ${tool} maps to unknown preset ${AGENT_TOOL_PRESETS[tool]}`);
    }
  }
}

export interface AgentStepOptions {
  limits?: Partial<{ stepBudget: number; tokenBudget: number }>;
  now?: () => number;
  newId?: () => string;
}

export type AgentStepResult = { status: number; body: AgentStepResponse | { error: string } };

/** User-owned values (run state) win over the model's enum args. */
export function toolInputs(
  tool: AgentWorkTool,
  args: Record<string, unknown>,
  job: AgentJob,
  approvals: AgentApprovals,
): Record<string, string> {
  const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
  const gateB = approvals.gateB;
  const company = job.company || "[Company]";
  const role = job.role || "[Role]";
  switch (tool) {
    case "fit_check":
      return { jobDescription: job.description };
    case "tailor_resume":
      return { jobDescription: job.description, intensity: str(args.intensity) ?? "standard" };
    case "cover_letter":
      return {
        company,
        role,
        recipientName: "",
        jobDescription: job.description,
        whyThem: job.notes ?? "",
        tone: str(args.tone) ?? "professional",
      };
    case "outreach_message":
      return {
        channel: gateB?.channel ?? "linkedin-message",
        company,
        role,
        recipientName: gateB?.recipientName ?? "",
        recipientRole: gateB?.recipientRole ?? str(args.recipientRole) ?? "recruiter",
        jobDescription: job.description,
        hook: job.notes ?? "",
        tone: str(args.tone) ?? "professional",
      };
  }
}

function view(
  steps: AgentStepSummary[],
  floor: { stepsUsed: number; tokensUsed: number },
  limits: { stepBudget: number; tokenBudget: number },
): AgentBudgetView {
  const u = countUsage(steps);
  return {
    stepsUsed: Math.max(u.stepsUsed, floor.stepsUsed),
    tokensUsed: Math.max(u.tokensUsed, floor.tokensUsed),
    stepBudget: limits.stepBudget,
    tokenBudget: limits.tokenBudget,
    rejectedChoices: u.rejectedChoices,
  };
}

export async function agentStep(raw: unknown, ip: string, opts: AgentStepOptions = {}): Promise<AgentStepResult> {
  // 1. Validate.
  const parsed = parseAgentStepRequest(raw);
  if (!parsed.ok) return { status: 400, body: { error: parsed.message } };
  const req = parsed.value;
  const now = opts.now ?? Date.now;
  const newId = opts.newId ?? (() => crypto.randomUUID());

  // 2. Budget: recomputed from step records, client claims can only raise it.
  const limits = { ...budgetLimits(req.budget.resets), ...opts.limits };
  const claimed = { stepsUsed: req.budget.claimedStepsUsed, tokensUsed: req.budget.claimedTokensUsed };
  const budget = view(req.steps, claimed, limits);

  // 3. Policy. Gates, stops and completion never call a model or consume a free run.
  const action = nextAction(
    { steps: req.steps, approvals: req.approvals },
    { stepsUsed: budget.stepsUsed, tokensUsed: budget.tokensUsed },
    limits,
  );
  if (action.kind !== "step") {
    return { status: 200, body: { kind: "blocked", budget, next: action } };
  }

  // 4. Access, once per step, so a step counts exactly one free run.
  const access = await resolveAccess(req.config, ip);
  if (!access.ok) return { status: access.status, body: { error: access.message } };

  // 5. Plan.
  const startedAt = now();
  const screened = screenUntrusted(req.job.description);
  let planned;
  try {
    planned = await planNextTool(access.config, req, screened.text, action.allowed);
  } catch (err) {
    const info = classifyAIError(err);
    return { status: info.status, body: { error: info.message } };
  }
  const plannerTokens = planned.usage
    ? planned.usage.promptTokens + planned.usage.completionTokens
    : AGENT_NULL_USAGE_ESTIMATE;

  const after = (step: AgentStepRecord) => {
    const steps = [...req.steps, step];
    const next = view(
      steps,
      { stepsUsed: claimed.stepsUsed + 1, tokensUsed: claimed.tokensUsed + step.usage.total },
      limits,
    );
    return {
      budget: next,
      next: nextAction(
        { steps, approvals: req.approvals },
        { stepsUsed: next.stepsUsed, tokensUsed: next.tokensUsed },
        limits,
      ),
    };
  };

  // 6. Validate the choice; a rejected choice executes nothing but still counts.
  const choice = validateChoice(action, planned.toolName);
  if (!choice.ok) {
    const known = (AGENT_TOOLS as readonly string[]).includes(planned.toolName);
    const usage: AgentUsage = { planner: plannerTokens, tool: 0, total: plannerTokens };
    const step: AgentStepRecord = {
      id: newId(),
      tool: known ? (planned.toolName as AgentToolName) : "finish",
      requestedTool: planned.toolName.slice(0, 40),
      status: "rejected",
      plannedBy: planned.plannedBy,
      inputs: {},
      usage,
      startedAt,
      finishedAt: now(),
    };
    const { budget: b, next } = after(step);
    return { status: 200, body: { kind: "rejected", step, budget: b, remaining: access.remaining, next } };
  }

  // 7. Execute through the unchanged pipeline.
  const tool = choice.tool;
  const preset = getPresetById(AGENT_TOOL_PRESETS[tool])!;
  const inputs = toolInputs(tool, planned.args, req.job, req.approvals);
  const sent = req.vault[tool] ?? [];
  const outcome = await runPreset(
    preset,
    { inputs, vault: sent, profile: req.profile, config: req.config, retrieval: req.retrieval?.[tool] },
    ip,
    { access },
  );

  const finishedAt = now();
  const base = {
    id: newId(),
    tool,
    presetId: preset.id,
    plannedBy: planned.plannedBy,
    inputs,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  };
  let step: AgentStepRecord;
  if (!outcome.ok) {
    step = {
      ...base,
      status: "error",
      error: outcome.message,
      usage: { planner: plannerTokens, tool: 0, total: plannerTokens },
    };
  } else {
    const { data, meta } = outcome.result;
    const toolTokens = meta.usage ? meta.usage.promptTokens + meta.usage.completionTokens : AGENT_NULL_USAGE_ESTIMATE;
    step = {
      ...base,
      status: "done",
      output: { data, meta, sent },
      usage: { planner: plannerTokens, tool: toolTokens, total: plannerTokens + toolTokens },
    };
    if (tool === "fit_check") {
      const verdict = (data as { score?: { verdict?: unknown } } | null)?.score?.verdict;
      if (verdict === "APPLY" || verdict === "STRETCH" || verdict === "LONG_SHOT" || verdict === "SKIP") {
        step.verdict = verdict;
      }
    }
    if (tool === "tailor_resume") {
      step.target = { jobTitle: req.job.role, company: req.job.company, ...(req.job.url ? { jobUrl: req.job.url } : {}) };
    }
  }
  const { budget: b, next } = after(step);
  return { status: 200, body: { kind: "step", step, budget: b, remaining: access.remaining, next } };
}
