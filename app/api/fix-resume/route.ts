/**
 * Resume Fixer.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { ResumeFixRequestBody } from "@/lib/types";
import { buildFixPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateResumeFixResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: ResumeFixRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.resumeText, "Resume", 20000); if (e) return e; }
      { const v = b.jobDescription; if (typeof v === "string" && v.length > 10000) return "Job description is too long."; }
      { const u = validateUrl(b.linkedinUrl, "LinkedIn URL"); if (u) return u; }
      { const u = validateUrl(b.githubUrl, "GitHub URL"); if (u) return u; }
      return null;
    },
    buildPrompts: async (b) => {
      await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl }); // best-effort, not used
      const { system, user } = buildFixPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateResumeFixResult(out),
    temperature: 0.5,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
