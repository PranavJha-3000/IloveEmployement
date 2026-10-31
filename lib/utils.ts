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
const GAP_IMPORTANCES: GapImportance[] = ["must-have", "nice-to-have", "specialized"];

function safeImportance(raw: unknown): GapImportance {
  const v = safeString(raw) as GapImportance;
  return GAP_IMPORTANCES.includes(v) ? v : "nice-to-have";
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