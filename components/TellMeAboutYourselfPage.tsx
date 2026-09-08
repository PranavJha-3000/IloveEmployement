"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  TellMeRequestBody,
  TellMeResult,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your journey...",
  "Trimming the life story into a professional one...",
  "Deleting the childhood section...",
  "Writing three speakable versions...",
  "Making sure it doesn't start with your birth certificate...",
];

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
      <span className="text-zinc-600 font-medium">Tell Me About Yourself</span>
    </nav>
  );
}

export function TellMeAboutYourselfPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<TellMeResult | null>(null);
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

  async function build() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. The answer is built from your actual background.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. 'Why this role' needs the role.");

    setPhase("loading");
    const body: TellMeRequestBody = {
      config,
      resumeText,
      jobDescription,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
    };
    try {
      const res = await fetch("/api/build-introduction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as TellMeResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void build();
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
            Tell me about yourself.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRebuild={() => void build()} onReset={handleReset} />;
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
          Tell me about yourself.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          The question that somehow isn&apos;t about your entire life.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          Natural version included. Please do not start with your birth certificate.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The material <span>(resume + target job)</span>
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
                  The answer is built from your actual background. No invented accomplishments.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="tm-jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="tm-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  &ldquo;Why this role makes sense&rdquo; is grounded in this JD.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                Extra context <span>(optional)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="tm-linkedin" className="field-label">
                  LinkedIn Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="tm-linkedin"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="Paste your LinkedIn About, Experience, Skills..."
                  rows={5}
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="tm-github" className="field-label">
                  GitHub Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="tm-github"
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
              Build My Answer <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onRebuild,
  onReset,
}: {
  result: TellMeResult;
  onRebuild: () => void;
  onReset: () => void;
}) {
  const versions: { label: string; blurb: string; text: string }[] = [
    { label: "30 Seconds", blurb: "Very concise introduction", text: result.thirtySeconds },
    { label: "60 Seconds", blurb: "Standard interview response", text: result.sixtySeconds },
    { label: "90 Seconds", blurb: "More detailed version", text: result.ninetySeconds },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <div className="workflow-heading">
            <span className="step-badge">T</span>
            <div>
              <h2 className="text-base font-bold leading-tight text-zinc-900">
                Three Versions
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Same structure — Present, past, achievement, why this role. Different lengths.
              </p>
            </div>
          </div>
          <div className="mt-2 space-y-3">
            {versions.map((v) => (
              <VersionCard key={v.label} label={v.label} blurb={v.blurb} text={v.text} />
            ))}
          </div>
        </section>

        {result.whyThisWorks.some((w) => w) && (
          <section className="card mt-4 border-emerald-200 bg-emerald-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Why This Works
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.whyThisWorks.filter(Boolean).map((w, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.avoidSaying.some((a) => a) && (
          <section className="card mt-4 border-red-200 bg-red-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Avoid Saying
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.avoidSaying.filter(Boolean).map((a, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          {result.funnyLine || "Please do not start with your birth certificate."}
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRebuild} className="cta-primary action-primary">
            Rebuild
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function VersionCard({
  label,
  blurb,
  text,
}: {
  label: string;
  blurb: string;
  text: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {label} <span className="font-normal normal-case tracking-normal text-zinc-500">&middot; {blurb}</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {text || (
              <span className="italic text-zinc-400">No version generated.</span>
            )}
          </p>
        </div>
        <CopyButton text={text} />
      </div>
    </div>
  );
}