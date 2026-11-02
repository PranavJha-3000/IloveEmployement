/**
 * Provider-call plumbing shared by the engine (lib/engine/run.ts):
 * secret redaction, error classification, the call timeout, and lenient JSON
 * extraction for providers that can't do structured output.
 */

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
    return { category: "timeout", message: "The analysis timed out. Try a faster model (e.g. gpt-4o-mini or gemini-3.5-flash-lite).", status: 504 };
  }
  if (/model.*(not found|does not exist|invalid)|unsupported (model|value)/i.test(message)) {
    return { category: "model", message: "Model not found for this provider. Check the model name.", status: 400 };
  }
  if (/valid json|json/i.test(message)) {
    return { category: "json", message: "The model returned a malformed response. Retry, or switch to a different model.", status: 502 };
  }
  return { category: "other", message: message || "Something went wrong.", status: 500 };
}

export const DEFAULT_TIMEOUT = 55_000;

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
