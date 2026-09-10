/**
 * JD Translator.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { CorporateYappingRequest } from "@/lib/types";
import { buildYappingPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateYapping } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: CorporateYappingRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.jobDescription, "Job description", 15000); if (e) return e; }
      { const v = b.companyName; if (typeof v === "string" && v.length > 200) return "Company name is too long."; }
      { const v = b.roleTitle; if (typeof v === "string" && v.length > 200) return "Role title is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildYappingPrompt({ jobDescription: b.jobDescription,
        companyName: b.companyName?.trim() || undefined, roleTitle: b.roleTitle?.trim() || undefined, });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateYapping(out),
    isEmpty: (r) => r.translations.length === 0,
    emptyMessage: "The translator returned no usable entries. Try a longer JD or a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
