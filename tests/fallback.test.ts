import assert from "node:assert";
import { afterEach, test } from "node:test";
import { MockLanguageModelV1 } from "ai/test";
import { runPreset, setModelFactory } from "../lib/engine/run";
import { getPresetById } from "../lib/presets";
import type { AiRequestConfig } from "../lib/types";

afterEach(() => setModelFactory(null));

const config = (provider: "groq" | "google", fallback?: AiRequestConfig): AiRequestConfig => ({ provider, apiKey: "k", model: provider, fallback });
const body = { inputs: { company: "Acme", role: "Backend Engineer", jobDescription: "Go role." }, vault: [] };
const reply = { subject: "", body: "Hello.", variants: [], placeholders: [], notes: [], citations: [] };

function factory(primaryError: string | null) {
  const used: string[] = [];
  setModelFactory(
    (c) =>
      new MockLanguageModelV1({
        doGenerate: async () => {
          used.push(c.provider);
          if (c.provider === "groq" && primaryError) throw new Error(primaryError);
          return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: { promptTokens: 1, completionTokens: 1 }, text: JSON.stringify(reply) };
        },
      }),
  );
  return used;
}

test("free tier switches to the fallback provider when the first is rate limited", async () => {
  const used = factory("Rate limit reached for model (429)");
  const access = { ok: true as const, tier: "free" as const, remaining: 0, refund: async () => {}, config: config("groq", config("google")) };
  const out = await runPreset(getPresetById("cold-recruiter-message")!, body, "u", { access });
  assert.ok(out.ok);
  assert.deepStrictEqual(used, ["groq", "google"]);
});

test("non-quota errors do not switch providers", async () => {
  const used = factory("something else broke");
  const access = { ok: true as const, tier: "free" as const, remaining: 0, refund: async () => {}, config: config("groq", config("google")) };
  const out = await runPreset(getPresetById("cold-recruiter-message")!, body, "u", { access });
  assert.ok(!out.ok);
  assert.deepStrictEqual(used, ["groq"]);
});
