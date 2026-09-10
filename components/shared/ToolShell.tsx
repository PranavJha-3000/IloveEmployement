"use client";
import { useState, useCallback } from "react";
import type { AiRequestConfig } from "@/lib/types";
import { ToolHeader } from "./ToolHeader";
import { JobDescriptionInput, ProfileInputs } from "./JobDescriptionInput";
import { ResumeCard } from "@/components/ResumeCard";
import { ProviderConfig } from "@/components/ProviderConfig";
import { DesperationSelector } from "@/components/DesperationSelector";
import { AnalyzeButton } from "./AnalyzeButton";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "@/components/LoadingState";

export type ToolPhase = "idle" | "loading" | "results";

export interface ToolShellRenderState {
  phase: ToolPhase;
  result: unknown;
  error: string;
  validationError: string;
  config: AiRequestConfig;
  resumeText: string;
  jobDescription: string;
  linkedinUrl: string;
  githubUrl: string;
  desperationLevel: number;
}

export interface ToolShellProps {
  title: string;
  description: string;
  actionLabel: string;
  apiEndpoint: string;
  loadingMessages?: string[];
  jdLabel?: string;
  jdPlaceholder?: string;
  jdRequired?: boolean;
  showDesperation?: boolean;
  showProfiles?: boolean;
  children: (state: ToolShellRenderState) => React.ReactNode;
}


/** Shared tool page shell — encapsulates the entire input → loading → results flow. */
export function ToolShell({
  title,
  description,
  actionLabel,
  apiEndpoint,
  loadingMessages,
  jdLabel = "Job Description",
  jdPlaceholder = "Paste the job description here...",
  jdRequired = true,
  showDesperation = false,
  showProfiles = false,
  children,
}: ToolShellProps) {
  const [phase, setPhase] = useState<ToolPhase>("idle");
  const [result, setResult] = useState<unknown>(null);
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

  const canSubmit = Boolean(resumeText.trim() && config.apiKey.trim());

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError("");
      setError("");

      if (!config.apiKey.trim()) {
        return setValidationError("API key is required. This app runs on your own key.");
      }
      if (!resumeText.trim()) {
        return setValidationError("Resume is required. Paste text or upload a file.");
      }
      if (jdRequired && !jobDescription.trim()) {
        return setValidationError("Job description is required.");
      }

      setPhase("loading");
      try {
        const body = {
          config,
          resumeText,
          jobDescription,
          linkedinUrl: linkedinUrl.trim() || undefined,
          githubUrl: githubUrl.trim() || undefined,
          desperationLevel: showDesperation ? desperationLevel : 0,
        };

        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");

        setResult(json);
        setPhase("results");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("idle");
      }
    },
    [config, resumeText, jobDescription, linkedinUrl, githubUrl, desperationLevel, apiEndpoint, jdRequired, showDesperation],
  );

  const handleReset = useCallback(() => {
    setResult(null);
    setError("");
    setValidationError("");
    setPhase("idle");
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <ToolHeader title={title} description={description} backHref="/#tools" />

      <form onSubmit={handleSubmit} className="workflow-wrap mt-4">
        {/* Resume + JD input */}
        <div className="input-grid">
          <div className="input-pane">
            <ResumeCard value={resumeText} onChange={setResumeText} disabled={phase === "loading"} />
          </div>
          <div className="input-pane">
            <JobDescriptionInput
              value={jobDescription}
              onChange={setJobDescription}
              label={jdLabel}
              placeholder={jdPlaceholder}
              disabled={phase === "loading"}
            />
            {showProfiles && (
              <ProfileInputs
                linkedinUrl={linkedinUrl}
                setLinkedinUrl={setLinkedinUrl}
                githubUrl={githubUrl}
                setGithubUrl={setGithubUrl}
                disabled={phase === "loading"}
              />
            )}
          </div>
        </div>

        {/* AI config */}
        <div className="config-card mt-4">
          <ProviderConfig config={config} onChange={setConfig} compact />
        </div>

        {/* Desperation selector */}
        {showDesperation && (
          <>
            <div className="workflow-heading desperate-heading mt-4">
              <span className="step-badge">2</span>
              <div>
                <h2>How desperate are we?</h2>
                <p>Changes the tone, never the facts.</p>
              </div>
            </div>
            <DesperationSelector value={desperationLevel} onChange={setDesperationLevel} />
          </>
        )}

        {/* Errors */}
        <ErrorState error={validationError || error} onDismiss={error ? () => setError("") : undefined} />

        {/* Submit */}
        <div className="action-row mt-4">
          <AnalyzeButton onClick={() => {}} disabled={!canSubmit || phase === "loading"} loading={phase === "loading"}>
            {actionLabel} <span aria-hidden>→</span>
          </AnalyzeButton>
        </div>
        <p className="field-help text-center">
          Runs on your own API key. Sent per-request, never stored.
        </p>
      </form>

      {/* Loading */}
      {phase === "loading" && <LoadingState messages={loadingMessages} />}

      {/* Results */}
      {phase === "results" && result !== null && result !== undefined && (
        <div className="max-w-5xl mx-auto px-6 pb-12">
          {children({
            phase,
            result,
            error,
            validationError,
            config,
            resumeText,
            jobDescription,
            linkedinUrl,
            githubUrl,
            desperationLevel,
          })}
        </div>
      )}
    </main>
  );
}
