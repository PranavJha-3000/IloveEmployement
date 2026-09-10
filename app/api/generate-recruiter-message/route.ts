/**
 * Recruiter Message Generator.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { RecruiterMessageRequestBody } from "@/lib/types";
import { buildRecruiterMessagePrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateRecruiterMessageResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: RecruiterMessageRequestBody;
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
      { const v = b.recruiterName; if (typeof v === "string" && v.length > 100) return "Recruiter name is too long."; }
      { const v = b.additionalContext; if (typeof v === "string" && v.length > 2000) return "Additional context is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildRecruiterMessagePrompt({
        resumeText: b.resumeText, jobDescription: b.jobDescription.trim(),
        companyName: b.companyName.trim(), jobTitle: b.jobTitle.trim(),
        recruiterName: b.recruiterName?.trim() || undefined,
        context: b.context || "cold-outreach",
        additionalContext: b.additionalContext?.trim() || undefined,
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateRecruiterMessageResult(out),
    isEmpty: (r) => !r.variants.short.message && !r.variants.confident.message && !r.variants.warm.message,
    emptyMessage: "The message came back empty. Retry, or switch to a different model.",
    temperature: 0.7,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
