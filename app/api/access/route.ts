/** GET /api/access — whether the free tier is available, so the UI can skip the key step. */

import { NextResponse } from "next/server";
import { freeTierInfo } from "@/lib/engine/access";

export async function GET() {
  const { enabled, model, dailyLimit } = freeTierInfo();
  return NextResponse.json({ freeTier: enabled, model, dailyLimit });
}
