"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  WeaknessRequestBody,
  WeaknessResult,
  WeaknessItem,
  ClaimToDefend,
  WeaknessRisk,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Scanning for open weak points...",
  "Comparing your resume against the JD...",
  "Finding the questions that hurt...",
  "Ranking the damage potential...",
  "Preparing truthful counter-strategies...",
];

const RISK_STYLES: Record<WeaknessRisk, { label: string; badge: string }> = {
  LOW: { label: "LOW", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MEDIUM: { label: "MEDIUM", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  HIGH: { label: "HIGH", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  "FINAL BOSS": { label: "FINAL BOSS", badge: "bg-red-50 text-red-700 border-red-200" },
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className="text-[11px] font-semibold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:border-red-300 rounded-md px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">Weakness Detector</span>
    </nav>
  );
}

export function WeaknessDetectorPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<WeaknessResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");

  const canSubmit = Boolean(
    resumeText.trim() && jobDescription.trim() && config.apiKey.trim(),
  );

  async function detect() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Weaknesses are found in the mismatch.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. Gaps only exist against a target.");

    setPhase("loading");
    const body: WeaknessRequestBody = {
      config,
      resumeText,
      jobDescription,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
    };
    try {
      const res = await fetch("/api/detect-weaknesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as WeaknessResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void detect();
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
        <div className="workflow-wrap pt-6">
          <Breadcrumb />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
            Find out where they&apos;re going to cook you.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRedetect={() => void detect()} onReset={handleReset} />;
  }

  return (
    <InputWorkspace
      canSubmit={canSubmit}
      error={error}
      validationError={validationError}
      config={config}
      setConfig={setConfig}
      resumeText={resumeText}
      setResumeText={setResumeText}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      linkedin={linkedin}
      setLinkedin={setLinkedin}
      github={github}
      setGithub={setGithub}
      onSubmit={handleSubmit}
    />
  );
}

function InputWorkspace(props: {
  canSubmit: boolean;
  error: string;
  validationError: string;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (t: string) => void;
  jobDescription: string;
  setJobDescription: (t: string) => void;
  linkedin: string;
  setLinkedin: (t: string) => void;
  github: string;
  setGithub: (t: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    canSubmit,
    error,
    validationError,
    config,
    setConfig,
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    linkedin,
    setLinkedin,
    github,
    setGithub,
    onSubmit,
  } = props;
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Find out where they&apos;re going to cook you.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Identify the questions and topics most likely to expose your gaps.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          Truthful prep only. No faking experience, no invented metrics.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The mismatch <span>(resume vs. JD)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={false}
                />
                <p className="field-help mt-2">
                  Weaknesses live where your resume under-eviden the JD&apos;s demands.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="wd-jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="wd-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  Gaps only exist against a target.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                Extra evidence <span>(optional)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="wd-linkedin" className="field-label">
                  LinkedIn Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="wd-linkedin"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="Paste your LinkedIn About, Experience, Skills..."
                  rows={5}
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="wd-github" className="field-label">
                  GitHub Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="wd-github"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="Paste your README, pinned repos, tech stack..."
                  rows={5}
                  className="field-control"
                />
              </div>
            </div>
          </section>

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
              disabled={!canSubmit}
              className="cta-primary action-primary"
            >
              Find My Weaknesses <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onRedetect,
  onReset,
}: {
  result: WeaknessResult;
  onRedetect: () => void;
  onReset: () => void;
}) {
  const scoreColor =
    result.weaknessScore >= 70
      ? "text-red-700"
      : result.weaknessScore >= 40
        ? "text-amber-700"
        : "text-emerald-700";

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Weakness Score
          </p>
          <p className={`mt-1 text-4xl font-bold tracking-tight ${scoreColor}`}>
            {result.weaknessScore}
            <span className="text-lg text-zinc-400">/100</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            How exposed you are to JD-mismatch weaknesses. Higher = more gaps to prep.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={
                result.weaknessScore >= 70
                  ? "h-full rounded-full bg-red-500"
                  : result.weaknessScore >= 40
                    ? "h-full rounded-full bg-amber-500"
                    : "h-full rounded-full bg-emerald-500"
              }
              style={{ width: `${result.weaknessScore}%` }}
            />
          </div>
        </section>

        {result.weaknesses.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">5</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  Ranked Weaknesses
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Biggest first. Each with the question it invites and how to prepare.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-3">
              {result.weaknesses.map((w, i) => (
                <WeaknessCard key={`wk-${i}`} index={i + 1} item={w} />
              ))}
            </div>
          </section>
        )}

                {result.claimsToDefend.length > 0 && (
          <section className="card mt-4 border-amber-200 bg-amber-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Claims You Need to Defend
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Resume claims the interviewer will likely probe.
            </p>
            <div className="mt-2 space-y-2">
              {result.claimsToDefend.map((c, i) => (
                <ClaimCard key={`claim-${i}`} claim={c} />
              ))}
            </div>
          </section>
        )}

        {result.gapStrategy && (
          <section className="card mt-4 border-emerald-200 bg-emerald-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              How to Handle the Gap
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Truthful strategy for the biggest weakness.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              {result.gapStrategy}
            </p>
          </section>
        )}

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          {result.funnyLine || "These are the areas where the interviewer may activate their trap card."}
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRedetect} className="cta-primary action-primary">
            Re-detect
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function WeaknessCard({ index, item }: { index: number; item: WeaknessItem }) {
  const risk = RISK_STYLES[item.risk] ?? RISK_STYLES.MEDIUM;

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Weakness {index}
          </p>
          <p className="mt-0.5 text-sm font-bold text-zinc-900">{item.weakness}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${risk.badge}`}>
          {risk.label}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        {item.whyItExists && (
          <p className="text-xs leading-relaxed text-zinc-600">
            <span className="font-semibold text-zinc-500">Why it exists:</span> {item.whyItExists}
          </p>
        )}
        {item.evidence && (
          <p className="text-xs leading-relaxed text-zinc-600">
            <span className="font-semibold text-zinc-500">Evidence:</span> {item.evidence}
          </p>
        )}
        {item.likelyQuestion && (
          <p className="text-xs italic leading-relaxed text-zinc-600">
            <span className="font-semibold not-italic text-zinc-500">Likely question:</span> &ldquo;{item.likelyQuestion}&rdquo;
          </p>
        )}
        {item.howToPrepare && (
          <div className="border-l-2 border-emerald-300 pl-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              How to prepare
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{item.howToPrepare}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ClaimCard({ claim }: { claim: ClaimToDefend }) {
  return (
    <div className="rounded-md border border-amber-200 bg-white p-3">
      <p className="text-sm font-semibold text-zinc-900">{claim.claim}</p>
      {claim.likelyFollowUp && (
        <p className="mt-1 text-xs italic text-zinc-600">
          <span className="font-semibold not-italic text-zinc-500">Follow-up:</span> &ldquo;{claim.likelyFollowUp}&rdquo;
        </p>
      )}
      {claim.evidenceAvailable && (
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">Evidence:</span> {claim.evidenceAvailable}
        </p>
      )}
    </div>
  );
}