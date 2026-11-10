/**
 * Single entry point for every engine preset: POST /api/run/<preset-id>.
 * The preset registry decides fields, knowledge and schema; lib/engine/run.ts
 * does access, screening, context assembly, generation and grounding.
 */

import { NextResponse, type NextRequest } from "next/server";
import { identify } from "@/lib/engine/access";
import { runPreset } from "@/lib/engine/run";
import type { RunRequestBody } from "@/lib/engine/types";
import { getPresetById } from "@/lib/presets";

// Reviewed presets make up to three model calls (draft, review, revise), each capped at 55 s.
export const maxDuration = 180;

export async function POST(req: NextRequest, { params }: { params: Promise<{ preset: string }> }) {
  const { preset: presetId } = await params;
  const preset = getPresetById(presetId);
  if (!preset) return NextResponse.json({ error: "Unknown tool." }, { status: 404 });

  let body: RunRequestBody;
  try {
    body = (await req.json()) as RunRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const outcome = await runPreset(preset, body, await identify(req.headers));
  if (!outcome.ok) return NextResponse.json({ error: outcome.message }, { status: outcome.status });
  return NextResponse.json(outcome.result);
}
