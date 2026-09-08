"use client";
import { useState } from "react";
import Link from "next/link";
import type { AiRequestConfig, ResumeCourtResult, CourtVerdict } from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Calling the court to order...",
  "Examining the evidence...",
  "Cross-examining claims...",
  "The jury is deliberating...",
  "Almost done...",
];

export function ResumeCourtPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ResumeCourtResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const canSubmit = Boolean(resumeText.trim() && config.apiKey.trim());

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Paste text or upload a file.");

    setPhase("loading");
    const body = {
      config,
      resumeText,
      linkedinUrl: linkedinUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      portfolioUrl: portfolioUrl.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
    };
    try {
      const res = await fetch("/api/resume-court", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as ResumeCourtResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleReset() {
    setResult(null);
    setError("");
    setValidationError("");
    setPhase("idle");
  }

  if (phase === "results" && result) {
    return (
      <main className="min-h-screen bg-white">
        <div className="workflow-wrap pt-6">
          <Breadcrumb />
          <ResultsView result={result} onReset={handleReset} />
        </div>
      </main>
    );
  }

  return (
    <View
      phase={phase}
      error={error}
      validationError={validationError}
      canSubmit={canSubmit}
      config={config}
      setConfig={setConfig}
      resumeText={resumeText}
      setResumeText={setResumeText}
      linkedinUrl={linkedinUrl}
      setLinkedinUrl={setLinkedinUrl}
      githubUrl={githubUrl}
      setGithubUrl={setGithubUrl}
      portfolioUrl={portfolioUrl}
      setPortfolioUrl={setPortfolioUrl}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      onCheck={handleCheck}
      onReset={handleReset}
    />
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm text-zinc-500">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">Resume Court</span>
    </nav>
  );
}

const inputClass = "field-control";

interface ViewProps {
  phase: Phase;
  error: string;
  validationError: string;
  canSubmit: boolean;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (v: string) => void;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  githubUrl: string;
  setGithubUrl: (v: string) => void;
  portfolioUrl: string;
  setPortfolioUrl: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  onCheck: (e: React.FormEvent) => void;
  onReset: () => void;
}

function View(props: ViewProps) {
  const {
    phase,
    error,
    validationError,
    canSubmit,
    config,
    setConfig,
    resumeText,
    setResumeText,
    linkedinUrl,
    setLinkedinUrl,
    githubUrl,
    setGithubUrl,
    portfolioUrl,
    setPortfolioUrl,
    jobDescription,
    setJobDescription,
    onCheck,
  } = props;

  const loading = phase === "loading";

  if (loading) {
    return (
      <div>
        <div className="workflow-wrap pt-6">
          <Breadcrumb />
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />

        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Chaos / Resume Court
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Every impressive claim needs receipts.
            </p>
          </div>
        </div>

        <form onSubmit={onCheck} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(the court is now in session)</span>
              </h2>
            </div>

            {/* Resume */}
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={loading}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="courtJd" className="field-label">
                  Job Description <em>(optional)</em>
                </label>
                <textarea
                  id="courtJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job description here (optional)..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Optional. Helps the court evaluate claims against the JD.
                </p>
              </div>
            </div>

            {/* Optional LinkedIn / GitHub / Portfolio */}
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <div>
                <label htmlFor="courtLinkedin" className="field-label">
                  LinkedIn URL <em>(optional)</em>
                </label>
                <input
                  id="courtLinkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={loading}
                  placeholder="linkedin.com/in/you"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="courtGithub" className="field-label">
                  GitHub URL <em>(optional)</em>
                </label>
                <input
                  id="courtGithub"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={loading}
                  placeholder="github.com/you"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="courtPortfolio" className="field-label">
                  Portfolio URL <em>(optional)</em>
                </label>
                <input
                  id="courtPortfolio"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  disabled={loading}
                  placeholder="yourportfolio.com"
                  className={inputClass}
                />
              </div>
            </div>

            {/* AI configuration */}
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
                Call The Court <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. This is a playful evidence analysis, not a legal judgment.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────

interface ResultsViewProps {
  result: ResumeCourtResult;
  onReset: () => void;
}

function verdictColor(verdict: CourtVerdict): string {
  switch (verdict) {
    case "SUPPORTED":
      return "bg-green-50 text-green-700 border-green-200";
    case "PARTIALLY SUPPORTED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "UNVERIFIED":
      return "bg-red-50 text-red-700 border-red-200";
    case "CONTRADICTION":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

function verdictIcon(verdict: CourtVerdict): string {
  switch (verdict) {
    case "SUPPORTED":
      return "✓";
    case "PARTIALLY SUPPORTED":
      return "~";
    case "UNVERIFIED":
      return "?";
    case "CONTRADICTION":
      return "✗";
    default:
      return "•";
  }
}

function ResultsView({ result, onReset }: ResultsViewProps) {
  return (
    <div className="animate-fade-up">
      <Breadcrumb />

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Resume Court
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Not a legal judgment. Just a playful evidence analysis.
        </p>
      </div>

      {/* Court header */}
      <section className="card mt-6 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
          The Court Has Spoken
        </p>
        <p className="text-sm text-zinc-500 mt-2">
          {result.claims.length} claim{result.claims.length !== 1 ? "s" : ""} put on trial.
          {" "}&quot;Receipts secured.&quot;
        </p>
      </section>

      {/* Claims */}
      {result.claims.map((claim, i) => (
        <section key={i} className="card mt-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
              Claim #{i + 1}
            </h2>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md border ${
                verdictColor(claim.verdict)
              }`}
            >
              <span>{verdictIcon(claim.verdict)}</span>
              {claim.verdict}
            </span>
          </div>

          <p className="text-base font-semibold text-zinc-800 mb-4">
            &quot;{claim.claim}&quot;
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-2">
                Evidence
              </p>
              <p className="text-sm text-zinc-700">{claim.evidence}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-2">
                Prosecution
              </p>
              <p className="text-sm text-zinc-700">{claim.prosecution}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-xs uppercase tracking-widest text-green-600 font-semibold mb-2">
              Defense
            </p>
            <p className="text-sm text-zinc-700">{claim.defense}</p>
          </div>
        </section>
      ))}

      {/* Most Dangerous Claim */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Most Dangerous Claim
        </h2>
        <p className="text-sm text-zinc-700 leading-relaxed">
          {result.mostDangerousClaim}
        </p>
        <p className="text-xs text-zinc-400 mt-2">
          Objection: vague wording.
        </p>
      </section>

      {/* Best Claim */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Best Claim
        </h2>
        <p className="text-sm text-zinc-700 leading-relaxed">
          {result.bestClaim}
        </p>
        <p className="text-xs text-zinc-400 mt-2">
          Receipts secured.
        </p>
      </section>

      {/* Sentence to Fix */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Sentence to Fix
        </h2>
        <p className="text-sm text-zinc-700 leading-relaxed">
          {result.sentenceToFix}
        </p>
        <p className="text-xs text-zinc-400 mt-2">
          Overruled.
        </p>
      </section>

      {/* Reset button */}
      <div className="mt-6 text-center">
        <button
          onClick={onReset}
          type="button"
          className="cta-secondary action-secondary"
        >
          Put Another Resume on Trial
        </button>
      </div>
    </div>
  );
}

