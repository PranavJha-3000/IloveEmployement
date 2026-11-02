// Offline end-to-end tests for the eval runner: scripted models only, no network, no real key.
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MockLanguageModelV1 } from "ai/test";
import { CASES, type EvalCase } from "../evals/cases";
import { parseModelSpec } from "../evals/llm/env";
import { parseArgs, probeModels, runEval, type LlmRunResult } from "../evals/llm/run";
import { renderLlmReport } from "../evals/llm/report";
import { createDiskCache } from "../evals/llm/cache";
import { createThrottle } from "../evals/llm/throttle";
import { runPreset, setModelFactory } from "../lib/engine/run";
import { getPresetById } from "../lib/presets";
import type { AiRequestConfig } from "../lib/types";

const FAKE_KEY = "AIzaFAKEKEY1234567890";
const ENV = { EVAL_GOOGLE_API_KEY: FAKE_KEY };
const CASE_IDS = ["linkedin-note-limit", "fit-strong-match", "cover-letter-grounded"];
const cases = (): EvalCase[] => CASE_IDS.map((id) => CASES.find((c) => c.id === id) as EvalCase);

const JUDGEMENT = {
  scores: { groundedness: "3", task_fit: "4", clarity: "4" },
  reasons: { groundedness: "ok", task_fit: "ok", clarity: "ok" },
  claims: [{ claim: "Built things", status: "supported", evidence: "c" }],
  citations: [{ index: 1, verdict: "supports" }],
};

interface Script {
  calls: { generation: number; judge: number; probe: number; total: number };
  factory: (cfg: AiRequestConfig) => MockLanguageModelV1;
}

/** A scripted provider: draft shaped for both message and job-fit schemas, a review that ships, a fixed judgement. */
function script(opts: { failOnGeneration?: number; probeError?: (model: string) => Error | null; generateError?: (model: string) => Error | null } = {}): Script {
  const calls = { generation: 0, judge: 0, probe: 0, total: 0 };
  return {
    calls,
    factory: (cfg) =>
      new MockLanguageModelV1({
        defaultObjectGenerationMode: "json",
        modelId: cfg.model,
        doGenerate: async (options) => {
          const prompt = JSON.stringify(options.prompt);
          calls.total++;
          let text: string;
          if (prompt.includes("Reply with the word OK")) {
            calls.probe++;
            const err = opts.probeError?.(cfg.model);
            if (err) throw err;
            text = "OK";
          } else if (prompt.includes("impartial evaluator")) {
            calls.judge++;
            text = JSON.stringify(JUDGEMENT);
          } else if (prompt.includes("<draft_to_review>")) {
            text = JSON.stringify({ issues: [], verdict: "ship" });
          } else {
            calls.generation++;
            if (opts.failOnGeneration && calls.generation === opts.failOnGeneration) {
              throw Object.assign(new Error("Quota exceeded: GenerateRequestsPerDayPerProjectPerModel"), { statusCode: 429 });
            }
            const err = opts.generateError?.(cfg.model);
            if (err) throw err;
            const id = /\[chunk:([^\]]+)\]/.exec(prompt)?.[1] ?? "none";
            text = JSON.stringify({
              subject: "s", body: "I built things.", variants: [], placeholders: [], notes: [],
              citations: [{ chunkId: id, claim: "built things" }],
              headline: "h", summary: "s",
              requirements: [{ requirement: "Go", importance: "must", evidence: "STRONG", proof: "p", chunkIds: [id] }],
              strengths: [], gaps: [], interviewRisks: [],
            });
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: "stop",
            usage: { promptTokens: 100, completionTokens: 50 },
            text,
            rawResponse: { headers: {}, body: { modelVersion: `ver-${cfg.model}`, usageMetadata: { thoughtsTokenCount: 7 } } },
          };
        },
      }),
  };
}

function harness() {
  let t = 1_000_000;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), "llm-run-")),
  };
}

const A = parseModelSpec("google:model-a");
const B = parseModelSpec("google:model-b");
const J = parseModelSpec("google:model-j");

async function go(s: Script, h: ReturnType<typeof harness>, extra: Partial<Parameters<typeof runEval>[0]> = {}): Promise<LlmRunResult> {
  return runEval({
    cases: cases(), models: [A, B], judge: J, baseFactory: s.factory, cacheDir: h.cacheDir, rpm: 5,
    now: h.now, sleep: h.sleep, env: ENV, command: "--models google:model-a,google:model-b", gitSha: "testsha", ...extra,
  });
}

test("end to end: cases x models, judged, summaries, and no key anywhere in the result or report", async () => {
  const h = harness();
  const s = script();
  const result = await go(s, h);

  assert.strictEqual(result.outcomes.length, 6);
  assert.deepStrictEqual(Object.keys(result.summaries).sort(), [A.key, B.key]);
  for (const o of result.outcomes) {
    assert.ok(o.ok, `${o.caseId} ${o.modelKey}: ${o.error}`);
    assert.strictEqual(o.judge?.ok, true, "every ok outcome is judged");
    assert.ok(o.judgeCalls.length >= 1);
    assert.ok(o.calls.every((c) => c.purpose === "generation"), "judge calls never mix into generator totals");
  }
  // Review preset: draft + review calls recorded.
  const review = result.outcomes.find((o) => o.caseId === "cover-letter-grounded" && o.modelKey === A.key)!;
  assert.ok(review.calls.some((c) => c.role === "review"));

  assert.strictEqual(result.complete, true);
  assert.strictEqual(result.caseCount, 3);
  assert.strictEqual(result.gitSha, "testsha");
  assert.strictEqual(result.command, "--models google:model-a,google:model-b");
  assert.strictEqual(result.harnessVersion, "llm-eval-1");
  assert.ok(result.caseFingerprint.length > 0 && result.rubricHash.length > 0);
  assert.deepStrictEqual(result.models[0].reportedModelVersions, ["ver-model-a"]);
  assert.deepStrictEqual(result.judge?.reportedModelVersions, ["ver-model-j"]);
  assert.ok(result.models[0].firstCallAt);
  assert.strictEqual(result.sampling.judgeTemperature, 0);
  assert.ok((result.sampling.observedTemperatures.generate ?? []).length >= 1);
  assert.ok(result.summaries[A.key].tokens.thoughts > 0, "thinking tokens flow through");
  assert.ok(result.retrieval.includes("keyword BM25"));

  assert.ok(!JSON.stringify(result).includes(FAKE_KEY), "key must not be serialised");
  assert.ok(!renderLlmReport(result).includes(FAKE_KEY));
  // The factory is always reset: a bare run with a bogus provider key no longer reaches the mock.
  const before = s.calls.total;
  await runPreset(getPresetById("job-fit-check")!, { inputs: {}, vault: [], config: { provider: "openai", apiKey: "sk-test-not-real-1234567890", model: "m" } }, "t");
  assert.strictEqual(s.calls.total, before);
});

test("resume: a second run over the same cache makes no base-model calls and returns the same metrics", async () => {
  const h = harness();
  const first = await go(script(), h);
  const s2 = script();
  const second = await go(s2, h);
  assert.strictEqual(s2.calls.total, 0);
  assert.deepStrictEqual(second.summaries, first.summaries);
  assert.deepStrictEqual(second.outcomes, first.outcomes);
  assert.deepStrictEqual(second.models, first.models);
});

test("a provider without a key is a skipped column, and a lone keyless model throws", async () => {
  const h = harness();
  const result = await go(script(), h, { models: [A, parseModelSpec("openai:gpt-x")] });
  assert.strictEqual(result.models[1].skipped, "no key for openai");
  assert.ok(!(parseModelSpec("openai:gpt-x").key in result.summaries));
  assert.strictEqual(result.outcomes.length, 3);
  await assert.rejects(go(script(), harness(), { models: [parseModelSpec("openai:gpt-x")], judge: null }), /no model with a key/);
});

test("daily quota stops the run: remaining outcomes are notRun, complete is false, no throw", async () => {
  const h = harness();
  const s = script({ failOnGeneration: 2 });
  const result = await go(s, h, { models: [A] });
  assert.strictEqual(result.complete, false);
  assert.strictEqual(result.outcomes.length, 3);
  assert.strictEqual(result.outcomes[0].ok, true);
  assert.strictEqual(result.outcomes[1].notRun, "quota");
  assert.strictEqual(result.outcomes[2].notRun, "quota");
  assert.strictEqual(s.calls.generation, 2, "no generation call after the quota error");
  assert.strictEqual(result.summaries[A.key].cases, 1, "unattempted cases stay out of the summary");

  // The finished case survives for the resume.
  const cache = createDiskCache(h.cacheDir);
  assert.ok(cache.caseDone(CASE_IDS[0], A.key));
  assert.ok(!cache.caseDone(CASE_IDS[1], A.key));
});

test("a thrown expectation is a recorded failure and a failed run is an error with the key redacted", async () => {
  const h = harness();
  const base = cases();
  const thrower: EvalCase = { ...base[1], expect: () => { throw new Error("boom"); } };
  const result = await go(script(), h, { cases: [thrower], models: [A], judge: null });
  assert.deepStrictEqual(result.outcomes[0].failures, ["expectation threw: boom"]);
  assert.strictEqual(result.outcomes[0].passed, false);
  assert.strictEqual(result.judge, null);

  const h2 = harness();
  const bad = script({ generateError: () => new Error(`invalid request ${FAKE_KEY} rejected`) });
  const r2 = await go(bad, h2, { cases: [base[1]], models: [A], judge: null });
  assert.strictEqual(r2.outcomes[0].ok, false);
  assert.ok(r2.outcomes[0].error && !r2.outcomes[0].error.includes(FAKE_KEY));
  assert.ok(!createDiskCache(h2.cacheDir).caseDone(base[1].id, A.key), "errors are retried on resume");
});

test("probe: a not-found model is skipped with a reason and the other models still run; probes are cached", async () => {
  const h = harness();
  const s = script({ probeError: (m) => (m === "model-b" ? new Error("404 models/model-b is not found for API version") : null) });
  const result = await go(s, h);
  assert.ok(result.models[1].skipped?.startsWith("probe failed"));
  assert.strictEqual(result.outcomes.every((o) => o.modelKey === A.key), true);
  assert.strictEqual(result.outcomes.length, 3);

  const s2 = script();
  const cache = createDiskCache(h.cacheDir);
  const throttle = createThrottle({ rpm: 5, now: h.now, sleep: h.sleep });
  const again = await probeModels([A], { baseFactory: s2.factory, keyFor: () => FAKE_KEY, cache, throttle, retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1, sleep: h.sleep, now: h.now } });
  assert.strictEqual(again[0].ok, true);
  assert.strictEqual(s2.calls.total, 0, "second probe is served from the cache");
  setModelFactory(null);
});

test("parseArgs: flags, defaults, and rejection of unknown input", () => {
  const a = parseArgs(["--dry", "--cases", "x,y", "--limit", "4", "--models", "google:a,google:b", "--judge", "google:j", "--rpm", "3", "--max-requests", "50", "--report", "r.md", "--no-dotenv"]);
  assert.strictEqual(a.dry, true);
  assert.deepStrictEqual(a.cases, ["x", "y"]);
  assert.strictEqual(a.limit, 4);
  assert.deepStrictEqual(a.models?.map((m) => m.key), ["google:a", "google:b"]);
  assert.strictEqual(a.judge?.key, "google:j");
  assert.strictEqual(a.rpm, 3);
  assert.strictEqual(a.maxRequests, 50);
  assert.strictEqual(a.report, "r.md");
  const d = parseArgs([]);
  assert.strictEqual(d.maxRequests, 300);
  assert.strictEqual(d.rpm, null);
  assert.strictEqual(d.cases, null);
  assert.throws(() => parseArgs(["--nope"]), /Unknown argument/);
  assert.throws(() => parseArgs(["--limit", "x"]), /integer/);
  assert.throws(() => parseArgs(["--models"]), /needs a value/);
});

test("a case subset is flagged partial even when every selected case ran", async () => {
  const h = harness();
  const r = await go(script(), h, { cases: [cases()[0]], models: [A], caseSubset: true });
  assert.strictEqual(r.complete, false);
  assert.strictEqual(r.caseSubset, true);
});
