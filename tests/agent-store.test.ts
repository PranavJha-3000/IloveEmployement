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
import { buildVaultExport, parseVaultImport, upgradeVaultDb } from "../lib/vault/store";

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

// Vault store: v2 -> v3 upgrade and export/import

interface FakeStore {
  keyPath?: string;
  data: Map<string, unknown>;
}

function fakeDb(initial: Record<string, FakeStore> = {}) {
  const stores = new Map<string, FakeStore>(Object.entries(initial));
  const calls: string[] = [];
  return {
    stores,
    calls,
    db: {
      objectStoreNames: { contains: (n: string) => stores.has(n) },
      createObjectStore(name: string, options?: { keyPath?: string | string[] }) {
        calls.push(`create:${name}`);
        if (stores.has(name)) throw new Error("ConstraintError");
        stores.set(name, { keyPath: options?.keyPath as string | undefined, data: new Map() });
        return {};
      },
      deleteObjectStore(name: string) {
        calls.push(`delete:${name}`);
      },
    },
  };
}

test("upgradeVaultDb v2 -> v3 adds only agentRuns and keeps data", () => {
  const f = fakeDb({
    chunks: { keyPath: "id", data: new Map([["c1", { id: "c1", text: "hello" }]]) },
    meta: { data: new Map([["profile", { name: "A" }]]) },
    vectors: { keyPath: "id", data: new Map([["c1", { id: "c1", hash: "h", vector: [1] }]]) },
  });
  const snapshot = () =>
    JSON.stringify([...f.stores].filter(([k]) => k !== "agentRuns").map(([k, v]) => [k, [...v.data]]));
  const before = snapshot();
  upgradeVaultDb(f.db, 2);
  assert.deepEqual(f.calls, ["create:agentRuns"]);
  assert.equal(f.stores.get("agentRuns")?.keyPath, "id");
  assert.equal(snapshot(), before);
});

test("upgradeVaultDb on a fresh install creates all four stores", () => {
  const f = fakeDb();
  upgradeVaultDb(f.db, 0);
  assert.deepEqual([...f.stores.keys()].sort(), ["agentRuns", "chunks", "meta", "vectors"]);
  assert.ok(!f.calls.some((c) => c.startsWith("delete:")));
});

test("upgradeVaultDb is idempotent", () => {
  const f = fakeDb();
  upgradeVaultDb(f.db, 0);
  assert.doesNotThrow(() => upgradeVaultDb(f.db, 3));
  assert.equal(f.calls.length, 4);
});

test("vault export and import round-trip includes agent runs", () => {
  const run = createRunRecord(job, { id: "r1", now: 5 });
  const chunk = { id: "c1", text: "hi", createdAt: 1 } as never;
  const profile = { name: "A", headline: "", location: "", targetRole: "", links: "" };
  const json = buildVaultExport({ profile, chunks: [chunk], agentRuns: [run] }, "2026-01-01T00:00:00.000Z");
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, "iloveemployement-vault@1");
  assert.equal(parsed.agentRuns.length, 1);
  const back = parseVaultImport(json);
  assert.deepEqual(back.chunks, [chunk]);
  assert.deepEqual(back.agentRuns, [run]);
});

test("parseVaultImport handles old exports, invalid runs and wrong format", () => {
  const old = JSON.stringify({ format: "iloveemployement-vault@1", chunks: [] });
  assert.deepEqual(parseVaultImport(old).agentRuns, []);
  const run = createRunRecord(job, { id: "r1", now: 5 });
  const mixed = JSON.stringify({
    format: "iloveemployement-vault@1",
    chunks: [],
    agentRuns: [run, { id: "bad" }, null, { ...run, config: { apiKey: "sk-z" } }],
  });
  const out = parseVaultImport(mixed);
  assert.equal(out.agentRuns.length, 2);
  assert.ok(!JSON.stringify(out.agentRuns).includes("sk-z"));
  assert.throws(
    () => parseVaultImport(JSON.stringify({ format: "nope", chunks: [] })),
    /isn't an IloveEmployement vault export/,
  );
});
