// Run traces: spans, token attrs, OTLP shape, no user content.
import assert from "node:assert";
import { afterEach, test } from "node:test";
import { MockLanguageModelV1 } from "ai/test";
import { runPreset, setModelFactory } from "../lib/engine/run";
import { getPresetById } from "../lib/presets";
import { exportTrace, toOtlp, Tracer } from "../lib/engine/trace";

afterEach(() => setModelFactory(null));

test("Tracer records ordered spans with attrs and failures", async () => {
  const t = new Tracer("demo");
  await t.span("a", () => 1, (r) => ({ n: r }));
  await assert.rejects(t.span("b", () => Promise.reject(new Error("x"))));
  const tr = t.finish();
  assert.deepStrictEqual(tr.spans.map((s) => [s.name, s.attrs.ok]), [["a", true], ["b", false]]);
  assert.strictEqual(tr.spans[0].attrs.n, 1);
  assert.match(tr.traceId, /^[0-9a-f]{32}$/);
});

test("toOtlp builds a root span with children", () => {
  const t = new Tracer("demo");
  const body = toOtlp({ ...t.finish(), spans: [{ name: "model.draft", startMs: 1, durationMs: 2, attrs: { promptTokens: 5 } }] }, 0) as {
    resourceSpans: { scopeSpans: { spans: { name: string; parentSpanId?: string }[] }[] }[];
  };
  const spans = body.resourceSpans[0].scopeSpans[0].spans;
  assert.strictEqual(spans.length, 2);
  assert.ok(spans[1].parentSpanId);
});

test("exportTrace posts OTLP only when configured and never throws", async () => {
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    throw new Error("down");
  }) as typeof fetch;
  try {
    const tr = new Tracer("demo").finish();
    await exportTrace(tr, Date.now(), {});
    assert.strictEqual(calls.length, 0);
    await exportTrace(tr, Date.now(), { OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318/" });
    assert.deepStrictEqual(calls, ["http://collector:4318/v1/traces"]);
  } finally {
    globalThis.fetch = orig;
  }
});

test("a real preset run returns a trace with model token counts and no user content", async () => {
  const preset = getPresetById("cold-recruiter-message");
  assert.ok(preset);
  const SECRET = "Zanzibar-unique-resume-phrase";
  setModelFactory(
    () =>
      new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: "stop",
          usage: { promptTokens: 120, completionTokens: 40 },
          text: JSON.stringify({ subject: "Hi", body: "Hello there", variants: [], placeholders: [], citations: [], notes: [] }),
        }),
      }),
  );
  const inputs: Record<string, string> = {};
  for (const f of preset.fields) inputs[f.key] = `${SECRET} ${f.label}`;
  const out = await runPreset(preset, { inputs, config: { provider: "openai", apiKey: "sk-test-not-real-1234567890", model: "mock" } } as never, "127.0.0.1");
  assert.ok(out.ok, !out.ok ? out.message : "");
  const trace = out.result.meta.trace;
  assert.ok(trace);
  const draft = trace.spans.find((s) => s.name === "model.draft");
  assert.strictEqual(draft?.attrs.promptTokens, 120);
  assert.ok(trace.spans.some((s) => s.name === "context.assemble"));
  assert.ok(!JSON.stringify(trace).includes(SECRET), "trace carries no user content");
});
