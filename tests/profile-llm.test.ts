// Offline tests for the --llm measurement path: scripted models, temp cache dir,
// injected clock. No network, no key, no real model factory.
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MockLanguageModelV1 } from "ai/test";
import { CASES } from "../evals/cases";
import { HARNESS_VERSION } from "../evals/llm/cache";
import { parseModelSpec } from "../evals/llm/env";
import { caseFingerprint } from "../evals/llm/fingerprint";
import { profileCaseId, runProfileLlm } from "../evals/profile/llm";
import { loadProfileDataset } from "../evals/profile/dataset/load";
import type { GoldResume } from "../evals/profile/dataset/types";
import { prf } from "../evals/profile/metrics";
import type { StructuredProfile, YearMonth } from "../lib/profile/schema";

const ENV = { EVAL_GOOGLE_API_KEY: "AIzaFAKEKEY1234567890" };
const SPEC = parseModelSpec("google:mock-model");
const noSleep = async () => {};

const ym = (d: YearMonth | null) => (d ? (d.month ? `${d.year}-${String(d.month).padStart(2, "0")}` : String(d.year)) : "");

/** The gold profile in the model-facing shape (dates as YYYY-MM, years as strings). */
function toModelShape(g: StructuredProfile) {
  return {
    contact: g.contact,
    roles: g.roles.map((r) => ({ ...r, start: ym(r.start), end: ym(r.end) })),
    education: g.education.map((e) => ({ ...e, startYear: e.startYear ? String(e.startYear) : "", endYear: e.endYear ? String(e.endYear) : "" })),
    skills: g.skills.map((s) => s.name),
    projects: g.projects,
  };
}

function scripted(dataset: GoldResume[], opts: { quotaOnGeneration?: number } = {}) {
  let n = 0;
  return {
    calls: () => n,
    factory: () =>
      new MockLanguageModelV1({
        defaultObjectGenerationMode: "json",
        modelId: "mock-model",
        doGenerate: async () => {
          n += 1;
          if (opts.quotaOnGeneration && n === opts.quotaOnGeneration) {
            throw Object.assign(new Error("Quota exceeded: GenerateRequestsPerDayPerProjectPerModel"), { statusCode: 429 });
          }
          const item = dataset[Math.min(n, dataset.length) - 1];
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: "stop" as const,
            usage: { promptTokens: 100, completionTokens: 50 },
            text: JSON.stringify(toModelShape(item.gold)),
          };
        },
      }),
  };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "profile-llm-"));
const dataset = () => loadProfileDataset().slice(0, 4);

test("measures refined and llm-only counts, writes cache entries under profile case ids", async () => {
  const ds = dataset();
  const dir = tmp();
  const s = scripted(ds);
  const out = await runProfileLlm({ dataset: ds, models: [SPEC], baseFactory: s.factory, cacheDir: dir, rpm: 600, env: ENV, sleep: noSleep });
  assert.equal(out.status, "measured");
  const m = out.models[0];
  assert.equal(m.resumesDone, 4);
  assert.equal(m.resumesTotal, 4);
  assert.equal(m.stoppedByQuota, false);
  assert.equal(m.usage.promptTokens, 400);
  // The scripted model returns the gold: scalar fields are exact for every resume.
  for (const k of ["contact.name", "contact.email", "roles.title", "roles.company"] as const) {
    assert.equal(m.llmOnly[k].fp, 0, k);
    assert.equal(m.llmOnly[k].fn, 0, k);
    assert.ok(prf(m.refined[k]).recall !== null);
  }
  for (const d of ds) {
    const caseDir = path.join(dir, HARNESS_VERSION, profileCaseId(d.id), "google_mock-model");
    assert.ok(fs.existsSync(path.join(caseDir, "case.json")), `case.json for ${d.id}`);
    assert.ok(fs.readdirSync(caseDir).some((f) => f !== "case.json" && f.endsWith(".json")), `entry for ${d.id}`);
    const rec = fs.readFileSync(path.join(caseDir, "case.json"), "utf8");
    assert.ok(!rec.includes(ENV.EVAL_GOOGLE_API_KEY));
    assert.ok(!rec.includes(d.gold.contact.email));
  }
});

test("a second run is served entirely from the cache", async () => {
  const ds = dataset();
  const dir = tmp();
  const first = await runProfileLlm({ dataset: ds, models: [SPEC], baseFactory: scripted(ds).factory, cacheDir: dir, rpm: 600, env: ENV, sleep: noSleep });
  const second = await runProfileLlm({
    dataset: ds,
    models: [SPEC],
    baseFactory: () => {
      throw new Error("model must not be constructed on a fully cached run");
    },
    cacheDir: dir,
    rpm: 600,
    env: ENV,
    sleep: noSleep,
  });
  assert.equal(second.status, "measured");
  assert.deepEqual(second.models[0].llmOnly, first.models[0].llmOnly);
  assert.deepEqual(second.models[0].refined, first.models[0].refined);
});

test("a daily-quota error on the third resume stops gracefully with a partial result", async () => {
  const ds = dataset();
  const s = scripted(ds, { quotaOnGeneration: 3 });
  const out = await runProfileLlm({ dataset: ds, models: [SPEC], baseFactory: s.factory, cacheDir: tmp(), rpm: 600, env: ENV, sleep: noSleep });
  assert.equal(out.status, "partial");
  assert.equal(out.models[0].stoppedByQuota, true);
  assert.equal(out.models[0].resumesDone, 2);
  assert.equal(s.calls(), 3);
});

test("a model with no key is skipped without constructing it", async () => {
  const ds = dataset();
  const out = await runProfileLlm({
    dataset: ds,
    models: [SPEC],
    baseFactory: () => {
      throw new Error("must not be constructed");
    },
    cacheDir: tmp(),
    rpm: 600,
    env: {},
    sleep: noSleep,
  });
  assert.equal(out.models.length, 0);
  assert.equal(out.status, "partial");
});

test("Phase 3 is untouched: no CASES id collides, harness version and fingerprint unchanged", () => {
  assert.ok(!CASES.some((c) => c.id.startsWith("profile-")));
  assert.equal(HARNESS_VERSION, "llm-eval-1");
  assert.equal(caseFingerprint(CASES), "1ht349n");
  assert.equal(profileCaseId("abc"), "profile-extract--abc");
});
