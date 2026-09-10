/**
 * Resume Analyzer — flagship endpoint.
 *
 * Pipeline: Document extraction → Normalization → JD analysis → Evidence matching →
 * LLM reasoning → Validated structured output.
 *
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { AnalyzeRequestBody } from "@/lib/types";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import {
  validateConfig,
  validateNonEmpty,
  validateUrl,
  buildProfileContexts,
  callAI,
  extractJson,
  classifyAIError,
} from "@/lib/pipeline";
import { validateAnalysisResult } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ─── Input validation (shared helpers) ──
  const configError = validateConfig(body.config);
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const resumeError = validateNonEmpty(body.resumeText, "Resume", 20_000);
  if (resumeError) return NextResponse.json({ error: resumeError }, { status: 400 });

  const jdError = validateNonEmpty(body.jobDescription, "Job description", 10_000);
  if (jdError) return NextResponse.json({ error: jdError }, { status: 400 });

  const linkedinError = validateUrl(body.linkedinUrl, "LinkedIn URL");
  if (linkedinError) return NextResponse.json({ error: linkedinError }, { status: 400 });

  const githubError = validateUrl(body.githubUrl, "GitHub URL");
  if (githubError) return NextResponse.json({ error: githubError }, { status: 400 });

  // ─── Profile fetching (best-effort, never blocks) ──
  const { linkedinContext, githubContext } = await buildProfileContexts({
    linkedinUrl: body.linkedinUrl,
    githubUrl: body.githubUrl,
  });

  // ─── Build prompts ──
  const systemPrompt = buildSystemPrompt(body.desperationLevel);
  let userPrompt = buildUserPrompt(body);
  if (linkedinContext) userPrompt += `\n\n${linkedinContext}`;
  if (githubContext) userPrompt += `\n\n${githubContext}`;

  // ─── AI call (shared error handling) ──
  try {
    const rawText = await callAI(
      body.config,
      systemPrompt,
      userPrompt,
      { temperature: 0.7, timeoutMs: 55_000 },
    );

    const parsed = extractJson(rawText);
    if (parsed === null) {
      return NextResponse.json(
        { error: "The model returned a malformed response. Retry, or switch to a different model." },
        { status: 502 },
      );
    }

    const safe = validateAnalysisResult(parsed);
    return NextResponse.json(safe);
  } catch (err: unknown) {
    const info = classifyAIError(err);
    return NextResponse.json({ error: info.message }, { status: info.status });
  }
}
