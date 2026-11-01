/**
 * POST /api/agent/step: one validated, budgeted, gated agent step.
 * The body is the whole run state and may carry a BYOK key, so nothing here logs it.
 */

import { NextResponse, type NextRequest } from "next/server";
import { agentStep } from "@/lib/agent/step";
import { clientIp } from "@/lib/engine/access";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { status, body } = await agentStep(json, clientIp(req.headers));
  return NextResponse.json(body, { status });
}
