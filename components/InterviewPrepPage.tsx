"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  InterviewPrepRequestBody,
  InterviewPrepResult,
  PrepQuestion,
  QuestionCategory,
  QuestionDifficulty,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume like an interviewer...",
  "Mapping the JD against your claims...",
  "Cooking up the Final Boss question...",
  "Preparing the questions you should ask back...",
  "Flagging your weak spots...",
];

const CATEGORY_META: Record<
  QuestionCategory,
  { label: string; blurb: string }
> = {
  resume: { label: "Resume", blurb: "Probing what you actually claimed." },
  technical: { label: "Technical", blurb: "Skills they'll test in conversation." },
  behavioral: { label: "Behavioral", blurb: "How you work, told through stories." },
  "role-specific": { label: "Role-specific", blurb: "The core of THIS job." },
  "company-jd": { label: "Company / JD", blurb: "Questions arising from the posting itself." },
  "weakness-gap": { label: "Weakness / Gap", blurb: "Where your evidence is thinnest." },
};

const DIFFICULTY_STYLES: Record<QuestionDifficulty, string> = {
  Easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Hard: "bg-orange-50 text-orange-700 border-orange-200",
  "Final Boss": "bg-red-50 text-red-700 border-red-200",
};

const RISK_STYLES: Record<string, string> = {
  Low: "text-emerald-700",
  Medium: "text-amber-700",
  High: "text-red-700",
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
      <span className="text-zinc-600 font-medium">Interview Prep</span>
    </nav>
  );
}

export function InterviewPrepPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<InterviewPrepResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");

  const canSubmit = Boolean(
    resumeText.trim() && jobDescription.trim() && config.apiKey.trim(),
  );

  async function prepare() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Questions come from your actual claims.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. The prep targets a specific job.");

    setPhase("loading");
    const body: InterviewPrepRequestBody = {
      config,
      resumeText,
      jobDescription,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
    };
    try {
      const res = await fetch("/api/prepare-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as InterviewPrepResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void prepare();
  }

  function handleReset() {
    setResult(null);
    setError("");
    setValidationError("");
    setPhase("idle");
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-white">
        <div className="workflow-wrap pt-6">
          <Breadcrumb />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
            Know what they&apos;re going to ask.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRedo={() => void prepare()} onReset={handleReset} />;
  }

  return (
    <InputWorkspace
      phase={phase}
      canSubmit={canSubmit}
      error={error}
      validationError={validationError}
      config={config}
      setConfig={setConfig}
      resumeText={resumeText}
      setResumeText={setResumeText}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      linkedin={linkedin}
      setLinkedin={setLinkedin}
      github={github}
      setGithub={setGithub}
      onSubmit={handleSubmit}
    />
  );
}

function InputWorkspace(props: {
  phase: Phase;
  canSubmit: boolean;
  error: string;
  validationError: string;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (t: string) => void;
  jobDescription: string;
  setJobDescription: (t: string) => void;
  linkedin: string;
  setLinkedin: (t: string) => void;
  github: string;
  setGithub: (t: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    phase,
    canSubmit,
    error,
    validationError,
    config,
    setConfig,
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    linkedin,
    setLinkedin,
    github,
    setGithub,
    onSubmit,
  } = props;
  const loading = phase === "loading";
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Know what they&apos;re going to ask.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Generate interview questions from your actual resume and the actual job description.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The material <span>(resume + target job)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={loading}
                />
                <p className="field-help mt-2">
                  Questions probe what you actually claimed. No fabricated experience.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="ip-jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="ip-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  The interview is for THIS job. The questions target it.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                Extra context <span>(optional)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="ip-linkedin" className="field-label">
                  LinkedIn Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="ip-linkedin"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  disabled={loading}
                  placeholder="Paste your LinkedIn About, Experience, Skills..."
                  rows={5}
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="ip-github" className="field-label">
                  GitHub Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="ip-github"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  disabled={loading}
                  placeholder="Paste your README, pinned repos, tech stack..."
                  rows={5}
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
              disabled={!canSubmit || loading}
              className="cta-primary action-primary"
            >
              Prepare Me <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onRedo,
  onReset,
}: {
  result: InterviewPrepResult;
  onRedo: () => void;
  onReset: () => void;
}) {
  const categories = Object.keys(CATEGORY_META) as QuestionCategory[];

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Interview Readiness
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900">
            {result.readinessScore}
            <span className="text-lg text-zinc-400">/100</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Preparedness for an interview for this job, given your resume evidence.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={
                result.readinessScore >= 70
                  ? "h-full rounded-full bg-emerald-500"
                  : result.readinessScore >= 40
                    ? "h-full rounded-full bg-amber-500"
                    : "h-full rounded-full bg-red-500"
              }
              style={{ width: `${result.readinessScore}%` }}
            />
          </div>
        </section>

        {result.questions.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">Q</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  Most Likely Questions
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {result.questions.length} questions, grouped by category.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-4">
              {categories.map((cat) => {
                const qs = result.questions.filter((q) => q.category === cat);
                if (qs.length === 0) return null;
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {meta.label} <span className="text-zinc-300">&middot;</span>{" "}
                      <span className="font-normal normal-case tracking-normal text-zinc-500">
                        {meta.blurb}
                      </span>
                    </p>
                    <div className="mt-2 space-y-2">
                      {qs.map((q, i) => (
                        <QuestionCard key={`${cat}-${i}`} question={q} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {result.questionsForThem.length > 0 && (
          <section className="card mt-4 border-blue-200 bg-blue-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Questions You Should Ask Them
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Derived from the JD. No invented company facts.
            </p>
            <div className="mt-2 space-y-2">
              {result.questionsForThem.map((q, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border border-blue-200 bg-white p-3"
                >
                  <p className="text-sm leading-relaxed text-zinc-800">
                    <span className="font-bold text-blue-700">{i + 1}.</span> {q}
                  </p>
                  <CopyButton text={q} />
                </div>
              ))}
            </div>
          </section>
        )}

        {result.weakSpots.length > 0 && (
          <section className="card mt-4 border-red-200 bg-red-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Your Interview Weak Spots
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Where the JD demands more than your resume evidences.
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.weakSpots.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.summary && (
          <section className="card mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{result.summary}</p>
          </section>
        )}

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          {result.funnyLine || "Interview prep complete. Now we find out whether the resume was telling the truth."}
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRedo} className="cta-primary action-primary">
            Regenerate Prep
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function QuestionCard({ question }: { question: PrepQuestion }) {
  const copyText = [
    `Q: ${question.question}`,
    `Category: ${CATEGORY_META[question.category].label}`,
    `Difficulty: ${question.difficulty}`,
    question.whyTheyAsk ? `Why they'll ask: ${question.whyTheyAsk}` : null,
    `Risk: ${question.risk}`,
    question.howToPrepare ? `How to prepare: ${question.howToPrepare}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-zinc-900">
          {question.question}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <CopyButton text={copyText} />
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${DIFFICULTY_STYLES[question.difficulty]}`}
          >
            {question.difficulty}
          </span>
        </div>
      </div>
      {question.whyTheyAsk && (
        <div className="mt-2 border-l-2 border-zinc-300 pl-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Why they&apos;ll ask
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
            {question.whyTheyAsk}
          </p>
        </div>
      )}
      <div className="mt-2 flex flex-col gap-1.5">
        <p className="text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">Your risk:</span>{" "}
          <span className={`font-bold ${RISK_STYLES[question.risk] ?? ""}`}>
            {question.risk}
          </span>
        </p>
        {question.howToPrepare && (
          <p className="text-xs leading-relaxed text-zinc-600">
            <span className="font-semibold text-zinc-500">How to prepare:</span>{" "}
            {question.howToPrepare}
          </p>
        )}
      </div>
    </div>
  );
}