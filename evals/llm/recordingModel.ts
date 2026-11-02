// ─── Recording model wrapper ─────────────────────────────────────────────────
// Every model call (generation, reviewer, revision, judge, probe) goes through
// this one wrapper: disk cache -> throttle -> retry -> delegate, with tokens and
// latency recorded per call. RunMeta.usage sums calls and drops thinking
// tokens, so the call-level record is the source of truth for LEVAL-03.

import type { LanguageModelV1 } from "ai";
import { DEFAULT_TIMEOUT, redactSecrets } from "../../lib/pipeline";
import { HARNESS_VERSION, requestHash, type DiskCache } from "./cache";
import { QuotaExhaustedError, withRetry, type RetryOptions, type Throttle, type ThrottleEvent } from "./throttle";

export type CallPurpose = "generation" | "judge" | "probe";
export type CallRole = "generate" | "review" | "revise" | "fallback-json" | "judge" | "probe";

export interface CallRecord {
  caseId: string;
  modelKey: string;
  purpose: CallPurpose;
  role: CallRole;
  hash: string;
  cached: boolean;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  thoughtsTokens: number | null;
  modelVersion: string | null;
  temperature: number | null;
  finishReason: string | null;
  /** The model text; later steps extract citation units from the final draft. */
  responseText: string | null;
  error?: string;
}

export interface RecordingContext {
  caseId: string;
  modelKey: string;
  purpose: CallPurpose;
  cache: DiskCache;
  throttle: Throttle;
  retry: RetryOptions;
  transcript: CallRecord[];
  onEvent?: (e: ThrottleEvent) => void;
  /** Per-attempt timeout; defaults to evalCallTimeoutMs(). */
  timeoutMs?: number;
}

/** Eval per-call timeout: EVAL_TIMEOUT_MS if set to a positive number, else 180 s (never below the app's 55 s). */
export function evalCallTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.EVAL_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.max(n, DEFAULT_TIMEOUT) : 180_000;
}

/** Classify a call from its prompt (array of messages, or already-serialised JSON). */
export function classifyCallRole(prompt: unknown, purpose: CallPurpose = "generation"): CallRole {
  if (purpose === "judge") return "judge";
  if (purpose === "probe") return "probe";
  const json = typeof prompt === "string" ? prompt : JSON.stringify(prompt ?? "");
  if (json.includes("<draft_to_review>")) return "review";
  if (json.includes("<reviewer_feedback>")) return "revise";
  if (json.includes("Return ONLY the JSON object")) return "fallback-json";
  return "generate";
}

const num = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);

type GenerateOptions = Parameters<LanguageModelV1["doGenerate"]>[0];

export function recordingModel(inner: LanguageModelV1, ctx: RecordingContext): LanguageModelV1 {
  return {
    specificationVersion: inner.specificationVersion,
    provider: inner.provider,
    modelId: inner.modelId,
    defaultObjectGenerationMode: inner.defaultObjectGenerationMode,
    supportsImageUrls: inner.supportsImageUrls,
    supportsStructuredOutputs: inner.supportsStructuredOutputs,
    supportsUrl: inner.supportsUrl,

    async doGenerate(options: GenerateOptions) {
      const hash = requestHash({
        harnessVersion: HARNESS_VERSION,
        caseId: ctx.caseId,
        modelKey: ctx.modelKey,
        purpose: ctx.purpose,
        prompt: options.prompt,
        mode: options.mode,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        topK: options.topK,
        seed: options.seed,
        responseFormat: options.responseFormat,
      });
      const role = classifyCallRole(options.prompt, ctx.purpose);
      const base = { caseId: ctx.caseId, modelKey: ctx.modelKey, purpose: ctx.purpose, role, hash, temperature: num(options.temperature) };

      const hit = ctx.cache.get(ctx.caseId, ctx.modelKey, hash);
      if (hit) {
        const r = hit.response;
        ctx.transcript.push({
          ...base, cached: true, latencyMs: hit.latencyMs,
          promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens,
          thoughtsTokens: r.thoughtsTokens, modelVersion: r.modelVersion, finishReason: r.finishReason, responseText: r.text ?? null,
        });
        return toResult(r);
      }

      let latencyMs = 0;
      try {
        const result = await withRetry(
          async () => {
            await ctx.throttle.acquire(ctx.modelKey);
            const started = Date.now();
            // Fresh per-attempt signal: throttle waits must never eat the caller's 55 s budget,
            // and an outer abort must not poison a cached, retried call. Thinking models can
            // exceed the app's 55 s limit, so evals use their own (longer) per-call timeout.
            const out = await inner.doGenerate({ ...options, abortSignal: AbortSignal.timeout(ctx.timeoutMs ?? evalCallTimeoutMs()) });
            latencyMs = Date.now() - started;
            return out;
          },
          { ...ctx.retry, modelKey: ctx.modelKey, onEvent: ctx.onEvent ?? ctx.retry.onEvent },
        );
        const body = (result.rawResponse?.body ?? null) as { usageMetadata?: { thoughtsTokenCount?: unknown }; modelVersion?: unknown } | null;
        const response = {
          text: result.text,
          toolCalls: result.toolCalls as unknown[] | undefined,
          finishReason: result.finishReason as string,
          usage: { promptTokens: num(result.usage?.promptTokens), completionTokens: num(result.usage?.completionTokens) },
          thoughtsTokens: num(body?.usageMetadata?.thoughtsTokenCount),
          modelVersion: typeof body?.modelVersion === "string" ? body.modelVersion : null,
        };
        ctx.cache.set({ harnessVersion: HARNESS_VERSION, caseId: ctx.caseId, modelKey: ctx.modelKey, hash, createdAt: Date.now(), latencyMs, response });
        ctx.transcript.push({
          ...base, cached: false, latencyMs,
          promptTokens: response.usage.promptTokens, completionTokens: response.usage.completionTokens,
          thoughtsTokens: response.thoughtsTokens, modelVersion: response.modelVersion, finishReason: response.finishReason, responseText: response.text ?? null,
        });
        return toResult(response);
      } catch (err) {
        const message = redactSecrets(err instanceof Error ? err.message : String(err)).slice(0, 300);
        ctx.transcript.push({
          ...base, cached: false, latencyMs: null, promptTokens: null, completionTokens: null,
          thoughtsTokens: null, modelVersion: null, finishReason: null, responseText: null, error: message,
        });
        if (err instanceof QuotaExhaustedError) throw err;
        throw new Error(message);
      }
    },

    async doStream() {
      throw new Error("streaming not supported by the eval harness");
    },
  };
}

function toResult(r: {
  text?: string;
  toolCalls?: unknown[];
  finishReason: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
}) {
  return {
    text: r.text,
    toolCalls: r.toolCalls as Awaited<ReturnType<LanguageModelV1["doGenerate"]>>["toolCalls"],
    finishReason: r.finishReason as Awaited<ReturnType<LanguageModelV1["doGenerate"]>>["finishReason"],
    // The provider reports NaN when a count is absent; keep that shape for the SDK.
    usage: { promptTokens: r.usage.promptTokens ?? NaN, completionTokens: r.usage.completionTokens ?? NaN },
    rawCall: { rawPrompt: null, rawSettings: {} },
  };
}
