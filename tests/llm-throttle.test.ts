import assert from "node:assert";
import { test } from "node:test";
import { APICallError } from "@ai-sdk/provider";
import { createThrottle, isDailyQuotaError, parseRetryDelayMs, QuotaExhaustedError, withRetry, type ThrottleEvent } from "../evals/llm/throttle";

const FAKE = "AIzaFAKEKEY1234567890";

function apiErr(statusCode: number, extra: { headers?: Record<string, string>; body?: string; message?: string } = {}) {
  return new APICallError({
    message: extra.message ?? `HTTP ${statusCode} ${FAKE}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
    responseHeaders: extra.headers,
    responseBody: extra.body,
  });
}

test("throttle spaces calls per model and not across models", async () => {
  let t = 0;
  const sleeps: number[] = [];
  const th = createThrottle({ rpm: 6, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
  await th.acquire("a");
  await th.acquire("a");
  await th.acquire("a");
  assert.deepStrictEqual(sleeps, [10000, 10000]);
  const before = sleeps.length;
  await th.acquire("b");
  assert.strictEqual(sleeps.length, before);
});

test("throttle: three acquires report waits 0, 10000, 10000", async () => {
  let t = 0;
  const waits: number[] = [];
  const th = createThrottle({ rpm: 6, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } });
  const seen: number[] = [];
  for (let i = 0; i < 3; i++) {
    const n = waits.length;
    await th.acquire("a");
    seen.push(waits.length > n ? waits[waits.length - 1] : 0);
  }
  assert.deepStrictEqual(seen, [0, 10000, 10000]);
});

test("parseRetryDelayMs", () => {
  assert.strictEqual(parseRetryDelayMs(apiErr(429, { headers: { "retry-after": "7" } })), 7000);
  assert.strictEqual(parseRetryDelayMs(apiErr(429, { headers: { "Retry-After": new Date(1_000_000 + 5000).toUTCString() } }), () => 1_000_000), 5000);
  assert.strictEqual(parseRetryDelayMs(apiErr(429, { body: '{"details":[{"retryDelay": "37s"}]}' })), 37000);
  assert.strictEqual(parseRetryDelayMs(apiErr(429)), null);
});

test("isDailyQuotaError", () => {
  assert.ok(isDailyQuotaError(apiErr(429, { body: '{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}' })));
  assert.ok(isDailyQuotaError(apiErr(429, { message: "exceeded your quota per day" })));
  assert.ok(!isDailyQuotaError(apiErr(429, { body: '{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel"}', message: "slow down" })));
  assert.ok(!isDailyQuotaError(apiErr(500, { body: "PerDay" })));
});

test("withRetry retries 429/503 with backoff honouring Retry-After", async () => {
  const sleeps: number[] = [];
  const events: ThrottleEvent[] = [];
  let calls = 0;
  const out = await withRetry(
    async () => {
      calls++;
      if (calls === 1) throw apiErr(429, { headers: { "retry-after": "9" }, message: "slow" });
      if (calls === 2) throw apiErr(503, { message: "busy" });
      return "ok";
    },
    { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 60000, sleep: async (ms) => { sleeps.push(ms); }, onEvent: (e) => events.push(e), modelKey: "m" },
  );
  assert.strictEqual(out, "ok");
  assert.deepStrictEqual(sleeps, [9000, 4000]);
  assert.deepStrictEqual(events.map((e) => e.type), ["retry", "retry"]);
});

test("withRetry retries network errors", async () => {
  let calls = 0;
  const out = await withRetry(async () => { if (++calls < 2) throw new Error("fetch failed"); return 1; }, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {} });
  assert.strictEqual(out, 1);
});

test("withRetry does not retry 400/401/403/404", async () => {
  for (const s of [400, 401, 403, 404]) {
    let calls = 0;
    await assert.rejects(() => withRetry(async () => { calls++; throw apiErr(s, { message: "nope" }); }, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {} }));
    assert.strictEqual(calls, 1);
  }
});

test("withRetry: daily quota throws QuotaExhaustedError immediately", async () => {
  let calls = 0;
  const events: ThrottleEvent[] = [];
  await assert.rejects(
    () => withRetry(async () => { calls++; throw apiErr(429, { body: "GenerateRequestsPerDay" }); }, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {}, modelKey: "m", onEvent: (e) => events.push(e) }),
    (e: unknown) => e instanceof QuotaExhaustedError && e.modelKey === "m",
  );
  assert.strictEqual(calls, 1);
  assert.strictEqual(events[0].type, "quota");
});

test("exhausted retries throw a plain, redacted, bounded Error", async () => {
  let calls = 0;
  await assert.rejects(
    () => withRetry(async () => { calls++; throw apiErr(503, { message: `overloaded ${FAKE} ${"x".repeat(500)}` }); }, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {} }),
    (e: unknown) => {
      const err = e as Error;
      return !APICallError.isInstance(err) && !err.message.includes(FAKE) && err.message.length <= 340 && /3 attempts/.test(err.message);
    },
  );
  assert.strictEqual(calls, 3);
});

test("backoff is capped at maxDelayMs", async () => {
  const sleeps: number[] = [];
  await assert.rejects(() => withRetry(async () => { throw apiErr(503); }, { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 5000, sleep: async (ms) => { sleeps.push(ms); } }));
  assert.deepStrictEqual(sleeps, [2000, 4000, 5000, 5000]);
});
