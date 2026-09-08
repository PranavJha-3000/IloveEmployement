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
// ─── LinkedIn Optimizer Types ─────────────────────────────────────────────────

export interface LinkedInCompletenessItem {
  status: "good" | "weak" | "missing";
  note: string;
}

export interface LinkedInOptimizerResult {
  linkedinScore: number; // 0-100
  completeness: {
    score: number; // 0-100
    headline: LinkedInCompletenessItem;
    about: LinkedInCompletenessItem;
    experience: LinkedInCompletenessItem;
    projects: LinkedInCompletenessItem;
    skills: LinkedInCompletenessItem;
    keywords: LinkedInCompletenessItem;
    resumeConsistency: LinkedInCompletenessItem;
  };
  headline: {
    current: string;
    options: {
      professional: string;
      recruiterFocused: string;
      personality: string;
    };
  };
  about: {
    current: string;
    optimized: string;
    why: string;
  };
  experience: {
    current: string;
    optimized: string;
    why: string;
  };
  skills: {
    keep: string[];
    add: string[];
    remove: string[];
  };
  resumeConsistency: {
    contradictions: string[];
    summary: string;
  };
  biggestL: string;
  biggestW: string;
  funnyCopy: string;
}

export interface LinkedInOptimizerRequestBody {
  config: AiRequestConfig;
  linkedinUrl?: string;
  linkedinContent?: string;
  jobDescription?: string;
  resumeText?: string;
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

// ─── Cover Letter Generator Types ─────────────────────────────────────────

export type CoverLetterTone =
  | "professional"
  | "confident"
  | "direct"
  | "startup"
  | "short-punchy";

export interface CoverLetterResult {
  subject: string; // optional subject line (e.g. for email applications)
  coverLetter: string; // the full cover letter text
  whyThisWorks: {
    relevantExperience: string[]; // 2-4 bullet points — which resume experiences were used
    jdRequirementsAddressed: string[]; // 2-4 bullet points — which JD requirements were addressed
    openingSpecificity: string; // why the opening is specific (not generic)
    lessGeneric: string; // what makes this less generic than AI sludge
  };
  tone: CoverLetterTone; // tone actually used
  disclaimer?: string; // explicit note if resume lacks relevant evidence
}

export interface CoverLetterRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  hiringManagerName?: string;
  additionalContext?: string;
  tone?: CoverLetterTone;
}

// ─── Recruiter Message Types ──────────────────────────────────────────────

export type RecruiterMessageContext =
  | "already-applied"
  | "referral"
  | "cold-outreach"
  | "follow-up";

export interface RecruiterMessageVariantResult {
  message: string; // the message text itself
  whyThisWorks: string; // one short sentence explaining the choice
}

export interface RecruiterMessageResult {
  subject: string; // optional subject line (empty if not useful)
  variants: {
    short: RecruiterMessageVariantResult; // 2-3 sentences
    confident: RecruiterMessageVariantResult; // slightly more direct
    warm: RecruiterMessageVariantResult; // networking / referral tone
  };
  contextUsed: RecruiterMessageContext; // the outreach context used
  disclaimer?: string; // explicit note if resume lacks relevant evidence
}

export interface RecruiterMessageRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  recruiterName?: string;
  context?: RecruiterMessageContext;
  additionalContext?: string;
}

// ─── JD Red Flag Scanner Types ────────────────────────────────────────────

export type RedFlagLevel = "LOW" | "MEDIUM" | "HIGH";

export type ProceedRecommendation = "YES" | "PROBABLY" | "INVESTIGATE_FIRST";

export interface JdFinding {
  phrase: string; // what the JD actually says
  whatItCouldMean: string; // reasonable interpretation, not an accusation
  whatToAsk: string; // clarifying interview question
}

export interface JdRedFlagResult {
  redFlagLevel: RedFlagLevel;
  categories: {
    vague: JdFinding[]; // generic wording, little useful info
    overloaded: JdFinding[]; // role combines many responsibilities
    missing: JdFinding[]; // important information absent
    concern: JdFinding[]; // language that deserves clarification
  };
  goodSignals: string[]; // specific requirements, clear responsibilities
  corporateYappingScore: number; // 0-100
  shouldProceed: ProceedRecommendation;
  summary: string; // short, fair, no accusations
}

export interface JdRedFlagRequestBody {
  config: AiRequestConfig;
  jobDescription: string;
  companyName?: string;
  role?: string;
  salary?: string;
}

// ─── Skill Gap Analyzer Types ─────────────────────────────────────────────

export type GapClassification = "STRONG" | "PARTIAL" | "MISSING";

export type GapImportance = "must-have" | "nice-to-have" | "specialized";

export type CookedLevel = "LOW" | "MEDIUM" | "HIGH";

export type WinCategory =
  | "resume-positioning"
  | "project-evidence"
  | "portfolio-addition"
  | "interview-prep";

export interface RequirementRow {
  requirement: string; // JD requirement text (paraphrased tight)
  importance: GapImportance;
  currentEvidence: string; // what the candidate actually has; empty if MISSING
  gap: string; // the specific missing piece
  priority: number; // 1 (critical) – 5 (minor)
  classification: GapClassification;
}

export interface BigGap {
  whatTheJdWants: string;
  whatTheCandidateHas: string;
  whatIsMissing: string;
  importance: GapImportance;
}

export interface TransferableSkill {
  fromTheCandidate: string; // skill the candidate actually has
  compensatesFor: string; // gap it partially fills
  why: string; // the concrete connection
}

export interface FastestWin {
  gap: string;
  category: WinCategory;
  action: string; // specific, doable action
}

export interface SkillGapResult {
  matrix: RequirementRow[];
  biggestGaps: BigGap[];
  transferableSkills: TransferableSkill[];
  fastestWins: FastestWin[];
  longTermGaps: string[];
  howCooked: CookedLevel;
  summary: string;
}

export interface SkillGapRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedin?: string;
  github?: string;
}

// ─── GitHub Resume Checker Types ──────────────────────────────────────────

export type EvidenceStrength = "strong" | "weak" | "none";

export interface ProjectHighlight {
  repository: string; // repo name as shown on GitHub
  whyRelevant: string; // why this repo helps the application
  skillsDemonstrated: string; // concrete skills the repo evidences
  resumeRelevance: string; // connection to the resume/JD, if any
}

export interface ClaimCheck {
  claim: string; // the resume claim being verified
  githubEvidence: string; // what GitHub actually shows; empty if none
  strength: EvidenceStrength;
}

export interface ProfileQualityObservation {
  area: string; // e.g. "README quality", "pinned repositories"
  assessment: string; // what was observed (or noted as unassessable)
  improvement: string; // actionable fix
}

export interface GitHubResumeResult {
  githubSignal: number; // 0-100
  projectsWorthShowing: ProjectHighlight[];
  missingFromResume: string[]; // GitHub projects that would strengthen the application
  claims: ClaimCheck[]; // resume claims checked against GitHub evidence
  profileQuality: {
    score: number; // 0-100
    observations: ProfileQualityObservation[];
  };
  githubRoast: string[]; // 3 short observations, funny not cruel
  disclaimer?: string; // stated limitation when GitHub wasn't fully accessible
}

export interface GitHubResumeRequestBody {
  config: AiRequestConfig;
  githubInput: string; // GitHub URL or pasted repo/profile content
  resumeText?: string;
  jobDescription?: string;
}

// ─── Resume Truth Detector Types ──────────────────────────────────────────

export type ClaimVerdict = "green" | "yellow" | "gray" | "red";

export interface ClaimAssessment {
  claim: string; // the resume claim being checked
  source: string; // where the claim appears (e.g. "Resume - Experience")
  evidence: string; // what the provided sources show; empty if none
  assessment: string; // brief reasoning, non-accusatory
  verdict: ClaimVerdict;
}

export interface Contradiction {
  sources: string; // e.g. "Resume vs. LinkedIn"
  issue: string; // what is inconsistent
  detail: string; // the specific mismatch
}

export type CleanupCategory = "clarify" | "substantiate" | "reword";

export interface CleanupItem {
  claim: string;
  issue: string; // why it needs cleanup
  suggestion: string; // how to improve it
  category: CleanupCategory;
}

export interface ResumeTruthResult {
  evidenceScore: number; // 0-100
  claims: ClaimAssessment[];
  contradictions: Contradiction[];
  cleanup: CleanupItem[];
  noCapMode: {
    enabled: boolean; // always true - statement of principle
    explanation: string; // "We can improve presentation. We cannot manufacture receipts."
  };
  funnyLine: string; // "The evidence department has concerns."
  summary: string;
}

export interface ResumeTruthRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  jobDescription?: string;
}

// ─── Recruiter Simulator Types ────────────────────────────────────────────

export type KeepReading = "YES" | "MAYBE" | "NO";

export type RecruiterTabRisk = "LOW" | "MEDIUM" | "HIGH";

export interface TimelinePhase {
  phase: string; // e.g. "0-5 SECONDS"
  seconds: string; // display label, e.g. "0-5s"
  observations: string[];
}

export interface RecruiterSimulationResult {
  timeline: TimelinePhase[]; // 3 phases: 0-5s, 5-15s, 15-30s
  keepReading: KeepReading;
  whatTheyNoticeFirst: string[]; // 3-5 points
  whatTheyMiss: string[]; // important experience buried or unclear
  whyTheyMightSkip: string[]; // specific, evidence-based reasons
  recruiterQuestions: string[]; // caused by ambiguity/gaps in the resume
  tabClosingRisk: RecruiterTabRisk;
  tabClosingExplanation: string;
  fixes: string[]; // 3 highest-impact changes for the first 30 seconds
  innerMonologue: string[]; // 3-5 light lines, clearly a simulation
  disclaimer: string; // model-based simulation statement
}

export interface RecruiterSimulationRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  role?: string;
  company?: string;
}

// ─── Interview Prep Types ─────────────────────────────────────────────────

export type QuestionCategory =
  | "resume"
  | "technical"
  | "behavioral"
  | "role-specific"
  | "company-jd"
  | "weakness-gap";

export type QuestionDifficulty = "Easy" | "Medium" | "Hard" | "Final Boss";

export type InterviewRisk = "Low" | "Medium" | "High";

export interface PrepQuestion {
  question: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  whyTheyAsk: string; // grounded in the resume + JD
  risk: InterviewRisk; // risk of stumbling
  howToPrepare: string; // concise preparation direction
}

export interface InterviewPrepResult {
  readinessScore: number; // 0-100
  questions: PrepQuestion[]; // 8-12
  questionsForThem: string[]; // 5 questions to ask the interviewer
  weakSpots: string[]; // 3-5 trouble areas
  funnyLine: string;
  summary: string;
}

export interface InterviewPrepRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedin?: string;
  github?: string;
}

// ─── STAR Answer Builder Types ────────────────────────────────────────────

export interface StarSections {
  situation: string; // what was happening
  task: string; // what the candidate was responsible for
  action: string; // what specifically they did
  result: string; // what happened (honest — never invented)
}

export interface StarAssessment {
  clarity: number; // 0-100
  ownership: number; // 0-100
  specificity: number; // 0-100
  impact: number; // 0-100
}

export interface StarAnswerResult {
  sections: StarSections;
  finalAnswer: string; // natural 45-90 second spoken answer
  resultWarning?: string; // set when the story lacks a measurable result
  assessment: StarAssessment;
  followUpQuestions: string[]; // exactly 3
  funnyLine: string;
}

export interface StarAnswerRequestBody {
  config: AiRequestConfig;
  question: string; // the interview question
  experience: string; // the messy story
  resumeText?: string;
  jobDescription?: string;
}

// ─── Tell Me About Yourself Types ─────────────────────────────────────────

export interface TellMeResult {
  thirtySeconds: string; // very concise introduction
  sixtySeconds: string; // standard interview response
  ninetySeconds: string; // more detailed version
  whyThisWorks: string[]; // exactly 3 short points
  avoidSaying: string[]; // exactly 3 things to avoid
  funnyLine: string;
}

export interface TellMeRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedin?: string;
  github?: string;
}

// ─── Weakness Detector Types ──────────────────────────────────────────────

export type WeaknessRisk = "LOW" | "MEDIUM" | "HIGH" | "FINAL BOSS";

export interface WeaknessItem {
  weakness: string; // what the weakness is
  whyItExists: string; // why it's a weakness (gap analysis)
  evidence: string; // what the resume shows (or lacks)
  likelyQuestion: string; // the interviewer question it invites
  risk: WeaknessRisk;
  howToPrepare: string; // truthful prep strategy
}

export interface ClaimToDefend {
  claim: string; // resume claim
  likelyFollowUp: string; // probe question
  evidenceAvailable: string; // what supports it (or "thin")
}

export interface WeaknessResult {
  weaknessScore: number; // 0-100
  weaknesses: WeaknessItem[]; // ranked 1-5
  claimsToDefend: ClaimToDefend[];
  gapStrategy: string; // truthful response strategy for the biggest gap
  funnyLine: string;
}

export interface WeaknessRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedin?: string;
  github?: string;
}

// ─── Interview Boss Fight Types ───────────────────────────────────────────

export type BossVerdict = "READY" | "NEEDS WORK" | "ABSOLUTELY COOKED";

export interface BossFightQuestion {
  index: number; // 1-10
  question: string;
  difficulty: BossDifficulty; // reuses existing EASY/MEDIUM/HARD/FINAL_BOSS
  category: string; // resume / technical / behavioral / role-specific / gap
}

export interface BossFightSession {
  questions: BossFightQuestion[]; // exactly 10
  role?: string;
  experienceLevel?: string;
  disclaimer: string;
}

export interface BossAnswerEvaluation {
  score: number; // 0-100
  whatWasGood: string[];
  whatWasWeak: string[];
  whatTheyMightAskNext: string;
  betterAnswerStructure: string; // guidance, not a memorizable perfect answer
}

export interface BossFightResults {
  overallScore: number; // 0-100
  strongestArea: string;
  weakestArea: string;
  mostDangerousQuestion: string;
  interviewReadiness: number; // 0-100
  verdict: BossVerdict;
  funnyLine: string;
}

export interface StartBossFightBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  role?: string;
  experienceLevel?: string;
}

export interface EvaluateBossAnswerBody {
  config: AiRequestConfig;
  question: BossFightQuestion;
  answer: string;
  resumeText: string;
  jobDescription: string;
}

// ─── Employment Aura Types ────────────────────────────────────────────────

export interface EmploymentAuraResult {
  overallAura: number; // 0-100
  resumeAura: number; // 0-100
  skillAura: number; // 0-100
  experienceAura: number; // 0-100
  projectAura: number; // 0-100
  applicationAura: number; // 0-100
  auraType: string; // e.g. "The Quiet Menace"
  biggestW: string; // strongest career signal
  biggestL: string; // weakest signal
  auraBoosters: string[]; // 3 concrete improvements
  auraDrainers: string[]; // 3 things hurting the profile
  verdict: string; // funny final verdict
}

export interface EmploymentAuraRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

// ─── Rizz Score Types ─────────────────────────────────────────────────────

export type RizzVerdict =
  | "NO RIZZ"
  | "LOW RIZZ"
  | "DECENT RIZZ"
  | "HIGH RIZZ"
  | "UNREASONABLE AURA";

export interface RizzScoreResult {
  rizzScore: number; // 0-100
  relevance: number; // 0-100
  specificity: number; // 0-100
  credibility: number; // 0-100
  clarity: number; // 0-100
  differentiation: number; // 0-100
  evidence: number; // 0-100
  rizzBoosters: string[]; // what makes the application convincing
  rizzKillers: string[]; // what weakens it
  recruiterPitch: string; // one concise sentence
  verdict: RizzVerdict;
}

export interface RizzScoreRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

// ─── Cooked Meter Types ───────────────────────────────────────────────────

export type CookedVerdict =
  | "NOT COOKED"
  | "LIGHTLY COOKED"
  | "MEDIUM"
  | "WELL DONE"
  | "ABSOLUTELY COOKED";

export type CanApply = "YES" | "YES, BUT STRETCH" | "PROBABLY NOT";

export interface CookedMeterResult {
  cookedScore: number; // 0-100 (higher = more cooked)
  verdict: CookedVerdict;
  why: string[]; // 3-5 evidence-based reasons
  whatSavesYou: string[]; // strongest transferable/relevant factors
  whatCookedYou: string; // largest mismatch
  canYouStillApply: CanApply;
  howToLower: string[]; // 3-5 concrete actions
}

export interface CookedMeterRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

// ─── Resume Court Types ───────────────────────────────────────────────────

export type CourtVerdict =
  | "SUPPORTED"
  | "PARTIALLY SUPPORTED"
  | "UNVERIFIED"
  | "CONTRADICTION";

export interface ResumeClaim {
  claim: string;
  evidence: string;
  prosecution: string;
  defense: string;
  verdict: CourtVerdict;
}

export interface ResumeCourtResult {
  claims: ResumeClaim[];
  mostDangerousClaim: string;
  bestClaim: string;
  sentenceToFix: string;
}

export interface ResumeCourtRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  jobDescription?: string;
}

// ─── ATS Boss Fight Types ─────────────────────────────────────────────────

export interface BossAttackCategory {
  name: string;
  damage: number;
  why: string;
}

export interface AtsBossFightResult {
  bossHp: number;
  yourDamage: number;
  attackCategories: BossAttackCategory[];
  bossWeaknesses: string[];
  yourWeapons: string[];
  bossAttacks: string[];
  atsBattleScore: number;
  nextMove: string[];
}

export interface AtsBossFightRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
}

// ─── Skill Issue Types ────────────────────────────────────────────────────

export interface SecondaryIssue {
  problem: string;
  evidence: string;
  impact: string;
  fix: string;
}

export type FinalDiagnosis =
  | "Skill issue"
  | "Positioning issue"
  | "Experience issue"
  | "Evidence issue"
  | "Application strategy issue";

export interface SkillIssueResult {
  primaryIssue: string;
  secondaryIssues: SecondaryIssue[];
  notTheProblem: string[];
  thirtyDayFix: string[];
  finalDiagnosis: FinalDiagnosis;
}

export interface SkillIssueRequestBody {
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedinUrl?: string;
  githubUrl?: string;
}
