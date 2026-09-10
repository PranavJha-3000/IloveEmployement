/**
 * Recruiter Simulator.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { RecruiterSimulationRequestBody } from "@/lib/types";
import { buildRecruiterSimulatorPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateRecruiterSimulationResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: RecruiterSimulationRequestBody;
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
      { const v = b.role; if (typeof v === "string" && v.length > 200) return "Role is too long."; }
      { const v = b.company; if (typeof v === "string" && v.length > 200) return "Company is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildRecruiterSimulatorPrompt({
        resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),
        role: b.role?.trim() || undefined, company: b.company?.trim() || undefined,
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateRecruiterSimulationResult(out),
    isEmpty: (r) => r.timeline.length === 0,
    emptyMessage: "The recruiter simulation came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
