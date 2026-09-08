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
  LinkedInOptimizerResult,
  LinkedInCompletenessItem,
  CoverLetterResult,
  CoverLetterTone,
  RecruiterMessageResult,
  RecruiterMessageContext,
  RecruiterMessageVariantResult,
  JdRedFlagResult,
  JdFinding,
  RedFlagLevel,
  ProceedRecommendation,
  SkillGapResult,
  RequirementRow,
  BigGap,
  TransferableSkill,
  FastestWin,
  GapClassification,
  GapImportance,
  CookedLevel,
  WinCategory,
  GitHubResumeResult,
  ProjectHighlight,
  ClaimCheck,
  ProfileQualityObservation,
  EvidenceStrength,
  ResumeTruthResult,
  ClaimAssessment,
  Contradiction,
  CleanupItem,
  ClaimVerdict,
  CleanupCategory,
  RecruiterSimulationResult,
  TimelinePhase,
  KeepReading,
  RecruiterTabRisk,
  InterviewPrepResult,
  PrepQuestion,
  QuestionCategory,
  QuestionDifficulty,
  InterviewRisk,
  BossFightSession,
  BossFightQuestion,
  BossAnswerEvaluation,
  BossVerdict,
  StarAnswerResult,
  StarSections,
  StarAssessment,
  TellMeResult,
    WeaknessResult,
  WeaknessItem,
  ClaimToDefend,
  WeaknessRisk,
  EmploymentAuraResult,
  RizzScoreResult,
  RizzVerdict,
  CookedMeterResult,
  CookedVerdict,
  CanApply,
  ResumeCourtResult,
  ResumeClaim,
  CourtVerdict,
  AtsBossFightResult,
  BossAttackCategory,
  SkillIssueResult,
  SecondaryIssue,
  FinalDiagnosis,
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

// ─── LinkedIn Optimizer validation ──────────────────────────────────────────────

function safeCompletenessItem(raw: unknown): LinkedInCompletenessItem {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status = safeString(obj.status);
  return {
    status: ["good", "weak", "missing"].includes(status) ? status as LinkedInCompletenessItem["status"] : "missing",
    note: safeString(obj.note),
  };
}

/**
 * Validate LinkedIn Optimizer output from an LLM. Defensive — a malformed response
 * never crashes the route.
 */
export function validateLinkedInOptimizerResult(raw: unknown): LinkedInOptimizerResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const completeness = obj.completeness && typeof obj.completeness === "object"
    ? (obj.completeness as Record<string, unknown>)
    : {};

  return {
    linkedinScore: clampScore(obj.linkedinScore),
    completeness: {
      score: clampScore(completeness.score),
      headline: safeCompletenessItem(completeness.headline),
      about: safeCompletenessItem(completeness.about),
      experience: safeCompletenessItem(completeness.experience),
      projects: safeCompletenessItem(completeness.projects),
      skills: safeCompletenessItem(completeness.skills),
      keywords: safeCompletenessItem(completeness.keywords),
      resumeConsistency: safeCompletenessItem(completeness.resumeConsistency),
    },
    headline: {
      current: safeString(
        obj.headline && typeof obj.headline === "object"
          ? (obj.headline as Record<string, unknown>).current
          : undefined,
      ),
      options: {
        professional: safeString(
          obj.headline && typeof obj.headline === "object"
            ? (obj.headline as Record<string, unknown>).options
              && typeof (obj.headline as Record<string, unknown>).options === "object"
              ? ((obj.headline as Record<string, unknown>).options as Record<string, unknown>).professional
              : undefined
            : undefined,
        ),
        recruiterFocused: safeString(
          obj.headline && typeof obj.headline === "object"
            ? (obj.headline as Record<string, unknown>).options
              && typeof (obj.headline as Record<string, unknown>).options === "object"
              ? ((obj.headline as Record<string, unknown>).options as Record<string, unknown>).recruiterFocused
              : undefined
            : undefined,
        ),
        personality: safeString(
          obj.headline && typeof obj.headline === "object"
            ? (obj.headline as Record<string, unknown>).options
              && typeof (obj.headline as Record<string, unknown>).options === "object"
              ? ((obj.headline as Record<string, unknown>).options as Record<string, unknown>).personality
              : undefined
            : undefined,
        ),
      },
    },
    about: {
      current: safeString(
        obj.about && typeof obj.about === "object"
          ? (obj.about as Record<string, unknown>).current
          : undefined,
      ),
      optimized: safeString(
        obj.about && typeof obj.about === "object"
          ? (obj.about as Record<string, unknown>).optimized
          : undefined,
      ),
      why: safeString(
        obj.about && typeof obj.about === "object"
          ? (obj.about as Record<string, unknown>).why
          : undefined,
      ),
    },
    experience: {
      current: safeString(
        obj.experience && typeof obj.experience === "object"
          ? (obj.experience as Record<string, unknown>).current
          : undefined,
      ),
      optimized: safeString(
        obj.experience && typeof obj.experience === "object"
          ? (obj.experience as Record<string, unknown>).optimized
          : undefined,
      ),
      why: safeString(
        obj.experience && typeof obj.experience === "object"
          ? (obj.experience as Record<string, unknown>).why
          : undefined,
      ),
    },
    skills: {
      keep: safeStringArray(
        obj.skills && typeof obj.skills === "object"
          ? (obj.skills as Record<string, unknown>).keep
          : undefined,
      ),
      add: safeStringArray(
        obj.skills && typeof obj.skills === "object"
          ? (obj.skills as Record<string, unknown>).add
          : undefined,
      ),
      remove: safeStringArray(
        obj.skills && typeof obj.skills === "object"
          ? (obj.skills as Record<string, unknown>).remove
          : undefined,
      ),
    },
    resumeConsistency: {
      contradictions: safeStringArray(
        obj.resumeConsistency && typeof obj.resumeConsistency === "object"
          ? (obj.resumeConsistency as Record<string, unknown>).contradictions
          : undefined,
      ),
      summary: safeString(
        obj.resumeConsistency && typeof obj.resumeConsistency === "object"
          ? (obj.resumeConsistency as Record<string, unknown>).summary
          : undefined,
      ),
    },
    biggestL: safeString(obj.biggestL) || "No LinkedIn content provided for analysis.",
    biggestW: safeString(obj.biggestW) || "Could not determine strongest element.",
    funnyCopy: safeString(obj.funnyCopy) || "Your LinkedIn is giving mystery.",
  };
}

// ─── Cover Letter validation ─────────────────────────────────────────────────

const COVER_LETTER_TONES: CoverLetterTone[] = [
  "professional",
  "confident",
  "direct",
  "startup",
  "short-punchy",
];

/**
 * Validate cover letter output from an LLM. Defensive — a malformed response
 * never crashes the route.
 */
export function validateCoverLetterResult(raw: unknown): CoverLetterResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const why = obj.whyThisWorks && typeof obj.whyThisWorks === "object"
    ? (obj.whyThisWorks as Record<string, unknown>)
    : {};

  const tone = safeString(obj.tone) as CoverLetterTone;

  return {
    subject: safeString(obj.subject),
    coverLetter: safeString(obj.coverLetter),
    whyThisWorks: {
      relevantExperience: safeStringArray(why.relevantExperience),
      jdRequirementsAddressed: safeStringArray(why.jdRequirementsAddressed),
      openingSpecificity: safeString(why.openingSpecificity),
      lessGeneric: safeString(why.lessGeneric),
    },
    tone: COVER_LETTER_TONES.includes(tone) ? tone : "professional",
    disclaimer: safeString(obj.disclaimer) || undefined,
  };
}

// ─── Recruiter Message validation ──────────────────────────────────────────

const RECRUITER_MESSAGE_CONTEXTS: RecruiterMessageContext[] = [
  "already-applied",
  "referral",
  "cold-outreach",
  "follow-up",
];

function safeRecruiterVariant(raw: unknown): RecruiterMessageVariantResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    message: safeString(obj.message),
    whyThisWorks: safeString(obj.whyThisWorks),
  };
}

/**
 * Validate recruiter message output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateRecruiterMessageResult(raw: unknown): RecruiterMessageResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const variants = obj.variants && typeof obj.variants === "object"
    ? (obj.variants as Record<string, unknown>)
    : {};

  const contextUsed = safeString(obj.contextUsed) as RecruiterMessageContext;

  return {
    subject: safeString(obj.subject),
    variants: {
      short: safeRecruiterVariant(variants.short),
      confident: safeRecruiterVariant(variants.confident),
      warm: safeRecruiterVariant(variants.warm),
    },
    contextUsed: RECRUITER_MESSAGE_CONTEXTS.includes(contextUsed)
      ? contextUsed
      : "cold-outreach",
    disclaimer: safeString(obj.disclaimer) || undefined,
  };
}

// ─── JD Red Flag Scanner validation ────────────────────────────────────────

const RED_FLAG_LEVELS: RedFlagLevel[] = ["LOW", "MEDIUM", "HIGH"];
const PROCEED_RECOMMENDATIONS: ProceedRecommendation[] = [
  "YES",
  "PROBABLY",
  "INVESTIGATE_FIRST",
];

function safeJdFinding(raw: unknown): JdFinding {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    phrase: safeString(obj.phrase),
    whatItCouldMean: safeString(obj.whatItCouldMean),
    whatToAsk: safeString(obj.whatToAsk),
  };
}

function safeJdFindings(raw: unknown): JdFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(safeJdFinding)
    .filter((f) => f.phrase || f.whatItCouldMean || f.whatToAsk);
}

function safeJdCategoryMap(raw: unknown): JdRedFlagResult["categories"] {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    vague: safeJdFindings(obj.vague),
    overloaded: safeJdFindings(obj.overloaded),
    missing: safeJdFindings(obj.missing),
    concern: safeJdFindings(obj.concern),
  };
}

function clampYappingScore(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Validate JD red flag output from an LLM. Defensive — a malformed response
 * never crashes the route.
 */
export function validateJdRedFlagResult(raw: unknown): JdRedFlagResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const redFlagLevel = safeString(obj.redFlagLevel).toUpperCase() as RedFlagLevel;
  const shouldProceedRaw = safeString(obj.shouldProceed)
    .toUpperCase()
    .replace(/[\s-]+/g, "_") as ProceedRecommendation;

  return {
    redFlagLevel: RED_FLAG_LEVELS.includes(redFlagLevel) ? redFlagLevel : "MEDIUM",
    categories: safeJdCategoryMap(obj.categories),
    goodSignals: safeStringArray(obj.goodSignals),
    corporateYappingScore: clampYappingScore(obj.corporateYappingScore),
    shouldProceed: PROCEED_RECOMMENDATIONS.includes(shouldProceedRaw)
      ? shouldProceedRaw
      : "PROBABLY",
    summary: safeString(obj.summary),
  };
}

// ─── Skill Gap Analyzer validation ─────────────────────────────────────────

const GAP_CLASSIFICATIONS: GapClassification[] = ["STRONG", "PARTIAL", "MISSING"];
const GAP_IMPORTANCES: GapImportance[] = ["must-have", "nice-to-have", "specialized"];
const COOKED_LEVELS: CookedLevel[] = ["LOW", "MEDIUM", "HIGH"];
const WIN_CATEGORIES: WinCategory[] = [
  "resume-positioning",
  "project-evidence",
  "portfolio-addition",
  "interview-prep",
];

function safeImportance(raw: unknown): GapImportance {
  const v = safeString(raw) as GapImportance;
  return GAP_IMPORTANCES.includes(v) ? v : "nice-to-have";
}

function safeClassification(raw: unknown): GapClassification {
  const v = safeString(raw).toUpperCase() as GapClassification;
  return GAP_CLASSIFICATIONS.includes(v) ? v : "MISSING";
}

function safeWinCategory(raw: unknown): WinCategory {
  const v = safeString(raw) as WinCategory;
  return WIN_CATEGORIES.includes(v) ? v : "interview-prep";
}

function safePriority(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function safeRequirementRow(raw: unknown): RequirementRow {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    requirement: safeString(obj.requirement),
    importance: safeImportance(obj.importance),
    currentEvidence: safeString(obj.currentEvidence),
    gap: safeString(obj.gap),
    priority: safePriority(obj.priority),
    classification: safeClassification(obj.classification),
  };
}

export function validateSkillGapResult(raw: unknown): SkillGapResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const matrix = Array.isArray(obj.matrix)
    ? obj.matrix.map(safeRequirementRow).filter((r) => r.requirement)
    : [];

  const biggestGaps: BigGap[] = Array.isArray(obj.biggestGaps)
    ? obj.biggestGaps
        .map((g) => {
          const o = g && typeof g === "object" ? (g as Record<string, unknown>) : {};
          return {
            whatTheJdWants: safeString(o.whatTheJdWants),
            whatTheCandidateHas: safeString(o.whatTheCandidateHas),
            whatIsMissing: safeString(o.whatIsMissing),
            importance: safeImportance(o.importance),
          };
        })
        .filter((g) => g.whatTheJdWants)
    : [];

  const transferableSkills: TransferableSkill[] = Array.isArray(obj.transferableSkills)
    ? obj.transferableSkills
        .map((t) => {
          const o = t && typeof t === "object" ? (t as Record<string, unknown>) : {};
          return {
            fromTheCandidate: safeString(o.fromTheCandidate),
            compensatesFor: safeString(o.compensatesFor),
            why: safeString(o.why),
          };
        })
        .filter((t) => t.fromTheCandidate || t.compensatesFor)
    : [];

  const fastestWins: FastestWin[] = Array.isArray(obj.fastestWins)
    ? obj.fastestWins
        .map((w) => {
          const o = w && typeof w === "object" ? (w as Record<string, unknown>) : {};
          return {
            gap: safeString(o.gap),
            category: safeWinCategory(o.category),
            action: safeString(o.action),
          };
        })
        .filter((w) => w.gap || w.action)
    : [];

  const howCooked = safeString(obj.howCooked).toUpperCase() as CookedLevel;

  return {
    matrix,
    biggestGaps,
    transferableSkills,
    fastestWins,
    longTermGaps: safeStringArray(obj.longTermGaps),
    howCooked: COOKED_LEVELS.includes(howCooked) ? howCooked : "MEDIUM",
    summary: safeString(obj.summary),
  };
}

// ─── GitHub Resume Checker validation ──────────────────────────────────────

const EVIDENCE_STRENGTHS: EvidenceStrength[] = ["strong", "weak", "none"];

function safeEvidenceStrength(raw: unknown): EvidenceStrength {
  const v = safeString(raw).toLowerCase() as EvidenceStrength;
  return EVIDENCE_STRENGTHS.includes(v) ? v : "none";
}

function clampHundred(raw: unknown, fallback: number): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeProjectHighlight(raw: unknown): ProjectHighlight | null {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const repository = safeString(obj.repository);
  if (!repository) return null;
  return {
    repository,
    whyRelevant: safeString(obj.whyRelevant),
    skillsDemonstrated: safeString(obj.skillsDemonstrated),
    resumeRelevance: safeString(obj.resumeRelevance),
  };
}

function safeClaimCheck(raw: unknown): ClaimCheck | null {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const claim = safeString(obj.claim);
  if (!claim) return null;
  return {
    claim,
    githubEvidence: safeString(obj.githubEvidence),
    strength: safeEvidenceStrength(obj.strength),
  };
}

function safeProfileObservation(raw: unknown): ProfileQualityObservation | null {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const area = safeString(obj.area);
  if (!area) return null;
  return {
    area,
    assessment: safeString(obj.assessment),
    improvement: safeString(obj.improvement),
  };
}

/**
 * Validate GitHub resume check output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateGitHubResumeResult(raw: unknown): GitHubResumeResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const pq =
    obj.profileQuality && typeof obj.profileQuality === "object"
      ? (obj.profileQuality as Record<string, unknown>)
      : {};

  const roast = safeStringArray(obj.githubRoast).slice(0, 3);
  while (roast.length < 3) roast.push("");

  return {
    githubSignal: clampHundred(obj.githubSignal, 0),
    projectsWorthShowing: Array.isArray(obj.projectsWorthShowing)
      ? obj.projectsWorthShowing
          .map(safeProjectHighlight)
          .filter((p): p is ProjectHighlight => p !== null)
      : [],
    missingFromResume: safeStringArray(obj.missingFromResume),
    claims: Array.isArray(obj.claims)
      ? obj.claims
          .map(safeClaimCheck)
          .filter((c): c is ClaimCheck => c !== null)
      : [],
    profileQuality: {
      score: clampHundred(pq.score, 50),
      observations: Array.isArray(pq.observations)
        ? pq.observations
            .map(safeProfileObservation)
            .filter((o): o is ProfileQualityObservation => o !== null)
        : [],
    },
    githubRoast: roast,
    disclaimer: safeString(obj.disclaimer) || undefined,
  };
}

// ─── Resume Truth Detector validation ──────────────────────────────────────

const CLAIM_VERDICTS: ClaimVerdict[] = ["green", "yellow", "gray", "red"];
const CLEANUP_CATEGORIES: CleanupCategory[] = ["clarify", "substantiate", "reword"];

function safeVerdict(raw: unknown): ClaimVerdict {
  const v = safeString(raw).toLowerCase() as ClaimVerdict;
  return CLAIM_VERDICTS.includes(v) ? v : "gray";
}

function safeCleanupCategory(raw: unknown): CleanupCategory {
  const v = safeString(raw).toLowerCase() as CleanupCategory;
  return CLEANUP_CATEGORIES.includes(v) ? v : "clarify";
}

function safeClaimAssessment(raw: unknown): ClaimAssessment | null {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const claim = safeString(obj.claim);
  if (!claim) return null;
  return {
    claim,
    source: safeString(obj.source),
    evidence: safeString(obj.evidence),
    assessment: safeString(obj.assessment),
    verdict: safeVerdict(obj.verdict),
  };
}

function safeContradiction(raw: unknown): Contradiction | null {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const issue = safeString(obj.issue);
  if (!issue) return null;
  return {
    sources: safeString(obj.sources),
    issue,
    detail: safeString(obj.detail),
  };
}

function safeCleanupItem(raw: unknown): CleanupItem | null {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const claim = safeString(obj.claim);
  if (!claim) return null;
  return {
    claim,
    issue: safeString(obj.issue),
    suggestion: safeString(obj.suggestion),
    category: safeCleanupCategory(obj.category),
  };
}

/**
 * Validate resume truth detector output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateResumeTruthResult(raw: unknown): ResumeTruthResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const noCap =
    obj.noCapMode && typeof obj.noCapMode === "object"
      ? (obj.noCapMode as Record<string, unknown>)
      : {};

  return {
    evidenceScore: clampHundred(obj.evidenceScore, 50),
    claims: Array.isArray(obj.claims)
      ? obj.claims
          .map(safeClaimAssessment)
          .filter((c): c is ClaimAssessment => c !== null)
      : [],
    contradictions: Array.isArray(obj.contradictions)
      ? obj.contradictions
          .map(safeContradiction)
          .filter((c): c is Contradiction => c !== null)
      : [],
    cleanup: Array.isArray(obj.cleanup)
      ? obj.cleanup
          .map(safeCleanupItem)
          .filter((c): c is CleanupItem => c !== null)
      : [],
    noCapMode: {
      enabled: true,
      explanation:
        safeString(noCap.explanation) ||
        "We can improve presentation. We cannot manufacture receipts.",
    },
    funnyLine:
      safeString(obj.funnyLine) || "The evidence department has concerns.",
    summary: safeString(obj.summary),
  };
}

// ─── Recruiter Simulator validation ────────────────────────────────────────

const KEEP_READING_VALUES: KeepReading[] = ["YES", "MAYBE", "NO"];
const TAB_CLOSING_RISKS: RecruiterTabRisk[] = ["LOW", "MEDIUM", "HIGH"];

const SIM_DISCLAIMER =
  "This is a model-based simulation of a recruiter's scan, not a prediction of any specific recruiter's behavior.";

/**
 * Validate recruiter simulator output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateRecruiterSimulationResult(
  raw: unknown,
): RecruiterSimulationResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const timeline: TimelinePhase[] = Array.isArray(obj.timeline)
    ? obj.timeline
        .map((t) => {
          const o = t && typeof t === "object" ? (t as Record<string, unknown>) : {};
          const phase = safeString(o.phase);
          if (!phase) return null;
          return {
            phase,
            seconds: safeString(o.seconds),
            observations: safeStringArray(o.observations),
          } satisfies TimelinePhase;
        })
        .filter((t): t is TimelinePhase => t !== null)
    : [];

  const keepReading = safeString(obj.keepReading).toUpperCase() as KeepReading;
  const tabClosingRisk = safeString(obj.tabClosingRisk).toUpperCase() as RecruiterTabRisk;

  return {
    timeline,
    keepReading: KEEP_READING_VALUES.includes(keepReading) ? keepReading : "MAYBE",
    whatTheyNoticeFirst: safeStringArray(obj.whatTheyNoticeFirst),
    whatTheyMiss: safeStringArray(obj.whatTheyMiss),
    whyTheyMightSkip: safeStringArray(obj.whyTheyMightSkip),
    recruiterQuestions: safeStringArray(obj.recruiterQuestions),
    tabClosingRisk: TAB_CLOSING_RISKS.includes(tabClosingRisk) ? tabClosingRisk : "MEDIUM",
    tabClosingExplanation: safeString(obj.tabClosingExplanation),
    fixes: safeStringArray(obj.fixes),
    innerMonologue: safeStringArray(obj.innerMonologue),
    disclaimer: safeString(obj.disclaimer) || SIM_DISCLAIMER,
  };
}

// ─── Interview Prep validation ─────────────────────────────────────────────

const QUESTION_CATEGORIES: QuestionCategory[] = [
  "resume",
  "technical",
  "behavioral",
  "role-specific",
  "company-jd",
  "weakness-gap",
];
const QUESTION_DIFFICULTIES: QuestionDifficulty[] = [
  "Easy",
  "Medium",
  "Hard",
  "Final Boss",
];
const INTERVIEW_RISKS: InterviewRisk[] = ["Low", "Medium", "High"];

const INTERVIEW_FUNNY_LINE =
  "Interview prep complete. Now we find out whether the resume was telling the truth.";

function safeQuestionCategory(raw: unknown): QuestionCategory {
  const v = safeString(raw) as QuestionCategory;
  return QUESTION_CATEGORIES.includes(v) ? v : "resume";
}

function safeDifficulty(raw: unknown): QuestionDifficulty {
  const v = safeString(raw) as QuestionDifficulty;
  return QUESTION_DIFFICULTIES.includes(v) ? v : "Medium";
}

function safeInterviewRisk(raw: unknown): InterviewRisk {
  const v = safeString(raw) as InterviewRisk;
  return INTERVIEW_RISKS.includes(v) ? v : "Medium";
}

function safeInterviewQuestion(raw: unknown): PrepQuestion | null {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const question = safeString(obj.question);
  if (!question) return null;
  return {
    question,
    category: safeQuestionCategory(obj.category),
    difficulty: safeDifficulty(obj.difficulty),
    whyTheyAsk: safeString(obj.whyTheyAsk),
    risk: safeInterviewRisk(obj.risk),
    howToPrepare: safeString(obj.howToPrepare),
  };
}

/**
 * Validate interview prep output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateInterviewPrepResult(raw: unknown): InterviewPrepResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    readinessScore: clampHundred(obj.readinessScore, 50),
    questions: Array.isArray(obj.questions)
      ? obj.questions
          .map(safeInterviewQuestion)
          .filter((q): q is PrepQuestion => q !== null)
      : [],
    questionsForThem: safeStringArray(obj.questionsForThem).slice(0, 5),
    weakSpots: safeStringArray(obj.weakSpots),
    funnyLine: safeString(obj.funnyLine) || INTERVIEW_FUNNY_LINE,
    summary: safeString(obj.summary),
  };
}

// ─── STAR Answer Builder validation ────────────────────────────────────────

/**
 * Validate STAR answer output from an LLM. Defensive — a malformed response
 * never crashes the route.
 */
export function validateStarAnswerResult(raw: unknown): StarAnswerResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const sections =
    obj.sections && typeof obj.sections === "object"
      ? (obj.sections as Record<string, unknown>)
      : {};

  const assessment =
    obj.assessment && typeof obj.assessment === "object"
      ? (obj.assessment as Record<string, unknown>)
      : {};

  const followUp = safeStringArray(obj.followUpQuestions).slice(0, 3);
  while (followUp.length < 3) followUp.push("");

  return {
    sections: {
      situation: safeString(sections.situation),
      task: safeString(sections.task),
      action: safeString(sections.action),
      result: safeString(sections.result),
    },
    finalAnswer: safeString(obj.finalAnswer),
    resultWarning: safeString(obj.resultWarning) || undefined,
    assessment: {
      clarity: clampHundred(assessment.clarity, 50),
      ownership: clampHundred(assessment.ownership, 50),
      specificity: clampHundred(assessment.specificity, 50),
      impact: clampHundred(assessment.impact, 50),
    },
    followUpQuestions: followUp,
    funnyLine:
      safeString(obj.funnyLine) ||
      "Story upgraded from 'trust me bro' to actual structure.",
  };
}

// ─── Tell Me About Yourself validation ─────────────────────────────────────

const TELL_ME_FUNNY_LINE =
  "Please do not start with your birth certificate.";

/**
 * Validate tell me about yourself output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateTellMeResult(raw: unknown): TellMeResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const why = safeStringArray(obj.whyThisWorks).slice(0, 3);
  while (why.length < 3) why.push("");

  const avoid = safeStringArray(obj.avoidSaying).slice(0, 3);
  while (avoid.length < 3) avoid.push("");

  return {
    thirtySeconds: safeString(obj.thirtySeconds),
    sixtySeconds: safeString(obj.sixtySeconds),
    ninetySeconds: safeString(obj.ninetySeconds) || "",
    whyThisWorks: why,
    avoidSaying: avoid,
    funnyLine: safeString(obj.funnyLine) || TELL_ME_FUNNY_LINE,
  };
}

// ─── Weakness Detector validation ─────────────────────────────────────────

const WEAKNESS_RISKS: WeaknessRisk[] = ["LOW", "MEDIUM", "HIGH", "FINAL BOSS"];

const WEAKNESS_FUNNY_LINE =
  "These are the areas where the interviewer may activate their trap card.";

function safeWeaknessRisk(raw: unknown): WeaknessRisk {
  const v = safeString(raw).toUpperCase() as WeaknessRisk;
  return WEAKNESS_RISKS.includes(v) ? v : "MEDIUM";
}

/**
 * Validate weakness detector output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateWeaknessResult(raw: unknown): WeaknessResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const weaknesses: WeaknessItem[] = Array.isArray(obj.weaknesses)
    ? obj.weaknesses
        .map((w) => {
          const o = w && typeof w === "object" ? (w as Record<string, unknown>) : {};
          const weakness = safeString(o.weakness);
          if (!weakness) return null;
          return {
            weakness,
            whyItExists: safeString(o.whyItExists),
            evidence: safeString(o.evidence),
            likelyQuestion: safeString(o.likelyQuestion),
            risk: safeWeaknessRisk(o.risk),
            howToPrepare: safeString(o.howToPrepare),
          } satisfies WeaknessItem;
        })
        .filter((w): w is WeaknessItem => w !== null)
        .slice(0, 5)
    : [];

  const claimsToDefend: ClaimToDefend[] = Array.isArray(obj.claimsToDefend)
    ? obj.claimsToDefend
        .map((c) => {
          const o = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
          const claim = safeString(o.claim);
          if (!claim) return null;
          return {
            claim,
            likelyFollowUp: safeString(o.likelyFollowUp),
            evidenceAvailable: safeString(o.evidenceAvailable),
          } satisfies ClaimToDefend;
        })
        .filter((c): c is ClaimToDefend => c !== null)
    : [];

  return {
    weaknessScore: clampHundred(obj.weaknessScore, 50),
    weaknesses,
    claimsToDefend,
    gapStrategy: safeString(obj.gapStrategy),
    funnyLine: safeString(obj.funnyLine) || WEAKNESS_FUNNY_LINE,
  };
}

// ─── Interview Boss Fight validation ───────────────────────────────────────

const BOSS_VERDICTS: BossVerdict[] = ["READY", "NEEDS WORK", "ABSOLUTELY COOKED"];

/**
 * Validate boss fight session output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateBossFightSession(raw: unknown): BossFightSession {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const questions: BossFightQuestion[] = Array.isArray(obj.questions)
    ? obj.questions
        .map((q) => {
          const o = q && typeof q === "object" ? (q as Record<string, unknown>) : {};
          const question = safeString(o.question);
          if (!question) return null;
          return {
            index: typeof o.index === "number" ? Math.round(o.index) : 0,
            question,
            difficulty: safeString(o.difficulty).toUpperCase() as BossDifficulty,
            category: safeString(o.category),
          } satisfies BossFightQuestion;
        })
        .filter((q): q is BossFightQuestion => q !== null)
    : [];

  // Normalize to exactly 10 with sequential indices
  while (questions.length < 10) {
    questions.push({
      index: questions.length + 1,
      question: "",
      difficulty: "MEDIUM",
      category: "resume",
    });
  }
  const trimmed = questions.slice(0, 10);
  trimmed.forEach((q, i) => {
    q.index = i + 1;
    if (!BOSS_DIFFICULTIES.includes(q.difficulty)) q.difficulty = "MEDIUM";
  });

  return {
    questions: trimmed,
    role: safeString(obj.role) || undefined,
    experienceLevel: safeString(obj.experienceLevel) || undefined,
    disclaimer: safeString(obj.disclaimer),
  };
}

/**
 * Validate boss answer evaluation output from an LLM. Defensive — a malformed
 * response never crashes the route.
 */
export function validateBossAnswerEvaluation(
  raw: unknown,
): BossAnswerEvaluation {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    score: clampHundred(obj.score, 50),
    whatWasGood: safeStringArray(obj.whatWasGood),
    whatWasWeak: safeStringArray(obj.whatWasWeak),
    whatTheyMightAskNext: safeString(obj.whatTheyMightAskNext),
    betterAnswerStructure: safeString(obj.betterAnswerStructure),
  };
}

/**
 * Validate resume fix output from an LLM. Mirrors the defensive approach of
 * validateAnalysisResult so a malformed model response never crashes the route.
 */
export function validateResumeFixResult(raw: unknown): ResumeFixResult {
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
}

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

// ─── Employment Aura validation ────────────────────────────────────────────

function safeAuraScore(raw: unknown, fallback: number): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function validateEmploymentAuraResult(raw: unknown): EmploymentAuraResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  // If overall is missing/invalid, fall back to average of components.
  const resumeAura = safeAuraScore(obj.resumeAura, 50);
  const skillAura = safeAuraScore(obj.skillAura, 50);
  const experienceAura = safeAuraScore(obj.experienceAura, 50);
  const projectAura = safeAuraScore(obj.projectAura, 50);
  const applicationAura = safeAuraScore(obj.applicationAura, 50);

  const computedOverall = Math.round(
    (resumeAura + skillAura + experienceAura + projectAura + applicationAura) / 5,
  );
  const overallAura = safeAuraScore(obj.overallAura, computedOverall);

    const auraType = safeString(obj.auraType) || "The Enigmatic Applicant";
  const biggestW = safeString(obj.biggestW) || "Something";
  const biggestL = safeString(obj.biggestL) || "Something";
  const verdict = safeString(obj.verdict) || "Current aura: questionable but recoverable.";

  return {
    overallAura,
    resumeAura,
    skillAura,
    experienceAura,
    projectAura,
    applicationAura,
    auraType,
    biggestW,
    biggestL,
    auraBoosters: safeStringArray(obj.auraBoosters).slice(0, 3),
    auraDrainers: safeStringArray(obj.auraDrainers).slice(0, 3),
    verdict,
  };
}

// ─── Rizz Score validation ────────────────────────────────────────────────

const RIZZ_VERDICTS: RizzVerdict[] = [
  "NO RIZZ",
  "LOW RIZZ",
  "DECENT RIZZ",
  "HIGH RIZZ",
  "UNREASONABLE AURA",
];

function safeRizzScore(raw: unknown, fallback: number): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function validateRizzScoreResult(raw: unknown): RizzScoreResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const relevance = safeRizzScore(obj.relevance, 50);
  const specificity = safeRizzScore(obj.specificity, 50);
  const credibility = safeRizzScore(obj.credibility, 50);
  const clarity = safeRizzScore(obj.clarity, 50);
  const differentiation = safeRizzScore(obj.differentiation, 50);
  const evidence = safeRizzScore(obj.evidence, 50);

  const computedOverall = Math.round(
    (relevance + specificity + credibility + clarity + differentiation + evidence) / 6,
  );
  const rizzScore = safeRizzScore(obj.rizzScore, computedOverall);

  const rawVerdict = safeString(obj.verdict).toUpperCase();
  const verdict: RizzVerdict = RIZZ_VERDICTS.includes(rawVerdict as RizzVerdict)
    ? (rawVerdict as RizzVerdict)
    : "LOW RIZZ";

  return {
    rizzScore,
    relevance,
    specificity,
    credibility,
    clarity,
    differentiation,
    evidence,
    rizzBoosters: safeStringArray(obj.rizzBoosters).slice(0, 5),
    rizzKillers: safeStringArray(obj.rizzKillers).slice(0, 5),
    recruiterPitch: safeString(obj.recruiterPitch) || "No pitch generated.",
    verdict,
  };
}

// ─── Cooked Meter validation ───────────────────────────────────────────────

const COOKED_VERDICTS: CookedVerdict[] = [
  "NOT COOKED",
  "LIGHTLY COOKED",
  "MEDIUM",
  "WELL DONE",
  "ABSOLUTELY COOKED",
];

const CAN_APPLY_OPTIONS: CanApply[] = [
  "YES",
  "YES, BUT STRETCH",
  "PROBABLY NOT",
];

function safeCookedScore(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function validateCookedMeterResult(raw: unknown): CookedMeterResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const cookedScore = safeCookedScore(obj.cookedScore);

  const rawVerdict = safeString(obj.verdict).toUpperCase();
  const verdict: CookedVerdict = COOKED_VERDICTS.includes(rawVerdict as CookedVerdict)
    ? (rawVerdict as CookedVerdict)
    : cookedScore <= 20
      ? "NOT COOKED"
      : cookedScore <= 40
        ? "LIGHTLY COOKED"
        : cookedScore <= 60
          ? "MEDIUM"
          : cookedScore <= 80
            ? "WELL DONE"
            : "ABSOLUTELY COOKED";

  const rawCanApply = safeString(obj.canYouStillApply).toUpperCase();
  const canYouStillApply: CanApply = CAN_APPLY_OPTIONS.includes(rawCanApply as CanApply)
    ? (rawCanApply as CanApply)
    : cookedScore <= 30
      ? "YES"
      : cookedScore <= 60
        ? "YES, BUT STRETCH"
        : "PROBABLY NOT";

  return {
    cookedScore,
    verdict,
    why: safeStringArray(obj.why).slice(0, 5),
    whatSavesYou: safeStringArray(obj.whatSavesYou).slice(0, 5),
    whatCookedYou: safeString(obj.whatCookedYou) || "No specific factor identified.",
    canYouStillApply,
    howToLower: safeStringArray(obj.howToLower).slice(0, 5),
  };
}

// ─── Resume Court validation ───────────────────────────────────────────────

const COURT_VERDICTS: CourtVerdict[] = [
  "SUPPORTED",
  "PARTIALLY SUPPORTED",
  "UNVERIFIED",
  "CONTRADICTION",
];

function safeCourtVerdict(raw: unknown): CourtVerdict {
  const s = safeString(raw).toUpperCase();
  return COURT_VERDICTS.includes(s as CourtVerdict)
    ? (s as CourtVerdict)
    : "UNVERIFIED";
}

function safeClaim(raw: unknown): ResumeClaim {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    claim: safeString(obj.claim) || "Unnamed claim",
    evidence: safeString(obj.evidence) || "No supporting evidence was found.",
    prosecution: safeString(obj.prosecution) || "No prosecution argument generated.",
    defense: safeString(obj.defense) || "No defense argument generated.",
    verdict: safeCourtVerdict(obj.verdict),
  };
}

export function validateResumeCourtResult(raw: unknown): ResumeCourtResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const rawClaims = Array.isArray(obj.claims) ? obj.claims : [];
  const claims = rawClaims.map(safeClaim).slice(0, 8);

  return {
    claims,
    mostDangerousClaim:
      safeString(obj.mostDangerousClaim) ||
      "No dangerous claims identified.",
    bestClaim: safeString(obj.bestClaim) || "No best claim identified.",
    sentenceToFix:
      safeString(obj.sentenceToFix) ||
      "No sentence to fix identified.",
  };
}

// ─── ATS Boss Fight validation ─────────────────────────────────────────────

function safeDamage(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeAttackCategory(raw: unknown): BossAttackCategory {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    name: safeString(obj.name) || "Unknown",
    damage: safeDamage(obj.damage),
    why: safeString(obj.why) || "No explanation provided.",
  };
}

export function validateAtsBossFightResult(raw: unknown): AtsBossFightResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const yourDamage = safeDamage(obj.yourDamage);
  const bossHp = Math.max(0, Math.min(100, 100 - yourDamage));

  const rawCategories = Array.isArray(obj.attackCategories)
    ? obj.attackCategories
    : [];
  const attackCategories = rawCategories
    .map(safeAttackCategory)
    .slice(0, 6);

  return {
    bossHp,
    yourDamage,
    attackCategories,
    bossWeaknesses: safeStringArray(obj.bossWeaknesses).slice(0, 5),
    yourWeapons: safeStringArray(obj.yourWeapons).slice(0, 5),
    bossAttacks: safeStringArray(obj.bossAttacks).slice(0, 5),
    atsBattleScore: safeDamage(obj.atsBattleScore),
    nextMove: safeStringArray(obj.nextMove).slice(0, 3),
  };
}

// ─── Skill Issue validation ────────────────────────────────────────────────

const FINAL_DIAGNOSES: FinalDiagnosis[] = [
  "Skill issue",
  "Positioning issue",
  "Experience issue",
  "Evidence issue",
  "Application strategy issue",
];

function safeSecondaryIssue(raw: unknown): SecondaryIssue {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    problem: safeString(obj.problem) || "No problem identified.",
    evidence: safeString(obj.evidence) || "No evidence provided.",
    impact: safeString(obj.impact) || "No impact identified.",
    fix: safeString(obj.fix) || "No fix suggested.",
  };
}

function safeFinalDiagnosis(raw: unknown): FinalDiagnosis {
  const s = safeString(raw);
  return FINAL_DIAGNOSES.includes(s as FinalDiagnosis)
    ? (s as FinalDiagnosis)
    : "Skill issue";
}

export function validateSkillIssueResult(raw: unknown): SkillIssueResult {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const rawSecondary = Array.isArray(obj.secondaryIssues)
    ? obj.secondaryIssues
    : [];
  const secondaryIssues = rawSecondary.map(safeSecondaryIssue).slice(0, 5);

  return {
    primaryIssue: safeString(obj.primaryIssue) || "No primary issue identified.",
    secondaryIssues,
    notTheProblem: safeStringArray(obj.notTheProblem).slice(0, 5),
    thirtyDayFix: safeStringArray(obj.thirtyDayFix).slice(0, 5),
    finalDiagnosis: safeFinalDiagnosis(obj.finalDiagnosis),
  };
}