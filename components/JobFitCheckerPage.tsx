"use client";
import { useState } from "react";
import Link from "next/link";
import type { AnalysisResult, AnalyzeRequestBody, AiRequestConfig } from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";
import { FitVerdict } from "./sections/FitVerdict";
import { RequirementMatrix } from "./sections/RequirementMatrix";
import { FitAnalysis } from "./sections/FitAnalysis";
import { ShouldApply } from "./sections/ShouldApply";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Analyzing job requirements...",
  "Checking your fit...",
  "Evaluating evidence...",
  "Almost there...",
];

const inputClass = "field-control";

export function JobFitCheckerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const canSubmit = Boolean(
    resumeText.trim() && jobDescription.trim() && config.apiKey.trim()
  );

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Paste text or upload a file.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required.");

    setPhase("loading");
    const body: AnalyzeRequestBody = {
      config,
      resumeText,
      jobDescription,
      linkedinUrl: linkedinUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      desperationLevel: 0,
    };
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as AnalysisResult);
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

  return (
    <View
      phase={phase}
      result={result}
      error={error}
      validationError={validationError}
      canSubmit={canSubmit}
      config={config}
      setConfig={setConfig}
      resumeText={resumeText}
      setResumeText={setResumeText}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      linkedinUrl={linkedinUrl}
      setLinkedinUrl={setLinkedinUrl}
      githubUrl={githubUrl}
      setGithubUrl={setGithubUrl}
      onCheck={handleCheck}
      onReset={handleReset}
      onDismissError={() => setError("")}
    />
  );
}
interface ViewProps {
  phase: Phase;
  result: AnalysisResult | null;
  error: string;
  validationError: string;
  canSubmit: boolean;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  githubUrl: string;
  setGithubUrl: (v: string) => void;
  onCheck: (e: React.FormEvent) => void;
  onReset: () => void;
  onDismissError: () => void;
}

function View(props: ViewProps) {
  const { phase, result, onReset } = props;

  // ─── Loading state ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-[1180px] mx-auto px-6 pt-6">
          <Breadcrumb />
        </div>
        <LoadingState messages={LOADING_MESSAGES} />
      </main>
    );
  }

  // ─── Results view ────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-[900px] mx-auto px-6 pt-6 pb-20 space-y-4">
          <Breadcrumb />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={onReset}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              &larr; Check another fit
            </button>
          </div>
          <FitVerdict result={result} />
          <RequirementMatrix result={result} />
          <FitAnalysis result={result} />
          <ShouldApply result={result} />
          <p className="text-xs text-zinc-400 text-center pt-4">
            The scores above are model estimates, not factual predictions. Your resume and JD
            were analyzed in-request and never stored.
          </p>
        </div>
      </main>
    );
  }

  // ─── Input workspace (defined below) ─────────────────────────────────────
  return <InputWorkspace {...props} />;
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">Job Fit Checker</span>
    </nav>
  );
}
function InputWorkspace(props: ViewProps) {
  const {
    phase,
    error,
    validationError,
    canSubmit,
    config,
    setConfig,
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    linkedinUrl,
    setLinkedinUrl,
    githubUrl,
    setGithubUrl,
    onCheck,
    onDismissError,
  } = props;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Should you apply?
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Let&apos;s find out whether you&apos;re a strong candidate, a stretch, or simply delulu.
        </p>

        <form onSubmit={onCheck} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(no sugar-coating included)</span>
              </h2>
            </div>

            {/* Two-column workspace: resume | job description */}
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={phase === "loading"}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="jobDescription" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="jobDescription"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste the job description here..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">The more yapping, the better we can roast.</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label htmlFor="linkedin" className="field-label">
                      LinkedIn URL <em>(optional)</em>
                    </label>
                    <input
                      id="linkedin"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      disabled={phase === "loading"}
                      placeholder="linkedin.com/in/you"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="github" className="field-label">
                      GitHub URL <em>(optional)</em>
                    </label>
                    <input
                      id="github"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      disabled={phase === "loading"}
                      placeholder="github.com/you"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI configuration */}
            <div className="config-card">
              <ProviderConfig config={config} onChange={setConfig} compact />
            </div>

            {(validationError || error) && (
              <div className="form-error" role="alert">
                {validationError || error}
                {error && (
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="ml-2 underline font-medium"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}

            <div className="action-row">
              <button
                type="submit"
                disabled={!canSubmit || phase === "loading"}
                className="cta-primary action-primary"
              >
                Check My Fit <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}