"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { AiRequestConfig, RizzScoreResult } from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Reading the job description...",
  "Measuring the rizz...",
  "Checking recruiter appeal...",
  "Calculating your rizz score...",
  "Your application has entered the chat...",
];

export function RizzScorePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RizzScoreResult | null>(null);
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

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Paste text or upload a file.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. Paste the JD to measure alignment.");

    setPhase("loading");
    const body = {
      config,
      resumeText,
      jobDescription,
      linkedinUrl: linkedinUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
    };
    try {
      const res = await fetch("/api/rizz-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as RizzScoreResult);
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
      onCalculate={handleCalculate}
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
      <span className="text-zinc-600 font-medium">Rizz Score</span>
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
  onCalculate: (e: React.FormEvent) => void;
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
    onCalculate,
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
              Chaos / Rizz Score
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Not romantic rizz. Recruiter rizz.
            </p>
          </div>
        </div>

        <form onSubmit={onCalculate} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(honesty is mandatory for accurate rizz measurement)</span>
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
                <label htmlFor="rizzJd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="rizzJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job description here..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Required. The JD is what we measure your rizz against.
                </p>
              </div>
            </div>

            {/* Optional LinkedIn / GitHub */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="rizzLinkedin" className="field-label">
                  LinkedIn URL <em>(optional)</em>
                </label>
                <input
                  id="rizzLinkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={loading}
                  placeholder="linkedin.com/in/you"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="rizzGithub" className="field-label">
                  GitHub URL <em>(optional)</em>
                </label>
                <input
                  id="rizzGithub"
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
                Calculate My Rizz <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. This is a playful score, not a hiring prediction.
            </p>
          </section>
        </form>
      </div>
        </main>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────

interface ResultsViewProps {
  result: RizzScoreResult;
  onReset: () => void;
}

const DIMENSION_SCORES: { key: keyof RizzScoreResult; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "specificity", label: "Specificity" },
  { key: "credibility", label: "Credibility" },
  { key: "clarity", label: "Clarity" },
  { key: "differentiation", label: "Differentiation" },
  { key: "evidence", label: "Evidence" },
];

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 45) return "text-amber-500";
  if (score >= 25) return "text-orange-500";
  return "text-red-600";
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "UNREASONABLE AURA":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "HIGH RIZZ":
      return "bg-green-50 text-green-700 border-green-200";
    case "DECENT RIZZ":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "LOW RIZZ":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "NO RIZZ":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

function ResultsView({ result, onReset }: ResultsViewProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = result.rizzScore;
    if (target === 0) { setDisplay(0); return; }
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    }, [result.rizzScore]);

  return (
    <div className="animate-fade-up">
      <Breadcrumb />

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Rizz Score
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Not a hiring prediction. Just a vibe check with extra steps.
        </p>
      </div>

      {/* Big score + verdict */}
      <section className="card mt-6">
        <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="flex flex-col items-center sm:pr-8 sm:border-r sm:border-zinc-100">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              RIZZ SCORE
            </p>
            <p className={`mt-2 text-6xl font-bold tabular-nums ${scoreColor(result.rizzScore)}`}>
              {display}
            </p>
            <p className="text-xs text-zinc-400 mt-1">out of 100</p>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              Verdict
            </p>
            <span
              className={`inline-block mt-1.5 text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-md border ${
                verdictColor(result.verdict)
              }`}
            >
              {result.verdict}
            </span>
            <p className="text-xs text-zinc-400 mt-2">
              &quot;Your application has entered the chat.&quot;
            </p>
                    </div>
        </div>
      </section>

      {/* Dimension scores */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Score Breakdown
        </h2>
        <div className="grid gap-3">
          {DIMENSION_SCORES.map((item) => {
            const value = result[item.key] as number;
            return (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-zinc-600">{item.label}</span>
                <span className={`font-bold tabular-nums ${scoreColor(value)}`}>
                  {value}/100
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rizz Boosters */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Rizz Boosters
        </h2>
        <ul className="space-y-2">
          {(result.rizzBoosters.length > 0
            ? result.rizzBoosters
            : ["No boosters identified."]).map((booster, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">+{i + 1}</span>
              <span className="text-sm text-zinc-700">{booster}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Rizz Killers */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Rizz Killers
        </h2>
        <ul className="space-y-2">
          {(result.rizzKillers.length > 0
            ? result.rizzKillers
            : ["No killers identified."]).map((killer, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-red-500 font-bold flex-shrink-0">−{i + 1}</span>
              <span className="text-sm text-zinc-700">{killer}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Recruiter Pitch */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Recruiter Pitch
        </h2>
        <p className="text-sm text-zinc-700 leading-relaxed italic">
          &quot;{result.recruiterPitch}&quot;
        </p>
      </section>

      {/* Reset button */}
      <div className="mt-6 text-center">
        <button
          onClick={onReset}
          type="button"
          className="cta-secondary action-secondary"
        >
          Calculate a Different Rizz Score
        </button>
      </div>
    </div>
  );
}

