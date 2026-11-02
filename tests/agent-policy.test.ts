// Offline tests of the agent workflow config and policy. No network, no model calls.
import assert from "node:assert";
import { test } from "node:test";
import {
  AGENT_STEP_BUDGET,
  AGENT_TOKEN_BUDGET,
  AGENT_TOOLS,
  AGENT_TOOL_PRESETS,
  AGENT_WORK_TOOLS,
  type AgentToolName,
} from "../lib/agent/config";
import {
  budgetLimits,
  countUsage,
  nextAction,
  validateChoice,
  type AgentPolicyState,
} from "../lib/agent/policy";
import type { AgentStepSummary, FitVerdict } from "../lib/agent/types";
import { getPresetById } from "../lib/presets";

test("every agent work tool maps to a real preset id", () => {
  for (const tool of AGENT_WORK_TOOLS) {
    assert.ok(getPresetById(AGENT_TOOL_PRESETS[tool]), `${tool} -> ${AGENT_TOOL_PRESETS[tool]}`);
  }
});

test("agent tools are exactly the five names including finish", () => {
  assert.deepStrictEqual(
    [...AGENT_TOOLS],
    ["fit_check", "tailor_resume", "cover_letter", "outreach_message", "finish"],
  );
});

test("budget constants", () => {
  assert.strictEqual(AGENT_STEP_BUDGET, 6);
  assert.strictEqual(AGENT_TOKEN_BUDGET, 50000);
});

// ─── Policy ──────────────────────────────────────────────────────────────────

const LIMITS = { stepBudget: 6, tokenBudget: 50000 };
const OK = { stepsUsed: 0, tokensUsed: 0 };

function step(
  id: string,
  tool: AgentToolName,
  extra: Partial<AgentStepSummary> = {},
): AgentStepSummary {
  return { id, tool, status: "done", usage: { planner: 0, tool: 0, total: 0 }, ...extra };
}
function fit(verdict: FitVerdict, id = "f1"): AgentStepSummary {
  return step(id, "fit_check", { verdict });
}
function state(
  steps: AgentStepSummary[],
  approvals: AgentPolicyState["approvals"] = {},
): AgentPolicyState {
  return { steps, approvals };
}
const GATE_A = { fitStepId: "f1", approvedAt: 1 };

test("no steps -> only fit_check", () => {
  assert.deepStrictEqual(nextAction(state([]), OK, LIMITS), {
    kind: "step",
    allowed: ["fit_check"],
  });
});

test("errored fit stays retryable", () => {
  const s = state([step("f0", "fit_check", { status: "error" })]);
  assert.deepStrictEqual(nextAction(s, OK, LIMITS), { kind: "step", allowed: ["fit_check"] });
});

test("fit APPLY without gate A -> gate A", () => {
  assert.deepStrictEqual(nextAction(state([fit("APPLY")]), OK, LIMITS), {
    kind: "gate",
    gate: "A",
  });
});

test("SKIP without override stops even with gate A approved", () => {
  const a = nextAction(state([fit("SKIP")], { gateA: GATE_A }), OK, LIMITS);
  assert.strictEqual(a.kind, "stop");
  if (a.kind === "stop") assert.strictEqual(a.reason, "skip_verdict");
});

test("SKIP with matching override and gate A -> tailor and cover allowed", () => {
  const s = state([fit("SKIP")], {
    gateA: GATE_A,
    skipOverride: { fitStepId: "f1", confirmedAt: 1 },
  });
  assert.deepStrictEqual(nextAction(s, OK, LIMITS), {
    kind: "step",
    allowed: ["tailor_resume", "cover_letter"],
  });
});

test("SKIP override for a different fit step does not apply", () => {
  const s = state([fit("SKIP", "f2")], { skipOverride: { fitStepId: "f1", confirmedAt: 1 } });
  assert.strictEqual(nextAction(s, OK, LIMITS).kind, "stop");
});

test("gate A approved for an invalidated fit step -> gate A again", () => {
  const s = state(
    [
      step("f1", "fit_check", { verdict: "APPLY", invalidated: { reason: "fit_rerun", at: 2 } }),
      fit("APPLY", "f2"),
    ],
    { gateA: GATE_A },
  );
  assert.deepStrictEqual(nextAction(s, OK, LIMITS), { kind: "gate", gate: "A" });
});

test("tailor done, cover not -> cover only; both done -> gate B", () => {
  const one = state([fit("APPLY"), step("t1", "tailor_resume")], { gateA: GATE_A });
  assert.deepStrictEqual(nextAction(one, OK, LIMITS), { kind: "step", allowed: ["cover_letter"] });
  const both = state(
    [fit("APPLY"), step("t1", "tailor_resume"), step("c1", "cover_letter")],
    { gateA: GATE_A },
  );
  assert.deepStrictEqual(nextAction(both, OK, LIMITS), { kind: "gate", gate: "B" });
});

test("invalidated tailor step does not count as done", () => {
  const s = state(
    [fit("APPLY"), step("t1", "tailor_resume", { invalidated: { reason: "fit_rerun", at: 2 } })],
    { gateA: GATE_A },
  );
  assert.deepStrictEqual(nextAction(s, OK, LIMITS), {
    kind: "step",
    allowed: ["tailor_resume", "cover_letter"],
  });
});

test("errored tailor stays allowed for retry", () => {
  const s = state([fit("APPLY"), step("t1", "tailor_resume", { status: "error" })], {
    gateA: GATE_A,
  });
  assert.deepStrictEqual(nextAction(s, OK, LIMITS), {
    kind: "step",
    allowed: ["tailor_resume", "cover_letter"],
  });
});

test("gate B decline -> complete; draft -> outreach; outreach done -> complete", () => {
  const base = [fit("APPLY"), step("t1", "tailor_resume"), step("c1", "cover_letter")];
  assert.deepStrictEqual(
    nextAction(
      state(base, { gateA: GATE_A, gateB: { decision: "decline", approvedAt: 2 } }),
      OK,
      LIMITS,
    ),
    { kind: "complete" },
  );
  const draft = { gateA: GATE_A, gateB: { decision: "draft" as const, approvedAt: 2 } };
  assert.deepStrictEqual(nextAction(state(base, draft), OK, LIMITS), {
    kind: "step",
    allowed: ["outreach_message"],
  });
  assert.deepStrictEqual(
    nextAction(state([...base, step("o1", "outreach_message")], draft), OK, LIMITS),
    { kind: "complete" },
  );
});

test("countUsage counts all statuses and sums tokens", () => {
  const u = (total: number) => ({ planner: 0, tool: total, total });
  const usage = countUsage([
    step("a", "fit_check", { usage: u(100) }),
    step("b", "tailor_resume", { status: "error", usage: u(50) }),
    step("c", "cover_letter", { status: "rejected", usage: u(10) }),
    step("d", "cover_letter", { status: "interrupted", usage: u(5) }),
    step("e", "cover_letter", { status: "running", usage: u(1) }),
  ]);
  assert.deepStrictEqual(usage, { stepsUsed: 5, tokensUsed: 166, rejectedChoices: 1 });
});

test("step budget exhausted stops with exact copy", () => {
  const a = nextAction(state([]), { stepsUsed: 6, tokensUsed: 0 }, LIMITS);
  assert.deepStrictEqual(a, {
    kind: "stop",
    reason: "step_budget",
    message: "Stopped: step limit reached (6 of 6 steps). Your finished steps are saved below.",
  });
});

test("token budget exhausted stops with exact copy", () => {
  const a = nextAction(state([]), { stepsUsed: 2, tokensUsed: 48200 }, LIMITS);
  assert.deepStrictEqual(a, {
    kind: "stop",
    reason: "token_budget",
    message:
      "Stopped: token limit reached (48,200 of 50,000 tokens). Your finished steps are saved below.",
  });
});

test("gate and complete are returned even when budget is exhausted", () => {
  const spent = { stepsUsed: 6, tokensUsed: 50000 };
  assert.deepStrictEqual(nextAction(state([fit("APPLY")]), spent, LIMITS), {
    kind: "gate",
    gate: "A",
  });
  const done = state([fit("APPLY"), step("t1", "tailor_resume"), step("c1", "cover_letter")], {
    gateA: GATE_A,
    gateB: { decision: "decline", approvedAt: 2 },
  });
  assert.deepStrictEqual(nextAction(done, spent, LIMITS), { kind: "complete" });
});

test("budgetLimits doubles per reset and clamps", () => {
  assert.deepStrictEqual(budgetLimits(0), { stepBudget: 6, tokenBudget: 50000 });
  assert.deepStrictEqual(budgetLimits(1), { stepBudget: 12, tokenBudget: 100000 });
  assert.deepStrictEqual(budgetLimits(99), { stepBudget: 18, tokenBudget: 150000 });
  assert.deepStrictEqual(budgetLimits(-3), { stepBudget: 6, tokenBudget: 50000 });
});

test("validateChoice accepts allowed, rejects disallowed, finish and unknown", () => {
  const act = {
    kind: "step" as const,
    allowed: ["tailor_resume" as const, "cover_letter" as const],
  };
  assert.deepStrictEqual(validateChoice(act, "cover_letter"), { ok: true, tool: "cover_letter" });
  assert.strictEqual(validateChoice(act, "outreach_message").ok, false);
  assert.strictEqual(validateChoice(act, "finish").ok, false);
  assert.strictEqual(validateChoice(act, "rm_rf").ok, false);
  assert.strictEqual(validateChoice({ kind: "gate", gate: "B" }, "outreach_message").ok, false);
});
