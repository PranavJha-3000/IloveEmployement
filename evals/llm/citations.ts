// ─── Citation-unit extraction ────────────────────────────────────────────────
// A unit is one (cited item, chunk id) pair from the RAW final model output,
// before the finalizers scrub unknown ids, so fabricated ids stay visible.
// Definition: evals/llm/RUBRIC.md "Citation units".

import type { CallRecord } from "./recordingModel";

export interface CitationUnit {
  /** 1-based, document order. */
  index: number;
  path: string;
  chunkId: string;
  claim: string;
  /** Deterministic: was the id one of the chunk ids supplied to the generator? */
  idValid: boolean;
}

const CLAIM_MAX = 600;
const ID_KEYS = new Set(["chunkIds", "evidencedBy"]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** JSON of the object's top-level string fields, id arrays removed, capped at 600 chars. */
function claimOf(obj: Record<string, unknown>): string {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = v;
  }
  return JSON.stringify(fields).slice(0, CLAIM_MAX);
}

export function extractCitationUnits(raw: unknown, validIds: Set<string>): CitationUnit[] {
  if (raw === null || raw === undefined) return [];
  const units: CitationUnit[] = [];
  const seen = new Set<string>();

  const push = (path: string, chunkId: unknown, claim: string) => {
    if (typeof chunkId !== "string") return;
    const key = `${path}\u0000${chunkId}`;
    if (seen.has(key)) return;
    seen.add(key);
    units.push({ index: units.length + 1, path, chunkId, claim: claim.slice(0, CLAIM_MAX), idValid: validIds.has(chunkId) });
  };

  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (!isRecord(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "citations" && Array.isArray(value)) {
        value.forEach((c, i) => {
          if (isRecord(c)) push(`${path ? `${path}.` : ""}citations[${i}]`, c.chunkId, typeof c.claim === "string" ? c.claim : "");
        });
      } else if (ID_KEYS.has(key) && Array.isArray(value)) {
        const claim = claimOf(node);
        for (const id of value) push(path || "$", id, claim);
      } else {
        walk(value, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(raw, "");
  return units;
}

const FINAL_ROLES = new Set(["generate", "revise", "fallback-json"]);

/** Response text of the last generation call that produced a draft (reviewer and judge calls excluded). */
export function finalDraftText(transcript: CallRecord[]): string | null {
  for (let i = transcript.length - 1; i >= 0; i--) {
    const r = transcript[i];
    if (r.purpose === "generation" && FINAL_ROLES.has(r.role) && r.responseText && !r.error) return r.responseText;
  }
  return null;
}
