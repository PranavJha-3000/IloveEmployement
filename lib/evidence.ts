/**
 * Evidence Engine — evidence-based analysis across resume, LinkedIn, and GitHub.
 *
 * Classifies evidence for each JD requirement using a 4-tier scale:
 *   STRONG    → requirement explicitly demonstrated with concrete evidence
 *   PARTIAL   → related capability shown, but not a direct match
 *   MISSING   → capability genuinely absent from all provided materials
 *   UNVERIFIED → URL provided but content could not be fetched/inspected
 *
 * Design principle: keyword presence alone is NOT evidence. The engine
 * pre-processes sources and post-validates LLM output; it never claims
 * absence from one source means the skill doesn't exist.
 */

export type EvidenceStrength = "STRONG" | "PARTIAL" | "MISSING" | "UNVERIFIED";

export interface EvidenceSource {
  type: "resume" | "linkedin" | "github" | "portfolio";
  content: string;
}

export interface RequirementEvidence {
  requirement: string;
  importance: "must-have" | "nice-to-have" | "specialized";
  classification: EvidenceStrength;
  resumeEvidence: string;
  linkedinEvidence: string;
  githubEvidence: string;
  reasoning: string;
}
const VALID_IMPORTANCE: Required<RequirementEvidence>["importance"][] = ["must-have", "nice-to-have", "specialized"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeString(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  return fallback;
}

function safeImportance(val: unknown): Required<RequirementEvidence>["importance"] {
  const v = safeString(val).toLowerCase() as Required<RequirementEvidence>["importance"];
  return VALID_IMPORTANCE.includes(v) ? v : "nice-to-have";
}
