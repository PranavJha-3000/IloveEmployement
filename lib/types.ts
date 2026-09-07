// ─── AI Provider Types ───────────────────────────────────────────────────────

export type ProviderId =
  | "openai"
  | "google"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "together"
  | "xai"
  | "custom";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  baseUrl?: string;
  defaultModel: string;
  models: string[];
  docsUrl: string;
  keyPrefix?: string;
}

export interface AiRequestConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

// ─── Analysis Result Types ───────────────────────────────────────────────────

export type EvidenceLevel = "strong" | "weak" | "none";

export type EvidenceSource = "resume" | "linkedin" | "github" | "inferred";

export type ImportanceLevel = "high" | "medium" | "low";

/**
 * A finding with its evidence classification.
 * - evidence: strong / weak / none
 * - source: where the evidence came from (optional)
 * - importance: how much the JD demands this (optional, used on weaknesses)
 * - area: the skill/topic this finding is about (optional, used on weaknesses)
 */
export interface EvidenceItem {
  text: string;
  evidence: EvidenceLevel;
  source?: EvidenceSource;
  importance?: ImportanceLevel;
  area?: string;
}

export type Verdict =
  "APPLY" | "BORDERLINE" | "LONG SHOT" | "ABSOLUTELY COOKED";

export interface AnalysisResult {
  overallScore: number; // 0-100 composite fit score
  selectionChance: number; // 0-100 estimate (not a prediction)
  selectionChanceExplanation: string; // what drives the percentage
  verdict: Verdict;
  summary: string; // 3-5 sentence professional fit assessment
  strengths: EvidenceItem[];
  weaknesses: EvidenceItem[];
  fatalGaps: EvidenceItem[];
  missingSkills: string[];
  matchedSkills: string[];
  atsScore: number; // 0-100
  experienceScore: number; // 0-100
  projectScore: number; // 0-100
  evidenceScore: number; // 0-100
  resumeProblems: string[];
  resumeChanges: string[];
  applicationStrategy: string[]; // items prefixed LEAD:/HIDE:/FIX:
  interviewRisks: string[];
  trollComment: string; // exactly one witty line; everything else stays professional
  recruiterSimulation: RecruiterSimulation; // 30-second recruiter scan
  capDetector: ResumeCapDetector; // claim strength analysis
  interviewBossFight: InterviewBossFight; // 5 interview prep questions
}

// ─── Resume Optimization Types ──────────────────────────────────────────────

export type ChangeCategory =
  "structure" | "wording" | "keywords" | "emphasis" | "clarity" | "relevance";

export interface ChangeEntry {
  category: ChangeCategory;
  description: string; // e.g. "Reordered projects to prioritize JD relevance"
  section?: string; // e.g. "Experience"
}

export interface ResumeOptimizationResult {
  optimizedResume: string; // full resume as clean markdown (strictly professional)
  whatChanged: ChangeEntry[];
}

export interface ResumeOptimizationRequest {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  analysis: AnalysisResult;
  linkedinUrl?: string;
  githubUrl?: string;
}

// ─── Request Types ───────────────────────────────────────────────────────────

export interface AnalyzeRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedinUrl?: string;
  githubUrl?: string;
  desperationLevel: number; // 0-5
}

// ─── Corporate Yapping Translator Types ────────────────────────────────────

export type YappingCategory =
  | "what_they_want"
  | "required_skills"
  | "nice_to_have"
  | "likely_interview_topics"
  | "potential_red_flags"
  | "corporate_yapping";

export interface YappingTranslation {
  category: YappingCategory;
  companySaid: string; // exact (or near-exact) quote from the JD
  theyProbablyMean: string; // plain-English professional translation
  iLoveEmploymentSays: string; // witty / cynical / realistic interpretation
}

export interface CorporateYappingResult {
  translations: YappingTranslation[];
  /** 0-100: low = unusually specific JD, high = lots of generic corporate language. */
  yappingScore?: number;
}

export interface CorporateYappingRequest {
  config: AiRequestConfig;
  jobDescription: string;
  /** Optional context. Used only to frame the JD; never invented information. */
  companyName?: string;
  /** Optional context. Used only to frame the JD; never invented information. */
  roleTitle?: string;
}

// ─── Recruiter Simulator & Cap Detector Types ──────────────────────────────

export type RiskLevel = "Low" | "Medium" | "High";

export interface TabClosingRisk {
  level: RiskLevel;
  explanation: string;
}

export interface RecruiterSimulation {
  firstFiveSeconds: string; // 0-5s: visual/structural eye-catchers
  fiveToFifteenSeconds: string; // 5-15s: keywords/qualifications hunted
  fifteenToThirtySeconds: string; // 15-30s: make-or-break factor
  tabClosingRisk: TabClosingRisk;
}

export type CapVerdict = "green" | "yellow" | "red";

export interface CapClaim {
  claim: string; // the specific claim from the resume
  verdict: CapVerdict;
  note: string; // humorous one-liner
}

export interface ResumeCapDetector {
  claims: CapClaim[];
}

// ─── Interview Boss Fight Types ─────────────────────────────────────────────

export type BossDifficulty = "EASY" | "MEDIUM" | "HARD" | "FINAL_BOSS";

export interface InterviewQuestion {
  question: string; // the likely interview question
  whyTheyreAsking: string; // underlying intent / competency tested
  yourRisk: string; // vulnerability based on actual background
  howToAnswer: string; // truthful strategy, no fabrication
  difficulty: BossDifficulty;
  bossWarning?: string; // high-alert warning, ONLY for FINAL_BOSS
}

export interface InterviewBossFight {
  questions: InterviewQuestion[]; // exactly 5
}

// ─── ATS Checker Types ─────────────────────────────────────────────────────

export type AtsFormatStatus = "pass" | "warning" | "fail";

export type AtsRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AtsFormatItem {
  check: string; // e.g. "Readable section headings"
  status: AtsFormatStatus;
  detail: string; // concise explanation of why it passed/warned/failed
}

export interface AtsPartialMatch {
  concept: string; // the JD concept/skill partially covered
  evidence: string; // what the resume shows for it
}

export interface AtsCheckResult {
  atsScore: number; // 0-100
  riskLevel: AtsRiskLevel;
  formatChecks: AtsFormatItem[]; // one entry per format check
  matchedKeywords: string[]; // job-specific keywords with resume evidence
  missingKeywords: string[]; // JD keywords with no resume evidence
  partialMatches: AtsPartialMatch[]; // concepts only partially covered
  requirementsNoEvidence: string[]; // important JD requirements lacking evidence
  topFixes: string[]; // ranked top 5 problems, most important first
  bossFightComment: string; // one short humorous line
  strongResumeNote?: string; // present when atsScore >= 80
}

export interface AtsCheckRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription?: string; // optional — enables keyword matching
}

// ─── Resume Roast Types ─────────────────────────────────────────────────────

export type RoastRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface BulletRewrite {
  original: string; // the actual bullet from the resume
  better: string; // improved rewrite grounded in the same facts
}

export interface NpcPhrase {
  phrase: string; // the generic phrase (e.g. "Team player")
  why: string; // why it is weak / says almost nothing
}

export interface BuriedGold {
  item: string; // relevant project/experience from the resume
  reason: string; // why it deserves more emphasis
}

export interface ResumeRoastResult {
  roastLevel: number; // 0-100 (higher = more brutally needed)
  verdict: string; // one concise brutal summary
  biggestL: string; // most damaging problem
  biggestW: string; // strongest part of the resume
  npcContent: NpcPhrase[]; // generic phrases that say almost nothing
  buriedGold: BuriedGold[]; // relevant experience deserving more emphasis
  recruiterSkipRisk: RoastRiskLevel;
  recruiterSkipWhy: string; // why that risk level
  bulletsThatNeedHelp: BulletRewrite[]; // up to 5 original + improved pairs
  roast: string[]; // 3-5 short humorous observations
  topFixes: string[]; // top 5 fixes before applying, ranked
}

export interface ResumeRoastRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription?: string; // optional — sharpens relevance of the roast
}

// ─── Delulu Detector Types ──────────────────────────────────────────────────

export type DeluluVerdict =
  | "APPLY"
  | "APPLY_AS_A_STRETCH"
  | "BUILD_MORE_EVIDENCE_FIRST"
  | "LOW_PROBABILITY";

export interface RealityComparison {
  experienceRequired: string; // what the JD asks for
  experienceYouHave: string; // what the resume shows
  coreSkillsRequired: string;
  coreSkillsYouDemonstrate: string;
  preferredQualifications: string;
  evidenceAvailable: string;
}

export interface DeluluCheckResult {
  deluluScore: number; // 0-100 (higher = bigger gap vs reality)
  interpretation: string; // band label, e.g. "Reasonable stretch"
  realityCheck: RealityComparison;
  whatYouHave: string[]; // real strengths from the resume
  whatTheyWant: string[]; // what the JD is asking for
  whatsMissing: string[]; // gaps (preferred gaps included here, not fatal)
  whatTransfers: string[]; // adjacent experience that transfers
  whatIsActuallyFatal: string[]; // hard blockers only — missing preferred skills do NOT belong here
  verdict: DeluluVerdict;
  howToBecomeLessDelulu: string[]; // 3-5 concrete improvements
  finalLine: string; // one funny closing line
}

export interface DeluluCheckRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

// ─── Resume Rewriter Types ──────────────────────────────────────────────────

export interface ResumeSection {
  title: string; // e.g. "Summary", "Experience", "Projects", "Skills", "Education"
  content: string; // the text content for this section (single bullet / paragraph per line)
}

export interface ResumeChange {
  section: string; // which section this change applies to
  original: string; // the original text
  optimized: string; // the rewritten text
  reason: string; // why the change was made (e.g. "aligned terminology with JD", "clarified measurable outcome")
}

export interface ResumeRewriteResult {
  truthFilter: "ON"; // always ON — signals the no-fabrication constraint was respected
  originalResume: ResumeSection[]; // parsed original organized by section
  optimizedResume: ResumeSection[]; // rewritten version organized by section
  changes: ResumeChange[]; // every important change with reason
  keywordCoverage: {
    matched: string[]; // JD keywords present in the optimized resume
    missing: string[]; // JD keywords with no candidate evidence (NOT inserted)
  };
  desperationLevel: number; // echo back the level used (0-5)
  professionalNote: string; // one line confirming the output stays professional
}

export interface ResumeRewriteRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  desperationLevel: number; // 0-5
  linkedinUrl?: string;
  githubUrl?: string;
}

// ─── Resume Fixer Types ────────────────────────────────────────────────────

export type IssueSeverity = "CRITICAL" | "WARNING" | "OPTIONAL";

export interface ResumeIssue {
  category: string; // e.g. "Summary", "Experience", "Skills", "Education", "Formatting"
  severity: IssueSeverity;
  problem: string; // what is wrong
  current: string; // the relevant resume text
  fix: string; // the improved version
  why: string; // why the change helps
}

export interface ResumeFixResult {
  healthScore: number; // 0-100
  issues: ResumeIssue[];
  quickFix: string[]; // top 3 highest-impact changes
  personalityCopy: string; // e.g. "Your resume isn't doomed. It just has a few skill issues."
}

export interface ResumeFixRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

// ─── Bullet Point Fixer Types ──────────────────────────────────────────────

export interface BulletScore {
  clarity: number; // 0-100
  specificity: number; // 0-100
  impact: number; // 0-100
  relevance: number; // 0-100
}

export interface BulletFixResult {
  original: string;
  improved: string;
  stronger: string;
  whyBetter: string[]; // 2-3 concise points
  metricPlaceholder?: string; // if no measurable result, suggest adding one
  bulletScore: BulletScore;
  overallScore: number; // 0-100 average
  roast: string; // small roast line
}

export interface BulletFixRequestBody {
  config: AiRequestConfig;
  bullet: string;
  jobDescription?: string;
  roleContext?: string;
  technology?: string;
  desperationLevel?: number; // 0-5
}
