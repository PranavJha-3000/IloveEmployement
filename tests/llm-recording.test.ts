import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { MockLanguageModelV1 } from "ai/test";
import { CASES } from "../evals/cases";
import { createDiskCache } from "../evals/llm/cache";
import { parseModelSpec } from "../evals/llm/env";
import { estimateRequests, formatEstimate } from "../evals/llm/estimate";
import { classifyCallRole, recordingModel, type CallPurpose, type CallRecord } from "../evals/llm/recordingModel";
import { createThrottle } from "../evals/llm/throttle";
import { runPreset, setModelFactory } from "../lib/engine/run";
import type { RunMeta, VaultContextChunk } from "../lib/engine/types";
import { getPresetById } from "../lib/presets";

const FAKE = "AIzaFAKEKEY1234567890";
const KEY = { provider: "openai" as const, apiKey: "sk-test-not-real-1234567890", model: "mock" };
const VAULT: VaultContextChunk[] = [
  { id: "c1", kind: "summary", title: "Summary", text: "Backend engineer, four years of Go and PostgreSQL in fintech." },
  { id: "c3", kind: "bullet", title: "Senior Engineer, Zeta Payments | 2023 – Present", text: "Led migration of 40 services to Kubernetes." },
];

afterEach(() => setModelFactory(null));

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "llm-rec-"));
const ctxFor = (dir: string, transcript: CallRecord[], purpose: CallPurpose = "generation") => ({
  caseId: "case-1", modelKey: "google:mock", purpose, cache: createDiskCache(dir),
  throttle: createThrottle({ rpm: 0 }), retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {} }, transcript,
});

function scripted(responses: unknown[], extra: Record<string, unknown> = {}) {
  let i = 0;
  const signals: (AbortSignal | undefined)[] = [];
  const inner = new MockLanguageModelV1({
    defaultObjectGenerationMode: "json",
    doGenerate: async (options) => {
      signals.push(options.abortSignal);
      const next = responses[Math.min(i++, responses.length - 1)];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50 }, text: JSON.stringify(next),
        rawResponse: { headers: { "x-goog-api-key": FAKE }, body: { usageMetadata: { thoughtsTokenCount: 7 }, modelVersion: "mock-001" } },
        ...extra,
      };
    },
  });
  return { inner, calls: () => i, signals };
}

const DRAFT = {
  headline: "Backend Engineer",
  summary: { text: "Engineer", chunkIds: ["c1"] },
  sections: [{ title: "Experience", entries: [{ heading: "Zeta", bullets: [{ text: "Led 40 services to Kubernetes and 10x revenue", chunkIds: ["c3"], change: "tailored" }] }] }],
  skills: ["Go"], changes: [], gapsLeft: [],
};
const REVIEW = { issues: [{ severity: "high", where: "bullet 1", problem: "'10x revenue' is not in the source", fix: "Remove it" }], verdict: "revise" };
const REVISED = { ...DRAFT, sections: [{ title: "Experience", entries: [{ heading: "Zeta", bullets: [{ text: "Led migration of 40 services to Kubernetes", chunkIds: ["c3"], change: "reworded" }] }] }] };

async function runTailor(ip: string) {
  const out = await runPreset(getPresetById("tailor-resume")!, { inputs: { jobDescription: "Go, Kubernetes" }, vault: VAULT, config: KEY }, ip);
  if (!out.ok) throw new Error(`run failed: ${out.status} ${out.message}`);
  return out.result as { data: Record<string, unknown>; meta: RunMeta };
}

test("classifyCallRole", () => {
  assert.strictEqual(classifyCallRole([{ role: "user", content: "<draft_to_review>x" }]), "review");
  assert.strictEqual(classifyCallRole("a <reviewer_feedback> b"), "revise");
  assert.strictEqual(classifyCallRole([{ role: "system", content: "Return ONLY the JSON object, no prose" }]), "fallback-json");
  assert.strictEqual(classifyCallRole("plain"), "generate");
  assert.strictEqual(classifyCallRole("<draft_to_review>", "judge"), "judge");
  assert.strictEqual(classifyCallRole("x", "probe"), "probe");
});

test("review preset: 3 calls recorded (generate, review, revise); sums match meta.usage; second run is fully cached", async () => {
  const dir = tmp();
  const transcript: CallRecord[] = [];
  const s = scripted([DRAFT, REVIEW, REVISED]);
  setModelFactory(() => recordingModel(s.inner, ctxFor(dir, transcript)));
  const first = await runTailor("rec-1");
  assert.strictEqual(s.calls(), 3);
  assert.deepStrictEqual(transcript.map((r) => r.role), ["generate", "review", "revise"]);
  assert.ok(transcript.every((r) => !r.cached && r.thoughtsTokens === 7 && r.modelVersion === "mock-001"));
  const prompt = transcript.reduce((a, r) => a + (r.promptTokens ?? 0), 0);
  const completion = transcript.reduce((a, r) => a + (r.completionTokens ?? 0), 0);
  assert.strictEqual(first.meta.usage?.promptTokens, prompt);
  assert.strictEqual(first.meta.usage?.completionTokens, completion);
  const text = JSON.stringify(transcript);
  assert.ok(!text.includes("x-goog-api-key") && !text.includes("rawResponse"));

  const transcript2: CallRecord[] = [];
  const s2 = scripted([DRAFT, REVIEW, REVISED]);
  setModelFactory(() => recordingModel(s2.inner, ctxFor(dir, transcript2)));
  const second = await runTailor("rec-2");
  assert.strictEqual(s2.calls(), 0, "second identical run makes zero inner calls");
  assert.ok(transcript2.length === 3 && transcript2.every((r) => r.cached));
  assert.deepStrictEqual(second.data, first.data);
});

test("outer aborted signal does not abort the inner call", async () => {
  const s = scripted([{ ok: true }]);
  const model = recordingModel(s.inner, ctxFor(tmp(), []));
  const ac = new AbortController();
  ac.abort();
  await model.doGenerate({ inputFormat: "messages", mode: { type: "regular" }, prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }], abortSignal: ac.signal });
  assert.strictEqual(s.calls(), 1);
  assert.notStrictEqual(s.signals[0], ac.signal);
  assert.strictEqual(s.signals[0]?.aborted, false);
});

test("NaN usage is recorded as null", async () => {
  const transcript: CallRecord[] = [];
  const s = scripted([{ a: 1 }], { usage: { promptTokens: NaN, completionTokens: NaN }, rawResponse: undefined });
  const model = recordingModel(s.inner, ctxFor(tmp(), transcript));
  await model.doGenerate({ inputFormat: "messages", mode: { type: "regular" }, prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] });
  assert.strictEqual(transcript[0].promptTokens, null);
  assert.strictEqual(transcript[0].completionTokens, null);
  assert.strictEqual(transcript[0].thoughtsTokens, null);
});

test("errors in the record and the rethrow are redacted; doStream is unsupported", async () => {
  const transcript: CallRecord[] = [];
  const inner = new MockLanguageModelV1({ doGenerate: async () => { throw new Error(`400 bad request key ${FAKE}`); } });
  const model = recordingModel(inner, ctxFor(tmp(), transcript));
  await assert.rejects(
    async () => { await model.doGenerate({ inputFormat: "messages", mode: { type: "regular" }, prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }); },
    (e: Error) => !e.message.includes(FAKE),
  );
  assert.ok(transcript[0].error && !transcript[0].error.includes(FAKE));
  await assert.rejects(async () => { await model.doStream({} as never); }, /streaming not supported by the eval harness/);
});

test("estimateRequests over the real case set with two models and a judge", () => {
  const models = [parseModelSpec("google:a"), parseModelSpec("google:b")];
  const judge = parseModelSpec("google:j");
  const reviewCases = CASES.filter((c) => getPresetById(c.presetId)?.review).length;
  const n = CASES.length;
  const lowerGen = n + reviewCases;
  const upperGen = n + 2 * reviewCases;
  const est = estimateRequests({ cases: CASES, models, judge, cache: null });
  assert.strictEqual(est.lower, 2 * lowerGen + 2 * n + 3);
  assert.strictEqual(est.upper, 2 * upperGen + 2 * n + 3);
  assert.strictEqual(est.fallbackWorstCase, 2 * upperGen);
  // 28 cases, 4 review cases: 64-72 generation + 56 judge + 3 probes (2 models + judge) = 123-131.
  if (n === 28 && reviewCases === 4) assert.deepStrictEqual([est.lower, est.upper], [123, 131]);
  assert.ok(formatEstimate(est).includes(`Total: ${est.lower}-${est.upper} requests`));
  assert.strictEqual(est.perModel[0].probeCalls, 1);
});

test("estimateRequests subtracts cases already complete in the cache", () => {
  const dir = tmp();
  const cache = createDiskCache(dir);
  const models = [parseModelSpec("google:a")];
  const full = estimateRequests({ cases: CASES, models, judge: null, cache });
  cache.markCaseDone(CASES[0].id, "google:a", { done: true });
  const after = estimateRequests({ cases: CASES, models, judge: null, cache });
  assert.strictEqual(after.perModel[0].cachedCases, 1);
  assert.ok(after.lower < full.lower);
});
