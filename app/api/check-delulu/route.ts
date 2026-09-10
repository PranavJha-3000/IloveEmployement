/**
 * Delulu Detector.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { DeluluCheckRequestBody } from "@/lib/types";
import { buildDeluluPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateDeluluCheckResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: DeluluCheckRequestBody;
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
      { const u = validateUrl(b.linkedinUrl, "LinkedIn URL"); if (u) return u; }
      { const u = validateUrl(b.githubUrl, "GitHub URL"); if (u) return u; }
      return null;
    },
    buildPrompts: async (b) => {
      const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });
      const { system, user } = buildDeluluPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,
        linkedinContext: p.linkedinContext || undefined, githubContext: p.githubContext || undefined, });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateDeluluCheckResult(out),
    isEmpty: (r) => !r.verdict,
    emptyMessage: "The delulu check came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
