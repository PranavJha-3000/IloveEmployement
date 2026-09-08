"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { AiRequestConfig, CookedMeterResult } from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Reading the job description...",
  "Preheating the oven...",
  "Checking how cooked you are...",
  "Measuring the heat...",
  "Almost done...",
];

export function CookedMeterPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CookedMeterResult | null>(null);
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
      return setValidationError("Job description is required. Paste the JD to check.");

    setPhase("loading");
    const body = {
      config,
      resumeText,
      jobDescription,
      linkedinUrl: linkedinUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
    };
    try {
      const res = await fetch("/api/cooked-meter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as CookedMeterResult);
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
      <span className="text-zinc-600 font-medium">Cooked Meter</span>
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
              Chaos / Cooked Meter
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Put your resume against the job and let&apos;s find out.
            </p>
          </div>
        </div>

        <form onSubmit={onCheck} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(the oven is preheating)</span>
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
                <label htmlFor="cookedJd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="cookedJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job description here..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Required. The JD is what we measure your cookedness against.
                </p>
              </div>
            </div>

            {/* Optional LinkedIn / GitHub */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="cookedLinkedin" className="field-label">
                  LinkedIn URL <em>(optional)</em>
                </label>
                <input
                  id="cookedLinkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={loading}
                  placeholder="linkedin.com/in/you"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="cookedGithub" className="field-label">
                  GitHub URL <em>(optional)</em>
                </label>
                <input
                  id="cookedGithub"
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
                Check How Cooked I Am <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. This is a vibe check, not a hiring probability.
            </p>
          </section>
        </form>
      </div>
        </main>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────

interface ResultsViewProps {
  result: CookedMeterResult;
  onReset: () => void;
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "NOT COOKED":
      return "bg-green-50 text-green-700 border-green-200";
    case "LIGHTLY COOKED":
      return "bg-lime-50 text-lime-700 border-lime-200";
    case "MEDIUM":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "WELL DONE":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "ABSOLUTELY COOKED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

function canApplyColor(verdict: string): string {
  switch (verdict) {
    case "YES":
      return "text-green-600";
    case "YES, BUT STRETCH":
      return "text-amber-500";
    case "PROBABLY NOT":
      return "text-red-600";
    default:
      return "text-zinc-600";
  }
}

function ResultsView({ result, onReset }: ResultsViewProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = result.cookedScore;
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
    }, [result.cookedScore]);

  return (
    <div className="animate-fade-up">
      <Breadcrumb />

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Cooked Meter
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Not a hiring probability. Just a vibe check with evidence.
        </p>
      </div>

      {/* Big meter + verdict */}
      <section className="card mt-6">
        <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="flex flex-col items-center sm:pr-8 sm:border-r sm:border-zinc-100">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              COOKED METER
            </p>
            <p className={`mt-2 text-6xl font-bold tabular-nums ${
              result.cookedScore >= 81 ? "text-red-600" :
              result.cookedScore >= 61 ? "text-orange-500" :
              result.cookedScore >= 41 ? "text-amber-500" :
              result.cookedScore >= 21 ? "text-lime-600" :
              "text-green-600"
            }`}>
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
              &quot;The kitchen is open, but there is still time.&quot;
            </p>
                    </div>
        </div>
      </section>

      {/* Why */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Why
        </h2>
        <ul className="space-y-2">
          {(result.why.length > 0 ? result.why : ["No reasons identified."]).map((reason, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-zinc-400 font-bold flex-shrink-0">•</span>
              <span className="text-sm text-zinc-700">{reason}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What Saves You */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          What Saves You
        </h2>
        <ul className="space-y-2">
          {(result.whatSavesYou.length > 0
            ? result.whatSavesYou
            : ["No saving factors identified."]).map((factor, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">+</span>
              <span className="text-sm text-zinc-700">{factor}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What Cooked You */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          What Cooked You
        </h2>
        <p className="text-sm text-zinc-700 leading-relaxed">
          {result.whatCookedYou}
        </p>
      </section>

      {/* Can You Still Apply? */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Can You Still Apply?
        </h2>
        <p className={`text-lg font-bold ${canApplyColor(result.canYouStillApply)}`}>
          {result.canYouStillApply}
        </p>
      </section>

      {/* How to Lower the Cooked Score */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          How to Lower the Cooked Score
        </h2>
        <ul className="space-y-2">
          {(result.howToLower.length > 0
            ? result.howToLower
            : ["No actions identified."]).map((action, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-blue-500 font-bold flex-shrink-0">↓</span>
              <span className="text-sm text-zinc-700">{action}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Reset button */}
      <div className="mt-6 text-center">
        <button
          onClick={onReset}
          type="button"
          className="cta-secondary action-secondary"
        >
          Check a Different Job
        </button>
      </div>
    </div>
  );
}

