// Offline tests of agent run records and the vault store (v3 upgrade, export/import).
import assert from "node:assert";
import { test } from "node:test";
import {
  createRunRecord,
  isAgentRunRecord,
  jobLabel,
  normalizeForResume,
  runBadge,
  toStorable,
} from "../lib/agent/record";
import type { AgentRunRecord, AgentStepRecord } from "../lib/agent/types";

const job = { description: "Build APIs", company: "Razorpay", role: "Backend Engineer" };

function step(over: Partial<AgentStepRecord> = {}): AgentStepRecord {
  return {
    id: "s1",
    tool: "fit_check",
    status: "done",
    plannedBy: "model",
    inputs: {},
    usage: { planner: 10, tool: 20, total: 30 },
    startedAt: 1,
    ...over,
  };
}

test("createRunRecord builds an idle record with default budget", () => {
  const r = createRunRecord(job, { id: "r1", now: 5 });
  assert.equal(r.status, "idle");
  assert.equal(r.schemaVersion, 1);
  assert.deepEqual(r.steps, []);
  assert.deepEqual(r.approvals, {});
  assert.deepEqual(r.budget, {
    stepsUsed: 0,
    tokensUsed: 0,
    stepBudget: 6,
    tokenBudget: 50000,
    rejectedChoices: 0,
    resets: 0,
  });
  assert.equal(r.pauseAfterStep, false);
  assert.equal(r.createdAt, 5);
  assert.equal(r.updatedAt, 5);
});

test("isAgentRunRecord accepts valid records and rejects malformed ones", () => {
  const r = createRunRecord(job, { id: "r1", now: 5 });
  assert.ok(isAgentRunRecord(r));
  assert.ok(isAgentRunRecord(JSON.parse(JSON.stringify(r))));
  assert.ok(!isAgentRunRecord(null));
  assert.ok(!isAgentRunRecord({ ...r, id: undefined }));
  assert.ok(!isAgentRunRecord({ ...r, schemaVersion: 2 }));
  assert.ok(!isAgentRunRecord({ ...r, steps: "x" }));
  assert.ok(!isAgentRunRecord({ ...r, steps: [step({ tool: "rm_rf" as never })] }));
});

test("toStorable whitelists fields and never stores an api key", () => {
  const r = createRunRecord(job, { id: "r1", now: 5 });
  const dirty = { ...r, config: { apiKey: "sk-x" }, apiKey: "sk-y" } as never;
  const out = toStorable(dirty);
  const json = JSON.stringify(out);
  assert.ok(!json.includes("sk-x"));
  assert.ok(!json.includes("sk-y"));
  assert.ok(!json.includes("apiKey"));
  assert.deepEqual(out, r);
});

test("normalizeForResume restarts running steps and pauses running runs", () => {
  const r: AgentRunRecord = {
    ...createRunRecord(job, { id: "r1", now: 5 }),
    status: "running",
    steps: [step({ id: "a" }), step({ id: "b", status: "running" })],
  };
  const n = normalizeForResume(r);
  assert.equal(n.status, "paused");
  assert.equal(n.steps[0].status, "done");
  assert.equal(n.steps[1].status, "interrupted");
  assert.deepEqual(n.steps[1].usage, r.steps[1].usage);
  const done: AgentRunRecord = { ...r, status: "completed", steps: [step()] };
  assert.equal(normalizeForResume(done), done);
  const stopped: AgentRunRecord = { ...r, status: "stopped", steps: [step()] };
  assert.equal(normalizeForResume(stopped), stopped);
});

test("jobLabel", () => {
  assert.equal(jobLabel({ role: "Backend Engineer", company: "Razorpay" }), "Backend Engineer at Razorpay");
  assert.equal(jobLabel({ role: "Backend Engineer", company: "" }), "Backend Engineer");
  assert.equal(jobLabel({ role: "", company: "Razorpay" }), "Razorpay");
  assert.equal(jobLabel({ role: "", company: "" }), "this job");
});

test("runBadge", () => {
  for (const s of ["running", "paused", "idle"] as const) assert.equal(runBadge(s), "In progress");
  assert.equal(runBadge("awaiting_approval"), "Needs approval");
  assert.equal(runBadge("stopped"), "Stopped");
  assert.equal(runBadge("error"), "Stopped");
  assert.equal(runBadge("completed"), "Completed");
});
