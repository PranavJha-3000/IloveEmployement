// ─── Access: free tier or bring-your-own-key ─────────────────────────────────
// A request with an API key runs on that key (no limit, key never stored).
// A request without one runs on the server's free-tier key, which needs a
// signed-in user (Supabase) and is limited per user per UTC day. Without
// Supabase configured it falls back to a per-IP counter (Upstash Redis over
// REST when configured, an in-memory map otherwise: fine for dev only).

import type { AiRequestConfig, ProviderId } from "../types";
import { PROVIDERS } from "../providers";
import { authConfigured, consumeRun, getUserId, refundRun } from "../auth/supabase";

export interface FreeTierInfo {
  enabled: boolean;
  provider: ProviderId | null;
  model: string | null;
  dailyLimit: number;
}

export function freeTierInfo(): FreeTierInfo {
  const provider = process.env.FREE_TIER_PROVIDER as ProviderId | undefined;
  const enabled = Boolean(process.env.FREE_TIER_API_KEY && provider && provider in PROVIDERS);
  return {
    enabled,
    provider: enabled ? provider! : null,
    model: enabled ? process.env.FREE_TIER_MODEL || PROVIDERS[provider!].defaultModel : null,
    dailyLimit: Number(process.env.FREE_TIER_DAILY_LIMIT) || 1,
  };
}

export type AccessResult =
  | { ok: true; tier: "byok"; config: AiRequestConfig; remaining: null }
  | { ok: true; tier: "free"; config: AiRequestConfig; remaining: number; refund: () => Promise<void> }
  | { ok: false; status: number; message: string };

/** Who is calling: the verified user id when accounts are on (null = not signed in), else the client IP. */
export async function identify(headers: Headers): Promise<string | null> {
  return authConfigured() ? getUserId(headers) : clientIp(headers);
}

/** `allowFree: false` makes the request BYOK-only (the agent makes many model calls per run). */
export async function resolveAccess(config: AiRequestConfig | undefined, id: string | null, opts: { allowFree?: boolean } = {}): Promise<AccessResult> {
  if (config?.apiKey?.trim()) {
    if (!config.provider || !(config.provider in PROVIDERS)) {
      return { ok: false, status: 400, message: "Unknown AI provider." };
    }
    return { ok: true, tier: "byok", config, remaining: null };
  }

  const free = freeTierInfo();
  if (opts.allowFree === false) {
    return { ok: false, status: 400, message: "The agent workflow needs your own API key. Add one to continue." };
  }
  if (!free.enabled) {
    return {
      ok: false,
      status: 400,
      message: "Add your own API key to run this tool. The free tier isn't configured on this deployment.",
    };
  }

  if (id === null) {
    return { ok: false, status: 401, message: "Sign in to use your free daily run, or add your own API key." };
  }

  let used: number;
  if (authConfigured()) {
    try {
      const taken = await consumeRun(id, free.dailyLimit);
      used = taken.ok ? taken.used : free.dailyLimit + 1;
    } catch {
      return { ok: false, status: 503, message: "Couldn't check your free run just now. Try again in a moment." };
    }
  } else {
    used = await countToday(id);
  }
  if (used > free.dailyLimit) {
    return {
      ok: false,
      status: 429,
      message: `You've used today's ${free.dailyLimit} free run${free.dailyLimit === 1 ? "" : "s"}. Add your own API key for unlimited runs, or come back tomorrow.`,
    };
  }

  return {
    ok: true,
    tier: "free",
    remaining: Math.max(0, free.dailyLimit - used),
    refund: () => (authConfigured() ? refundRun(id) : refundToday(id)),
    config: {
      provider: free.provider!,
      apiKey: process.env.FREE_TIER_API_KEY!,
      model: free.model!,
      baseUrl: process.env.FREE_TIER_BASE_URL || PROVIDERS[free.provider!].baseUrl,
    },
  };
}

// ─── Daily counter ───────────────────────────────────────────────────────────

const memory = new Map<string, number>();

function dayKey(ip: string): string {
  return `ile:free:${new Date().toISOString().slice(0, 10)}:${ip}`;
}

/** Increments and returns today's count for this IP. */
async function countToday(ip: string): Promise<number> {
  const key = dayKey(ip);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, "90000", "NX"],
        ]),
        cache: "no-store",
      });
      const json = (await res.json()) as { result: number }[];
      if (res.ok && typeof json[0]?.result === "number") return json[0].result;
    } catch {
      // Fall through to the in-memory counter rather than blocking the user.
    }
  }

  const next = (memory.get(key) ?? 0) + 1;
  memory.set(key, next);
  return next;
}

async function refundToday(id: string): Promise<void> {
  const key = dayKey(id);
  memory.set(key, Math.max(0, (memory.get(key) ?? 0) - 1));
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    await fetch(`${url}/decr/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => undefined);
  }
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "local"
  );
}
