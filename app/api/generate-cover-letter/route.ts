/**
 * Cover Letter Generator.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { CoverLetterRequestBody } from "@/lib/types";
import { buildCoverLetterPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateCoverLetterResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: CoverLetterRequestBody;
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
      { const e = validateNonEmpty(b.companyName, "Company name", 200); if (e) return e; }
      { const e = validateNonEmpty(b.jobTitle, "Job title", 200); if (e) return e; }
      { const v = b.hiringManagerName; if (typeof v === "string" && v.length > 100) return "Hiring manager name is too long."; }
      { const v = b.additionalContext; if (typeof v === "string" && v.length > 2000) return "Additional context is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildCoverLetterPrompt({
        resumeText: b.resumeText, jobDescription: b.jobDescription.trim(),
        companyName: b.companyName.trim(), jobTitle: b.jobTitle.trim(),
        hiringManagerName: b.hiringManagerName?.trim() || undefined,
        additionalContext: b.additionalContext?.trim() || undefined,
        tone: b.tone || "professional",
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateCoverLetterResult(out),
    isEmpty: (r) => !r.coverLetter,
    emptyMessage: "The cover letter came back empty. Retry, or switch to a different model.",
    temperature: 0.7,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
