/**
 * JD Red Flag Scanner.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { JdRedFlagRequestBody } from "@/lib/types";
import { buildJdRedFlagPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateJdRedFlagResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: JdRedFlagRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.jobDescription, "Job description", 10000); if (e) return e; }
      { const v = b.companyName; if (typeof v === "string" && v.length > 200) return "Company name is too long."; }
      { const v = b.role; if (typeof v === "string" && v.length > 200) return "Role is too long."; }
      { const v = b.salary; if (typeof v === "string" && v.length > 200) return "Salary is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildJdRedFlagPrompt({ jobDescription: b.jobDescription.trim(),
        companyName: b.companyName?.trim() || undefined, role: b.role?.trim() || undefined,
        salary: b.salary?.trim() || undefined, });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateJdRedFlagResult(out),
    isEmpty: (r) => r.categories.vague.length === 0 && r.categories.overloaded.length === 0 && r.categories.missing.length === 0 && r.categories.concern.length === 0 && r.goodSignals.length === 0,
    emptyMessage: "The scan came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
