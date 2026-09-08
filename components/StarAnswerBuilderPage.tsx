"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  StarAnswerRequestBody,
  StarAnswerResult,
  StarSections,
  StarAssessment,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Untangling your story...",
  "Separating the signal from the 'uhh basically so'...",
  "Fitting everything into S-T-A-R...",
  "Checking for measurable results...",
  "Writing the spoken answer...",
];

const SECTION_META: { key: keyof StarSections; label: string; blurb: string }[] = [
  { key: "situation", label: "Situation", blurb: "What was happening?" },
  { key: "task", label: "Task", blurb: "What were you responsible for?" },
  { key: "action", label: "Action", blurb: "What specifically did you do?" },
  { key: "result", label: "Result", blurb: "What happened?" },
];

const ASSESSMENT_META: { key: keyof StarAssessment; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "ownership", label: "Ownership" },
  { key: "specificity", label: "Specificity" },
  { key: "impact", label: "Impact" },
];

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
      <span className="text-zinc-600 font-medium">STAR Answer Builder</span>
    </nav>
  );
}

export function StarAnswerBuilderPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<StarAnswerResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [question, setQuestion] = useState(
    "What was a difficult problem you solved?",
  );
  const [experience, setExperience] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const canSubmit = Boolean(
    question.trim() && experience.trim() && config.apiKey.trim(),
  );

  async function build() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!question.trim())
      return setValidationError("The question is required.");
    if (!experience.trim())
      return setValidationError("The story is required. Dump the messy version — we'll structure it.");

    setPhase("loading");
    const body: StarAnswerRequestBody = {
      config,
      question,
      experience,
      resumeText: resumeText.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
    };
    try {
      const res = await fetch("/api/build-star-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as StarAnswerResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void build();
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
            Turn that messy story into an interview answer.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRebuild={() => void build()} onReset={handleReset} />;
  }

  return (
    <InputWorkspace
      canSubmit={canSubmit}
      error={error}
      validationError={validationError}
      config={config}
      setConfig={setConfig}
      question={question}
      setQuestion={setQuestion}
      experience={experience}
      setExperience={setExperience}
      resumeText={resumeText}
      setResumeText={setResumeText}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
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
  question: string;
  setQuestion: (t: string) => void;
  experience: string;
  setExperience: (t: string) => void;
  resumeText: string;
  setResumeText: (t: string) => void;
  jobDescription: string;
  setJobDescription: (t: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    canSubmit,
    error,
    validationError,
    config,
    setConfig,
    question,
    setQuestion,
    experience,
    setExperience,
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    onSubmit,
  } = props;
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Turn that messy story into an interview answer.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Because &ldquo;uhh... basically... so...&rdquo; is not a STAR answer.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The question <span>(what did they ask?)</span>
              </h2>
            </div>
            <label htmlFor="sa-question" className="field-label">
              Interview Question
            </label>
            <input
              id="sa-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="field-control"
              placeholder="e.g. What was a difficult problem you solved?"
            />
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                The messy story <span>(dump it here)</span>
              </h2>
            </div>
            <label htmlFor="sa-story" className="field-label">
              Experience / story
            </label>
            <textarea
              id="sa-story"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder={"Type it exactly how you'd tell a friend — rambling, out of order, 'we did a thing', missing details and all...\n\nWe'll turn it into structure. We will not invent the result."}
              rows={12}
              className="field-control jd-input"
            />
            <p className="field-help">
              The more messy truth you give us, the better — as long as the result is real, or honestly absent.
            </p>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">3</span>
              <h2>
                Extra context <span>(optional)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={false}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="sa-jd" className="field-label">
                  Job Description <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="sa-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the target JD to sharpen wording..."
                  rows={8}
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
              Build My Answer <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onRebuild,
  onReset,
}: {
  result: StarAnswerResult;
  onRebuild: () => void;
  onReset: () => void;
}) {
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <div className="workflow-heading">
            <span className="step-badge">S</span>
            <div>
              <h2 className="text-base font-bold leading-tight text-zinc-900">
                The STAR Structure
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Clean sections, ready to speak from.
              </p>
            </div>
          </div>
          <div className="mt-1 space-y-3">
            {SECTION_META.map((s) => (
              <StarSectionCard key={s.key} sectionKey={s.key} label={s.label} blurb={s.blurb} text={result.sections[s.key]} />
            ))}
          </div>
        </section>

        {result.finalAnswer && (
          <section className="card mt-4 border-red-200 bg-red-50/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                  Final Answer
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  A natural 45&ndash;90 second spoken answer. Read it, don&apos;t memorize it.
                </p>
              </div>
              <CopyButton text={result.finalAnswer} />
            </div>
            <div className="mt-2 rounded-md border border-red-200 bg-white p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                {result.finalAnswer}
              </p>
            </div>
          </section>
        )}

        {result.resultWarning && (
          <section className="card mt-4 border-amber-200 bg-amber-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Missing result
            </p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-amber-800">
              {result.resultWarning}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              We didn&apos;t invent one. If the outcome is real and you have it, add it and rebuild.
            </p>
          </section>
        )}

        <section className="card mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Interviewer Score
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ASSESSMENT_META.map((a) => {
              const score = result.assessment[a.key];
              const color =
                score >= 70
                  ? "bg-emerald-500"
                  : score >= 40
                    ? "bg-amber-500"
                    : "bg-red-500";
              const textColor =
                score >= 70
                  ? "text-emerald-700"
                  : score >= 40
                    ? "text-amber-700"
                    : "text-red-700";
              return (
                <div key={a.key} className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {a.label}
                    </p>
                    <p className={`text-sm font-bold ${textColor}`}>{score}</p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {result.followUpQuestions.some((f) => f) && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">F</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  Follow-up Questions
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  What an interviewer would likely probe next.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-2">
              {result.followUpQuestions.filter(Boolean).map((q, i) => (
                <div
                  key={i}
                  className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3 text-sm italic leading-relaxed text-zinc-700"
                >
                  &ldquo;{q}&rdquo;
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          {result.funnyLine || "Story upgraded from 'trust me bro' to actual structure."}
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRebuild} className="cta-primary action-primary">
            Rebuild
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function StarSectionCard({
  sectionKey,
  label,
  blurb,
  text,
}: {
  sectionKey: keyof StarSections;
  label: string;
  blurb: string;
  text: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {label} <span className="font-normal normal-case tracking-normal text-zinc-500">&middot; {blurb}</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {text || (
              <span className="italic text-zinc-400">
                {sectionKey === "result"
                  ? "No result was provided — kept honest, not invented."
                  : "Not enough in the story to fill this section."}
              </span>
            )}
          </p>
        </div>
        <CopyButton text={`${label}: ${text}`} />
      </div>
    </div>
  );
}