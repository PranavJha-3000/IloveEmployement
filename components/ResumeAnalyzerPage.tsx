"use client";
import { useState } from "react";
import Link from "next/link";
import type { AnalysisResult, AnalyzeRequestBody, AiRequestConfig } from "@/lib/types";
import { DESPERATION_LEVELS } from "@/lib/prompts";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { DesperationSelector } from "./DesperationSelector";
import { LoadingState } from "./LoadingState";
import { EmploymentAura } from "./sections/EmploymentAura";
import { VerdictCard } from "./sections/VerdictCard";
import { ScoreBreakdown } from "./sections/ScoreBreakdown";
import { MatchAnalysis } from "./sections/MatchAnalysis";
import { RequirementsTable } from "./sections/RequirementsTable";
import { BiggestProblem } from "./sections/BiggestProblem";
import { StrategySection } from "./sections/StrategySection";
import { AuraCheck } from "./sections/AuraCheck";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Interrogating the JD...",
  "Checking your employment aura...",
  "Fighting the ATS...",
  "Cooking...",
];

export function ResumeAnalyzerPage() {
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
  const [desperationLevel, setDesperationLevel] = useState(2);

  const canSubmit = Boolean(
    resumeText.trim() && jobDescription.trim() && config.apiKey.trim()
  );
  const desp =
    DESPERATION_LEVELS[Math.min(5, Math.max(0, desperationLevel))] ?? null;

  async function handleAnalyze(e: React.FormEvent) {
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
      desperationLevel,
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
    <AnalyzerView
      phase={phase}
      result={result}
      error={error}
      validationError={validationError}
      desp={desp}
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
      desperationLevel={desperationLevel}
      setDesperationLevel={setDesperationLevel}
      onAnalyze={handleAnalyze}
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
  desp: (typeof DESPERATION_LEVELS)[number] | null;
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
  desperationLevel: number;
  setDesperationLevel: (v: number) => void;
  onAnalyze: (e: React.FormEvent) => void;
  onReset: () => void;
  onDismissError: () => void;
}

function AnalyzerView(props: ViewProps) {
  const { phase, result, desp, onReset } = props;

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
              &larr; Analyze another resume
            </button>
            {desp && (
              <span className="pill">
                Desperation: {desp.level}/5 &ndash; {desp.label}
              </span>
            )}
          </div>
          <EmploymentAura result={result} />
          <VerdictCard result={result} />
          <ScoreBreakdown result={result} />
          <MatchAnalysis result={result} />
          <RequirementsTable result={result} />
          <BiggestProblem result={result} />
          <StrategySection result={result} />
          <AuraCheck result={result} />
          <p className="text-xs text-zinc-400 text-center pt-4">
            The selection percentage is an AI estimate, not a prediction. Your resume and JD
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
      <span className="text-zinc-600 font-medium">Resume Analyzer</span>
    </nav>
  );
}


const inputClass = "field-control";

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
    desperationLevel,
    setDesperationLevel,
    onAnalyze,
    onDismissError,
  } = props;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Resume Analyzer
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Find out how badly your resume matches the job before you send it.
        </p>

        <form onSubmit={onAnalyze} className="mt-6">
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

            {/* Desperation */}
            <div className="workflow-heading desperate-heading">
              <span className="step-badge">2</span>
              <div>
                <h2>How desperate are we?</h2>
                <p>Changes the tone, never the facts.</p>
              </div>
            </div>
            <DesperationSelector
              value={desperationLevel}
              onChange={setDesperationLevel}
            />

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
                Analyze My Employment Aura <span aria-hidden>&rarr;</span>
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

