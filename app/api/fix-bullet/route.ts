import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import type { BulletFixRequestBody } from "@/lib/types";
import { createModel } from "@/lib/ai";
import { buildBulletFixPrompt } from "@/lib/prompts";
import {
  extractJsonFromLlmResponse,
    validateFixResult,
} from "@/lib/utils";

export const maxDuration = 30;

const MAX_BULLET_LENGTH = 1_000;
const MAX_JD_LENGTH = 5_000;
const AI_TIMEOUT_MS = 25_000;

/** Redact anything resembling an API key before an error string leaves the server. */
function redactSecrets(input: string): string {
  return input
    .replace(/sk-or-v1-[A-Za-z0-9]+/g, "[REDACTED]")
    .replace(/sk-or-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/gsk_[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

export async function POST(req: NextRequest) {
  let body: BulletFixRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const {
    config,
    bullet,
    jobDescription,
    roleContext,
    technology,
    desperationLevel,
  } = body;

  // ─── Input validation ────────────────────────────────────────────────────
  if (!config?.provider || !config?.apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "Provider and API key are required. This app runs on your own key - we never store it.",
      },
      { status: 400 },
    );
  }
  if (
    !config.model?.trim() &&
    config.provider !== "openai" &&
    config.provider !== "google"
  ) {
    return NextResponse.json(
      { error: "A model name is required." },
      { status: 400 },
    );
  }
  if (!bullet?.trim()) {
    return NextResponse.json(
      { error: "A bullet point is required. Paste your resume bullet above." },
      { status: 400 },
    );
  }
  if (bullet.length > MAX_BULLET_LENGTH) {
    return NextResponse.json(
      {
        error: `Bullet is too long (${bullet.length.toLocaleString()} chars). Max is ${MAX_BULLET_LENGTH.toLocaleString()}.`,
      },
      { status: 400 },
    );
  }
  if (jobDescription && jobDescription.length > MAX_JD_LENGTH) {
    return NextResponse.json(
      {
        error: `Job description is too long (${jobDescription.length.toLocaleString()} chars). Max is ${MAX_JD_LENGTH.toLocaleString()}.`,
      },
      { status: 400 },
    );
  }

  // ─── Prompt ──────────────────────────────────────────────────────────────
  const { system, user } = buildBulletFixPrompt({
    bullet,
    jobDescription,
    roleContext,
    technology,
    desperationLevel,
  });

  // ─── AI call ─────────────────────────────────────────────────────────────
  try {
    const model = createModel(config);
    const result = await generateText({
      model,
      system,
      prompt: user,
      temperature: 0.5,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    const parsed = extractJsonFromLlmResponse(result.text);
        const safe = validateFixResult(parsed);
    return NextResponse.json(safe);
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : "Bullet fix failed.";
    const message = redactSecrets(rawMessage);

    const isAuthError =
      /api key|unauthorized|401|invalid[ _-]?key|authentication|permission denied/i.test(
        message,
      );
    const isRateLimit = /rate limit|429|too many requests|quota exceeded/i.test(
      message,
    );
    const isTimeout = /timeout|timed out|etimedout|econnaborted|abort/i.test(
      message,
    );
    const isModelError =
      /model.*(not found|does not exist|invalid)|unsupported (model|value)/i.test(
        message,
      );
    const isJsonError = /valid json|json/i.test(message);

    if (isAuthError) {
      return NextResponse.json(
        {
          error:
            "API key rejected by the provider. Double-check the key and that it has credit.",
        },
        { status: 401 },
      );
    }
    if (isRateLimit) {
      return NextResponse.json(
        {
          error:
            "Provider rate limit hit. Wait a moment and retry, or switch to a different model.",
        },
        { status: 429 },
      );
    }
    if (isTimeout) {
      return NextResponse.json(
        {
          error:
            "The fix timed out. Try a faster model (e.g. gpt-4o-mini or gemini-2.0-flash).",
        },
        { status: 504 },
      );
    }
    if (isModelError) {
      return NextResponse.json(
        { error: "Model not found for this provider. Check the model name." },
        { status: 400 },
      );
    }
    if (isJsonError) {
      return NextResponse.json(
        {
          error:
            "The model returned a malformed response. Retry, or switch to a different model.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: message || "Bullet fix failed. Try again." },
      { status: 500 },
    );
  }
}
