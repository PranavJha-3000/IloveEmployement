/**
 * ATS Boss Fight.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { AtsBossFightRequestBody } from "@/lib/types";
import { buildAtsBossFightPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateAtsBossFightResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: AtsBossFightRequestBody;
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
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildAtsBossFightPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateAtsBossFightResult(out),
    isEmpty: (r) => r.attackCategories.length === 0,
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
