/**
 * LinkedIn Optimizer.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { LinkedInOptimizerRequestBody } from "@/lib/types";
import { buildLinkedInOptimizerPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateLinkedInOptimizerResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: LinkedInOptimizerRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { if (!b.linkedinContent?.trim() && !b.linkedinUrl?.trim()) return "LinkedIn profile is required. Paste your profile content or provide a profile URL."; }
      { const v = b.linkedinContent; if (typeof v === "string" && v.length > 5000) return "LinkedIn content is too long."; }
      { const v = b.resumeText; if (typeof v === "string" && v.length > 20000) return "Resume is too long."; }
      { const v = b.jobDescription; if (typeof v === "string" && v.length > 10000) return "Job description is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      let content = b.linkedinContent?.trim() || "";
      if (!content && b.linkedinUrl?.trim()) {
        const f = await import("@/lib/utils");
        const text = await f.fetchProfileText(b.linkedinUrl);
        if (text) content = text;
      }
      const { system, user } = buildLinkedInOptimizerPrompt({
        linkedinUrl: b.linkedinUrl?.trim() || undefined,
        linkedinContent: content || undefined,
        jobDescription: b.jobDescription?.trim() || undefined,
        resumeText: b.resumeText?.trim() || undefined,
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateLinkedInOptimizerResult(out),
    isEmpty: (r) => r.linkedinScore === 0,
    emptyMessage: "The LinkedIn optimization came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
