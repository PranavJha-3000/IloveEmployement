import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { AGENT_CASES } from "../evals/agentCases";
import { BACKEND_RESUME, CASES } from "../evals/cases";
import { agentCaseFingerprint, estimateAgentRequests, runAgentCase, runAgentEval } from "../evals/llm/agentRun";
import { stableChunks } from "../evals/llm/caseRun";
import { parseModelSpec } from "../evals/llm/env";
import { estimateRequests } from "../evals/llm/estimate";
import { caseFingerprint } from "../evals/llm/fingerprint";
import { parseArgs, selectCases } from "../evals/llm/run";
import { createRunRecord } from "../lib/agent/record";
import type { AgentRunRecord, AgentStepRecord } from "../lib/agent/types";
import { modelFor, setModelFactory } from "../lib/engine/run";
import type { AiRequestConfig } from "../lib/types";
import { COVER, FIT_APPLY, FIT_SKIP, OUTREACH, scriptAgentModel, TAILORED } from "./agentScript";

const KEY: AiRequestConfig = { provider: "openai", apiKey: "sk-test-not-real-0000000000", model: "mock" };
const FULL_PLAN = ["fit_check", "tailor_resume", "cover_letter", "outreach_message"];
const byId = (id: string) => AGENT_CASES.find((c) => c.id === id)!;

afterEach(() => setModelFactory(null));

/** Fixtures cite c1..c4; remap them to the content-derived ids the eval chunker assigns to the real resume. */
function remap<T>(fixture: T): T {
  const chunks = stableChunks(BACKEND_RESUME);
  const find = (re: RegExp) => chunks.find((c) => re.test(c.text))!.id;
  const ids: Record<string, string> = {
    c1: find(/four years/),
    c2: find(/Cut checkout API/),
    c3: find(/Led migration/),
    c4: find(/reconciliation service/),
  };
  return JSON.parse(JSON.stringify(fixture).replace(/"(c[1-4])"/g, (_, k: string) => `"${ids[k]}"`)) as T;
}

const strongOutputs = () => ({ fit: remap(FIT_APPLY), resume: remap(TAILORED), cover: remap(COVER), outreach: remap(OUTREACH) });

test("agent cases: at least 3, ids prefixed agent-, disjoint from the Phase 3 CASES", () => {
  assert.ok(AGENT_CASES.length >= 3);
  for (const c of AGENT_CASES) {
    assert.ok(c.id.startsWith("agent-"), c.id);
    assert.ok(!CASES.some((x) => x.id === c.id), `${c.id} collides with CASES`);
  }
  assert.strictEqual(new Set(AGENT_CASES.map((c) => c.id)).size, AGENT_CASES.length);
});

test("agent-strong-fit-complete passes offline through the real loop", async () => {
  const s = scriptAgentModel({ plan: FULL_PLAN, outputs: strongOutputs() });
  const { record, failures } = await runAgentCase(byId("agent-strong-fit-complete"), { config: KEY });
  assert.deepStrictEqual(failures, []);
  assert.strictEqual(record.status, "completed");
  assert.strictEqual(s.plannerCalls(), 4);
});

test("agent-skip-stops passes offline and never overrides the SKIP verdict", async () => {
  const s = scriptAgentModel({ plan: ["fit_check", "tailor_resume"], outputs: { fit: FIT_SKIP } });
  const { record, failures } = await runAgentCase(byId("agent-skip-stops"), { config: KEY });
  assert.deepStrictEqual(failures, []);
  assert.strictEqual(record.status, "stopped");
  assert.strictEqual(record.stopReason?.kind, "skip_verdict");
  assert.strictEqual(record.approvals.skipOverride, undefined);
  assert.strictEqual(s.plannerCalls(), 1);
});

test("agent-injection-order-holds passes offline when the planner is steered to outreach first", async () => {
  scriptAgentModel({ plan: ["outreach_message", ...FULL_PLAN], outputs: strongOutputs() });
  const { record, failures } = await runAgentCase(byId("agent-injection-order-holds"), { config: KEY });
  assert.deepStrictEqual(failures, []);
  assert.strictEqual(record.steps[0].status, "rejected");
  assert.strictEqual(record.steps[0].requestedTool, "outreach_message");
});

test("agent-step-budget-stop passes offline", async () => {
  scriptAgentModel({ plan: FULL_PLAN, outputs: strongOutputs() });
  const { record, failures } = await runAgentCase(byId("agent-step-budget-stop"), { config: KEY });
  assert.deepStrictEqual(failures, []);
  assert.strictEqual(record.stopReason?.kind, "step_budget");
  assert.ok(record.steps.length <= 2);
});

test("agent-skip-stops expect fails when a tailor step ran after SKIP", () => {
  const base = createRunRecord(byId("agent-skip-stops").job, { id: "synthetic", now: 1 });
  const step = (id: string, tool: AgentStepRecord["tool"], extra: Partial<AgentStepRecord> = {}): AgentStepRecord => ({
    id, tool, status: "done", plannedBy: "model", inputs: {}, usage: { planner: 1, tool: 1, total: 2 }, startedAt: 1, ...extra,
  });
  const record: AgentRunRecord = {
    ...base,
    status: "stopped",
    stopReason: { kind: "skip_verdict", message: "m", at: 2 },
    steps: [step("f", "fit_check", { verdict: "SKIP" }), step("t", "tailor_resume")],
  };
  const failures = byId("agent-skip-stops").expect(record);
  assert.ok(failures.some((f) => f.includes("tools ran after SKIP")), failures.join("; "));
});

test("agent fingerprint is stable, content-sensitive and separate from the Phase 3 set", () => {
  const fp = agentCaseFingerprint(AGENT_CASES);
  assert.strictEqual(fp, agentCaseFingerprint(AGENT_CASES));
  assert.notStrictEqual(fp, agentCaseFingerprint(AGENT_CASES.slice(1)));
});

test("estimateAgentRequests: step budget x 4 per case, cached cases subtracted", () => {
  const model = parseModelSpec("google:gemini-2.5-flash");
  const all = estimateAgentRequests(AGENT_CASES, [model]);
  // 3 cases at the default budget of 6 and one at a budget of 2.
  assert.strictEqual(all.upper, 3 * 6 * 4 + 2 * 4);
  const cached = estimateAgentRequests(AGENT_CASES, [model], { caseDone: (id) => id === "agent-skip-stops" });
  assert.strictEqual(cached.upper, all.upper - 6 * 4);
  assert.strictEqual(cached.perModel[0].cachedCases, 1);
});

test("runAgentEval runs agent cases through the recording model, caches them and resumes from the cache", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-eval-"));
  try {
    const cases = [byId("agent-skip-stops"), byId("agent-step-budget-stop")];
    const s = scriptAgentModel({ plan: ["fit_check", "tailor_resume"], outputs: { fit: FIT_SKIP } });
    const base = modelFor(KEY);
    const model = parseModelSpec("openai:mock");
    const opts = {
      cases, models: [model], baseFactory: () => base, cacheDir: dir, rpm: 6000,
      env: { EVAL_OPENAI_API_KEY: KEY.apiKey }, gitSha: "test", sleep: async () => {},
    };
    const first = await runAgentEval(opts);
    assert.strictEqual(first.outcomes.length, 2);
    assert.ok(first.outcomes.every((o) => o.ok && !o.notRun));
    const skip = first.outcomes.find((o) => o.caseId === "agent-skip-stops")!;
    assert.strictEqual(skip.passed, true, skip.failures.join("; "));
    assert.strictEqual(skip.stopReason, "skip_verdict");
    assert.ok(skip.calls.length > 0);
    assert.ok(!JSON.stringify(first).includes(KEY.apiKey));
    const callsAfterFirst = s.plannerCalls() + s.generationCalls();

    const second = await runAgentEval(opts);
    assert.strictEqual(second.outcomes.length, 2);
    assert.strictEqual(s.plannerCalls() + s.generationCalls(), callsAfterFirst, "resumed run must not call the model again");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Phase 3 default run is unchanged ────────────────────────────────────────

test("default case set is pinned: 28 cases, fingerprint 1ht349n", () => {
  assert.strictEqual(CASES.length, 28);
  assert.strictEqual(caseFingerprint(CASES), "1ht349n");
});

test("parseArgs: --agent defaults off and composes with --cases", () => {
  assert.strictEqual(parseArgs([]).agent, false);
  assert.strictEqual(parseArgs(["--agent"]).agent, true);
  assert.deepStrictEqual(parseArgs(["--agent", "--cases", "agent-skip-stops"]).cases, ["agent-skip-stops"]);
});

test("selectCases: default selection is exactly CASES and explicit ids still work", () => {
  assert.deepStrictEqual(selectCases(parseArgs([])), CASES);
  assert.deepStrictEqual(selectCases(parseArgs(["--cases", "fit-strong-match"])).map((c) => c.id), ["fit-strong-match"]);
  assert.throws(() => selectCases(parseArgs(["--cases", "agent-skip-stops"])), /Unknown case id/);
});

test("estimateRequests over the default selection ignores agent cases", () => {
  const model = parseModelSpec("google:gemini-2.5-flash");
  const viaSelect = estimateRequests({ cases: selectCases(parseArgs([])), models: [model], judge: null, cache: null });
  const direct = estimateRequests({ cases: CASES, models: [model], judge: null, cache: null });
  assert.deepStrictEqual(viaSelect, direct);
});
