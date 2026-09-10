/**
 * Interview Boss Fight Start.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { StartBossFightBody } from "@/lib/types";
import { buildBossFightStartPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateBossFightSession } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: StartBossFightBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.resumeText, "Resume", 20000); if (e) return e; }
      { const e = validateNonEmpty(b.jobDescription, "Job description", 10000); if (e) return e; }
      { const v = b.role; if (typeof v === "string" && v.length > 200) return "Role is too long."; }
      { const v = b.experienceLevel; if (typeof v === "string" && v.length > 200) return "Experience level is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildBossFightStartPrompt({
        resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),
        role: b.role?.trim() || undefined, experienceLevel: b.experienceLevel?.trim() || undefined,
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateBossFightSession(out),
    isEmpty: (r) => r.questions.length === 0 || !r.questions.some((q: any) => q.question),
    emptyMessage: "The gauntlet came back empty. Retry, or switch to a different model.",
    temperature: 0.7,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
