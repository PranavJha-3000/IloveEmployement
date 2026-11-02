// ─── Access: free tier or bring-your-own-key ─────────────────────────────────
// A request with an API key runs on that key (no limit, key never stored).
// A request without one runs on the server's free-tier key, rate limited per
// IP per day. The limiter uses Upstash Redis over REST when configured and an
// in-memory map otherwise (fine for dev; per-instance only on serverless).

import type { AiRequestConfig, ProviderId } from "../types";
import { PROVIDERS } from "../providers";

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
    dailyLimit: Number(process.env.FREE_TIER_DAILY_LIMIT) || 15,
  };
}

export type AccessResult =
  | { ok: true; tier: "byok"; config: AiRequestConfig; remaining: null }
  | { ok: true; tier: "free"; config: AiRequestConfig; remaining: number }
  | { ok: false; status: number; message: string };

export async function resolveAccess(config: AiRequestConfig | undefined, ip: string): Promise<AccessResult> {
  if (config?.apiKey?.trim()) {
    if (!config.provider || !(config.provider in PROVIDERS)) {
      return { ok: false, status: 400, message: "Unknown AI provider." };
    }
    return { ok: true, tier: "byok", config, remaining: null };
  }

  const free = freeTierInfo();
  if (!free.enabled) {
    return {
      ok: false,
      status: 400,
      message: "Add your own API key to run this tool. The free tier isn't configured on this deployment.",
    };
  }

  const used = await countToday(ip);
  if (used > free.dailyLimit) {
    return {
      ok: false,
      status: 429,
      message: `You've used today's ${free.dailyLimit} free runs. Add your own API key for unlimited runs, or come back tomorrow.`,
    };
  }

  return {
    ok: true,
    tier: "free",
    remaining: Math.max(0, free.dailyLimit - used),
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

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "local"
  );
}
