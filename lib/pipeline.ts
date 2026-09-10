/**
 * Shared AI analysis pipeline.
 *
 * Provides reusable infrastructure used by all API routes:
 * - Secret redaction in error messages
 * - Error classification (auth / rate-limit / timeout / model / JSON)
 * - Standardized AI call with timeout + abort signal
 * - Reusable input validation helpers
 * - Standardized profile fetching (LinkedIn / GitHub)
 */

import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import { createModel } from "./ai";
import { fetchProfileText, isGitHubUrl, isLinkedInUrl, isValidUrl } from "./utils";
import type { AiRequestConfig } from "./types";

/** Redact anything resembling an API key before an error string leaves the server. */
export function redactSecrets(input: string): string {
  return input
    .replace(/sk-or-v1-[A-Za-z0-9]+/g, "[REDACTED]")
    .replace(/sk-or-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/gsk_[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

export type AiErrorCategory = "auth" | "rate_limit" | "timeout" | "model" | "json" | "other";

export interface AiErrorInfo {
  category: AiErrorCategory;
  message: string;
  status: number;
}

/** Classify an AI error into a user-friendly message + HTTP status. */
export function classifyAIError(err: unknown): AiErrorInfo {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const message = redactSecrets(rawMessage);

  if (/api key|unauthorized|401|invalid[ _-]?key|authentication|permission denied/i.test(message)) {
    return { category: "auth", message: "API key rejected by the provider. Double-check the key and that it has credit.", status: 401 };
  }
  if (/rate limit|429|too many requests|quota exceeded/i.test(message)) {
    return { category: "rate_limit", message: "Provider rate limit hit. Wait a moment and retry, or switch to a different model.", status: 429 };
  }
  if (/timeout|timed out|etimedout|econnaborted|abort/i.test(message)) {
    return { category: "timeout", message: "The analysis timed out. Try a faster model (e.g. gpt-4o-mini or gemini-2.0-flash).", status: 504 };
  }
  if (/model.*(not found|does not exist|invalid)|unsupported (model|value)/i.test(message)) {
    return { category: "model", message: "Model not found for this provider. Check the model name.", status: 400 };
  }
  if (/valid json|json/i.test(message)) {
    return { category: "json", message: "The model returned a malformed response. Retry, or switch to a different model.", status: 502 };
  }
  return { category: "other", message: message || "Something went wrong.", status: 500 };
}

/** Centralized AI config validation shared by all routes. */
export function validateConfig(config: AiRequestConfig): string | null {
  if (!config?.provider) return "An AI provider is required.";
  if (!config?.apiKey?.trim()) return "An API key is required. This app runs on your own key — we never store it.";
  if (!config?.model?.trim() && config.provider !== "openai" && config.provider !== "google") return "A model name is required for this provider.";
  return null;
}

export const DEFAULT_TIMEOUT = 55_000;
export const DEFAULT_MAX_TEXT = 20_000;
export const DEFAULT_MAX_JD = 10_000;

export interface PipelineOptions {
  temperature?: number;
  timeoutMs?: number;
}

/** Execute an AI call with timeout + error handling. Returns raw LLM text. */
export async function callAI(
  config: AiRequestConfig,
  system: string,
  prompt: string,
  opts: PipelineOptions = {},
): Promise<string> {
  const model: LanguageModelV1 = createModel(config);
  const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT } = opts;

  const result = await generateText({
    model,
    system,
    prompt,
    temperature,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });

  return result.text;
}

/** Reusable non-empty field validation with optional max length. */
export function validateNonEmpty(value: unknown, label: string, maxLength?: number): string | null {
  if (!value || typeof value !== "string" || !value.trim()) {
    return `${label} is required.`;
  }
  if (typeof maxLength === "number" && value.length > maxLength) {
    return `${label} is too long (${value.length.toLocaleString()} chars). Max is ${maxLength.toLocaleString()}.`;
  }
  return null;
}

/** Reusable URL validation (optional field). */
export function validateUrl(url: string | undefined, label: string): string | null {
  if (!url || !url.trim()) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return `${label} must be an http(s) URL.`;
    }
    return null;
  } catch {
    return `${label} is not a valid URL.`;
  }
}

/** Extract clean JSON object from an LLM response that may contain markdown or prose. Returns null on failure. */
export function extractJson(raw: string): unknown {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json|JSON)?\n([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1];
  } else {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
        return null;
  }
}

/**
 * Standard profile context builder.
 * Fetches LinkedIn/GitHub profile text (best-effort) and returns
 * context strings to append to prompts. Never blocks — if fetch
 * fails, a graceful placeholder is returned.
 */
export async function buildProfileContexts(params: {
  linkedinUrl?: string;
  githubUrl?: string;
}): Promise<{ linkedinContext: string; githubContext: string }> {
  let linkedinContext = "";
  let githubContext = "";

  if (params.linkedinUrl?.trim() && isValidUrl(params.linkedinUrl) && isLinkedInUrl(params.linkedinUrl)) {
    const text = await fetchProfileText(params.linkedinUrl);
    linkedinContext = text
      ? `LinkedIn public profile content (fetched live):\n${text}`
      : `LinkedIn URL was provided (${params.linkedinUrl}) but could not be fetched. Treat as unknown.`;
  }

  if (params.githubUrl?.trim() && isValidUrl(params.githubUrl) && isGitHubUrl(params.githubUrl)) {
    const text = await fetchProfileText(params.githubUrl);
    githubContext = text
      ? `GitHub public profile content (fetched live):\n${text}`
      : `GitHub URL was provided (${params.githubUrl}) but could not be fetched. Treat as unknown.`;
  }

  return { linkedinContext, githubContext };
}

/**
 * Standard API route handler that encapsulates the full lifecycle:
 * validate → build prompts → call AI → extract JSON → validate output → handle errors.
 *
 * Each route provides its own validateInput, buildPrompts, and validateOutput.
 * The error handling (auth, rate-limit, timeout, model, JSON) is fully shared.
 */
export interface StandardHandlerOpts<TBody, TResult> {
  validateInput: (body: TBody) => string | null;
  buildPrompts: (body: TBody) => { system: string; prompt: string } | Promise<{ system: string; prompt: string }>;
  validateOutput: (parsed: unknown) => TResult;
  isEmpty?: (result: TResult) => boolean;
  emptyMessage?: string;
  temperature?: number;
  timeoutMs?: number;
}

export async function standardAIHandler<TBody, TResult>(
  body: TBody,
  opts: StandardHandlerOpts<TBody, TResult>,
): Promise<{ data: TResult } | { error: { message: string; status: number } }> {
  const { validateInput, buildPrompts, validateOutput, isEmpty, emptyMessage, temperature, timeoutMs } = opts;

  const inputError = validateInput(body);
  if (inputError) return { error: { message: inputError, status: 400 } };

  const { system, prompt } = await buildPrompts(body);

  try {
    const config = (body as unknown as { config: AiRequestConfig }).config;
    const rawText = await callAI(config, system, prompt, { temperature, timeoutMs });

    const parsed = extractJson(rawText);
    if (parsed === null) {
      return { error: { message: "The model returned a malformed response. Retry, or switch to a different model.", status: 502 } };
    }

    const result = validateOutput(parsed);
    if (typeof isEmpty === "function" && isEmpty(result)) {
      return { error: { message: emptyMessage || "The analysis came back empty. Retry, or switch to a different model.", status: 502 } };
    }

    return { data: result };
  } catch (err: unknown) {
    const info = classifyAIError(err);
    return { error: { message: info.message, status: info.status } };
  }
}

