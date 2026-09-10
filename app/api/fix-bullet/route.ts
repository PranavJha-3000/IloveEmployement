/**
 * Bullet Point Fixer.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { BulletFixRequestBody } from "@/lib/types";
import { buildBulletFixPrompt } from "@/lib/prompts";
import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";
import { validateFixResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: BulletFixRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await standardAIHandler(body, {
    validateInput: (b) => {
      { const c = validateConfig(b.config); if (c) return c; }
      { const e = validateNonEmpty(b.bullet, "A bullet point", 2000); if (e) return e; }
      { const v = b.jobDescription; if (typeof v === "string" && v.length > 10000) return "Job description is too long."; }
      return null;
    },
    buildPrompts: async (b) => {
      const { system, user } = buildBulletFixPrompt({ bullet: b.bullet,
        jobDescription: b.jobDescription?.trim() || undefined,
        roleContext: b.roleContext?.trim() || undefined,
        technology: b.technology?.trim() || undefined,
        desperationLevel: b.desperationLevel,
      });
      return { system, prompt: user };
    },
    validateOutput: (out) => validateFixResult(out),
    isEmpty: (r) => !r.improved,
    emptyMessage: "The bullet fix came back empty. Retry, or switch to a different model.",
    temperature: 0.6,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }
  return NextResponse.json(result.data);
}
