// Browser helper for the optional LLM refinement pass. Posts the resume text to
// the hidden profile-extract preset and re-derives confidence locally, so a
// tampered or buggy response can never inject a confidence value.
import type { RunMeta } from "../engine/types";
import type { AiRequestConfig } from "../types";
import { contentHash } from "../retrieval/fusion";
import { computeConfidence } from "./confidence";
import { StructuredProfileSchema, type ExtractionResult } from "./schema";

export const REFINE_MAX_CHARS = 11000;

export async function refineProfile(
  text: string,
  config: AiRequestConfig | undefined,
  signal?: AbortSignal,
): Promise<{ result: ExtractionResult; meta: RunMeta }> {
  if (text.length > REFINE_MAX_CHARS) {
    throw new Error(`The resume is too long to refine (limit ${REFINE_MAX_CHARS.toLocaleString("en-US")} characters).`);
  }
  const res = await fetch("/api/run/profile-extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: { resumeText: text }, config }),
    signal,
  });
  let json: { data?: { profile?: unknown; warnings?: unknown }; meta?: RunMeta; error?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || !json || typeof json.error === "string" || !json.data || !json.meta) {
    throw new Error(json?.error || "Something went wrong.");
  }
  const parsed = StructuredProfileSchema.safeParse(json.data.profile);
  if (!parsed.success) throw new Error("The refinement returned a profile in an unexpected shape.");
  const warnings = Array.isArray(json.data.warnings) ? json.data.warnings.filter((w): w is string => typeof w === "string") : [];
  return {
    result: {
      profile: parsed.data,
      confidence: computeConfidence(parsed.data, text),
      method: "refined",
      sourceHash: contentHash(text),
      warnings,
    },
    meta: json.meta,
  };
}
