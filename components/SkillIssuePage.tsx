"use client";
import { useState } from "react";
import Link from "next/link";
import type { AiRequestConfig, SkillIssueResult } from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Reading the job description...",
  "Analyzing the evidence...",
  "Cross-referencing claims...",
  "Preparing the diagnosis...",
  "Almost done...",
];

export function SkillIssuePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SkillIssueResult | null>(null);
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

  const canSubmit = Boolean(resumeText.trim() && jobDescription.trim() && config.apiKey.trim());

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Paste text or upload a file.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. Paste the JD to diagnose.");

    setPhase("loading");
    const body = {
      config,
      resumeText,
      jobDescription,
      linkedinUrl: linkedinUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
    };
    try {
      const res = await fetch("/api/skill-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as SkillIssueResult);
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
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      linkedinUrl={linkedinUrl}
      setLinkedinUrl={setLinkedinUrl}
      githubUrl={githubUrl}
      setGithubUrl={setGithubUrl}
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
      <span className="text-zinc-600 font-medium">Skill Issue</span>
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
  jobDescription: string;
  setJobDescription: (v: string) => void;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  githubUrl: string;
  setGithubUrl: (v: string) => void;
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
    jobDescription,
    setJobDescription,
    linkedinUrl,
    setLinkedinUrl,
    githubUrl,
    setGithubUrl,
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
              Chaos / Skill Issue
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              No corporate sugarcoating. Just the receipts.
            </p>
          </div>
        </div>

        <form onSubmit={onCheck} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(the truth hurts)</span>
              </h2>
            </div>

            {/* Resume + JD */}
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={loading}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="skillJd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="skillJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job description here..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Required. The JD is what we measure your skill issue against.
                </p>
              </div>
            </div>

            {/* Optional LinkedIn / GitHub */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="skillLinkedin" className="field-label">
                  LinkedIn URL <em>(optional)</em>
                </label>
                <input
                  id="skillLinkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={loading}
                  placeholder="linkedin.com/in/you"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="skillGithub" className="field-label">
                  GitHub URL <em>(optional)</em>
                </label>
                <input
                  id="skillGithub"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={loading}
                  placeholder="github.com/you"
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
                Diagnose My Skill Issue <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. This is a blunt diagnostic, not a judgment.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────

interface ResultsViewProps {
  result: SkillIssueResult;
  onReset: () => void;
}

function diagnosisColor(diagnosis: string): string {
  switch (diagnosis) {
    case "Skill issue":
      return "bg-red-50 text-red-700 border-red-200";
    case "Positioning issue":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Experience issue":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Evidence issue":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Application strategy issue":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

function ResultsView({ result, onReset }: ResultsViewProps) {
  return (
    <div className="animate-fade-up">
      <Breadcrumb />

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Skill Issue
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Not a judgment. Just a blunt diagnostic.
        </p>
      </div>

      {/* Diagnosis header */}
      <section className="card mt-6 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
          Diagnosis Complete
        </p>
        <span
          className={`inline-block mt-3 text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-md border ${
            diagnosisColor(result.finalDiagnosis)
          }`}
        >
          {result.finalDiagnosis}
        </span>
        <p className="text-xs text-zinc-400 mt-3">
          Unfortunately, the vibes were not the problem.
        </p>
      </section>

      {/* Primary Issue */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Primary Skill Issue
        </h2>
        <p className="text-base font-semibold text-zinc-800 leading-relaxed">
          {result.primaryIssue}
        </p>
      </section>

      {/* Secondary Issues */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-4">
          Secondary Issues
        </h2>
        <div className="space-y-4">
          {result.secondaryIssues.map((issue, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 p-4">
              <p className="text-sm font-semibold text-zinc-800 mb-2">
                {i + 1}. {issue.problem}
              </p>
              <div className="space-y-1 text-xs text-zinc-500">
                <p><span className="font-semibold text-zinc-600">Evidence:</span> {issue.evidence}</p>
                <p><span className="font-semibold text-zinc-600">Impact:</span> {issue.impact}</p>
                <p><span className="font-semibold text-zinc-600">Fix:</span> {issue.fix}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What is NOT the problem */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          What is NOT the Problem
        </h2>
        <ul className="space-y-2">
          {(result.notTheProblem.length > 0
            ? result.notTheProblem
            : ["No exclusions identified."]).map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">✓</span>
              <span className="text-sm text-zinc-700">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-400 mt-2">
          Don&apos;t waste time fixing these.
        </p>
      </section>

      {/* 30-Day Fix */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          30-Day Fix
        </h2>
        <ul className="space-y-2">
          {(result.thirtyDayFix.length > 0
            ? result.thirtyDayFix
            : ["No actions identified."]).map((action, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-blue-500 font-bold flex-shrink-0">→</span>
              <span className="text-sm text-zinc-700">{action}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-400 mt-2">
          Good news: this is fixable.
        </p>
      </section>

      {/* Reset button */}
      <div className="mt-6 text-center">
        <button
          onClick={onReset}
          type="button"
          className="cta-secondary action-secondary"
        >
          Diagnose Another Application
        </button>
      </div>
    </div>
  );
}

