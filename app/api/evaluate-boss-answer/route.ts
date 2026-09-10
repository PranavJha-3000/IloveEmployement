/**
 * Interview Boss Answer Evaluation.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { EvaluateBossAnswerBody } from "@/lib/types";
import { buildBossFightEvaluatePrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateBossAnswerEvaluation } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: EvaluateBossAnswerBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.answer, "An answer", 8000); if (e) return e; }
      { const v = b.resumeText; if (typeof v === "string" && v.length > 20000) return "Resume is too long."; }
      { const v = b.jobDescription; if (typeof v === "string" && v.length > 10000) return "Job description is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildBossFightEvaluatePrompt({
        resumeText: b.resumeText?.trim() || "", jobDescription: b.jobDescription?.trim() || "",
        question: b.question, answer: b.answer.trim(),
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateBossAnswerEvaluation(out),
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
