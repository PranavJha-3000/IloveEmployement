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

export type Verdict = "APPLY" | "BORDERLINE" | "LONG SHOT" | "ABSOLUTELY COOKED";

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
  | "structure"
  | "wording"
  | "keywords"
  | "emphasis"
  | "clarity"
  | "relevance";

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
}

export interface CorporateYappingRequest {
  config: AiRequestConfig;
  jobDescription: string;
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
