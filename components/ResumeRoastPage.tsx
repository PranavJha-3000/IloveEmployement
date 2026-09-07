"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  ResumeRoastRequestBody,
  ResumeRoastResult,
} from "@/lib/types";
import { ResumeCard } from "./ResumeCard";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";
import { RoastLevel } from "./sections/RoastLevel";
import { RoastAnalysis } from "./sections/RoastAnalysis";
import { RoastRisk } from "./sections/RoastRisk";
import { RoastHumor } from "./sections/RoastHumor";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Locating the corporate wallpaper...",
  "Auditing your NPC content...",
  "Measuring the damage...",
  "Cooking the roast...",
];

export function ResumeRoastPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ResumeRoastResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const canSubmit = Boolean(resumeText.trim() && config.apiKey.trim());

  async function handleRoast(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Paste text or upload a file.");

    setPhase("loading");
    const body: ResumeRoastRequestBody = {
      config,
      resumeText,
      jobDescription: jobDescription.trim() || undefined,
    };
    try {
      const res = await fetch("/api/roast-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as ResumeRoastResult);
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
      onRoast={handleRoast}
      onReset={handleReset}
    />
  );
}

interface ViewProps {
  phase: Phase;
  result: ResumeRoastResult | null;
  error: string;
  validationError: string;
  canSubmit: boolean;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  onRoast: (e: React.FormEvent) => void;
  onReset: () => void;
}

function View(props: ViewProps) {
  const { phase, result, onReset } = props;

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
        <div className="max-w-[900px] mx-auto px-6 pt-6 pb-20 space-y-4">
          <Breadcrumb />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={onReset}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              &larr; Roast another resume
            </button>
          </div>
          <RoastLevel result={result} />
          <RoastAnalysis result={result} />
          <RoastRisk result={result} />
          <RoastHumor result={result} />
          <p className="text-xs text-zinc-400 text-center pt-4">
            The roast is grounded in your actual resume text. Nothing is fabricated, nothing is
            stored, and nothing here is about you as a person - only the document.
          </p>
        </div>
      </main>
    );
  }

  return <InputWorkspace {...props} />;
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">Resume Roast</span>
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
    onRoast,
  } = props;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Let&apos;s see what we&apos;re working with.
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Send us your resume. We&apos;ll tell you what a recruiter is probably thinking.
        </p>

        <form onSubmit={onRoast} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your resume <span>(no feelings will be spared)</span>
              </h2>
            </div>

            {/* Resume + optional JD */}
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={phase === "loading"}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="roastJd" className="field-label">
                  Target Job Description <em>(optional)</em>
                </label>
                <textarea
                  id="roastJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste the job description to sharpen the roast..."
                  rows={10}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">
                  Optional. With a JD, the roast judges relevance. Without one, it judges the resume as-is.
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
                disabled={!canSubmit || phase === "loading"}
                className="cta-primary action-primary"
              >
                Roast My Resume <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored. Roasts the document, never the person.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}