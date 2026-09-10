/**
 * Employment Aura.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { EmploymentAuraRequestBody } from "@/lib/types";
import { buildEmploymentAuraPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateEmploymentAuraResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: EmploymentAuraRequestBody;
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
      const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });
      const { system, user } = buildEmploymentAuraPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,
        linkedinContext: p.linkedinContext || undefined, githubContext: p.githubContext || undefined, });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateEmploymentAuraResult(out),
    isEmpty: (r) => !r.auraType,
    emptyMessage: "The aura came back empty. Retry, or switch to a different model.",
    temperature: 0.7,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
