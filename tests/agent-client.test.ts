import assert from "node:assert";
import { test } from "node:test";
import {
  applyStepResponse,
  approveGateA,
  approveGateB,
  buildStepRequest,
  continueWithNewBudget,
  declineOutreach,
  localNextAction,
  overrideSkip,
  rerunFitCheck,
  retrieveForTools,
  revertArtifactEdit,
  saveArtifactEdit,
  stopRun,
} from "../lib/agent/client";
import { AGENT_MAX_BUDGET_RESETS, AGENT_STEP_BUDGET, AGENT_TOKEN_BUDGET } from "../lib/agent/config";
import { createRunRecord } from "../lib/agent/record";
import type { AgentBudgetView, AgentNextAction, AgentRunRecord, AgentStepRecord, AgentStepResponse } from "../lib/agent/types";
import type { RunMeta, VaultChunk } from "../lib/engine/types";
import { AGENT_VAULT } from "./agentScript";

const JOB = { description: "Go backend role with PostgreSQL", company: "Acme", role: "Backend Engineer" };
const META = { tier: "byok", model: "m", remaining: null, context: [], knowledge: [], usage: null, injection: [], grounding: [] } as RunMeta;

function chunks(): VaultChunk[] {
  return AGENT_VAULT.map((c, i) => ({ ...c, source: "resume", createdAt: i, updatedAt: i }) as unknown as VaultChunk);
}

function step(over: Partial<AgentStepRecord> & Pick<AgentStepRecord, "id" | "tool">): AgentStepRecord {
  return {
    status: "done",
    plannedBy: "model",
    inputs: {},
    usage: { planner: 100, tool: 150, total: 250 },
    startedAt: 1,
    ...over,
  };
}

function view(r: AgentRunRecord, over: Partial<AgentBudgetView> = {}): AgentBudgetView {
  return {
    stepsUsed: r.budget.stepsUsed + 1,
    tokensUsed: r.budget.tokensUsed + 250,
    stepBudget: r.budget.stepBudget,
    tokenBudget: r.budget.tokenBudget,
    rejectedChoices: 0,
    ...over,
  };
}

function resp(r: AgentRunRecord, s: AgentStepRecord, next: AgentNextAction, kind: "step" | "rejected" = "step", over: Partial<AgentBudgetView> = {}): AgentStepResponse {
  return { kind, step: s, budget: view(r, over), remaining: null, next };
}

const fresh = () => createRunRecord(JOB, { id: "run1", now: 1000 });

function atGateA(verdict: "APPLY" | "SKIP" = "APPLY"): AgentRunRecord {
  const r = { ...fresh(), status: "running" as const };
  return applyStepResponse(r, resp(r, step({ id: "f1", tool: "fit_check", verdict, output: { data: {}, meta: META, sent: AGENT_VAULT } }), { kind: "gate", gate: "A" }), 2000);
}

test("retrieveForTools: per-tool query and limit, whole vs keyword vs hybrid", () => {
  const out = retrieveForTools(chunks(), JOB, ["fit_check"]);
  assert.deepStrictEqual(Object.keys(out.vault), ["fit_check"]);
  assert.strictEqual(out.retrieval.fit_check, "whole");
  assert.ok((out.vault.fit_check?.length ?? 0) > 0);
  assert.strictEqual(retrieveForTools(chunks(), JOB, ["outreach_message"]).retrieval.outreach_message, "keyword");
  assert.strictEqual(retrieveForTools(chunks(), JOB, ["outreach_message"], ["c2", "c3"]).retrieval.outreach_message, "hybrid");
});

test("buildStepRequest: summaries only, claimed budget mirrors record, config only when given", () => {
  const r = atGateA();
  const approved = approveGateA(r, 3000);
  const ctx = { vault: { fit_check: AGENT_VAULT, tailor_resume: AGENT_VAULT, cover_letter: AGENT_VAULT, outreach_message: AGENT_VAULT } };
  const req = buildStepRequest(approved, ctx);
  const json = JSON.stringify(req);
  assert.ok(!json.includes('"output"') && !json.includes('"data"'));
  assert.strictEqual(req.budget.claimedStepsUsed, approved.budget.stepsUsed);
  assert.strictEqual(req.budget.claimedTokensUsed, approved.budget.tokensUsed);
  assert.ok(!("config" in req));
  assert.deepStrictEqual(Object.keys(req.vault).sort(), ["cover_letter", "tailor_resume"]);
  const withCfg = buildStepRequest(approved, { ...ctx, config: { provider: "openai", apiKey: "sk-test-1234567890123", model: "m" } });
  assert.ok(withCfg.config);
});

test("applyStepResponse: gate A -> awaiting_approval with step and budget copied", () => {
  const r = atGateA();
  assert.strictEqual(r.status, "awaiting_approval");
  assert.strictEqual(r.steps.length, 1);
  assert.strictEqual(r.budget.stepsUsed, 1);
  assert.strictEqual(r.budget.tokensUsed, 250);
});

test("applyStepResponse: budget stop carries the policy message", () => {
  const r = { ...fresh(), status: "running" as const };
  const msg = "Stopped: token limit reached (49,000 of 50,000 tokens). Your finished steps are saved below.";
  const out = applyStepResponse(r, resp(r, step({ id: "a", tool: "fit_check" }), { kind: "stop", reason: "token_budget", message: msg }), 5);
  assert.strictEqual(out.status, "stopped");
  assert.strictEqual(out.stopReason?.kind, "token_budget");
  assert.strictEqual(out.stopReason?.message, msg);
});

test("applyStepResponse: pauseAfterStep pauses, otherwise running", () => {
  const base = { ...fresh(), status: "running" as const };
  const next: AgentNextAction = { kind: "step", allowed: ["cover_letter"] };
  const s = step({ id: "t1", tool: "tailor_resume" });
  assert.strictEqual(applyStepResponse({ ...base, pauseAfterStep: true }, resp(base, s, next), 5).status, "paused");
  assert.strictEqual(applyStepResponse(base, resp(base, s, next), 5).status, "running");
});

test("applyStepResponse: rejected step is appended and run keeps running", () => {
  const base = { ...fresh(), status: "running" as const };
  const rej = step({ id: "x", tool: "finish", status: "rejected", requestedTool: "finish" });
  const out = applyStepResponse(base, resp(base, rej, { kind: "step", allowed: ["fit_check"] }, "rejected", { rejectedChoices: 1 }), 5);
  assert.strictEqual(out.status, "running");
  assert.strictEqual(out.steps[0].status, "rejected");
  assert.strictEqual(out.budget.rejectedChoices, 1);
});

test("applyStepResponse: input is not mutated", () => {
  const base = { ...fresh(), status: "running" as const };
  const snap = JSON.stringify(base);
  applyStepResponse(base, resp(base, step({ id: "a", tool: "fit_check" }), { kind: "gate", gate: "A" }), 5);
  assert.strictEqual(JSON.stringify(base), snap);
});

test("rerunFitCheck invalidates later steps, clears approvals, keeps usage counting", () => {
  let r = approveGateA(atGateA(), 3000);
  r = applyStepResponse(r, resp(r, step({ id: "t1", tool: "tailor_resume" }), { kind: "step", allowed: ["cover_letter"] }), 3500);
  r = overrideSkip(r, 3600);
  const stepsUsed = r.budget.stepsUsed;
  const out = rerunFitCheck(r, { description: "new" }, 4000);
  assert.strictEqual(out.job.description, "new");
  assert.ok(out.steps.every((s) => s.invalidated?.reason === "fit_rerun"));
  assert.deepStrictEqual(out.approvals, {});
  assert.strictEqual(out.budget.stepsUsed, stepsUsed);
  assert.deepStrictEqual(localNextAction(out), { kind: "step", allowed: ["fit_check"] });
});

test("overrideSkip, approveGateA, approveGateB, declineOutreach record decisions", () => {
  const skip = atGateA("SKIP");
  const skipStopped = applyStepResponse(skip, resp(skip, step({ id: "f2", tool: "fit_check", verdict: "SKIP" }), { kind: "stop", reason: "skip_verdict", message: "m" }), 2500);
  assert.strictEqual(localNextAction(skipStopped).kind, "stop");
  const over = overrideSkip(skipStopped, 2600);
  assert.strictEqual(over.approvals.skipOverride?.fitStepId, "f2");
  assert.strictEqual(over.approvals.skipOverride?.confirmedAt, 2600);
  assert.strictEqual(over.stopReason, undefined);

  const a = approveGateA(atGateA(), 3000);
  assert.strictEqual(a.approvals.gateA?.fitStepId, "f1");
  assert.strictEqual(a.status, "running");

  let b = a;
  for (const id of ["tailor_resume", "cover_letter"] as const) {
    b = applyStepResponse(b, resp(b, step({ id: `s-${id}`, tool: id }), { kind: "step", allowed: [] }), 3100);
  }
  assert.deepStrictEqual(localNextAction(b), { kind: "gate", gate: "B" });
  const draft = approveGateB(b, { recipientName: "Sam", recipientRole: "recruiter", channel: "email" }, 3200);
  assert.strictEqual(draft.approvals.gateB?.decision, "draft");
  assert.strictEqual(draft.approvals.gateB?.recipientName, "Sam");
  assert.strictEqual(draft.approvals.gateB?.channel, "email");
  const declined = declineOutreach(b, 3200);
  assert.strictEqual(declined.approvals.gateB?.decision, "decline");
  assert.deepStrictEqual(localNextAction(declined), { kind: "complete" });
  assert.strictEqual(declined.status, "completed");
});

test("stopRun marks the run stopped by the user", () => {
  const out = stopRun(atGateA(), 9000);
  assert.strictEqual(out.status, "stopped");
  assert.strictEqual(out.stopReason?.kind, "user");
});

test("continueWithNewBudget extends limits up to the reset cap", () => {
  let r = fresh();
  for (let i = 0; i < AGENT_MAX_BUDGET_RESETS; i++) r = continueWithNewBudget(r, 10 + i);
  assert.strictEqual(r.budget.resets, AGENT_MAX_BUDGET_RESETS);
  assert.strictEqual(r.budget.stepBudget, AGENT_STEP_BUDGET * (1 + AGENT_MAX_BUDGET_RESETS));
  assert.strictEqual(r.budget.tokenBudget, AGENT_TOKEN_BUDGET * (1 + AGENT_MAX_BUDGET_RESETS));
  const again = continueWithNewBudget(r, 99);
  assert.strictEqual(again, r);
});

test("saveArtifactEdit warns on unsupported figures but still saves; revert removes the edit", () => {
  const cover = step({
    id: "cl",
    tool: "cover_letter",
    inputs: { jobDescription: "Go role" },
    output: { data: {}, meta: META, sent: AGENT_VAULT },
  });
  const r = { ...fresh(), steps: [cover] };
  const saved = saveArtifactEdit(r, "cl", { subject: "Hello", body: "I grew revenue by $2M at Zeta." }, 500);
  const edit = saved.steps[0].edit;
  assert.ok(edit);
  assert.strictEqual(edit.body, "I grew revenue by $2M at Zeta.");
  assert.ok(edit.grounding.some((g) => g.includes("$2M")));
  assert.strictEqual(edit.editedAt, 500);
  assert.strictEqual(r.steps[0].edit, undefined);
  const clean = saveArtifactEdit(r, "cl", { body: "Cut latency to 280ms." }, 600);
  assert.deepStrictEqual(clean.steps[0].edit?.grounding, []);
  const reverted = revertArtifactEdit(saved, "cl", 700);
  assert.strictEqual(reverted.steps[0].edit, undefined);
});
