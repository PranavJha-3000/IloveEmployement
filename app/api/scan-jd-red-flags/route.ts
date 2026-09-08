import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import type { JdRedFlagRequestBody } from "@/lib/types";
import { createModel } from "@/lib/ai";
import { buildJdRedFlagPrompt } from "@/lib/prompts";
import {
  extractJsonFromLlmResponse,
  validateJdRedFlagResult,
} from "@/lib/utils";

export const maxDuration = 60;

const MAX_JD_LENGTH = 15_000;
const MAX_COMPANY_LENGTH = 200;
const MAX_ROLE_LENGTH = 200;
const MAX_SALARY_LENGTH = 100;
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
  let body: JdRedFlagRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { config, jobDescription, companyName, role, salary } = body;

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
  if (!jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Job description is required. Paste the posting you want scanned." },
      { status: 400 },
    );
  }
  if (jobDescription.length > MAX_JD_LENGTH) {
    return NextResponse.json(
      { error: `Job description is too long (${jobDescription.length.toLocaleString()} chars). Max is ${MAX_JD_LENGTH.toLocaleString()} - paste just the posting.` },
      { status: 400 },
    );
  }
  if (companyName && companyName.length > MAX_COMPANY_LENGTH) {
    return NextResponse.json({ error: `Company name is too long. Max ${MAX_COMPANY_LENGTH} characters.` }, { status: 400 });
  }
  if (role && role.length > MAX_ROLE_LENGTH) {
    return NextResponse.json({ error: `Role is too long. Max ${MAX_ROLE_LENGTH} characters.` }, { status: 400 });
  }
  if (salary && salary.length > MAX_SALARY_LENGTH) {
    return NextResponse.json({ error: `Salary is too long. Max ${MAX_SALARY_LENGTH} characters.` }, { status: 400 });
  }

  // ─── Prompt ──────────────────────────────────────────────────────────────
  const { system, user } = buildJdRedFlagPrompt({
    jobDescription: jobDescription.trim(),
    companyName: companyName?.trim() || undefined,
    role: role?.trim() || undefined,
    salary: salary?.trim() || undefined,
  });

  // ─── AI call ─────────────────────────────────────────────────────────────
  try {
    const model = createModel(config);
    const result = await generateText({
      model,
      system,
      prompt: user,
      temperature: 0.6,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    const parsed = extractJsonFromLlmResponse(result.text);
    const safe = validateJdRedFlagResult(parsed);

    const hasContent =
      safe.goodSignals.length > 0 ||
      safe.categories.vague.length > 0 ||
      safe.categories.overloaded.length > 0 ||
      safe.categories.missing.length > 0 ||
      safe.categories.concern.length > 0 ||
      Boolean(safe.summary);

    if (!hasContent) {
      return NextResponse.json(
        { error: "The scan came back empty. Retry, or switch to a different model." },
        { status: 502 },
      );
    }

    return NextResponse.json(safe);
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : "JD scan failed.";
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
        { error: "The scan timed out. Try a faster model (e.g. gpt-4o-mini or gemini-2.0-flash)." },
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
      { error: message || "JD scan failed. Try again." },
      { status: 500 },
    );
  }
}