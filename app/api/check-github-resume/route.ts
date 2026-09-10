/**
 * GitHub Resume Checker.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { GitHubResumeRequestBody } from "@/lib/types";
import { buildGitHubResumePrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateGitHubResumeResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: GitHubResumeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.githubInput, "GitHub input", 10000); if (e) return e; }
      { const v = b.resumeText; if (typeof v === "string" && v.length > 20000) return "Resume is too long."; }
      { const v = b.jobDescription; if (typeof v === "string" && v.length > 10000) return "Job description is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildGitHubResumePrompt({ githubInput: b.githubInput.trim(),
        resumeText: b.resumeText?.trim() || undefined, jobDescription: b.jobDescription?.trim() || undefined, });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateGitHubResumeResult(out),
    isEmpty: (r) => r.projectsWorthShowing.length === 0 && r.claims.length === 0 && r.missingFromResume.length === 0,
    emptyMessage: "The GitHub check came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
