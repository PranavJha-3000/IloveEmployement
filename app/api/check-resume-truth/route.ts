import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import type { ResumeTruthRequestBody } from "@/lib/types";
import { createModel } from "@/lib/ai";
import { buildResumeTruthPrompt } from "@/lib/prompts";
import {
  extractJsonFromLlmResponse,
  validateResumeTruthResult,
} from "@/lib/utils";

export const maxDuration = 60;

const MAX_RESUME_LENGTH = 20_000;
const MAX_LINKEDIN_LENGTH = 5_000;
const MAX_GITHUB_LENGTH = 5_000;
const MAX_PORTFOLIO_LENGTH = 5_000;
const MAX_JD_LENGTH = 10_000;
const AI_TIMEOUT_MS = 55_000;

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
  let body: ResumeTruthRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { config, resumeText, linkedin, github, portfolio, jobDescription } = body;

  // ─── Input validation ────────────────────────────────────────────────────
  if (!config?.provider || !config?.apiKey?.trim()) {
    return NextResponse.json(
      { error: "Provider and API key are required. This app runs on your own key - we never store it." },
      { status: 400 },
    );
  }
  if (!config.model?.trim() && config.provider !== "openai" && config.provider !== "google") {
    return NextResponse.json({ error: "A model name is required." }, { status: 400 });
  }
  if (!resumeText?.trim()) {
    return NextResponse.json(
      { error: "Resume is required. The evidence check runs against your resume claims." },
      { status: 400 },
    );
  }
  if (resumeText.length > MAX_RESUME_LENGTH) {
    return NextResponse.json(
      { error: `Resume is too long (${resumeText.length.toLocaleString()} chars). Max is ${MAX_RESUME_LENGTH.toLocaleString()} - trim it down and retry.` },
      { status: 400 },
    );
  }
  if (linkedin && linkedin.length > MAX_LINKEDIN_LENGTH) {
    return NextResponse.json(
      { error: `LinkedIn content is too long (${linkedin.length.toLocaleString()} chars). Max is ${MAX_LINKEDIN_LENGTH.toLocaleString()}.` },
      { status: 400 },
    );
  }
  if (github && github.length > MAX_GITHUB_LENGTH) {
    return NextResponse.json(
      { error: `GitHub content is too long (${github.length.toLocaleString()} chars). Max is ${MAX_GITHUB_LENGTH.toLocaleString()}.` },
      { status: 400 },
    );
  }
  if (portfolio && portfolio.length > MAX_PORTFOLIO_LENGTH) {
    return NextResponse.json(
      { error: `Portfolio content is too long (${portfolio.length.toLocaleString()} chars). Max is ${MAX_PORTFOLIO_LENGTH.toLocaleString()}.` },
      { status: 400 },
    );
  }
  if (jobDescription && jobDescription.length > MAX_JD_LENGTH) {
    return NextResponse.json(
      { error: `Job description is too long (${jobDescription.length.toLocaleString()} chars). Max is ${MAX_JD_LENGTH.toLocaleString()}.` },
      { status: 400 },
    );
  }

  // ─── Prompt ──────────────────────────────────────────────────────────────
  const { system, user } = buildResumeTruthPrompt({
    resumeText: resumeText.trim(),
    linkedin: linkedin?.trim() || undefined,
    github: github?.trim() || undefined,
    portfolio: portfolio?.trim() || undefined,
    jobDescription: jobDescription?.trim() || undefined,
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
    const safe = validateResumeTruthResult(parsed);

    if (safe.claims.length === 0) {
      return NextResponse.json(
        { error: "The audit came back empty. Retry, or switch to a different model." },
        { status: 502 },
      );
    }

    return NextResponse.json(safe);
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : "Resume truth check failed.";
    const message = redactSecrets(rawMessage);

    const isAuthError = /api key|unauthorized|401|invalid[ _-]?key|authentication|permission denied/i.test(message);
    const isRateLimit = /rate limit|429|too many requests|quota exceeded/i.test(message);
    const isTimeout = /timeout|timed out|etimedout|econnaborted|abort/i.test(message);
    const isModelError = /model.*(not found|does not exist|invalid)|unsupported (model|value)/i.test(message);
    const isJsonError = /valid json|json/i.test(message);

    if (isAuthError) {
      return NextResponse.json(
        { error: "API key rejected by the provider. Double-check the key and that it has credit." },
        { status: 401 },
      );
    }
    if (isRateLimit) {
      return NextResponse.json(
        { error: "Provider rate limit hit. Wait a moment and retry, or switch to a different model." },
        { status: 429 },
      );
    }
    if (isTimeout) {
      return NextResponse.json(
        { error: "The audit timed out. Try a faster model (e.g. gpt-4o-mini or gemini-2.0-flash)." },
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
        { error: "The model returned a malformed response. Retry, or switch to a different model." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: message || "Resume truth check failed. Try again." },
      { status: 500 },
    );
  }
}