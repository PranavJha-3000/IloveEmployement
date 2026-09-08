"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  RecruiterMessageContext,
  RecruiterMessageRequestBody,
  RecruiterMessageResult,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const CONTEXT_OPTIONS: { value: RecruiterMessageContext; label: string }[] = [
  { value: "cold-outreach", label: "Cold Outreach" },
  { value: "already-applied", label: "Already Applied" },
  { value: "referral", label: "Referral" },
  { value: "follow-up", label: "Follow-up" },
];

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Studying the job description...",
  "Removing all traces of desperation...",
  "Deleting 'I hope this message finds you well'...",
  "Writing like an actual human...",
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
      <span className="text-zinc-600 font-medium">Recruiter Message</span>
    </nav>
  );
}

function ContextChips({
  value,
  onChange,
  disabled,
}: {
  value: RecruiterMessageContext;
  onChange: (v: RecruiterMessageContext) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CONTEXT_OPTIONS.map((opt) => {
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

export function RecruiterMessagePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RecruiterMessageResult | null>(null);
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
  const [recruiterName, setRecruiterName] = useState("");
  const [context, setContext] = useState<RecruiterMessageContext>("cold-outreach");
  const [additionalContext, setAdditionalContext] = useState("");

  const canSubmit = Boolean(
    resumeText.trim() &&
      jobDescription.trim() &&
      companyName.trim() &&
      jobTitle.trim() &&
      config.apiKey.trim(),
  );

  async function generate() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. The message only references what's actually in it.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required.");
    if (!companyName.trim())
      return setValidationError("Company name is required.");
    if (!jobTitle.trim())
      return setValidationError("Job title is required.");

    setPhase("loading");
    const body: RecruiterMessageRequestBody = {
      config,
      resumeText,
      jobDescription,
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      recruiterName: recruiterName.trim() || undefined,
      context,
      additionalContext: additionalContext.trim() || undefined,
    };
    try {
      const res = await fetch("/api/generate-recruiter-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as RecruiterMessageResult);
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
            Message the recruiter without immediately screaming desperation.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRegenerate={() => void generate()} onReset={handleReset} />;
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
      recruiterName={recruiterName}
      setRecruiterName={setRecruiterName}
      context={context}
      setContext={setContext}
      additionalContext={additionalContext}
      setAdditionalContext={setAdditionalContext}
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
  recruiterName: string;
  setRecruiterName: (t: string) => void;
  context: RecruiterMessageContext;
  setContext: (c: RecruiterMessageContext) => void;
  additionalContext: string;
  setAdditionalContext: (t: string) => void;
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
    recruiterName,
    setRecruiterName,
    context,
    setContext,
    additionalContext,
    setAdditionalContext,
    onSubmit,
  } = props;
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Message the recruiter without immediately screaming desperation.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Short. Specific. Human.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">Rizz, but professional.</p>

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
                  The message only references what&apos;s actually in here. No fabrication.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="rj-jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="rj-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  Each message references one legitimate connection to this role.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                Who you&apos;re messaging <span>(and why)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="rj-company" className="field-label">
                  Company
                </label>
                <input
                  id="rj-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="e.g. Stripe"
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="rj-title" className="field-label">
                  Role
                </label>
                <input
                  id="rj-title"
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
                <label htmlFor="rj-recruiter" className="field-label">
                  Recruiter Name <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="rj-recruiter"
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="e.g. Priya Sharma"
                  className="field-control"
                />
                <p className="field-help">
                  Only used if you provide it. We never pretend you know someone you don&apos;t.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="rj-context" className="field-label">
                  Additional Context <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="rj-context"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Referral name, application date, anything the message should know..."
                  rows={4}
                  className="field-control"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="field-label">Outreach Context</label>
              <ContextChips
                value={context}
                onChange={setContext}
                disabled={phase === "loading"}
              />
              <p className="field-help">Changes the framing, never the facts.</p>
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
              disabled={!canSubmit || phase === "loading"}
              className="cta-primary action-primary"
            >
              Write My Message <span aria-hidden>&rarr;</span>
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
  onReset,
}: {
  result: RecruiterMessageResult;
  onRegenerate: () => void;
  onReset: () => void;
}) {
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        {result.subject && (
          <section className="card mt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Subject line
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{result.subject}</p>
              </div>
              <CopyButton text={result.subject} />
            </div>
          </section>
        )}

        <VariantCard
          step="1"
          label="Short"
          hint="2&ndash;3 sentences. Maximum signal."
          variant={result.variants.short}
        />
        <VariantCard
          step="2"
          label="Confident"
          hint="Slightly more direct. Leads with what you bring."
          variant={result.variants.confident}
        />
        <VariantCard
          step="3"
          label="Warm"
          hint="For networking and referrals. Human, not fake-familiar."
          variant={result.variants.warm}
        />

        {result.disclaimer && (
          <section className="card mt-4 border-amber-200 bg-amber-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Heads up &mdash; thin evidence
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{result.disclaimer}</p>
          </section>
        )}

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          Networking aura detected.
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRegenerate} className="cta-primary action-primary">
            Regenerate
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function VariantCard({
  step,
  label,
  hint,
  variant,
}: {
  step: string;
  label: string;
  hint: string;
  variant: { message: string; whyThisWorks: string };
}) {
  return (
    <section className="card mt-4">
      <div className="workflow-heading">
        <span className="step-badge">{step}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-tight text-zinc-900">{label}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        </div>
        <CopyButton text={variant.message} />
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
          {variant.message || "No message generated."}
        </p>
      </div>
      {variant.whyThisWorks && (
        <p className="mt-2 text-xs italic text-zinc-500">
          <span className="font-semibold not-italic text-zinc-700">Why this works:</span>{" "}
          {variant.whyThisWorks}
        </p>
      )}
    </section>
  );
}