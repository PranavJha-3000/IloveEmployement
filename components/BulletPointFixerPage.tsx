"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  BulletFixRequestBody,
  BulletFixResult,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";
import { BulletFixResultView } from "./sections/BulletFixResult";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your bullet...",
  "Diagnosing the issues...",
  "Crafting a better version...",
  "Checking the facts...",
  "Almost done...",
];

export function BulletPointFixerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<BulletFixResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [bullet, setBullet] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [roleContext, setRoleContext] = useState("");
  const [technology, setTechnology] = useState("");
  const [desperationLevel, setDesperationLevel] = useState(2);

  const canSubmit = Boolean(bullet.trim() && config.apiKey.trim());

  async function handleFix(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!bullet.trim())
      return setValidationError("A bullet point is required.");

    setPhase("loading");
    const body: BulletFixRequestBody = {
      config,
      bullet,
      jobDescription: jobDescription.trim() || undefined,
      roleContext: roleContext.trim() || undefined,
      technology: technology.trim() || undefined,
      desperationLevel,
    };
    try {
      const res = await fetch("/api/fix-bullet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as BulletFixResult);
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

  if (phase === "results" && result) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-[800px] mx-auto px-6 pt-6 pb-20 space-y-4">
          <Breadcrumb />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleReset}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              &larr; Fix another bullet
            </button>
          </div>
          <BulletFixResultView result={result} />
          <p className="text-xs text-zinc-400 text-center pt-4">
            TRUTH FILTER: ON. No fabricated metrics or experience. No slang in the output.
          </p>
        </div>
      </main>
    );
  }

  return <IdleView {...{ phase, error, validationError, canSubmit, config, setConfig, bullet, setBullet, jobDescription, setJobDescription, roleContext, setRoleContext, technology, setTechnology, desperationLevel, onFix: handleFix }} />;
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">Bullet Point Fixer</span>
    </nav>
  );
}


interface IdleViewProps {
  phase: Phase;
  error: string;
  validationError: string;
  canSubmit: boolean;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  bullet: string;
  setBullet: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  roleContext: string;
  setRoleContext: (v: string) => void;
  technology: string;
  setTechnology: (v: string) => void;
  desperationLevel: number;
  onFix: (e: React.FormEvent) => void;
}

function IdleView({
  phase,
  error,
  validationError,
  canSubmit,
  config,
  setConfig,
  bullet,
  setBullet,
  jobDescription,
  setJobDescription,
  roleContext,
  setRoleContext,
  technology,
  setTechnology,
  onFix,
}: IdleViewProps) {
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Fix that bullet.
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Because "worked on a project" is not exactly making recruiters levitate.
        </p>

        <form onSubmit={onFix} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>Your inputs</h2>
            </div>

            <div className="mb-4">
              <label htmlFor="bulletText" className="field-label">
                Resume Bullet <span className="text-red-500">*</span>
              </label>
              <textarea
                id="bulletText"
                value={bullet}
                onChange={(e) => setBullet(e.target.value)}
                disabled={phase === "loading"}
                placeholder="Paste your resume bullet here..."
                rows={4}
                className="field-control bullet-input"
              />
              <p className="field-help">One bullet at a time. Be specific for better results.</p>
            </div>

            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="fixBulletJd" className="field-label">
                  Job Description (optional)
                </label>
                <textarea
                  id="fixBulletJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste target JD for keyword alignment"
                  rows={5}
                  className="field-control jd-input"
                />
                <p className="field-help">Optional. Helps align terminology.</p>
              </div>
              <div className="input-pane space-y-4">
                <div>
                  <label htmlFor="roleContext" className="field-label">
                    Role / Context (optional)
                  </label>
                  <input
                    id="roleContext"
                    type="text"
                    value={roleContext}
                    onChange={(e) => setRoleContext(e.target.value)}
                    disabled={phase === "loading"}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="field-control"
                  />
                </div>
                <div>
                  <label htmlFor="technology" className="field-label">
                    Technology (optional)
                  </label>
                  <input
                    id="technology"
                    type="text"
                    value={technology}
                    onChange={(e) => setTechnology(e.target.value)}
                    disabled={phase === "loading"}
                    placeholder="e.g. React, AWS, Python"
                    className="field-control"
                  />
                </div>
              </div>
            </div>

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
                Fix This Bullet <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. TRUTH FILTER always on.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}
