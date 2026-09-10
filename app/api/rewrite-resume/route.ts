/**
 * Resume Rewriter.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { ResumeRewriteRequestBody } from "@/lib/types";
import { buildRewritePrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateRewriteResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: ResumeRewriteRequestBody;
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
      const built = buildRewritePrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,
        desperationLevel: Number.isFinite(b.desperationLevel) ? b.desperationLevel : 2, });
      let prompt = built.user;
      if (p.linkedinContext) prompt += "\n\n" + p.linkedinContext;
      if (p.githubContext) prompt += "\n\n" + p.githubContext;
      return { system: built.system, prompt };
    },
    validateOutput: (out) => validateRewriteResult(out),
    isEmpty: (r) => r.optimizedResume.length === 0,
    emptyMessage: "The rewrite came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
