import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import type { ResumeOptimizationRequest } from "@/lib/types";
import { createModel } from "@/lib/ai";
import { buildOptimizationUserPrompt } from "@/lib/prompts";
import {
  extractJsonFromLlmResponse,
  fetchProfileText,
  isGitHubUrl,
  isLinkedInUrl,
  isValidUrl,
  validateResumeOptimization,
} from "@/lib/utils";

export const maxDuration = 60;

const MAX_RESUME_LENGTH = 20_000;
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
  let body: ResumeOptimizationRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { config, resumeText, jobDescription, analysis, linkedinUrl, githubUrl } = body;

  // ─── Validation ────────────────────────────────────────────────────────────
  if (!config?.provider || !config?.apiKey?.trim()) {
    return NextResponse.json(
      { error: "Provider and API key are required. This app runs on your own key - we never store it." },
      { status: 400 }
    );
  }
  if (!config.model?.trim() && config.provider !== "openai" && config.provider !== "google") {
    return NextResponse.json({ error: "A model name is required." }, { status: 400 });
  }
  if (!resumeText?.trim()) {
    return NextResponse.json(
      { error: "Resume is required. Paste text or upload a PDF first." },
      { status: 400 }
    );
  }
  if (!jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Job description is required. Paste the full JD first." },
      { status: 400 }
    );
  }
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return NextResponse.json(
      { error: "Run a full analysis first before requesting an optimized resume." },
      { status: 400 }
    );
  }
  if (resumeText.length > MAX_RESUME_LENGTH) {
    return NextResponse.json(
      { error: `Resume is too long (${resumeText.length.toLocaleString()} chars). Max is ${MAX_RESUME_LENGTH.toLocaleString()} - trim it down and retry.` },
      { status: 400 }
    );
  }
  if (jobDescription.length > MAX_JD_LENGTH) {
    return NextResponse.json(
      { error: `Job description is too long (${jobDescription.length.toLocaleString()} chars). Max is ${MAX_JD_LENGTH.toLocaleString()} - paste just the JD.` },
      { status: 400 }
    );
  }

  // ─── Fetch profile content (best-effort, never blocks) ────────────────────
  let linkedinContext = "";
  let githubContext = "";

  if (linkedinUrl?.trim() && isValidUrl(linkedinUrl) && isLinkedInUrl(linkedinUrl)) {
    const text = await fetchProfileText(linkedinUrl);
    linkedinContext = text
      ? `LinkedIn public profile content (fetched live):\n${text}`
      : `LinkedIn URL was provided (${linkedinUrl}) but could not be fetched - treat its contents as unknown.`;
  }

  if (githubUrl?.trim() && isValidUrl(githubUrl) && isGitHubUrl(githubUrl)) {
    const text = await fetchProfileText(githubUrl);
    githubContext = text
      ? `GitHub public profile content (fetched live):\n${text}`
      : `GitHub URL was provided (${githubUrl}) but could not be fetched - treat its contents as unknown.`;
  }

  // ─── Build prompt ──────────────────────────────────────────────────────────
  let userPrompt = buildOptimizationUserPrompt({
    resumeText,
    jobDescription,
    analysis,
  });
  if (linkedinContext) userPrompt += `\n\n${linkedinContext}`;
  if (githubContext) userPrompt += `\n\n${githubContext}`;

  // ─── AI call (conservative temperature - rewriting, not writing) ───────────
  try {
    const model = createModel(config);
    const result = await generateText({
      model,
      system:
        "You are a professional resume optimizer. The user has supplied a resume, a job description, and prior analysis. Fix their mistakes and polish the resume. Follow the truth filter rules strictly. Respond ONLY with valid JSON matching the schema in your instructions.",
      prompt: userPrompt,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    const parsed = extractJsonFromLlmResponse(result.text);
    const safe = validateResumeOptimization(parsed);

    if (!safe.optimizedResume.trim()) {
      return NextResponse.json(
        { error: "The optimizer returned empty content. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(safe);
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Optimization failed.";
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
        { error: "Provider rate limit hit. Wait a moment and retry." },
        { status: 429 }
      );
    }
    if (isTimeout) {
      return NextResponse.json(
        { error: "The rewrite timed out. Try a faster model." },
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
        { error: "The model returned a malformed response. Retry." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: message || "Optimization failed. Try again." }, { status: 500 });
  }
}
