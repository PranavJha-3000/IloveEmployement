// ─── Throttle, retry and quota detection ─────────────────────────────────────
// All time goes through injected now()/sleep() so tests never wait. Errors that
// leave withRetry are plain Errors (never APICallError) so the AI SDK's own
// maxRetries cannot multiply the attempts.

import { redactSecrets } from "../../lib/pipeline";

export type ThrottleEvent = { type: "wait" | "retry" | "quota"; modelKey: string; ms: number; status: number | null };

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class QuotaExhaustedError extends Error {
  modelKey: string;
  constructor(modelKey: string, message?: string) {
    super(message ?? `Daily quota exhausted for ${modelKey}. Completed cases are cached; re-run after the quota resets to resume.`);
    this.name = "QuotaExhaustedError";
    this.modelKey = modelKey;
  }
}

export interface Throttle {
  acquire(modelKey: string): Promise<void>;
}

export function createThrottle(opts: { rpm: number; now?: () => number; sleep?: (ms: number) => Promise<void>; onEvent?: (e: ThrottleEvent) => void }): Throttle {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const gap = opts.rpm > 0 ? 60000 / opts.rpm : 0;
  const last = new Map<string, number>();
  return {
    async acquire(modelKey) {
      const prev = last.get(modelKey);
      const t = now();
      const wait = prev === undefined ? 0 : Math.max(0, prev + gap - t);
      // Reserve the slot before sleeping so concurrent callers queue behind it.
      last.set(modelKey, t + wait);
      if (wait > 0) {
        opts.onEvent?.({ type: "wait", modelKey, ms: wait, status: null });
        await sleep(wait);
      }
    },
  };
}

type ErrLike = { statusCode?: number; responseHeaders?: Record<string, string>; responseBody?: string; message?: string; cause?: unknown };

function asErr(err: unknown): ErrLike {
  return (err && typeof err === "object" ? err : { message: String(err) }) as ErrLike;
}

function statusOf(err: unknown): number | null {
  const e = asErr(err);
  if (typeof e.statusCode === "number") return e.statusCode;
  const msg = String(e.message ?? "");
  if (/\b429\b|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  if (/\b503\b|unavailable|overloaded/i.test(msg)) return 503;
  if (/\b500\b/.test(msg)) return 500;
  return null;
}

function header(e: ErrLike, name: string): string | undefined {
  const h = e.responseHeaders;
  if (!h) return undefined;
  const k = Object.keys(h).find((x) => x.toLowerCase() === name);
  return k ? h[k] : undefined;
}

export function parseRetryDelayMs(err: unknown, now: () => number = Date.now): number | null {
  const e = asErr(err);
  const ra = header(e, "retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return Math.max(0, Math.round(secs * 1000));
    const date = Date.parse(ra);
    if (!Number.isNaN(date)) return Math.max(0, date - now());
  }
  const text = `${e.responseBody ?? ""} ${e.message ?? ""}`;
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(text);
  if (m) return Math.round(Number(m[1]) * 1000);
  return null;
}

export function isDailyQuotaError(err: unknown): boolean {
  const e = asErr(err);
  if (statusOf(err) !== 429) return false;
  const text = `${e.responseBody ?? ""} ${e.message ?? ""}`;
  return /PerDay|per day|requests_per_day|daily/i.test(text);
}

const NETWORK = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|fetch failed|socket hang up|network/i;

function isTransient(err: unknown): boolean {
  const s = statusOf(err);
  if (s !== null) return s === 429 || s === 500 || s === 503 || s === 502 || s === 504;
  const e = asErr(err);
  const causeMsg = e.cause && typeof e.cause === "object" ? String((e.cause as ErrLike).message ?? "") : "";
  return NETWORK.test(`${e.message ?? ""} ${causeMsg}`);
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  modelKey?: string;
  onEvent?: (e: ThrottleEvent) => void;
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? realSleep;
  const modelKey = opts.modelKey ?? "model";
  let lastMessage = "";
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) throw err;
      const status = statusOf(err);
      if (isDailyQuotaError(err)) {
        opts.onEvent?.({ type: "quota", modelKey, ms: 0, status });
        throw new QuotaExhaustedError(modelKey);
      }
      const raw = err instanceof Error ? err.message : String(err);
      lastMessage = redactSecrets(raw).slice(0, 300);
      if (!isTransient(err)) throw new Error(`${lastMessage} (attempt ${attempt})`.slice(0, 340));
      if (attempt === opts.maxAttempts) break;
      const backoff = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
      const ms = Math.max(parseRetryDelayMs(err, opts.now) ?? 0, backoff);
      opts.onEvent?.({ type: "retry", modelKey, ms, status });
      await sleep(ms);
    }
  }
  throw new Error(`${lastMessage} (gave up after ${opts.maxAttempts} attempts)`.slice(0, 340));
}
