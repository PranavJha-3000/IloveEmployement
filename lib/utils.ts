import type {
  AnalysisResult,
  BossDifficulty,
  CapClaim,
  CapVerdict,
  CorporateYappingResult,
  ChangeCategory,
  ChangeEntry,
  EvidenceItem,
  EvidenceLevel,
  EvidenceSource,
  ImportanceLevel,
  InterviewBossFight,
  InterviewQuestion,
  RecruiterSimulation,
  ResumeCapDetector,
  ResumeOptimizationResult,
  RiskLevel,
  YappingCategory,
  YappingTranslation,
  Verdict,
} from "./types";

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("linkedin.com");
  } catch {
    return false;
  }
}

export function isGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("github.com");
  } catch {
    return false;
  }
}

/**
 * Fetch public profile content from LinkedIn/GitHub and return plain text.
 * LinkedIn aggressively blocks bots - we do best-effort and gracefully degrade.
 */
export async function fetchProfileText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    return extractTextFromHtml(html);
  } catch {
    return null;
  }
}

/** Very lightweight HTML to text extraction (no cheerio needed) */
export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

/** Safely parse JSON from an LLM response that may have markdown fences */
export function extractJsonFromLlmResponse(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // noop
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // noop
    }
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      // noop
    }
  }

  throw new Error("AI did not return valid JSON. Try a different model.");
}

// ─── Schema validation ──────────────────────────────────────────────────────

const VERDICTS: Verdict[] = ["APPLY", "BORDERLINE", "LONG SHOT", "ABSOLUTELY COOKED"];
const EVIDENCE_LEVELS: EvidenceLevel[] = ["strong", "weak", "none"];
const EVIDENCE_SOURCES: EvidenceSource[] = ["resume", "linkedin", "github", "inferred"];
const IMPORTANCE_LEVELS: ImportanceLevel[] = ["high", "medium", "low"];

function clampScore(value: unknown): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function safeEvidenceItems(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  const items: EvidenceItem[] = [];
  for (const raw of value) {
    if (typeof raw === "string") {
      const text = raw.trim();
      if (text) items.push({ text, evidence: "weak" });
      continue;
    }
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const text = safeString(obj.text).trim();
      if (!text) continue;
      const evidence = EVIDENCE_LEVELS.includes(obj.evidence as EvidenceLevel)
        ? (obj.evidence as EvidenceLevel)
        : "weak";
      const item: EvidenceItem = { text, evidence };
      if (EVIDENCE_SOURCES.includes(obj.source as EvidenceSource)) {
        item.source = obj.source as EvidenceSource;
      }
      if (IMPORTANCE_LEVELS.includes(obj.importance as ImportanceLevel)) {
        item.importance = obj.importance as ImportanceLevel;
      }
      const area = safeString(obj.area).trim();
      if (area) item.area = area;
      items.push(item);
    }
  }
  return items;
}

/**
 * Validate the AI's JSON output against the AnalysisResult schema.
 * Missing or malformed fields are replaced with safe defaults so the UI
 * never crashes on malformed model output.
 */
export function validateAnalysisResult(raw: unknown): AnalysisResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const verdict = VERDICTS.includes(obj.verdict as Verdict)
    ? (obj.verdict as Verdict)
    : "BORDERLINE";

  return {
    overallScore: clampScore(obj.overallScore),
    selectionChance: clampScore(obj.selectionChance),
    selectionChanceExplanation: safeString(obj.selectionChanceExplanation),
    verdict,
    summary: safeString(obj.summary),
    strengths: safeEvidenceItems(obj.strengths),
    weaknesses: safeEvidenceItems(obj.weaknesses),
    fatalGaps: safeEvidenceItems(obj.fatalGaps),
    missingSkills: safeStringArray(obj.missingSkills),
    matchedSkills: safeStringArray(obj.matchedSkills),
    atsScore: clampScore(obj.atsScore),
    experienceScore: clampScore(obj.experienceScore),
    projectScore: clampScore(obj.projectScore),
    evidenceScore: clampScore(obj.evidenceScore),
    resumeProblems: safeStringArray(obj.resumeProblems),
    resumeChanges: safeStringArray(obj.resumeChanges),
    applicationStrategy: safeStringArray(obj.applicationStrategy),
    interviewRisks: safeStringArray(obj.interviewRisks),
    trollComment: safeString(obj.trollComment),
    recruiterSimulation: validateRecruiterSimulation(obj.recruiterSimulation),
    capDetector: validateCapDetector(obj.capDetector),
    interviewBossFight: validateInterviewBossFight(obj.interviewBossFight),
  };
}


// ─── Resume optimization validation ────────────────────────────────────────

const CHANGE_CATEGORIES: ChangeCategory[] = [
  "structure",
  "wording",
  "keywords",
  "emphasis",
  "clarity",
  "relevance",
];

function safeChangeEntries(value: unknown): ChangeEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: ChangeEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const description = typeof obj.description === "string" ? obj.description.trim() : "";
    if (!description) continue;
    const category = CHANGE_CATEGORIES.includes(obj.category as ChangeCategory)
      ? (obj.category as ChangeCategory)
      : "wording";
    const section =
      typeof obj.section === "string" && obj.section.trim() ? obj.section.trim() : undefined;
    entries.push(section ? { category, description, section } : { category, description });
  }
  return entries;
}

/**
 * Validate the resume optimizer's JSON output. Missing or malformed fields
 * are replaced with safe defaults so the UI never crashes on bad model output.
 */
export function validateResumeOptimization(raw: unknown): ResumeOptimizationResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const optimizedResume = safeString(obj.optimizedResume);
  return {
    optimizedResume,
    whatChanged: safeChangeEntries(obj.whatChanged),
  };
}


// ─── Corporate yapping translator validation ───────────────────────────────

const YAPPING_CATEGORIES: YappingCategory[] = [
  "what_they_want",
  "required_skills",
  "nice_to_have",
  "likely_interview_topics",
  "potential_red_flags",
  "corporate_yapping",
];

function safeYappingEntries(value: unknown): YappingTranslation[] {
  if (!Array.isArray(value)) return [];
  const entries: YappingTranslation[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const companySaid = typeof obj.companySaid === "string" ? obj.companySaid.trim() : "";
    const theyProbablyMean =
      typeof obj.theyProbablyMean === "string" ? obj.theyProbablyMean.trim() : "";
    const iLoveEmploymentSays =
      typeof obj.iLoveEmploymentSays === "string" ? obj.iLoveEmploymentSays.trim() : "";
    // All three parts must be present and non-empty
    if (!companySaid || !theyProbablyMean || !iLoveEmploymentSays) continue;
    const category = YAPPING_CATEGORIES.includes(obj.category as YappingCategory)
      ? (obj.category as YappingCategory)
      : "corporate_yapping";
    entries.push({ category, companySaid, theyProbablyMean, iLoveEmploymentSays });
  }
  return entries;
}

/**
 * Validate the translator's JSON output. Missing or malformed entries are
 * dropped; invalid categories fall back to corporate_yapping.
 */
export function validateYapping(raw: unknown): CorporateYappingResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    translations: safeYappingEntries(obj.translations),
  };
}



// ─── Recruiter Simulator & Cap Detector validation ─────────────────────────

const RISK_LEVELS: RiskLevel[] = ["Low", "Medium", "High"];
const CAP_VERDICTS: CapVerdict[] = ["green", "yellow", "red"];

function validateRecruiterSimulation(raw: unknown): RecruiterSimulation {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const riskObj =
    obj.tabClosingRisk && typeof obj.tabClosingRisk === "object"
      ? (obj.tabClosingRisk as Record<string, unknown>)
      : {};
  const level = RISK_LEVELS.includes(riskObj.level as RiskLevel)
    ? (riskObj.level as RiskLevel)
    : "Medium";
  return {
    firstFiveSeconds: safeString(obj.firstFiveSeconds),
    fiveToFifteenSeconds: safeString(obj.fiveToFifteenSeconds),
    fifteenToThirtySeconds: safeString(obj.fifteenToThirtySeconds),
    tabClosingRisk: {
      level,
      explanation: safeString(riskObj.explanation),
    },
  };
}

function safeCapClaims(value: unknown): CapClaim[] {
  if (!Array.isArray(value)) return [];
  const claims: CapClaim[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const claim = safeString(obj.claim);
    const note = safeString(obj.note);
    if (!claim) continue;
    const verdict = CAP_VERDICTS.includes(obj.verdict as CapVerdict)
      ? (obj.verdict as CapVerdict)
      : "yellow";
    claims.push({ claim, verdict, note });
  }
  return claims;
}

function validateCapDetector(raw: unknown): ResumeCapDetector {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    claims: safeCapClaims(obj.claims),
  };
}



// ─── Interview Boss Fight validation ───────────────────────────────────────

const BOSS_DIFFICULTIES: BossDifficulty[] = ["EASY", "MEDIUM", "HARD", "FINAL_BOSS"];

function safeInterviewQuestions(value: unknown): InterviewQuestion[] {
  if (!Array.isArray(value)) return [];
  const questions: InterviewQuestion[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const question = safeString(obj.question);
    if (!question) continue;
    const difficulty = BOSS_DIFFICULTIES.includes(obj.difficulty as BossDifficulty)
      ? (obj.difficulty as BossDifficulty)
      : "MEDIUM";
    const q: InterviewQuestion = {
      question,
      whyTheyreAsking: safeString(obj.whyTheyreAsking),
      yourRisk: safeString(obj.yourRisk),
      howToAnswer: safeString(obj.howToAnswer),
      difficulty,
    };
    // bossWarning only attaches to FINAL_BOSS
    if (difficulty === "FINAL_BOSS" && safeString(obj.bossWarning)) {
      q.bossWarning = safeString(obj.bossWarning);
    }
    questions.push(q);
  }
  return questions;
}

function validateInterviewBossFight(raw: unknown): InterviewBossFight {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    questions: safeInterviewQuestions(obj.questions),
  };
}
