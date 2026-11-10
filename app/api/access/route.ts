/** GET /api/access — free-tier availability and, for a signed-in caller, today's remaining runs. */

import { NextResponse, type NextRequest } from "next/server";
import { freeTierInfo, identify } from "@/lib/engine/access";
import { authConfigured, peekRuns } from "@/lib/auth/supabase";

export async function GET(req: NextRequest) {
  const { enabled, model, dailyLimit } = freeTierInfo();
  const needsSignIn = authConfigured();
  const id = needsSignIn ? await identify(req.headers) : null;
  const remaining = id ? Math.max(0, dailyLimit - (await peekRuns(id))) : null;
  return NextResponse.json({ freeTier: enabled, model, dailyLimit, needsSignIn, signedIn: Boolean(id), remaining });
}
