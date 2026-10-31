import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createDiskCache, HARNESS_VERSION, requestHash, type CacheEntry } from "../evals/llm/cache";
import { defaultModelSpecs, describeConfig, loadDotEnv, parseModelSpec, resolveKey } from "../evals/llm/env";
import { listGoogleModels } from "../evals/llm/models";

const FAKE = "AIzaFAKEKEY1234567890";
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "llm-cache-"));

test("parseModelSpec", () => {
  assert.deepStrictEqual(parseModelSpec("google:gemini-x"), { provider: "google", model: "gemini-x", key: "google:gemini-x" });
  assert.throws(() => parseModelSpec("nope"), /provider:model/);
  assert.throws(() => parseModelSpec("bogus:m"), /Unknown provider/);
});

test("resolveKey prefers EVAL_* then FREE_TIER_*", () => {
  assert.strictEqual(resolveKey("google", { EVAL_GOOGLE_API_KEY: "a", EVAL_API_KEY: "b", FREE_TIER_API_KEY: "c", FREE_TIER_PROVIDER: "google" }), "a");
  assert.strictEqual(resolveKey("google", { EVAL_API_KEY: "b", FREE_TIER_API_KEY: "c", FREE_TIER_PROVIDER: "google" }), "b");
  assert.strictEqual(resolveKey("google", { EVAL_API_KEY: "b", EVAL_PROVIDER: "openai" }), null);
  assert.strictEqual(resolveKey("google", { FREE_TIER_API_KEY: "c", FREE_TIER_PROVIDER: "google" }), "c");
  assert.strictEqual(resolveKey("google", { FREE_TIER_API_KEY: "c", FREE_TIER_PROVIDER: "openai" }), null);
});

test("defaultModelSpecs and describeConfig", () => {
  assert.deepStrictEqual(defaultModelSpecs({ EVAL_MODELS: "google:a, google:b" }).map((s) => s.key), ["google:a", "google:b"]);
  assert.deepStrictEqual(defaultModelSpecs({ EVAL_MODEL: "google:a" }).map((s) => s.key), ["google:a"]);
  assert.deepStrictEqual(defaultModelSpecs({ FREE_TIER_PROVIDER: "google", FREE_TIER_MODEL: "m" }).map((s) => s.key), ["google:m"]);
  assert.deepStrictEqual(defaultModelSpecs({}), []);
  const env = { FREE_TIER_PROVIDER: "google", FREE_TIER_MODEL: "m", FREE_TIER_API_KEY: FAKE };
  const out = describeConfig(defaultModelSpecs(env), env);
  assert.ok(!out.includes(FAKE));
  assert.ok(out.includes("key: set"));
  assert.ok(describeConfig([parseModelSpec("google:m")], {}).includes("key: missing"));
});

test("loadDotEnv parses, does not override, returns names only", () => {
  const dir = tmp();
  const file = path.join(dir, ".env");
  fs.writeFileSync(file, '# c\n\nA="quoted"\nB=\'single\'\nC=plain\nKEEP=new\nexport D=e\n');
  const env: Record<string, string | undefined> = { KEEP: "old" };
  const names = loadDotEnv(file, env);
  assert.deepStrictEqual(names.sort(), ["A", "B", "C", "D"]);
  assert.strictEqual(env.A, "quoted");
  assert.strictEqual(env.B, "single");
  assert.strictEqual(env.KEEP, "old");
  assert.deepStrictEqual(loadDotEnv(path.join(dir, "missing"), env), []);
});

test("listGoogleModels uses the header, follows pages, filters", async () => {
  const urls: string[] = [];
  const f = (async (url: string, init: { headers: Record<string, string> }) => {
    urls.push(url);
    assert.strictEqual(init.headers["x-goog-api-key"], FAKE);
    assert.ok(!url.includes(FAKE));
    const second = url.includes("pageToken=t2");
    return new Response(
      JSON.stringify(
        second
          ? { models: [{ name: "models/c", supportedGenerationMethods: ["generateContent"] }] }
          : { models: [{ name: "models/a", supportedGenerationMethods: ["generateContent"] }, { name: "models/emb", supportedGenerationMethods: ["embedContent"] }], nextPageToken: "t2" },
      ),
    );
  }) as unknown as typeof fetch;
  assert.deepStrictEqual(await listGoogleModels(FAKE, f), ["a", "c"]);
  assert.strictEqual(urls.length, 2);
});

test("listGoogleModels error is redacted", async () => {
  const f = (async () => new Response(`bad key ${FAKE}`, { status: 400, statusText: "Bad" })) as unknown as typeof fetch;
  await assert.rejects(() => listGoogleModels(FAKE, f), (e: Error) => !e.message.includes(FAKE) && /400/.test(e.message));
});

test("requestHash is canonical and sensitive to temperature", () => {
  assert.strictEqual(requestHash({ a: 1, b: 2 }), requestHash({ b: 2, a: 1 }));
  assert.notStrictEqual(requestHash({ t: 0.2 }), requestHash({ t: 0.3 }));
  assert.match(requestHash({}), /^[0-9a-f]{64}$/);
});

function entry(over: Partial<CacheEntry> = {}): CacheEntry {
  return {
    harnessVersion: HARNESS_VERSION, caseId: "c1", modelKey: "google:m/x", hash: "h1", createdAt: 1, latencyMs: 5,
    response: { text: "hi", finishReason: "stop", usage: { promptTokens: 1, completionTokens: 2 }, thoughtsTokens: null, modelVersion: null },
    ...over,
  };
}

test("disk cache: miss, hit, corrupt, version mismatch, layout", () => {
  const dir = tmp();
  const cache = createDiskCache(dir);
  assert.strictEqual(cache.get("c1", "google:m/x", "h1"), null);
  cache.set(entry());
  assert.strictEqual(cache.get("c1", "google:m/x", "h1")?.response.text, "hi");
  assert.ok(cache.has("c1", "google:m/x", "h1"));
  const file = path.join(dir, HARNESS_VERSION, "c1", "google_m_x", "h1.json");
  assert.ok(fs.existsSync(file));
  assert.ok(!fs.readdirSync(path.dirname(file)).some((f) => f.endsWith(".tmp")));
  fs.writeFileSync(file, "{not json SECRETCONTENT");
  assert.strictEqual(cache.get("c1", "google:m/x", "h1"), null);
  cache.set(entry({ hash: "h2", harnessVersion: "old" }));
  assert.strictEqual(cache.get("c1", "google:m/x", "h2"), null);
});

test("disk cache: case records", () => {
  const cache = createDiskCache(tmp());
  assert.ok(!cache.caseDone("c1", "m"));
  cache.markCaseDone("c1", "m", { ok: true });
  assert.ok(cache.caseDone("c1", "m"));
  assert.deepStrictEqual(cache.readCaseRecord("c1", "m"), { ok: true });
});

test("disk cache never persists keys, headers, raw responses", () => {
  const dir = tmp();
  const cache = createDiskCache(dir);
  const dirty = entry() as CacheEntry & Record<string, unknown>;
  dirty.apiKey = FAKE;
  (dirty.response as unknown as Record<string, unknown>).rawResponse = { headers: { "x-goog-api-key": FAKE }, body: {} };
  (dirty.response as unknown as Record<string, unknown>).request = { body: FAKE };
  cache.set(dirty);
  const text = fs.readFileSync(path.join(dir, HARNESS_VERSION, "c1", "google_m_x", "h1.json"), "utf8");
  assert.ok(!text.includes(FAKE));
  assert.ok(!text.includes("x-goog-api-key"));
  assert.ok(!text.includes("rawResponse"));
});
