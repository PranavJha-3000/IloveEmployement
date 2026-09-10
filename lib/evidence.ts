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

export interface EvidenceMap {
  requirements: RequirementEvidence[];
  overallStrength: number; // 0-100 composite of strong evidence
  strongCount: number;
  partialCount: number;
  missingCount: number;
  unverifiedCount: number;
  summary: string;
}

const VALID_STRENGTHS: EvidenceStrength[] = ["STRONG", "PARTIAL", "MISSING", "UNVERIFIED"];
const VALID_IMPORTANCE: Required<RequirementEvidence>["importance"][] = ["must-have", "nice-to-have", "specialized"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeString(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  return fallback;
}

function safeStrength(val: unknown): EvidenceStrength {
  const v = safeString(val).toUpperCase() as EvidenceStrength;
  return VALID_STRENGTHS.includes(v) ? v : "UNVERIFIED";
}


function safeEvidenceItem(raw: unknown): RequirementEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const requirement = safeString(obj.requirement);
  if (!requirement) return null;

  return {
    requirement,
    importance: safeImportance(obj.importance),
    classification: safeStrength(obj.classification),
    resumeEvidence: safeString(obj.resumeEvidence),
    linkedinEvidence: safeString(obj.linkedinEvidence),
    githubEvidence: safeString(obj.githubEvidence),
    reasoning: safeString(obj.reasoning),
  };
}

/**
 * Validate LLM evidence output into a typed EvidenceMap.
 * Never throws — malformed output yields a safe, empty-ish result.
 */
export function validateEvidenceMap(raw: unknown): EvidenceMap {
  if (!raw || typeof raw !== "object") {
    return {
      requirements: [],
      overallStrength: 0,
      strongCount: 0,
      partialCount: 0,
      missingCount: 0,
      unverifiedCount: 0,
      summary: "No evidence was provided by the analysis.",
    };
  }

  const obj = raw as Record<string, unknown>;

  const requirements = Array.isArray(obj.requirements)
    ? obj.requirements.map(safeEvidenceItem).filter((r): r is RequirementEvidence => r !== null)
    : [];

  const strongCount = requirements.filter((r) => r.classification === "STRONG").length;
  const partialCount = requirements.filter((r) => r.classification === "PARTIAL").length;
  const missingCount = requirements.filter((r) => r.classification === "MISSING").length;
  const unverifiedCount = requirements.filter((r) => r.classification === "UNVERIFIED").length;

  let overallStrength = 0;
  if (requirements.length > 0) {
    overallStrength = clamp(
      (strongCount * 100 + partialCount * 50 + unverifiedCount * 10) / requirements.length,
      0,
      100,
    );
  }

  return {
    requirements,
    overallStrength,
    strongCount,
    partialCount,
    missingCount,
    unverifiedCount,
    summary: safeString(obj.summary, ""),
  };
}

/**
 * Build the evidence analysis prompt section for an LLM.
 * Formats resume + LinkedIn + GitHub content as evidence sources
 * and asks the LLM to classify each requirement.
 */
export function buildEvidenceAnalysisPrompt(
  requirements: string[],
  sources: { resume?: string; linkedin?: string; github?: string },
): { system: string; user: string } {
  const system = `You are an evidence-based hiring analyst. For each requirement, classify the evidence:

- STRONG: explicitly and concretely demonstrated (named tech, specific projects, measurable outcomes, certifications)
- PARTIAL: related/adjacent capability shown (e.g. React when Vue is requested)
- MISSING: genuinely absent from all provided materials — no direct or adjacent evidence
- UNVERIFIED: source URL provided but content could not be fetched

CRITICAL: keyword presence alone is NOT evidence. Never claim absence from one source means the skill doesn't exist. Always cite specific evidence.

Output ONLY this JSON (no markdown fences):

{
  "requirements": [
    {
      "requirement": "skill",
      "importance": "must-have" | "nice-to-have" | "specialized",
      "classification": "STRONG" | "PARTIAL" | "MISSING" | "UNVERIFIED",
      "resumeEvidence": "evidence from resume, or 'not present'",
      "linkedinEvidence": "evidence from LinkedIn, or 'not provided'",
      "githubEvidence": "evidence from GitHub, or 'not provided'",
      "reasoning": "why this classification — cite specific evidence"
    }
  ],
  "overallStrength": 72,
  "summary": "2-3 sentence overall assessment of evidence quality"
}`;

  const sourceParts: string[] = [];
  if (sources.resume) sourceParts.push(`## CANDIDATE RESUME\n${sources.resume.slice(0, 20_000)}`);
  if (sources.linkedin) sourceParts.push(`## LINKEDIN PROFILE\n${sources.linkedin.slice(0, 5_000)}`);
  if (sources.github) sourceParts.push(`## GITHUB PROFILE\n${sources.github.slice(0, 5_000)}`);

  const requirementsList = requirements.map((r) => `- ${r}`).join("\n");

  const user = `${sourceParts.join("\n\n")}

## REQUIREMENTS TO EVALUATE
${requirementsList}

For each requirement, classify the evidence level. Be honest: keyword presence alone is NOT evidence. Output ONLY valid JSON matching the schema from your instructions.`;

  return { system, user };
}

function safeImportance(val: unknown): Required<RequirementEvidence>["importance"] {
  const v = safeString(val).toLowerCase() as Required<RequirementEvidence>["importance"];
  return VALID_IMPORTANCE.includes(v) ? v : "nice-to-have";
}
