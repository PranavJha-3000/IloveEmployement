"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  JdFinding,
  JdRedFlagRequestBody,
  JdRedFlagResult,
  ProceedRecommendation,
  RedFlagLevel,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading between the bullet points...",
  "Decoding the corporate dialect...",
  "Checking what is NOT being said...",
  "Weighing signals against evidence...",
  "Separating facts from vibes...",
];

const LEVEL_STYLES: Record<RedFlagLevel, { label: string; ring: string; text: string; bg: string }> = {
  LOW: { label: "LOW", ring: "border-emerald-300", text: "text-emerald-700", bg: "bg-emerald-50" },
  MEDIUM: { label: "MEDIUM", ring: "border-amber-300", text: "text-amber-700", bg: "bg-amber-50" },
  HIGH: { label: "HIGH", ring: "border-red-300", text: "text-red-700", bg: "bg-red-50" },
};

const PROCEED_STYLES: Record<ProceedRecommendation, { label: string; text: string; bg: string; note: string }> = {
  YES: { label: "YES", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", note: "Clear JD. Worth applying." },
  PROBABLY: { label: "PROBABLY", text: "text-amber-700", bg: "bg-amber-50 border-amber-200", note: "Apply, but walk in with questions." },
  INVESTIGATE_FIRST: { label: "INVESTIGATE FIRST", text: "text-red-700", bg: "bg-red-50 border-red-200", note: "Research and clarify before investing time." },
};

const CATEGORY_META: { key: keyof JdRedFlagResult["categories"]; title: string; blurb: string }[] = [
  { key: "vague", title: "Vague", blurb: "Generic wording that provides little useful information." },
  { key: "overloaded", title: "Overloaded", blurb: "Role appears to combine many responsibilities." },
  { key: "missing", title: "Missing Information", blurb: "Important information absent from the JD." },
  { key: "concern", title: "Potential Concern", blurb: "Language that deserves clarification." },
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
      <span className="text-zinc-600 font-medium">JD Red Flag Scanner</span>
    </nav>
  );
}

export function JdRedFlagScannerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<JdRedFlagResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");

  const canSubmit = Boolean(jobDescription.trim() && config.apiKey.trim());

  async function scan() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. Paste the posting to scan.");

    setPhase("loading");
    const body: JdRedFlagRequestBody = {
      config,
      jobDescription,
      companyName: companyName.trim() || undefined,
      role: role.trim() || undefined,
      salary: salary.trim() || undefined,
    };
    try {
      const res = await fetch("/api/scan-jd-red-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as JdRedFlagResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void scan();
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
            What&apos;s hiding between the bullet points?
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRescan={() => void scan()} onReset={handleReset} />;
  }

  return (
    <InputWorkspace
      phase={phase}
      canSubmit={canSubmit}
      error={error}
      validationError={validationError}
      config={config}
      setConfig={setConfig}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      companyName={companyName}
      setCompanyName={setCompanyName}
      role={role}
      setRole={setRole}
      salary={salary}
      setSalary={setSalary}
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
  jobDescription: string;
  setJobDescription: (t: string) => void;
  companyName: string;
  setCompanyName: (t: string) => void;
  role: string;
  setRole: (t: string) => void;
  salary: string;
  setSalary: (t: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    phase,
    canSubmit,
    error,
    validationError,
    config,
    setConfig,
    jobDescription,
    setJobDescription,
    companyName,
    setCompanyName,
    role,
    setRole,
    salary,
    setSalary,
    onSubmit,
  } = props;
  const loading = phase === "loading";
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          What&apos;s hiding between the bullet points?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Find suspicious job-description language before you spend an hour applying.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          Suspicious &ne; guilty. We flag what to clarify, not what to assume.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The job description <span>(paste the full posting)</span>
              </h2>
            </div>
            <label htmlFor="rf-jd" className="field-label">
              Job Description
            </label>
            <textarea
              id="rf-jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={loading}
              placeholder="Paste the entire job posting here — responsibilities, requirements, perks, the works..."
              rows={14}
              className="field-control jd-input"
            />
            <p className="field-help">
              We scan what it says — and what it conveniently leaves out.
            </p>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                Optional context <span>(sharpens the scan)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="rf-company" className="field-label">
                  Company <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="rf-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Stripe"
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="rf-role" className="field-label">
                  Role <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="rf-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Frontend Engineer"
                  className="field-control"
                />
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="rf-salary" className="field-label">
                Salary <em className="text-zinc-400 font-normal">(optional)</em>
              </label>
              <input
                id="rf-salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                disabled={loading}
                placeholder="e.g. $120k–150k, or 'not listed in the posting'"
                className="field-control"
              />
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
              Scan The JD <span aria-hidden>&rarr;</span>
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
  result: JdRedFlagResult;
  onRescan: () => void;
  onReset: () => void;
}) {
  const level = LEVEL_STYLES[result.redFlagLevel];
  const proceed = PROCEED_STYLES[result.shouldProceed];
  const totalFindings =
    result.categories.vague.length +
    result.categories.overloaded.length +
    result.categories.missing.length +
    result.categories.concern.length;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Red Flag Level
              </p>
              <p className={`mt-1 text-2xl font-bold tracking-tight ${level.text}`}>
                {level.label}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {totalFindings} {totalFindings === 1 ? "finding" : "findings"} across four categories
              </p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-center ${level.ring} ${level.bg}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${level.text}`}>
                Yapping Score
              </p>
              <p className={`text-2xl font-bold ${level.text}`}>
                {result.corporateYappingScore}
              </p>
              <p className="text-[10px] text-zinc-400">0&ndash;100</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={
                result.redFlagLevel === "LOW"
                  ? "h-full rounded-full bg-emerald-500"
                  : result.redFlagLevel === "MEDIUM"
                    ? "h-full rounded-full bg-amber-500"
                    : "h-full rounded-full bg-red-500"
              }
              style={{ width: `${result.corporateYappingScore}%` }}
            />
          </div>
        </section>

        {CATEGORY_META.map((cat) => {
          const findings = result.categories[cat.key];
          if (findings.length === 0) return null;
          return (
            <section key={cat.key} className="card mt-4">
              <div className="workflow-heading">
                <span className="step-badge">{cat.title.charAt(0)}</span>
                <div>
                  <h2 className="text-base font-bold leading-tight text-zinc-900">{cat.title}</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">{cat.blurb}</p>
                </div>
              </div>
              <div className="mt-1 space-y-3">
                {findings.map((f, i) => (
                  <FindingCard key={`${cat.key}-${i}`} index={i + 1} finding={f} />
                ))}
              </div>
            </section>
          );
        })}

        {result.goodSignals.length > 0 && (
          <section className="card mt-4 border-emerald-200 bg-emerald-50/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Good Signals
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.goodSignals.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  {g}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`card mt-4 border ${proceed.bg}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Should You Proceed?
          </p>
          <p className={`mt-1 text-2xl font-bold tracking-tight ${proceed.text}`}>
            {proceed.label}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{proceed.note}</p>
        </section>

        {result.summary && (
          <section className="card mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{result.summary}</p>
          </section>
        )}

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          Every finding is a question to ask, not a verdict to accept.
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRescan} className="cta-primary action-primary">
            Rescan
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function FindingCard({ index, finding }: { index: number; finding: JdFinding }) {
  const parts = [
    finding.phrase ? `"${finding.phrase}"` : "",
    finding.whatItCouldMean ? `Could mean: ${finding.whatItCouldMean}` : "",
    finding.whatToAsk ? `Ask: ${finding.whatToAsk}` : "",
  ].filter(Boolean);
  const copyText = parts.join("\n");

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Finding {index} &mdash; PHRASE
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            &ldquo;{finding.phrase}&rdquo;
          </p>
        </div>
        <CopyButton text={copyText} />
      </div>
      {finding.whatItCouldMean && (
        <div className="mt-2 border-l-2 border-amber-300 pl-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
            What it could mean
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-700">
            {finding.whatItCouldMean}
          </p>
        </div>
      )}
      {finding.whatToAsk && (
        <div className="mt-2 border-l-2 border-zinc-300 pl-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            What to ask
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-700 italic">
            &ldquo;{finding.whatToAsk}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}