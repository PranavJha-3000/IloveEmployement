/**
 * STAR Answer Builder.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { StarAnswerRequestBody } from "@/lib/types";
import { buildStarAnswerPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateStarAnswerResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: StarAnswerRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.question, "The interview question", 1000); if (e) return e; }
      { const e = validateNonEmpty(b.experience, "The story", 10000); if (e) return e; }
      { const v = b.resumeText; if (typeof v === "string" && v.length > 20000) return "Resume is too long."; }
      { const v = b.jobDescription; if (typeof v === "string" && v.length > 10000) return "Job description is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildStarAnswerPrompt({
        question: b.question.trim(), experience: b.experience.trim(),
        resumeText: b.resumeText?.trim() || undefined, jobDescription: b.jobDescription?.trim() || undefined,
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateStarAnswerResult(out),
    isEmpty: (r) => !r.sections.situation && !r.sections.task && !r.sections.action && !r.sections.result,
    emptyMessage: "The STAR answer came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
