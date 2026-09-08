"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  BossFightSession,
  BossFightQuestion,
  BossAnswerEvaluation,
  BossFightResults,
  BossVerdict,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "interview" | "evaluating" | "feedback" | "results";

const LOADING_MESSAGES = [
  "Generating your 10-question gauntlet...",
  "Building the difficulty curve...",
  "Studying your resume for weak points...",
  "Preparing the Final Boss...",
  "The interviewer is ready...",
];

const DIFFICULTY_META: Record<string, { label: string; badge: string }> = {
  EASY: { label: "EASY", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MEDIUM: { label: "MEDIUM", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  HARD: { label: "HARD", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  FINAL_BOSS: { label: "FINAL BOSS", badge: "bg-red-50 text-red-700 border-red-200" },
};

const VERDICT_STYLES: Record<
  BossVerdict,
  { text: string; bg: string; border: string; note: string }
> = {
  READY: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    note: "Your answers held up. The resume survived.",
  },
  "NEEDS WORK": {
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    note: "Some answers wobbled. Focused prep will close the gaps.",
  },
  "ABSOLUTELY COOKED": {
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    note: "The Final Boss got you. The good news: it happened here, not in the real thing.",
  },
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className="text-[11px] font-semibold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:border-red-300 rounded-md px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">Interview Boss Fight</span>
    </nav>
  );
}

export function InterviewBossFightPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  // Interview state — all client-side per spec
  const [session, setSession] = useState<BossFightSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluations, setEvaluations] = useState<BossAnswerEvaluation[]>([]);

  const canSubmit = Boolean(
    resumeText.trim() && jobDescription.trim() && config.apiKey.trim(),
  );

  const currentQuestion: BossFightQuestion | null =
    session?.questions[currentIndex] ?? null;

  async function startFight() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. The boss fights against your real claims.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. The questions target a specific job.");

    setPhase("loading");
    const body = {
      config,
      resumeText,
      jobDescription,
      role: role.trim() || undefined,
      experienceLevel: experienceLevel.trim() || undefined,
    };
    try {
      const res = await fetch("/api/start-boss-fight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      const s = json as BossFightSession;
      setSession(s);
      setCurrentIndex(0);
      setEvaluations([]);
      setAnswer("");
      setPhase("interview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  async function lockIn() {
    if (!currentQuestion || !answer.trim()) return;
    setError("");
    setPhase("evaluating");
    const body = {
      config,
      question: currentQuestion,
      answer,
      resumeText,
      jobDescription,
    };
    try {
      const res = await fetch("/api/evaluate-boss-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Evaluation failed. Try again.");
      const evalResult = json as BossAnswerEvaluation;
      const next = [...evaluations];
      next[currentIndex] = evalResult;
      setEvaluations(next);
      setPhase("feedback");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("interview");
    }
  }

  function nextQuestion() {
    if (!session) return;
    if (currentIndex + 1 >= session.questions.length) {
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setCurrentIndex((i) => i + 1);
    setAnswer("");
    setPhase("interview");
  }

  function retryQuestion() {
    setAnswer("");
    setPhase("interview");
  }

  function restart() {
    setSession(null);
    setEvaluations([]);
    setCurrentIndex(0);
    setAnswer("");
    setError("");
    setValidationError("");
    setPhase("idle");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void startFight();
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-white">
        <div className="workflow-wrap pt-6">
          <Breadcrumb />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
            Get interrogated before the interviewer does.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results") {
    return (
      <ResultsView
        session={session}
        evaluations={evaluations}
        onRestart={restart}
      />
    );
  }

  if (phase === "interview" || phase === "evaluating") {
    return (
      <InterviewView
        question={currentQuestion}
        total={session?.questions.length ?? 0}
        answer={answer}
        setAnswer={setAnswer}
        onLockIn={() => void lockIn()}
        evaluating={phase === "evaluating"}
        error={error}
      />
    );
  }

  if (phase === "feedback") {
    const evaluation = evaluations[currentIndex];
    return (
      <FeedbackView
        question={currentQuestion}
        answer={answer}
        evaluation={evaluation}
        onRetry={retryQuestion}
        onNext={nextQuestion}
        isLast={currentIndex >= (session?.questions.length ?? 1) - 1}
      />
    );
  }

  return (
    <InputWorkspace
      canSubmit={canSubmit}
      error={error}
      validationError={validationError}
      config={config}
      setConfig={setConfig}
      resumeText={resumeText}
      setResumeText={setResumeText}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      role={role}
      setRole={setRole}
      experienceLevel={experienceLevel}
      setExperienceLevel={setExperienceLevel}
      onSubmit={handleSubmit}
    />
  );
}

function InputWorkspace(props: {
  canSubmit: boolean;
  error: string;
  validationError: string;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (t: string) => void;
  jobDescription: string;
  setJobDescription: (t: string) => void;
  role: string;
  setRole: (t: string) => void;
  experienceLevel: string;
  setExperienceLevel: (t: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    canSubmit,
    error,
    validationError,
    config,
    setConfig,
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    role,
    setRole,
    experienceLevel,
    setExperienceLevel,
    onSubmit,
  } = props;
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Get interrogated before the interviewer does.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Your resume made the claims. Now defend them.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The claims in question <span>(resume + JD)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={false}
                />
                <p className="field-help mt-2">
                  The boss fights against what you actually claimed. No fabricated experience.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="bf-jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="bf-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  The questions target this specific job.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                Fight settings <span>(optional)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="bf-role" className="field-label">
                  Role <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="bf-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Frontend Engineer"
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="bf-experience" className="field-label">
                  Experience Level <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="bf-experience"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  placeholder="e.g. 3 years, mid-level"
                  className="field-control"
                />
              </div>
            </div>
          </section>

          <div className="config-card">
            <ProviderConfig config={config} onChange={setConfig} compact />
          </div>

          {(validationError || error) && (
            <div className="form-error" role="alert">
              {validationError || error}
            </div>
          )}

          <div className="action-row">
            <button
              type="submit"
              disabled={!canSubmit}
              className="cta-primary action-primary"
            >
              Start Boss Fight <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function InterviewView({
  question,
  total,
  answer,
  setAnswer,
  onLockIn,
  evaluating,
  error,
}: {
  question: BossFightQuestion | null;
  total: number;
  answer: string;
  setAnswer: (t: string) => void;
  onLockIn: () => void;
  evaluating: boolean;
  error: string;
}) {
  if (!question) return null;
  const diff = DIFFICULTY_META[question.difficulty] ?? DIFFICULTY_META.MEDIUM;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Question {question.index} / {total}
            </p>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider ${diff.badge}`}
            >
              {diff.label}
            </span>
          </div>
          <p className="mt-3 text-lg font-semibold leading-relaxed text-zinc-900">
            {question.question}
          </p>
          <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-red-600"
              style={{ width: `${(question.index / total) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-zinc-400">
            {((question.index / total) * 100).toFixed(0)}% through the gauntlet
          </p>
        </section>

        <section className="card mt-4">
          <label htmlFor="bf-answer" className="field-label">
            Your answer
          </label>
          <textarea
            id="bf-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={evaluating}
            placeholder="Type your answer as if you were actually in the interview..."
            rows={10}
            className="field-control jd-input"
            autoFocus
          />
          <p className="field-help">
            Be specific. Use your real projects and metrics. Vague answers get scored as vague.
          </p>
        </section>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="action-row">
          <button
            type="button"
            onClick={onLockIn}
            disabled={!answer.trim() || evaluating}
            className="cta-primary action-primary"
          >
            {evaluating ? "Judging..." : "Lock In Answer"} {!evaluating && <span aria-hidden>&rarr;</span>}
          </button>
        </div>
      </div>
    </main>
  );
}

function FeedbackView({
  question,
  answer,
  evaluation,
  onRetry,
  onNext,
  isLast,
}: {
  question: BossFightQuestion | null;
  answer: string;
  evaluation: BossAnswerEvaluation | undefined;
  onRetry: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  if (!question || !evaluation) return null;
  const diff = DIFFICULTY_META[question.difficulty] ?? DIFFICULTY_META.MEDIUM;
  const scoreColor =
    evaluation.score >= 70
      ? "text-emerald-700"
      : evaluation.score >= 40
        ? "text-amber-700"
        : "text-red-700";

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Score
              </p>
              <p className={`mt-1 text-4xl font-bold tracking-tight ${scoreColor}`}>
                {evaluation.score}
                <span className="text-lg text-zinc-400">/100</span>
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Question {question.index} &middot; {diff.label}
              </p>
              <p className="mt-0.5 max-w-xs text-xs text-zinc-600 line-clamp-2">
                {question.question}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={
                evaluation.score >= 70
                  ? "h-full rounded-full bg-emerald-500"
                  : evaluation.score >= 40
                    ? "h-full rounded-full bg-amber-500"
                    : "h-full rounded-full bg-red-500"
              }
              style={{ width: `${evaluation.score}%` }}
            />
          </div>
        </section>

        <section className="card mt-4 border-emerald-200 bg-emerald-50/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            What Was Good
          </p>
          <ul className="mt-2 space-y-1.5">
            {evaluation.whatWasGood.length > 0 ? (
              evaluation.whatWasGood.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  {g}
                </li>
              ))
            ) : (
              <li className="text-sm italic text-zinc-400">Nothing notable.</li>
            )}
          </ul>
        </section>

        <section className="card mt-4 border-red-200 bg-red-50/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
            What Was Weak
          </p>
          <ul className="mt-2 space-y-1.5">
            {evaluation.whatWasWeak.length > 0 ? (
              evaluation.whatWasWeak.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                  {w}
                </li>
              ))
            ) : (
              <li className="text-sm italic text-zinc-400">Nothing weak stood out.</li>
            )}
          </ul>
        </section>

        <section className="card mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            What They Might Ask Next
          </p>
          <p className="mt-1 text-sm italic leading-relaxed text-zinc-700">
            &ldquo;{evaluation.whatTheyMightAskNext || "—"} &rdquo;
          </p>
        </section>

        <section className="card mt-4 border-amber-200 bg-amber-50/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Better Answer Structure
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700">
            {evaluation.betterAnswerStructure}
          </p>
          <p className="mt-2 text-[10px] text-zinc-400">
            Guidance, not a script. Memorize structure, not words.
          </p>
        </section>

        {answer && (
          <details className="card mt-4">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Your submitted answer
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
              {answer}
            </p>
          </details>
        )}

        <div className="action-row mt-2">
          <button type="button" onClick={onRetry} className="cta-secondary">
            Retry Question
          </button>
          <button type="button" onClick={onNext} className="cta-primary action-primary">
            {isLast ? "See Results" : "Next Question"} <span aria-hidden>&rarr;</span>
          </button>
        </div>
      </div>
    </main>
  );
}

function computeResults(
  session: BossFightSession | null,
  evaluations: BossAnswerEvaluation[],
): BossFightResults | null {
  if (!session) return null;
  const scored = evaluations.filter(
    (e): e is BossAnswerEvaluation => typeof e?.score === "number",
  );
  if (scored.length === 0) return null;

  const overallScore = Math.round(
    scored.reduce((sum, e) => sum + e.score, 0) / scored.length,
  );

  // Most dangerous question = the one with the lowest evaluation score
  let lowestIdx = -1;
  let highestIdx = -1;
  evaluations.forEach((e, i) => {
    if (!e || typeof e.score !== "number") return;
    if (lowestIdx === -1 || e.score < evaluations[lowestIdx].score) lowestIdx = i;
    if (highestIdx === -1 || e.score > evaluations[highestIdx].score) highestIdx = i;
  });

  const verdict: BossVerdict =
    overallScore >= 70 ? "READY" : overallScore >= 45 ? "NEEDS WORK" : "ABSOLUTELY COOKED";

  return {
    overallScore,
    strongestArea:
      evaluations[highestIdx] && session.questions[highestIdx]
        ? `Strongest response was to "${session.questions[highestIdx].question}" — scored ${evaluations[highestIdx].score}/100.`
        : "Your strongest responses stayed specific and grounded in your real experience.",
    weakestArea:
      evaluations[lowestIdx] && session.questions[lowestIdx]
        ? `Weakest response was to "${session.questions[lowestIdx].question}" — scored ${evaluations[lowestIdx].score}/100.`
        : "Answers that stayed vague or light on evidence.",
    mostDangerousQuestion: session.questions[lowestIdx]?.question ?? "",
    interviewReadiness: overallScore,
    verdict,
    funnyLine:
      overallScore >= 75
        ? "Final Boss defeated."
        : overallScore >= 45
          ? "Your resume survived. Barely."
          : "Bro got exposed by question 7.",
  };
}

function ResultsView({
  session,
  evaluations,
  onRestart,
}: {
  session: BossFightSession | null;
  evaluations: BossAnswerEvaluation[];
  onRestart: () => void;
}) {
  const results = computeResults(session, evaluations);
  if (!results) return null;
  const v = VERDICT_STYLES[results.verdict];
  const scoreColor =
    results.overallScore >= 70
      ? "text-emerald-700"
      : results.overallScore >= 40
        ? "text-amber-700"
        : "text-red-700";

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className={`card mt-4 border ${v.border} ${v.bg}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Boss Fight Results
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <p className={`text-4xl font-bold tracking-tight ${scoreColor}`}>
              {results.overallScore}
              <span className="text-lg text-zinc-400">/100</span>
            </p>
            <div>
              <p className={`text-2xl font-bold tracking-tight ${v.text}`}>
                {results.verdict}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{v.note}</p>
            </div>
          </div>
          {results.mostDangerousQuestion && (
            <p className="mt-3 border-t border-current/10 pt-2 text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-700">Most dangerous question: </span>
              {results.mostDangerousQuestion}
            </p>
          )}
        </section>

        <section className="card mt-4">
          <div className="workflow-heading">
            <span className="step-badge">R</span>
            <div>
              <h2 className="text-base font-bold leading-tight text-zinc-900">The Breakdown</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Strongest area, weakest area, readiness — all computed from your locked-in answers.
              </p>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Strongest Area
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                {results.strongestArea}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                Weakest Area
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                {results.weakestArea}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Interview Readiness
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                {results.interviewReadiness}/100
              </p>
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          {results.funnyLine}
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRestart} className="cta-primary action-primary">
            Restart Interview
          </button>
        </div>
      </div>
    </main>
  );
}