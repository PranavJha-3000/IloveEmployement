"use client";
import { useState } from "react";
import Link from "next/link";
import type { AiRequestConfig, AtsBossFightResult } from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Entering the ATS arena...",
  "Loading boss fight...",
  "Analyzing keyword match...",
  "Calculating damage...",
  "ATS has entered phase two...",
  "Almost done...",
];

export function AtsBossFightPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<AtsBossFightResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

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
      return setValidationError("Job description is required. Paste the JD to fight the boss.");

    setPhase("loading");
    const body = {
      config,
      resumeText,
      jobDescription,
    };
    try {
      const res = await fetch("/api/ats-boss-fight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as AtsBossFightResult);
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
      <span className="text-zinc-600 font-medium">ATS Boss Fight</span>
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
              Chaos / ATS Boss Fight
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Your resume has entered the ATS arena.
            </p>
          </div>
        </div>

        <form onSubmit={onCheck} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your inputs <span>(prepare for battle)</span>
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
                <label htmlFor="bossJd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="bossJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job description here..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Required. The JD is the boss you&apos;re fighting.
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
              </div>
            )}

            <div className="action-row">
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="cta-primary action-primary"
              >
                Enter The Boss Fight <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. This is a playful optimization challenge, not a real ATS prediction.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────

interface ResultsViewProps {
  result: AtsBossFightResult;
  onReset: () => void;
}

function damageColor(damage: number): string {
  if (damage >= 75) return "text-green-600";
  if (damage >= 50) return "text-amber-500";
  if (damage >= 25) return "text-orange-500";
  return "text-red-500";
}

function damageBarColor(damage: number): string {
  if (damage >= 75) return "bg-green-500";
  if (damage >= 50) return "bg-amber-500";
  if (damage >= 25) return "bg-orange-500";
  return "bg-red-500";
}

function ResultsView({ result, onReset }: ResultsViewProps) {
  return (
    <div className="animate-fade-up">
      <Breadcrumb />

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          ATS Boss Fight
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Not a real ATS prediction. Just a playful optimization challenge.
        </p>
      </div>

      {/* Boss HP + Your Damage */}
      <section className="card mt-6">
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-2">
              BOSS: ATS
            </p>
            <div className="flex items-baseline gap-2">
              <p className={`text-4xl font-bold tabular-nums ${
                result.bossHp <= 0 ? "text-green-600" : result.bossHp <= 50 ? "text-amber-500" : "text-red-500"
              }`}>
                {result.bossHp}
              </p>
              <p className="text-sm text-zinc-400">HP remaining</p>
            </div>
            <div className="mt-3 h-4 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-1000"
                style={{ width: `${result.bossHp}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-2">
              YOUR DAMAGE
            </p>
            <div className="flex items-baseline gap-2">
              <p className={`text-4xl font-bold tabular-nums ${damageColor(result.yourDamage)}`}>
                {result.yourDamage}
              </p>
              <p className="text-sm text-zinc-400">dealt</p>
            </div>
            <div className="mt-3 h-4 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${damageBarColor(result.yourDamage)} transition-all duration-1000`}
                style={{ width: `${result.yourDamage}%` }}
              />
            </div>
          </div>
        </div>
        {result.bossHp <= 0 && (
          <p className="mt-4 text-center text-sm font-bold text-green-600">
            🎉 Your resume dealt critical damage! ATS has been defeated!
          </p>
        )}
        {result.bossHp > 0 && result.bossHp <= 50 && (
          <p className="mt-4 text-center text-sm text-zinc-500">
            ATS has entered phase two. Keep fighting!
          </p>
        )}
      </section>

      {/* Attack Categories */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-4">
          Attack Categories
        </h2>
        <div className="space-y-4">
          {result.attackCategories.map((cat, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-sm font-semibold text-zinc-800">{cat.name}</p>
                <p className={`text-sm font-bold tabular-nums ${damageColor(cat.damage)}`}>
                  +{cat.damage} damage
                </p>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${damageBarColor(cat.damage)} transition-all duration-1000`}
                  style={{ width: `${cat.damage}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500">{cat.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Boss Weaknesses */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Boss Weaknesses
        </h2>
        <ul className="space-y-2">
          {(result.bossWeaknesses.length > 0
            ? result.bossWeaknesses
            : ["No boss weaknesses identified."]).map((weakness, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-green-500 font-bold flex-shrink-0">↓</span>
              <span className="text-sm text-zinc-700">{weakness}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-400 mt-2">
          Keyword detected. +10 aura.
        </p>
      </section>

      {/* Your Weapons */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Your Weapons
        </h2>
        <ul className="space-y-2">
          {(result.yourWeapons.length > 0
            ? result.yourWeapons
            : ["No weapons identified."]).map((weapon, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-blue-500 font-bold flex-shrink-0">⚔</span>
              <span className="text-sm text-zinc-700">{weapon}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Boss Attacks */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Boss Attacks
        </h2>
        <ul className="space-y-2">
          {(result.bossAttacks.length > 0
            ? result.bossAttacks
            : ["No boss attacks identified."]).map((attack, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-red-500 font-bold flex-shrink-0">⚡</span>
              <span className="text-sm text-zinc-700">{attack}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-400 mt-2">
          Skill not found. -20 HP.
        </p>
      </section>

      {/* Final Score */}
      <section className="card mt-6 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
          ATS Battle Score
        </p>
        <p className={`mt-2 text-5xl font-bold tabular-nums ${damageColor(result.atsBattleScore)}`}>
          {result.atsBattleScore}
        </p>
        <p className="text-xs text-zinc-400 mt-1">out of 100</p>
      </section>

      {/* Next Move */}
      <section className="card mt-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-3">
          Next Move
        </h2>
        <ul className="space-y-2">
          {(result.nextMove.length > 0
            ? result.nextMove
            : ["No moves identified."]).map((move, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-purple-500 font-bold flex-shrink-0">→</span>
              <span className="text-sm text-zinc-700">{move}</span>
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
          Fight Another Boss
        </button>
      </div>
    </div>
  );
}

