"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  CoverLetterRequestBody,
  CoverLetterResult,
  CoverLetterTone,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const TONE_OPTIONS: { value: CoverLetterTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "confident", label: "Confident" },
  { value: "direct", label: "Direct" },
  { value: "startup", label: "Startup" },
  { value: "short-punchy", label: "Short & Punchy" },
];

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Analyzing the job description...",
  "Ditching the corporate template...",
  "Writing something a human would actually send...",
  "Polishing the opener...",
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
      <span className="text-zinc-600 font-medium">Cover Letter Generator</span>
    </nav>
  );
}

function ToneChips({
  value,
  onChange,
  disabled,
}: {
  value: CoverLetterTone;
  onChange: (v: CoverLetterTone) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TONE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              active
                ? "bg-red-50 border-red-300 text-red-700"
                : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function CoverLetterGeneratorPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CoverLetterResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hiringManagerName, setHiringManagerName] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [tone, setTone] = useState<CoverLetterTone>("professional");

  const canSubmit = Boolean(
    resumeText.trim() &&
      jobDescription.trim() &&
      companyName.trim() &&
      jobTitle.trim() &&
      config.apiKey.trim(),
  );

  async function generate(toneOverride?: CoverLetterTone) {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. The letter only uses what's actually in it.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required.");
    if (!companyName.trim())
      return setValidationError("Company name is required.");
    if (!jobTitle.trim())
      return setValidationError("Job title is required.");

    const effectiveTone = toneOverride ?? tone;
    if (toneOverride) setTone(toneOverride);
    setPhase("loading");
    const body: CoverLetterRequestBody = {
      config,
      resumeText,
      jobDescription,
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      hiringManagerName: hiringManagerName.trim() || undefined,
      additionalContext: additionalContext.trim() || undefined,
      tone: effectiveTone,
    };
    try {
      const res = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as CoverLetterResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void generate();
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
            Write a cover letter that doesn&apos;t sound like ChatGPT.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return (
      <ResultsView
        result={result}
        onRegenerate={() => void generate()}
        onShorter={() => void generate("short-punchy")}
        onMoreDirect={() => void generate("direct")}
        onReset={handleReset}
      />
    );
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
      companyName={companyName}
      setCompanyName={setCompanyName}
      jobTitle={jobTitle}
      setJobTitle={setJobTitle}
      hiringManagerName={hiringManagerName}
      setHiringManagerName={setHiringManagerName}
      additionalContext={additionalContext}
      setAdditionalContext={setAdditionalContext}
      tone={tone}
      setTone={setTone}
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
  companyName: string;
  setCompanyName: (t: string) => void;
  jobTitle: string;
  setJobTitle: (t: string) => void;
  hiringManagerName: string;
  setHiringManagerName: (t: string) => void;
  additionalContext: string;
  setAdditionalContext: (t: string) => void;
  tone: CoverLetterTone;
  setTone: (t: CoverLetterTone) => void;
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
    companyName,
    setCompanyName,
    jobTitle,
    setJobTitle,
    hiringManagerName,
    setHiringManagerName,
    additionalContext,
    setAdditionalContext,
    tone,
    setTone,
    onSubmit,
  } = props;
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Write a cover letter that doesn&apos;t sound like ChatGPT.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Specific to the job. Based on your actual experience. No corporate fan fiction.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          Corporate poetry generator: disabled.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(the raw material)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={phase === "loading"}
                />
                <p className="field-help mt-2">
                  Strongly recommended &mdash; the letter only uses what&apos;s actually in here. No fabrication.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  The letter maps your experience to what they actually asked for.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                The job <span>(who and where)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="company" className="field-label">
                  Company Name
                </label>
                <input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="e.g. Stripe"
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="title" className="field-label">
                  Job Title
                </label>
                <input
                  id="title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="e.g. Frontend Engineer"
                  className="field-control"
                />
              </div>
            </div>
            <div className="input-grid mt-3">
              <div className="input-pane">
                <label htmlFor="manager" className="field-label">
                  Hiring Manager Name <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="manager"
                  value={hiringManagerName}
                  onChange={(e) => setHiringManagerName(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="e.g. Priya Sharma"
                  className="field-control"
                />
                <p className="field-help">
                  If you know it. &ldquo;Dear Priya&rdquo; beats &ldquo;Dear Hiring Manager&rdquo; every time.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="context" className="field-label">
                  Additional Context <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="context"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Referral name, why you want this company, anything the resume doesn't show..."
                  rows={4}
                  className="field-control"
                />
              </div>
            </div>
          </section>

          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">3</span>
              <div>
                <h2>Tone <span>(default is concise)</span></h2>
              </div>
            </div>
            <ToneChips
              value={tone}
              onChange={setTone}
              disabled={phase === "loading"}
            />
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
              disabled={!canSubmit || phase === "loading"}
              className="cta-primary action-primary"
            >
              Write My Cover Letter <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onRegenerate,
  onShorter,
  onMoreDirect,
  onReset,
}: {
  result: CoverLetterResult;
  onRegenerate: () => void;
  onShorter: () => void;
  onMoreDirect: () => void;
  onReset: () => void;
}) {
  const fullLetter = [result.subject ? `Subject: ${result.subject}` : "", result.coverLetter]
    .filter(Boolean)
    .join("\n\n");

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        {result.subject && (
          <section className="card mt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Subject
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{result.subject}</p>
              </div>
              <CopyButton text={result.subject} />
            </div>
          </section>
        )}

        <section id="letter" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">1</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-tight text-zinc-900">Cover Letter</h2>
            </div>
            <CopyButton text={fullLetter} label="Copy letter" />
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
              {result.coverLetter}
            </p>
          </div>
          {result.disclaimer && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Heads up &mdash; thin evidence
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">{result.disclaimer}</p>
            </div>
          )}
        </section>

        <section id="why" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">2</span>
            <div>
              <h2 className="text-base font-bold leading-tight text-zinc-900">Why this works</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Relevant experience used
              </p>
              <ul className="mt-2 space-y-1.5">
                {result.whyThisWorks.relevantExperience.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-800">
                    <span aria-hidden className="font-bold text-red-600">&ndash;</span>
                    <span>{item}</span>
                  </li>
                ))}
                {result.whyThisWorks.relevantExperience.length === 0 && (
                  <li className="text-sm text-zinc-400">Not specified.</li>
                )}
              </ul>
            </div>
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                JD requirements addressed
              </p>
              <ul className="mt-2 space-y-1.5">
                {result.whyThisWorks.jdRequirementsAddressed.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-800">
                    <span aria-hidden className="font-bold text-red-600">&ndash;</span>
                    <span>{item}</span>
                  </li>
                ))}
                {result.whyThisWorks.jdRequirementsAddressed.length === 0 && (
                  <li className="text-sm text-zinc-400">Not specified.</li>
                )}
              </ul>
            </div>
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Why the opening is specific
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-800">
                {result.whyThisWorks.openingSpecificity || "Not specified."}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                What makes it less generic
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-800">
                {result.whyThisWorks.lessGeneric || "Not specified."}
              </p>
            </div>
          </div>
        </section>

        <div className="action-row mt-5">
          <button type="button" onClick={onRegenerate} className="cta-primary action-primary">
            Regenerate
          </button>
          <button type="button" onClick={onShorter} className="cta-secondary">
            Shorter
          </button>
          <button type="button" onClick={onMoreDirect} className="cta-secondary">
            More direct
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
          <CopyButton text={fullLetter} label="Copy full letter" />
        </div>
      </div>
    </main>
  );
}