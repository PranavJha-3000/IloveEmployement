"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  RecruiterSimulationRequestBody,
  RecruiterSimulationResult,
  KeepReading,
  RecruiterTabRisk,
  TimelinePhase,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Booting the simulated recruiter...",
  "First glance in progress...",
  "Skimming headers and first bullets...",
  "Making the keep-or-skip call...",
  "Consulting the inner monologue...",
];

const KEEP_READING_STYLES: Record<
  KeepReading,
  { text: string; bg: string; border: string; note: string }
> = {
  YES: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    note: "The fit is obvious within 30 seconds.",
  },
  MAYBE: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    note: "Fit is plausible but takes effort to find.",
  },
  NO: {
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    note: "The fit is not apparent in 30 seconds.",
  },
};

const RISK_STYLES: Record<RecruiterTabRisk, { text: string; bg: string; border: string }> = {
  LOW: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  MEDIUM: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  HIGH: { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
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
      <span className="text-zinc-600 font-medium">Recruiter Simulator</span>
    </nav>
  );
}

export function RecruiterSimulatorPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RecruiterSimulationResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");

  const canSubmit = Boolean(
    resumeText.trim() && jobDescription.trim() && config.apiKey.trim(),
  );

  async function simulate() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. The recruiter needs something to scan.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. The scan is against a specific job.");

    setPhase("loading");
    const body: RecruiterSimulationRequestBody = {
      config,
      resumeText,
      jobDescription,
      role: role.trim() || undefined,
      company: company.trim() || undefined,
    };
    try {
      const res = await fetch("/api/simulate-recruiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as RecruiterSimulationResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void simulate();
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
            Would a recruiter keep reading?
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRescan={() => void simulate()} onReset={handleReset} />;
  }

  return (
    <InputWorkspace
      phase={phase}
      canSubmit={canSubmit}
      error={error}
      validationError={validationError}
      config={config}
      setConfig={setConfig}
      resumeText={resumeText}
      setResumeText={setResumeText}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      role={role}
      setRole={setRole}
      company={company}
      setCompany={setCompany}
      onSubmit={handleSubmit}
    />
  );
}

function InputWorkspace(props: {
  phase: Phase;
  canSubmit: boolean;
  error: string;
  validationError: string;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  resumeText: string;
  setResumeText: (t: string) => void;
  jobDescription: string;
  setJobDescription: (t: string) => void;
  role: string;
  setRole: (t: string) => void;
  company: string;
  setCompany: (t: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    phase,
    canSubmit,
    error,
    validationError,
    config,
    setConfig,
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    role,
    setRole,
    company,
    setCompany,
    onSubmit,
  } = props;
  const loading = phase === "loading";
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Would a recruiter keep reading?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Let&apos;s simulate the 30-second resume scan.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          A model-based simulation — not a prediction of any specific recruiter.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                What gets scanned <span>(the 30 seconds)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={loading}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="rs-jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="rs-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  The simulated recruiter scans for fit against this specific job.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                Where they&apos;re looking <span>(optional)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="rs-role" className="field-label">
                  Role <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="rs-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Frontend Engineer"
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="rs-company" className="field-label">
                  Company <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="rs-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Stripe"
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
              disabled={!canSubmit || loading}
              className="cta-primary action-primary"
            >
              Start Recruiter Scan <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onRescan,
  onReset,
}: {
  result: RecruiterSimulationResult;
  onRescan: () => void;
  onReset: () => void;
}) {
  const kr = KEEP_READING_STYLES[result.keepReading];
  const risk = RISK_STYLES[result.tabClosingRisk];

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className={`card mt-4 border ${kr.border} ${kr.bg}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Keep Reading?
              </p>
              <p className={`mt-1 text-3xl font-bold tracking-tight ${kr.text}`}>
                {result.keepReading}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{kr.note}</p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-center ${risk.border} ${risk.bg}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Tab-Closing Risk
              </p>
              <p className={`text-2xl font-bold ${risk.text}`}>{result.tabClosingRisk}</p>
            </div>
          </div>
          {result.tabClosingExplanation && (
            <p className="mt-3 border-t border-current/10 pt-2 text-xs leading-relaxed text-zinc-600">
              {result.tabClosingExplanation}
            </p>
          )}
        </section>

        {result.timeline.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">30</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  The 30-Second Scan
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  What happens in each phase of the review.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-3">
              {result.timeline.map((t, i) => (
                <TimelineBlock key={`tl-${i}`} index={i + 1} phase={t} />
              ))}
            </div>
          </section>
        )}

        <BulletListCard
          step="N"
          title="What They Notice First"
          blurb="Ordered by prominence — top of page, most recent, most dominant."
          items={result.whatTheyNoticeFirst}
          dotClass="bg-red-500"
          emptyText="Nothing stood out enough to register."
        />

        <BulletListCard
          step="M"
          title="What They Miss"
          blurb="Important experience that is buried or unclear."
          items={result.whatTheyMiss}
          dotClass="bg-amber-500"
          emptyText="Nothing important went missing. The structure works."
        />

        {result.whyTheyMightSkip.length > 0 && (
          <section className="card mt-4 border-red-200 bg-red-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Why They Might Skip
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Specific, evidence-based reasons — not generic advice.
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.whyTheyMightSkip.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.recruiterQuestions.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">?</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  Recruiter Questions
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Caused by ambiguity or gaps in the resume.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-2">
              {result.recruiterQuestions.map((q, i) => (
                <div
                  key={i}
                  className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3 text-sm leading-relaxed text-zinc-700 italic"
                >
                  &ldquo;{q}&rdquo;
                </div>
              ))}
            </div>
          </section>
        )}

        {result.fixes.length > 0 && (
          <section className="card mt-4 border-emerald-200 bg-emerald-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Fix the First 30 Seconds
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              The 3 highest-impact changes, using material you already have.
            </p>
            <div className="mt-2 space-y-2">
              {result.fixes.map((f, i) => (
                <div key={i} className="rounded-md border border-emerald-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed text-zinc-800">
                      <span className="font-bold text-emerald-700">{i + 1}.</span> {f}
                    </p>
                    <CopyButton text={f} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.innerMonologue.length > 0 && (
          <section className="card mt-4 border-zinc-900/10 bg-zinc-900 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Recruiter Inner Monologue
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Simulated voice. Light. Clearly not a real recruiter.
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.innerMonologue.filter(Boolean).map((m, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-100">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.disclaimer && (
          <p className="mt-4 text-center text-xs leading-relaxed text-zinc-400">
            {result.disclaimer}
          </p>
        )}

        <div className="action-row mt-2">
          <button type="button" onClick={onRescan} className="cta-primary action-primary">
            Re-run Scan
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function TimelineBlock({ index, phase }: { index: number; phase: TimelinePhase }) {
  const copyText = [phase.phase, ...phase.observations].join("\n");

  return (
    <div className="relative rounded-md border border-zinc-200 bg-zinc-50/60 p-4 pl-14">
      <span className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
        {index}
      </span>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900">{phase.phase}</p>
          {phase.seconds && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {phase.seconds}
            </p>
          )}
        </div>
        <CopyButton text={copyText} />
      </div>
      {phase.observations.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {phase.observations.map((o, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" aria-hidden />
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BulletListCard({
  step,
  title,
  blurb,
  items,
  dotClass,
  emptyText,
}: {
  step: string;
  title: string;
  blurb: string;
  items: string[];
  dotClass: string;
  emptyText: string;
}) {
  return (
    <section className="card mt-4">
      <div className="workflow-heading">
        <span className="step-badge">{step}</span>
        <div>
          <h2 className="text-base font-bold leading-tight text-zinc-900">{title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{blurb}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="mt-1 space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
              <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dotClass}`} aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm italic text-zinc-400">{emptyText}</p>
      )}
    </section>
  );
}