import type {
  AnalysisResult,
  AtsCheckResult,
  AtsFormatItem,
  AtsFormatStatus,
  AtsPartialMatch,
  AtsRiskLevel,
  BulletRewrite,
  BuriedGold,
  NpcPhrase,
  ResumeRoastResult,
  ResumeRewriteResult,
  ResumeFixResult,
  ResumeIssue,
  IssueSeverity,
  BulletFixResult,
  BulletScore,
  ResumeSection,
  ResumeChange,
  RoastRiskLevel,
  BossDifficulty,
  CapClaim,
  CapVerdict,
  CorporateYappingResult,
  DeluluCheckResult,
  DeluluVerdict,
  RealityComparison,
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
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

const VERDICTS: Verdict[] = [
  "APPLY",
  "BORDERLINE",
  "LONG SHOT",
  "ABSOLUTELY COOKED",
];
const EVIDENCE_LEVELS: EvidenceLevel[] = ["strong", "weak", "none"];
const EVIDENCE_SOURCES: EvidenceSource[] = [
  "resume",
  "linkedin",
  "github",
  "inferred",
];
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
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
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
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
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
    const description =
      typeof obj.description === "string" ? obj.description.trim() : "";
    if (!description) continue;
    const category = CHANGE_CATEGORIES.includes(obj.category as ChangeCategory)
      ? (obj.category as ChangeCategory)
      : "wording";
    const section =
      typeof obj.section === "string" && obj.section.trim()
        ? obj.section.trim()
        : undefined;
    entries.push(
      section ? { category, description, section } : { category, description },
    );
  }
  return entries;
}

/**
 * Validate the resume optimizer's JSON output. Missing or malformed fields
 * are replaced with safe defaults so the UI never crashes on bad model output.
 */
export function validateResumeOptimization(
  raw: unknown,
): ResumeOptimizationResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
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
    const companySaid =
      typeof obj.companySaid === "string" ? obj.companySaid.trim() : "";
    const theyProbablyMean =
      typeof obj.theyProbablyMean === "string"
        ? obj.theyProbablyMean.trim()
        : "";
    const iLoveEmploymentSays =
      typeof obj.iLoveEmploymentSays === "string"
        ? obj.iLoveEmploymentSays.trim()
        : "";
    // All three parts must be present and non-empty
    if (!companySaid || !theyProbablyMean || !iLoveEmploymentSays) continue;
    const category = YAPPING_CATEGORIES.includes(
      obj.category as YappingCategory,
    )
      ? (obj.category as YappingCategory)
      : "corporate_yapping";
    entries.push({
      category,
      companySaid,
      theyProbablyMean,
      iLoveEmploymentSays,
    });
  }
  return entries;
}

/**
 * Validate the translator's JSON output. Missing or malformed entries are
 * dropped; invalid categories fall back to corporate_yapping.
 */
export function validateYapping(raw: unknown): CorporateYappingResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    translations: safeYappingEntries(obj.translations),
    yappingScore: clampScore(obj.yappingScore),
  };
}

// ─── Recruiter Simulator & Cap Detector validation ─────────────────────────

const RISK_LEVELS: RiskLevel[] = ["Low", "Medium", "High"];
const CAP_VERDICTS: CapVerdict[] = ["green", "yellow", "red"];

function validateRecruiterSimulation(raw: unknown): RecruiterSimulation {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
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
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    claims: safeCapClaims(obj.claims),
  };
}

// ─── Interview Boss Fight validation ───────────────────────────────────────

const BOSS_DIFFICULTIES: BossDifficulty[] = [
  "EASY",
  "MEDIUM",
  "HARD",
  "FINAL_BOSS",
];

function safeInterviewQuestions(value: unknown): InterviewQuestion[] {
  if (!Array.isArray(value)) return [];
  const questions: InterviewQuestion[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const question = safeString(obj.question);
    if (!question) continue;
    const difficulty = BOSS_DIFFICULTIES.includes(
      obj.difficulty as BossDifficulty,
    )
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
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    questions: safeInterviewQuestions(obj.questions),
  };
}

// ─── ATS Checker validation ────────────────────────────────────────────────

const ATS_RISKS: AtsRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];
const ATS_FORMAT_STATUSES: AtsFormatStatus[] = ["pass", "warning", "fail"];

function safeAtsFormatItems(value: unknown): AtsFormatItem[] {
  if (!Array.isArray(value)) return [];
  const items: AtsFormatItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const check = safeString(obj.check);
    if (!check) continue;
    items.push({
      check,
      status: ATS_FORMAT_STATUSES.includes(obj.status as AtsFormatStatus)
        ? (obj.status as AtsFormatStatus)
        : "warning",
      detail: safeString(obj.detail),
    });
  }
  return items;
}

function safeAtsPartialMatches(value: unknown): AtsPartialMatch[] {
  if (!Array.isArray(value)) return [];
  const items: AtsPartialMatch[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const concept = safeString(obj.concept);
    if (!concept) continue;
    items.push({ concept, evidence: safeString(obj.evidence) });
  }
  return items;
}

/**
 * Validate ATS check output from an LLM. Mirrors validateAnalysisResult's
 * defensive approach so a malformed model response never crashes the route.
 */
export function validateAtsCheckResult(raw: unknown): AtsCheckResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    atsScore: clampScore(obj.atsScore),
    riskLevel: ATS_RISKS.includes(obj.riskLevel as AtsRiskLevel)
      ? (obj.riskLevel as AtsRiskLevel)
      : "MEDIUM",
    formatChecks: safeAtsFormatItems(obj.formatChecks),
    matchedKeywords: safeStringArray(obj.matchedKeywords),
    missingKeywords: safeStringArray(obj.missingKeywords),
    partialMatches: safeAtsPartialMatches(obj.partialMatches),
    requirementsNoEvidence: safeStringArray(obj.requirementsNoEvidence),
    topFixes: safeStringArray(obj.topFixes),
    bossFightComment: safeString(obj.bossFightComment),
    strongResumeNote: safeString(obj.strongResumeNote) || undefined,
  };
}

// ─── Resume Roast validation ───────────────────────────────────────────────

const ROAST_RISKS: RoastRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

function safeNpcPhrases(value: unknown): NpcPhrase[] {
  if (!Array.isArray(value)) return [];
  const items: NpcPhrase[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const phrase = safeString(obj.phrase);
    if (!phrase) continue;
    items.push({ phrase, why: safeString(obj.why) });
  }
  return items;
}

function safeBuriedGold(value: unknown): BuriedGold[] {
  if (!Array.isArray(value)) return [];
  const items: BuriedGold[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const item = safeString(obj.item);
    if (!item) continue;
    items.push({ item, reason: safeString(obj.reason) });
  }
  return items;
}

function safeBulletRewrites(value: unknown): BulletRewrite[] {
  if (!Array.isArray(value)) return [];
  const items: BulletRewrite[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const original = safeString(obj.original);
    const better = safeString(obj.better);
    if (!original || !better) continue;
    items.push({ original, better });
  }
  return items;
}

/**
 * Validate resume roast output from an LLM. Mirrors the defensive approach of
 * validateAnalysisResult so a malformed model response never crashes the route.
 */
export function validateRoastResult(raw: unknown): ResumeRoastResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    roastLevel: clampScore(obj.roastLevel),
    verdict: safeString(obj.verdict),
    biggestL: safeString(obj.biggestL),
    biggestW: safeString(obj.biggestW),
    npcContent: safeNpcPhrases(obj.npcContent),
    buriedGold: safeBuriedGold(obj.buriedGold),
    recruiterSkipRisk: ROAST_RISKS.includes(
      obj.recruiterSkipRisk as RoastRiskLevel,
    )
      ? (obj.recruiterSkipRisk as RoastRiskLevel)
      : "MEDIUM",
    recruiterSkipWhy: safeString(obj.recruiterSkipWhy),
    bulletsThatNeedHelp: safeBulletRewrites(obj.bulletsThatNeedHelp),
    roast: safeStringArray(obj.roast),
    topFixes: safeStringArray(obj.topFixes),
  };
}

// ─── Delulu Detector validation ────────────────────────────────────────────

const DELULU_VERDICTS: DeluluVerdict[] = [
  "APPLY",
  "APPLY_AS_A_STRETCH",
  "BUILD_MORE_EVIDENCE_FIRST",
  "LOW_PROBABILITY",
];

function safeRealityComparison(raw: unknown): RealityComparison {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    experienceRequired: safeString(obj.experienceRequired),
    experienceYouHave: safeString(obj.experienceYouHave),
    coreSkillsRequired: safeString(obj.coreSkillsRequired),
    coreSkillsYouDemonstrate: safeString(obj.coreSkillsYouDemonstrate),
    preferredQualifications: safeString(obj.preferredQualifications),
    evidenceAvailable: safeString(obj.evidenceAvailable),
  };
}

/**
 * Validate delulu check output from an LLM. Mirrors the defensive approach of
 * validateAnalysisResult so a malformed model response never crashes the route.
 */
export function validateDeluluCheckResult(raw: unknown): DeluluCheckResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    deluluScore: clampScore(obj.deluluScore),
    interpretation: safeString(obj.interpretation),
    realityCheck: safeRealityComparison(obj.realityCheck),
    whatYouHave: safeStringArray(obj.whatYouHave),
    whatTheyWant: safeStringArray(obj.whatTheyWant),
    whatsMissing: safeStringArray(obj.whatsMissing),
    whatTransfers: safeStringArray(obj.whatTransfers),
    whatIsActuallyFatal: safeStringArray(obj.whatIsActuallyFatal),
    verdict: DELULU_VERDICTS.includes(obj.verdict as DeluluVerdict)
      ? (obj.verdict as DeluluVerdict)
      : "BUILD_MORE_EVIDENCE_FIRST",
    howToBecomeLessDelulu: safeStringArray(obj.howToBecomeLessDelulu),
    finalLine: safeString(obj.finalLine),
  };
}

// ─── Resume Rewriter validation ────────────────────────────────────────────

function safeResumeSections(value: unknown): ResumeSection[] {
  if (!Array.isArray(value)) return [];
  const items: ResumeSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const title = safeString(obj.title);
    if (!title) continue;
    items.push({ title, content: safeString(obj.content) });
  }
  return items;
}

function safeResumeChanges(value: unknown): ResumeChange[] {
  if (!Array.isArray(value)) return [];
  const items: ResumeChange[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const section = safeString(obj.section);
    const original = safeString(obj.original);
    const optimized = safeString(obj.optimized);
    if (!section || !original || !optimized) continue;
    items.push({
      section,
      original,
      optimized,
      reason: safeString(obj.reason),
    });
  }
  return items;
}

/**
 * Validate resume rewrite output from an LLM. Mirrors the defensive approach of
 * validateAnalysisResult so a malformed model response never crashes the route.
 */
export function validateRewriteResult(raw: unknown): ResumeRewriteResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    truthFilter: "ON",
    originalResume: safeResumeSections(obj.originalResume),
    optimizedResume: safeResumeSections(obj.optimizedResume),
    changes: safeResumeChanges(obj.changes),
    keywordCoverage: {
      matched: safeStringArray(
        obj.keywordCoverage && typeof obj.keywordCoverage === "object"
          ? (obj.keywordCoverage as Record<string, unknown>).matched
          : [],
      ),
      missing: safeStringArray(
        obj.keywordCoverage && typeof obj.keywordCoverage === "object"
          ? (obj.keywordCoverage as Record<string, unknown>).missing
          : [],
      ),
    },
    desperationLevel: Math.min(
      5,
      Math.max(0, Math.round(Number(obj.desperationLevel) || 0)),
    ),
    professionalNote: safeString(obj.professionalNote),
  };
}

// ─── Resume Fixer validation ───────────────────────────────────────────────

function safeIssues(value: unknown): ResumeIssue[] {
  if (!Array.isArray(value)) return [];
  const items: ResumeIssue[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const category = safeString(obj.category);
    const severity = safeString(obj.severity) as IssueSeverity;
    const problem = safeString(obj.problem);
    const current = safeString(obj.current);
    const fix = safeString(obj.fix);
    if (!category || !problem || !current || !fix) continue;
    items.push({
      category,
      severity: ["CRITICAL", "WARNING", "OPTIONAL"].includes(severity)
        ? severity
        : "WARNING",
      problem,
      current,
      fix,
      why: safeString(obj.why),
    });
  }
  return items;
}

/**
 * Validate resume fix output from an LLM. Mirrors the defensive approach of
 * validateAnalysisResult so a malformed model response never crashes the route.
 */
export function validateFixResult(raw: unknown): ResumeFixResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    healthScore: clampScore(obj.healthScore),
    issues: safeIssues(obj.issues),
    quickFix: safeStringArray(obj.quickFix).slice(0, 3),
    personalityCopy:
      safeString(obj.personalityCopy) ||
      "Your resume isn't doomed. It just has a few skill issues.",
  };

// ─── Bullet Point Fixer validation ─────────────────────────────────────────

function safeBulletScore(raw: unknown): BulletScore {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    clarity: clampScore(obj.clarity),
    specificity: clampScore(obj.specificity),
    impact: clampScore(obj.impact),
    relevance: clampScore(obj.relevance),
  };
}

/**
 * Validate bullet fix output from an LLM. Mirrors the defensive approach of
 * validateAnalysisResult so a malformed model response never crashes the route.
 */
export function validateFixResult(raw: unknown): BulletFixResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const score = safeBulletScore(obj.bulletScore);
  const overall =
    clampScore(obj.overallScore) ||
    Math.round(
      (score.clarity + score.specificity + score.impact + score.relevance) /
        4,
    );
  return {
    original: safeString(obj.original),
    improved: safeString(obj.improved),
    stronger: safeString(obj.stronger),
    whyBetter: safeStringArray(obj.whyBetter).slice(0, 3),
    metricPlaceholder: safeString(obj.metricPlaceholder) || undefined,
    bulletScore: score,
    overallScore: overall,
    roast: safeString(obj.roast) || "Current version: giving NPC.",
  };
}