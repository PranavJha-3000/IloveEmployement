import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import type { EvaluateBossAnswerBody } from "@/lib/types";
import { createModel } from "@/lib/ai";
import { buildBossFightEvaluatePrompt } from "@/lib/prompts";
import {
  extractJsonFromLlmResponse,
  validateBossAnswerEvaluation,
} from "@/lib/utils";

export const maxDuration = 60;

const MAX_ANSWER_LENGTH = 8_000;
const MAX_RESUME_LENGTH = 20_000;
const MAX_JD_LENGTH = 10_000;
const MAX_QUESTION_LENGTH = 1_000;
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
  let body: EvaluateBossAnswerBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { config, question, answer, resumeText, jobDescription } = body;

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
  if (!answer?.trim()) {
    return NextResponse.json(
      { error: "An answer is required. Lock in something you'd actually say." },
      { status: 400 },
    );
  }
  if (!question?.question?.trim()) {
    return NextResponse.json({ error: "Question context is missing." }, { status: 400 });
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    return NextResponse.json(
      { error: `Answer is too long (${answer.length.toLocaleString()} chars). Max is ${MAX_ANSWER_LENGTH.toLocaleString()}.` },
      { status: 400 },
    );
  }
  if ((question.question?.length ?? 0) > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "Question is too long." }, { status: 400 });
  }
  if (resumeText && resumeText.length > MAX_RESUME_LENGTH) {
    return NextResponse.json({ error: "Resume is too long." }, { status: 400 });
  }
  if (jobDescription && jobDescription.length > MAX_JD_LENGTH) {
    return NextResponse.json({ error: "Job description is too long." }, { status: 400 });
  }

  // ─── Prompt ──────────────────────────────────────────────────────────────
  const { system, user } = buildBossFightEvaluatePrompt({
    resumeText: resumeText?.trim() || "",
    jobDescription: jobDescription?.trim() || "",
    question,
    answer: answer.trim(),
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
    const safe = validateBossAnswerEvaluation(parsed);

    return NextResponse.json(safe);
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : "Answer evaluation failed.";
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
        { error: "The evaluation timed out. Try a faster model (e.g. gpt-4o-mini or gemini-2.0-flash)." },
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
      { error: message || "Answer evaluation failed. Try again." },
      { status: 500 },
    );
  }
}