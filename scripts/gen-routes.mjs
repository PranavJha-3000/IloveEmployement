/**
 * Route generator — writes all AI API routes using the shared analysis pipeline.
 * Run once: `node scripts/gen-routes.mjs` (one-shot developer tool).
 */
import { REQ, OPT_LEN, URL_VAL, routeTemplate, emit } from "./gen-routes.lib.mjs";

const routes = [];

// 1. Skill Gap Analyzer
routes.push({
  dir: "analyze-skill-gap", title: "Skill Gap Analyzer", bodyType: "SkillGapRequestBody",
  builder: "buildSkillGapPrompt", validator: "validateSkillGapResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [OPT_LEN("linkedin", 5_000, "LinkedIn content")],
    [OPT_LEN("github", 5_000, "GitHub content")],
  ],
  prompt: [
    `const { system, user } = buildSkillGapPrompt({`,
    `  resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),`,
    `  linkedin: b.linkedin?.trim() || undefined, github: b.github?.trim() || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.matrix.length === 0 && r.biggestGaps.length === 0`,
  emptyMsg: "The analysis came back empty. Retry, or switch to a different model.",
});

// 2. ATS Boss Fight
routes.push({
  dir: "ats-boss-fight", title: "ATS Boss Fight", bodyType: "AtsBossFightRequestBody",
  builder: "buildAtsBossFightPrompt", validator: "validateAtsBossFightResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
  ],
  prompt: [
    `const { system, user } = buildAtsBossFightPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.attackCategories.length === 0`,
});

// 3. Tell Me About Yourself
routes.push({
  dir: "build-introduction", title: "Tell Me About Yourself", bodyType: "TellMeRequestBody",
  builder: "buildTellMePrompt", validator: "validateTellMeResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [OPT_LEN("linkedin", 5_000, "LinkedIn content")],
    [OPT_LEN("github", 5_000, "GitHub content")],
  ],
  prompt: [
    `const { system, user } = buildTellMePrompt({`,
    `  resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),`,
    `  linkedin: b.linkedin?.trim() || undefined, github: b.github?.trim() || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.thirtySeconds && !r.sixtySeconds && !r.ninetySeconds`,
});

// 4. STAR Answer Builder
routes.push({
  dir: "build-star-answer", title: "STAR Answer Builder", bodyType: "StarAnswerRequestBody",
  builder: "buildStarAnswerPrompt", validator: "validateStarAnswerResult", temp: 0.6,
  validations: [
    [REQ("question", "The interview question", 1_000)],
    [REQ("experience", "The story", 10_000)],
    [OPT_LEN("resumeText", 20_000, "Resume")],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `const { system, user } = buildStarAnswerPrompt({`,
    `  question: b.question.trim(), experience: b.experience.trim(),`,
    `  resumeText: b.resumeText?.trim() || undefined, jobDescription: b.jobDescription?.trim() || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.sections.situation && !r.sections.task && !r.sections.action && !r.sections.result`,
  emptyMsg: "The STAR answer came back empty. Retry, or switch to a different model.",
});

// 5. ATS Checker
routes.push({
  dir: "check-ats", title: "ATS Checker", bodyType: "AtsCheckRequestBody",
  builder: "buildAtsPrompt", validator: "validateAtsCheckResult", temp: 0.4,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `const { system, user } = buildAtsPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription?.trim() || undefined });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.atsScore === 0 && r.formatChecks.length === 0`,
  emptyMsg: "The ATS check came back empty. Retry, or switch to a different model.",
});

// 6. Delulu Detector
routes.push({
  dir: "check-delulu", title: "Delulu Detector", bodyType: "DeluluCheckRequestBody",
  builder: "buildDeluluPrompt", validator: "validateDeluluCheckResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `const { system, user } = buildDeluluPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,`,
    `  linkedinContext: p.linkedinContext || undefined, githubContext: p.githubContext || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.verdict`,
  emptyMsg: "The delulu check came back empty. Retry, or switch to a different model.",
});

// 7. GitHub Resume Checker
routes.push({
  dir: "check-github-resume", title: "GitHub Resume Checker", bodyType: "GitHubResumeRequestBody",
  builder: "buildGitHubResumePrompt", validator: "validateGitHubResumeResult", temp: 0.6,
  validations: [
    [REQ("githubInput", "GitHub input", 10_000)],
    [OPT_LEN("resumeText", 20_000, "Resume")],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `const { system, user } = buildGitHubResumePrompt({ githubInput: b.githubInput.trim(),`,
    `  resumeText: b.resumeText?.trim() || undefined, jobDescription: b.jobDescription?.trim() || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.projectsWorthShowing.length === 0 && r.claims.length === 0 && r.missingFromResume.length === 0`,
  emptyMsg: "The GitHub check came back empty. Retry, or switch to a different model.",
});

// 8. Resume Truth Detector
routes.push({
  dir: "check-resume-truth", title: "Resume Truth Detector", bodyType: "ResumeTruthRequestBody",
  builder: "buildResumeTruthPrompt", validator: "validateResumeTruthResult", temp: 0.5,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [OPT_LEN("linkedin", 5_000, "LinkedIn content")],
    [OPT_LEN("github", 5_000, "GitHub content")],
    [OPT_LEN("portfolio", 5_000, "Portfolio content")],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `const { system, user } = buildResumeTruthPrompt({ resumeText: b.resumeText.trim(),`,
    `  linkedin: b.linkedin?.trim() || undefined, github: b.github?.trim() || undefined,`,
    `  portfolio: b.portfolio?.trim() || undefined, jobDescription: b.jobDescription?.trim() || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.claims.length === 0`,
  emptyMsg: "The audit came back empty. Retry, or switch to a different model.",
});

// 9. Cooked Meter
routes.push({
  dir: "cooked-meter", title: "Cooked Meter", bodyType: "CookedMeterRequestBody",
  builder: "buildCookedMeterPrompt", validator: "validateCookedMeterResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `const { system, user } = buildCookedMeterPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,`,
    `  linkedinContext: p.linkedinContext || undefined, githubContext: p.githubContext || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.verdict`,
  emptyMsg: "The cooked meter came back empty. Retry, or switch to a different model.",
});

// 10. Weakness Detector
routes.push({
  dir: "detect-weaknesses", title: "Weakness Detector", bodyType: "WeaknessRequestBody",
  builder: "buildWeaknessPrompt", validator: "validateWeaknessResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [OPT_LEN("linkedin", 5_000, "LinkedIn content")],
    [OPT_LEN("github", 5_000, "GitHub content")],
  ],
  prompt: [
    `const { system, user } = buildWeaknessPrompt({ resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),`,
    `  linkedin: b.linkedin?.trim() || undefined, github: b.github?.trim() || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.weaknesses.length === 0`,
  emptyMsg: "The weakness analysis came back empty. Retry, or switch to a different model.",
});

// 11. Employment Aura
routes.push({
  dir: "employment-aura", title: "Employment Aura", bodyType: "EmploymentAuraRequestBody",
  builder: "buildEmploymentAuraPrompt", validator: "validateEmploymentAuraResult", temp: 0.7,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `const { system, user } = buildEmploymentAuraPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,`,
    `  linkedinContext: p.linkedinContext || undefined, githubContext: p.githubContext || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.auraType`,
  emptyMsg: "The aura came back empty. Retry, or switch to a different model.",
});

// 12. Boss Fight Answer Evaluation
routes.push({
  dir: "evaluate-boss-answer", title: "Interview Boss Answer Evaluation",
  bodyType: "EvaluateBossAnswerBody",
  builder: "buildBossFightEvaluatePrompt", validator: "validateBossAnswerEvaluation", temp: 0.6,
  validations: [
    [REQ("answer", "An answer", 8_000)],
    [OPT_LEN("resumeText", 20_000, "Resume")],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `const { system, user } = buildBossFightEvaluatePrompt({`,
    `  resumeText: b.resumeText?.trim() || "", jobDescription: b.jobDescription?.trim() || "",`,
    `  question: b.question, answer: b.answer.trim(),`,
    `});`,
    `return { system, prompt: user };`,
  ],
});

// 13. Bullet Point Fixer
routes.push({
  dir: "fix-bullet", title: "Bullet Point Fixer", bodyType: "BulletFixRequestBody",
  builder: "buildBulletFixPrompt", validator: "validateFixResult", temp: 0.6,
  validations: [
    [REQ("bullet", "A bullet point", 2_000)],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `const { system, user } = buildBulletFixPrompt({ bullet: b.bullet,`,
    `  jobDescription: b.jobDescription?.trim() || undefined,`,
    `  roleContext: b.roleContext?.trim() || undefined,`,
    `  technology: b.technology?.trim() || undefined,`,
    `  desperationLevel: b.desperationLevel,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.improved`,
  emptyMsg: "The bullet fix came back empty. Retry, or switch to a different model.",
});

// 14. Resume Fixer
routes.push({
  dir: "fix-resume", title: "Resume Fixer", bodyType: "ResumeFixRequestBody",
  builder: "buildFixPrompt", validator: "validateResumeFixResult", temp: 0.5,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
  ],
  prompt: [
    `await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl }); // best-effort, not used`,
    `const { system, user } = buildFixPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription });`,
    `return { system, prompt: user };`,
  ],
});

// 15. Cover Letter Generator
routes.push({
  dir: "generate-cover-letter", title: "Cover Letter Generator", bodyType: "CoverLetterRequestBody",
  builder: "buildCoverLetterPrompt", validator: "validateCoverLetterResult", temp: 0.7,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [REQ("companyName", "Company name", 200)],
    [REQ("jobTitle", "Job title", 200)],
    [OPT_LEN("hiringManagerName", 100, "Hiring manager name")],
    [OPT_LEN("additionalContext", 2_000, "Additional context")],
  ],
  prompt: [
    `const { system, user } = buildCoverLetterPrompt({`,
    `  resumeText: b.resumeText, jobDescription: b.jobDescription.trim(),`,
    `  companyName: b.companyName.trim(), jobTitle: b.jobTitle.trim(),`,
    `  hiringManagerName: b.hiringManagerName?.trim() || undefined,`,
    `  additionalContext: b.additionalContext?.trim() || undefined,`,
    `  tone: b.tone || "professional",`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.coverLetter`,
  emptyMsg: "The cover letter came back empty. Retry, or switch to a different model.",
});

// 16. Recruiter Message Generator
routes.push({
  dir: "generate-recruiter-message", title: "Recruiter Message Generator",
  bodyType: "RecruiterMessageRequestBody",
  builder: "buildRecruiterMessagePrompt", validator: "validateRecruiterMessageResult", temp: 0.7,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [REQ("companyName", "Company name", 200)],
    [REQ("jobTitle", "Job title", 200)],
    [OPT_LEN("recruiterName", 100, "Recruiter name")],
    [OPT_LEN("additionalContext", 2_000, "Additional context")],
  ],
  prompt: [
    `const { system, user } = buildRecruiterMessagePrompt({`,
    `  resumeText: b.resumeText, jobDescription: b.jobDescription.trim(),`,
    `  companyName: b.companyName.trim(), jobTitle: b.jobTitle.trim(),`,
    `  recruiterName: b.recruiterName?.trim() || undefined,`,
    `  context: b.context || "cold-outreach",`,
    `  additionalContext: b.additionalContext?.trim() || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.variants.short.message && !r.variants.confident.message && !r.variants.warm.message`,
  emptyMsg: "The message came back empty. Retry, or switch to a different model.",
});

// 17. LinkedIn Optimizer
routes.push({
  dir: "optimize-linkedin", title: "LinkedIn Optimizer", bodyType: "LinkedInOptimizerRequestBody",
  builder: "buildLinkedInOptimizerPrompt", validator: "validateLinkedInOptimizerResult", temp: 0.6,
  validations: [
    [
      `{ if (!b.linkedinContent?.trim() && !b.linkedinUrl?.trim()) return "LinkedIn profile is required. Paste your profile content or provide a profile URL."; }`,
    ],
    [OPT_LEN("linkedinContent", 5_000, "LinkedIn content")],
    [OPT_LEN("resumeText", 20_000, "Resume")],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `let content = b.linkedinContent?.trim() || "";`,
    `if (!content && b.linkedinUrl?.trim()) {`,
    `  const f = await import("@/lib/utils");`,
    `  const text = await f.fetchProfileText(b.linkedinUrl);`,
    `  if (text) content = text;`,
    `}`,
    `const { system, user } = buildLinkedInOptimizerPrompt({`,
    `  linkedinUrl: b.linkedinUrl?.trim() || undefined,`,
    `  linkedinContent: content || undefined,`,
    `  jobDescription: b.jobDescription?.trim() || undefined,`,
    `  resumeText: b.resumeText?.trim() || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.linkedinScore === 0`,
  emptyMsg: "The LinkedIn optimization came back empty. Retry, or switch to a different model.",
});

// 18. Resume Optimizer
routes.push({
  dir: "optimize-resume", title: "Resume Optimizer", bodyType: "ResumeOptimizationRequest",
  builder: "buildOptimizationUserPrompt", validator: "validateResumeOptimization", temp: 0.3,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
    [`{ if (!b.analysis || typeof b.analysis !== "object" || Array.isArray(b.analysis)) return "Run a full analysis first before requesting an optimized resume."; }`],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `let user = buildOptimizationUserPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription, analysis: b.analysis });`,
    `if (p.linkedinContext) user += "\\n\\n" + p.linkedinContext;`,
    `if (p.githubContext) user += "\\n\\n" + p.githubContext;`,
    `return {`,
    `  system: "You are a professional resume optimizer. The user has supplied a resume, a job description, and prior analysis. Fix their mistakes and polish the resume. Follow the truth filter rules strictly. Respond ONLY with valid JSON matching the schema in your instructions.",`,
    `  prompt: user,`,
    `};`,
  ],
  isEmpty: `!r.optimizedResume.trim()`,
  emptyMsg: "The optimizer returned empty content. Try again.",
});

// 19. Interview Prep
routes.push({
  dir: "prepare-interview", title: "Interview Prep", bodyType: "InterviewPrepRequestBody",
  builder: "buildInterviewPrepPrompt", validator: "validateInterviewPrepResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [OPT_LEN("linkedin", 5_000, "LinkedIn content")],
    [OPT_LEN("github", 5_000, "GitHub content")],
  ],
  prompt: [
    `const { system, user } = buildInterviewPrepPrompt({ resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),`,
    `  linkedin: b.linkedin?.trim() || undefined, github: b.github?.trim() || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.questions.length === 0`,
  emptyMsg: "The interview prep came back empty. Retry, or switch to a different model.",
});

// 20. Resume Court
routes.push({
  dir: "resume-court", title: "Resume Court", bodyType: "ResumeCourtRequestBody",
  builder: "buildResumeCourtPrompt", validator: "validateResumeCourtResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
    [URL_VAL("portfolioUrl", "Portfolio URL")],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `let portfolioContext = "";`,
    `if (b.portfolioUrl?.trim()) {`,
    `  const { fetchProfileText, isValidUrl } = await import("@/lib/utils");`,
    `  if (isValidUrl(b.portfolioUrl)) {`,
    `    const text = await fetchProfileText(b.portfolioUrl);`,
    `    if (text) portfolioContext = "Portfolio content (fetched live):\\n" + text;`,
    `  }`,
    `}`,
    `const { system, user } = buildResumeCourtPrompt({`,
    `  resumeText: b.resumeText,`,
    `  linkedinContext: p.linkedinContext || undefined,`,
    `  githubContext: p.githubContext || undefined,`,
    `  portfolioContext: portfolioContext || undefined,`,
    `  jobDescription: b.jobDescription || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.claims.length === 0`,
  emptyMsg: "The court session came back empty. Retry, or switch to a different model.",
});

// 21. Rizz Score
routes.push({
  dir: "rizz-score", title: "Rizz Score", bodyType: "RizzScoreRequestBody",
  builder: "buildRizzScorePrompt", validator: "validateRizzScoreResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `const { system, user } = buildRizzScorePrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,`,
    `  linkedinContext: p.linkedinContext || undefined, githubContext: p.githubContext || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.verdict`,
  emptyMsg: "The rizz score came back empty. Retry, or switch to a different model.",
});

// 22. Resume Roast
routes.push({
  dir: "roast-resume", title: "Resume Roast", bodyType: "ResumeRoastRequestBody",
  builder: "buildRoastPrompt", validator: "validateRoastResult", temp: 0.8,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [OPT_LEN("jobDescription", 10_000, "Job description")],
  ],
  prompt: [
    `const { system, user } = buildRoastPrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription?.trim() || undefined });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.verdict`,
  emptyMsg: "The roast came back empty. Retry, or switch to a different model.",
});

// 23. JD Red Flag Scanner
routes.push({
  dir: "scan-jd-red-flags", title: "JD Red Flag Scanner", bodyType: "JdRedFlagRequestBody",
  builder: "buildJdRedFlagPrompt", validator: "validateJdRedFlagResult", temp: 0.6,
  validations: [
    [REQ("jobDescription", "Job description", 10_000)],
    [OPT_LEN("companyName", 200, "Company name")],
    [OPT_LEN("role", 200, "Role")],
    [OPT_LEN("salary", 200, "Salary")],
  ],
  prompt: [
    `const { system, user } = buildJdRedFlagPrompt({ jobDescription: b.jobDescription.trim(),`,
    `  companyName: b.companyName?.trim() || undefined, role: b.role?.trim() || undefined,`,
    `  salary: b.salary?.trim() || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.categories.vague.length === 0 && r.categories.overloaded.length === 0 && r.categories.missing.length === 0 && r.categories.concern.length === 0 && r.goodSignals.length === 0`,
  emptyMsg: "The scan came back empty. Retry, or switch to a different model.",
});

// 24. Simulate Recruiter
routes.push({
  dir: "simulate-recruiter", title: "Recruiter Simulator", bodyType: "RecruiterSimulationRequestBody",
  builder: "buildRecruiterSimulatorPrompt", validator: "validateRecruiterSimulationResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [OPT_LEN("role", 200, "Role")],
    [OPT_LEN("company", 200, "Company")],
  ],
  prompt: [
    `const { system, user } = buildRecruiterSimulatorPrompt({`,
    `  resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),`,
    `  role: b.role?.trim() || undefined, company: b.company?.trim() || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.timeline.length === 0`,
  emptyMsg: "The recruiter simulation came back empty. Retry, or switch to a different model.",
});

// 25. Skill Issue
routes.push({
  dir: "skill-issue", title: "Skill Issue", bodyType: "SkillIssueRequestBody",
  builder: "buildSkillIssuePrompt", validator: "validateSkillIssueResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `const { system, user } = buildSkillIssuePrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,`,
    `  linkedinContext: p.linkedinContext || undefined, githubContext: p.githubContext || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `!r.primaryIssue`,
  emptyMsg: "The skill issue analysis came back empty. Retry, or switch to a different model.",
});

// 26. Start Boss Fight
routes.push({
  dir: "start-boss-fight", title: "Interview Boss Fight Start", bodyType: "StartBossFightBody",
  builder: "buildBossFightStartPrompt", validator: "validateBossFightSession", temp: 0.7,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [OPT_LEN("role", 200, "Role")],
    [OPT_LEN("experienceLevel", 200, "Experience level")],
  ],
  prompt: [
    `const { system, user } = buildBossFightStartPrompt({`,
    `  resumeText: b.resumeText.trim(), jobDescription: b.jobDescription.trim(),`,
    `  role: b.role?.trim() || undefined, experienceLevel: b.experienceLevel?.trim() || undefined,`,
    `});`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.questions.length === 0 || !r.questions.some((q: any) => q.question)`,
  emptyMsg: "The gauntlet came back empty. Retry, or switch to a different model.",
});

// 27. Translate JD
routes.push({
  dir: "translate-jd", title: "JD Translator", bodyType: "CorporateYappingRequest",
  builder: "buildYappingPrompt", validator: "validateYapping", temp: 0.6,
  validations: [
    [REQ("jobDescription", "Job description", 15_000)],
    [OPT_LEN("companyName", 200, "Company name")],
    [OPT_LEN("roleTitle", 200, "Role title")],
  ],
  prompt: [
    `const { system, user } = buildYappingPrompt({ jobDescription: b.jobDescription,`,
    `  companyName: b.companyName?.trim() || undefined, roleTitle: b.roleTitle?.trim() || undefined, });`,
    `return { system, prompt: user };`,
  ],
  isEmpty: `r.translations.length === 0`,
  emptyMsg: "The translator returned no usable entries. Try a longer JD or a different model.",
});

// 28. Resume Rewriter
routes.push({
  dir: "rewrite-resume", title: "Resume Rewriter", bodyType: "ResumeRewriteRequestBody",
  builder: "buildRewritePrompt", validator: "validateRewriteResult", temp: 0.6,
  validations: [
    [REQ("resumeText", "Resume", 20_000)],
    [REQ("jobDescription", "Job description", 10_000)],
    [URL_VAL("linkedinUrl", "LinkedIn URL")],
    [URL_VAL("githubUrl", "GitHub URL")],
  ],
  prompt: [
    `const p = await buildProfileContexts({ linkedinUrl: b.linkedinUrl, githubUrl: b.githubUrl });`,
    `const built = buildRewritePrompt({ resumeText: b.resumeText, jobDescription: b.jobDescription,`,
    `  desperationLevel: Number.isFinite(b.desperationLevel) ? b.desperationLevel : 2, });`,
    `let prompt = built.user;`,
    `if (p.linkedinContext) prompt += "\\n\\n" + p.linkedinContext;`,
    `if (p.githubContext) prompt += "\\n\\n" + p.githubContext;`,
    `return { system: built.system, prompt };`,
  ],
  isEmpty: `r.optimizedResume.length === 0`,
  emptyMsg: "The rewrite came back empty. Retry, or switch to a different model.",
});

// ─── Generate all routes ────────────────────────────────────────────────────
for (const route of routes) {
  route.content = routeTemplate(route);
  delete route.content;
}
for (const route of routes) {
  route.content = routeTemplate(route);
  emit(route);
}
console.log(`\nDone — regenerated ${routes.length} routes.`);