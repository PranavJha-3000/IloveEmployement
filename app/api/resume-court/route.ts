/**
 * Resume Court.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { ResumeCourtRequestBody } from "@/lib/types";
import { buildResumeCourtPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateResumeCourtResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: ResumeCourtRequestBody;
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
      { const u = validateUrl(b.portfolioUrl, "Portfolio URL"); if (u) return u; }
      return null;
    },
    buildPrompts: async (b) => {
      const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });
      let portfolioContext = "";
      if (b.portfolioUrl?.trim()) {
        const { fetchProfileText, isValidUrl } = await import("@/lib/utils");
        if (isValidUrl(b.portfolioUrl)) {
          const text = await fetchProfileText(b.portfolioUrl);
          if (text) portfolioContext = "Portfolio content (fetched live):\n" + text;
        }
      }
      const { system, user } = buildResumeCourtPrompt({
        resumeText: b.resumeText,
        linkedinContext: p.linkedinContext || undefined,
        githubContext: p.githubContext || undefined,
        portfolioContext: portfolioContext || undefined,
        jobDescription: b.jobDescription || undefined,
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateResumeCourtResult(out),
    isEmpty: (r) => r.claims.length === 0,
    emptyMessage: "The court session came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
