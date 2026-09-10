/**
 * Resume Optimizer.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { ResumeOptimizationRequest } from "@/lib/types";
import { buildOptimizationUserPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateResumeOptimization } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: ResumeOptimizationRequest;
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
      { if (!b.analysis || typeof b.analysis !== "object" || Array.isArray(b.analysis)) return "Run a full analysis first before requesting an optimized resume."; }
      return null;
    },
    buildPrompts: async (b) => {
      const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });
      let user = buildOptimizationUserPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription, analysis: b.analysis });
      if (p.linkedinContext) user += "\n\n" + p.linkedinContext;
      if (p.githubContext) user += "\n\n" + p.githubContext;
      return {
        system: "You are a professional resume optimizer. The user has supplied a resume, a job description, and prior analysis. Fix their mistakes and polish the resume. Follow the truth filter rules strictly. Respond ONLY with valid JSON matching the schema in your instructions.",
        prompt: user,
      };
    },
    validateOutput: (out) => validateResumeOptimization(out),
    isEmpty: (r) => !r.optimizedResume.trim(),
    emptyMessage: "The optimizer returned empty content. Try again.",
    temperature: 0.3,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
