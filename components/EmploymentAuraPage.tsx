"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { AiRequestConfig, EmploymentAuraResult } from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Reading the job description...",
  "Scrying the employment ether...",
  "Consulting the oracle of corporate wallpaper...",
  "Calculating your employment aura...",
  "Assigning your aura type...",
];

export function EmploymentAuraPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<EmploymentAuraResult | null>(null);
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

  const canSubmit = Boolean(resumeText.trim() && config.apiKey.trim());

  async function handleCalculate(e: React.FormEvent) {
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
      jobDescription: jobDescription.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
    };
    try {
      const res = await fetch("/api/employment-aura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as EmploymentAuraResult);
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
      <span className="text-zinc-600 font-medium">Employment Aura</span>
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

  if (phase === "loading") {
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
              Chaos / Employment Aura
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              An entirely scientific measurement of how hireable you look right now.
            </p>
            <p className="text-xs text-zinc-400">
              Not scientific. Unfortunately.
            </p>
          </div>
        </div>

        <form onSubmit={onCalculate} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(be honest — the aura sees all)</span>
              </h2>
            </div>

            {/* Resume + optional JD */}
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                                    onChange={setResumeText}
                  disabled={loading}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="auraJd" className="field-label">
                  Job Description <em>(optional)</em>
                </label>
                <textarea
                  id="auraJd"
                  value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job description for a targeted aura reading..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Optional. With a JD, we can read your fit aura. Without one, we assess overall hireability.
                </p>
              </div>
            </div>

            {/* Optional LinkedIn / GitHub */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="auraLinkedin" className="field-label">
                  LinkedIn URL <em>(optional)</em>
                </label>
                <input
                  id="auraLinkedin"
                  value={linkedinUrl}
                                    onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={loading}
                  placeholder="linkedin.com/in/you"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="auraGithub" className="field-label">
                  GitHub URL <em>(optional)</em>
                </label>
                <input
                  id="auraGithub"
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
                Calculate My Aura <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. The aura is fluff but the feedback is real.
            </p>
          </section>
        </form>
      </div>
        </main>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────

interface ResultsViewProps {
  result: EmploymentAuraResult;
  onReset: () => void;
}

const COMPONENT_SCORES: { key: keyof EmploymentAuraResult; label: string }[] = [
  { key: "resumeAura", label: "Resume Aura" },
  { key: "skillAura", label: "Skill Aura" },
  { key: "experienceAura", label: "Experience Aura" },
  { key: "projectAura", label: "Project Aura" },
  { key: "applicationAura", label: "Application Aura" },
];

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 45) return "text-amber-500";
  if (score >= 25) return "text-orange-500";
  return "text-red-600";
}

function ResultsView({ result, onReset }: ResultsViewProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = result.overallAura;
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
    }, [result.overallAura]);

  return (
    <div className="animate-fade-up">
      <Breadcrumb />

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Employment Aura
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          An entirely scientific measurement. (Not scientific. Unfortunately.)
        </p>
      </div>

      {/* Big score + component scores */}
      <section className="card mt-6">
        <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="flex flex-col items-center sm:pr-8 sm:border-r sm:border-zinc-100">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              EMPLOYMENT AURA
            </p>
            <p
              className={`mt-2 text-6xl font-bold tabular-nums ${scoreColor(result.overallAura)}`}
            >
              {display}
            </p>
            <p className="text-xs text-zinc-400 mt-1">out of 100</p>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              Component Scores
            </p>
            <div className="grid gap-3">
              {COMPONENT_SCORES.map((item) => {
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
          </div>
        </div>
      </section>

      {/* Aura type */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Your Aura Type
        </h2>
        <p className="text-2xl font-bold text-zinc-900">{result.auraType}</p>
      </section>

      {/* Biggest W / Biggest L */}
      <section className="card mt-6">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              <span className="text-green-500">🟢</span>
              Biggest W
            </h3>
            <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
              {result.biggestW}
            </p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              <span className="text-red-500">🔴</span>
              Biggest L
            </h3>
            <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
              {result.biggestL}
            </p>
          </div>
        </div>
      </section>

      {/* Aura boosters */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Aura Boosters
        </h2>
        <ul className="space-y-2">
          {(result.auraBoosters.length > 0
            ? result.auraBoosters
            : ["No boosters identified."]).map((booster, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">+{i + 1}</span>
              <span className="text-sm text-zinc-700">{booster}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Aura drainers */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Aura Drainers
        </h2>
        <ul className="space-y-2">
          {(result.auraDrainers.length > 0
            ? result.auraDrainers
            : ["No drainers identified."]).map((drainer, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-red-500 font-bold flex-shrink-0">−{i + 1}</span>
              <span className="text-sm text-zinc-700">{drainer}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Funny verdict */}
      <section className="card mt-6 text-center">
        <p className="text-xl font-semibold text-zinc-800 leading-relaxed">
          {result.verdict}
        </p>
        <p className="mt-3 text-xs text-zinc-400">
          (Remember: this is an aura reading, not a scientific assessment.)
        </p>
      </section>

      {/* Reset button */}
      <div className="mt-6 text-center">
        <button
          onClick={onReset}
          type="button"
          className="cta-secondary action-secondary"
        >
          Calculate a Different Aura
        </button>
      </div>
    </div>
  );
}

