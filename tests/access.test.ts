import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { freeTierInfo, resolveAccess } from "../lib/engine/access";
import { getUserId } from "../lib/auth/supabase";

const ENV = ["FREE_TIER_PROVIDER", "FREE_TIER_API_KEY", "FREE_TIER_MODEL", "FREE_TIER_DAILY_LIMIT", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const realFetch = globalThis.fetch;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  ENV.forEach((k) => delete process.env[k]);
  process.env.FREE_TIER_PROVIDER = "groq";
  process.env.FREE_TIER_API_KEY = "gsk_test";
});
afterEach(() => {
  ENV.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  globalThis.fetch = realFetch;
});

function enableSupabase(rpc: (name: string, body: Record<string, unknown>) => unknown, userOk = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = String(input);
    if (u.includes("/auth/v1/user")) return userOk ? Response.json({ id: "user-1" }) : new Response("no", { status: 401 });
    const name = u.split("/rpc/")[1];
    const out = rpc(name, JSON.parse(String(init?.body ?? "{}")));
    return new Response(out === null ? "" : JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
}

test("free tier defaults to Groq llama-3.3-70b with 1 run a day", () => {
  assert.deepEqual(
    { ...freeTierInfo() },
    { enabled: true, provider: "groq", model: "llama-3.3-70b-versatile", dailyLimit: 1 },
  );
});

test("signed-out free request is 401; BYOK needs no sign-in", async () => {
  const r = await resolveAccess(undefined, null);
  assert.equal(r.ok === false && r.status, 401);
  const byok = await resolveAccess({ provider: "groq", apiKey: "gsk_mine", model: "m" }, null);
  assert.equal(byok.ok && byok.tier, "byok");
});

test("second run the same day is 429; refund gives the run back", async () => {
  let used = 0;
  enableSupabase((name) => (name === "consume_daily_run" ? (used < 1 ? ++used : null) : name === "refund_daily_run" ? ((used = Math.max(0, used - 1)), null) : null));
  const first = await resolveAccess(undefined, "user-1");
  assert.equal(first.ok && first.tier, "free");
  assert.equal(first.ok && first.remaining, 0);
  const second = await resolveAccess(undefined, "user-1");
  assert.equal(second.ok === false && second.status, 429);
  if (first.ok && first.tier === "free") await first.refund();
  const third = await resolveAccess(undefined, "user-1");
  assert.equal(third.ok, true);
});

test("forged token is rejected; unreachable Supabase fails closed", async () => {
  enableSupabase(() => null, false);
  assert.equal(await getUserId(new Headers({ authorization: "Bearer forged" })), null);
  globalThis.fetch = (async () => {
    throw new Error("down");
  }) as typeof fetch;
  const r = await resolveAccess(undefined, "user-1");
  assert.equal(r.ok === false && r.status, 503);
});

test("agent steps are BYOK-only", async () => {
  const r = await resolveAccess(undefined, "user-1", { allowFree: false });
  assert.equal(r.ok === false && r.status, 400);
});
