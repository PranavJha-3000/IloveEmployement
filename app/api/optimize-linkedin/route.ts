import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import type { LinkedInOptimizerRequestBody } from "@/lib/types";
import { createModel } from "@/lib/ai";
import { buildLinkedInOptimizerPrompt } from "@/lib/prompts";
import {
  extractJsonFromLlmResponse,
  fetchProfileText,
  isLinkedInUrl,
  isValidUrl,
  validateLinkedInOptimizerResult,
} from "@/lib/utils";

export const maxDuration = 60;

const MAX_LINKEDIN_LENGTH = 20_000;
const MAX_RESUME_LENGTH = 20_000;
const MAX_JD_LENGTH = 10_000;
const AI_TIMEOUT_MS = 55_000;

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
  let body: LinkedInOptimizerRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { config, linkedinUrl, linkedinContent, jobDescription, resumeText } = body;

  // ─── Input validation ────────────────────────────────────────────────────
  if (!config?.provider || !config?.apiKey?.trim()) {
    return NextResponse.json(
      { error: "Provider and API key are required. This app runs on your own key - we never store it." },
      { status: 400 }
    );
  }
  if (!config.model?.trim() && config.provider !== "openai" && config.provider !== "google") {
    return NextResponse.json({ error: "A model name is required." }, { status: 400 });
  }
  if (!linkedinContent?.trim() && !linkedinUrl?.trim()) {
    return NextResponse.json(
      { error: "LinkedIn profile is required. Paste your profile content or provide a profile URL." },
      { status: 400 }
    );
  }
  if (linkedinContent && linkedinContent.length > MAX_LINKEDIN_LENGTH) {
    return NextResponse.json(
      { error: `LinkedIn content is too long (${linkedinContent.length.toLocaleString()} chars). Max is ${MAX_LINKEDIN_LENGTH.toLocaleString()} - trim and retry.` },
      { status: 400 }
    );
  }
  if (resumeText && resumeText.length > MAX_RESUME_LENGTH) {
    return NextResponse.json(
      { error: `Resume is too long (${resumeText.length.toLocaleString()} chars). Max is ${MAX_RESUME_LENGTH.toLocaleString()} - trim it down and retry.` },
      { status: 400 }
    );
  }
  if (jobDescription && jobDescription.length > MAX_JD_LENGTH) {
    return NextResponse.json(
      { error: `Job description is too long (${jobDescription.length.toLocaleString()} chars). Max is ${MAX_JD_LENGTH.toLocaleString()} - paste just the JD.` },
      { status: 400 }
    );
  }

  // ─── Profile fetching (best-effort) ──────────────────────────────────────
  let resolvedLinkedInContent = linkedinContent?.trim() || "";
  if (!resolvedLinkedInContent && linkedinUrl?.trim() && isValidUrl(linkedinUrl) && isLinkedInUrl(linkedinUrl)) {
    const text = await fetchProfileText(linkedinUrl);
    if (text) {
      resolvedLinkedInContent = text;
    }
  }

  // ─── Prompt ──────────────────────────────────────────────────────────────
  const { system, user } = buildLinkedInOptimizerPrompt({
    linkedinUrl: linkedinUrl?.trim() || undefined,
    linkedinContent: resolvedLinkedInContent || undefined,
    jobDescription: jobDescription?.trim() || undefined,
    resumeText: resumeText?.trim() || undefined,
  });

  // ─── AI call ─────────────────────────────────────────────────────────────
  try {
    const model = createModel(config);
    const result = await generateText({
      model,
      system,
      prompt: user,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    const parsed = extractJsonFromLlmResponse(result.text);
    const safe = validateLinkedInOptimizerResult(parsed);
    return NextResponse.json(safe);
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "LinkedIn optimization failed.";
    const message = redactSecrets(rawMessage);

    const isAuthError = /api key|unauthorized|401|invalid[ _-]?key|authentication|permission denied/i.test(message);
    const isRateLimit = /rate limit|429|too many requests|quota exceeded/i.test(message);
    const isTimeout = /timeout|timed out|etimedout|econnaborted|abort/i.test(message);
    const isModelError = /model.*(not found|does not exist|invalid)|unsupported (model|value)/i.test(message);
    const isJsonError = /valid json|json/i.test(message);

    if (isAuthError) {
      return NextResponse.json(
        { error: "API key rejected by the provider. Double-check the key and that it has credit." },
        { status: 401 }
      );
    }
    if (isRateLimit) {
      return NextResponse.json(
        { error: "Provider rate limit hit. Wait a moment and retry, or switch to a different model." },
        { status: 429 }
      );
    }
    if (isTimeout) {
      return NextResponse.json(
        { error: "The optimization timed out. Try a faster model (e.g. gpt-4o-mini or gemini-2.0-flash)." },
        { status: 504 }
      );
    }
    if (isModelError) {
      return NextResponse.json(
        { error: "Model not found for this provider. Check the model name." },
        { status: 400 }
      );
    }
    if (isJsonError) {
      return NextResponse.json(
        { error: "The model returned a malformed response. Retry, or switch to a different model." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: message || "LinkedIn optimization failed. Try again." }, { status: 500 });
  }
}
