/**
 * Weakness Detector.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { WeaknessRequestBody } from "@/lib/types";
import { buildWeaknessPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateWeaknessResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: WeaknessRequestBody;
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
      { const v = b.linkedin; if (typeof v === "string" && v.length > 5000) return "LinkedIn content is too long."; }
      { const v = b.github; if (typeof v === "string" && v.length > 5000) return "GitHub content is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildWeaknessPrompt({ resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),
        linkedin: b.linkedin?.trim() || undefined, github: b.github?.trim() || undefined, });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateWeaknessResult(out),
    isEmpty: (r) => r.weaknesses.length === 0,
    emptyMessage: "The weakness analysis came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
