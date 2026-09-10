/**
 * Resume Truth Detector.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { ResumeTruthRequestBody } from "@/lib/types";
import { buildResumeTruthPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateResumeTruthResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: ResumeTruthRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.resumeText, "Resume", 20000); if (e) return e; }
      { const v = b.linkedin; if (typeof v === "string" && v.length > 5000) return "LinkedIn content is too long."; }
      { const v = b.github; if (typeof v === "string" && v.length > 5000) return "GitHub content is too long."; }
      { const v = b.portfolio; if (typeof v === "string" && v.length > 5000) return "Portfolio content is too long."; }
      { const v = b.jobDescription; if (typeof v === "string" && v.length > 10000) return "Job description is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildResumeTruthPrompt({ resumeText: b.resumeText.trim(),
        linkedin: b.linkedin?.trim() || undefined, github: b.github?.trim() || undefined,
        portfolio: b.portfolio?.trim() || undefined, jobDescription: b.jobDescription?.trim() || undefined, });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateResumeTruthResult(out),
    isEmpty: (r) => r.claims.length === 0,
    emptyMessage: "The audit came back empty. Retry, or switch to a different model.",
    temperature: 0.5,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
