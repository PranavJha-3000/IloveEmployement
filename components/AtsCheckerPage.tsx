"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  AtsCheckRequestBody,
  AtsCheckResult,
} from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";
import { AtsScore } from "./sections/AtsScore";
import { FormatCheck } from "./sections/FormatCheck";
import { JobMatch } from "./sections/JobMatch";
import { AtsFixes } from "./sections/AtsFixes";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Checking formatting...",
  "Scanning for ATS blockers...",
  "Analyzing keyword coverage...",
  "Consulting the robots...",
];

const inputClass = "field-control";

export function AtsCheckerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<AtsCheckResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [hadJobDescription, setHadJobDescription] = useState(false);

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
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

    const body: AtsCheckRequestBody = {
      config,
      resumeText,
      jobDescription: jobDescription.trim() || undefined,
    };
    setHadJobDescription(Boolean(body.jobDescription));
    setPhase("loading");
    try {
      const res = await fetch("/api/check-ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as AtsCheckResult);
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
    setHadJobDescription(false);
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
      hadJobDescription={hadJobDescription}
      onCheck={handleCheck}
      onReset={handleReset}
      onDismissError={() => setError("")}
    />
  );
}
interface ViewProps {
  phase: Phase;
  result: AtsCheckResult | null;
  error: string;
  validationError: string;
  canSubmit: boolean;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  hadJobDescription: boolean;
  onCheck: (e: React.FormEvent) => void;
  onReset: () => void;
  onDismissError: () => void;
}

function View(props: ViewProps) {
  const { phase, result, hadJobDescription, onReset } = props;

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
              &larr; Run another check
            </button>
          </div>
          <AtsScore result={result} />
          <FormatCheck result={result} />
          <JobMatch result={result} hasJobDescription={hadJobDescription} />
          <AtsFixes result={result} />
          <p className="text-xs text-zinc-400 text-center pt-4">
            The ATS score is an AI estimate based on common parsing behavior, not a
            guarantee about any specific system. Your resume was analyzed in-request and never stored.
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
      <span className="text-zinc-600 font-medium">ATS Checker</span>
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
    onCheck,
    onDismissError,
  } = props;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Will the robots understand your resume?
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Check formatting, structure and job-specific keyword coverage before you apply.
        </p>

        <form onSubmit={onCheck} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(the robots are watching)</span>
              </h2>
            </div>

            {/* Two-column workspace: resume | optional job description */}
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
                  Job Description <em>(optional)</em>
                </label>
                <textarea
                  id="jobDescription"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste the job description here for keyword matching..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Add a JD for keyword matching. Skip it for generic ATS structure analysis.
                </p>
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
                Run ATS Check <span aria-hidden>&rarr;</span>
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