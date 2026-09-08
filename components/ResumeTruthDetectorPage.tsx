"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  ResumeTruthRequestBody,
  ResumeTruthResult,
  ClaimAssessment,
  ClaimVerdict,
  CleanupCategory,
  CleanupItem,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Auditing the claims...",
  "Cross-referencing your sources...",
  "Separating receipts from vibes...",
  "Checking who corroborates whom...",
  "The evidence department is deliberating...",
];

const VERDICT_STYLES: Record<
  ClaimVerdict,
  { label: string; blurb: string; text: string; bg: string; border: string }
> = {
  green: {
    label: "STRONG EVIDENCE",
    blurb: "The provided material clearly supports the claim.",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  yellow: {
    label: "LIMITED EVIDENCE",
    blurb: "The claim may be true, but evidence is weak or incomplete.",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  gray: {
    label: "UNVERIFIABLE",
    blurb: "Not enough information to assess.",
    text: "text-zinc-600",
    bg: "bg-zinc-50",
    border: "border-zinc-200",
  },
  red: {
    label: "POTENTIAL ISSUE",
    blurb: "A contradiction appears, or the evidence doesn't support the claim.",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

const CLEANUP_META: Record<
  CleanupCategory,
  { label: string; blurb: string }
> = {
  clarify: { label: "Claims to Clarify", blurb: "Too vague to be credible — add specifics you can support." },
  substantiate: { label: "Claims to Substantiate", blurb: "Plausible but unsupported — add evidence you actually have." },
  reword: { label: "Claims to Reword", blurb: "Could be worded more accurately to match the evidence." },
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
      <span className="text-zinc-600 font-medium">Resume Truth Detector</span>
    </nav>
  );
}

export function ResumeTruthDetectorPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ResumeTruthResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [resumeText, setResumeText] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const canSubmit = Boolean(resumeText.trim() && config.apiKey.trim());

  async function check() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. The evidence check runs against your resume claims.");

    setPhase("loading");
    const body: ResumeTruthRequestBody = {
      config,
      resumeText,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      portfolio: portfolio.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
    };
    try {
      const res = await fetch("/api/check-resume-truth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as ResumeTruthResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void check();
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
            Receipts or trust-me-bro?
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onRecheck={() => void check()} onReset={handleReset} />;
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
      linkedin={linkedin}
      setLinkedin={setLinkedin}
      github={github}
      setGithub={setGithub}
      portfolio={portfolio}
      setPortfolio={setPortfolio}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
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
  linkedin: string;
  setLinkedin: (t: string) => void;
  github: string;
  setGithub: (t: string) => void;
  portfolio: string;
  setPortfolio: (t: string) => void;
  jobDescription: string;
  setJobDescription: (t: string) => void;
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
    linkedin,
    setLinkedin,
    github,
    setGithub,
    portfolio,
    setPortfolio,
    jobDescription,
    setJobDescription,
    onSubmit,
  } = props;
  const loading = phase === "loading";
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Receipts or trust-me-bro?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          See which resume claims are backed by actual evidence.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          An evidence check, not a lie detector. &ldquo;No evidence found&rdquo; is not an
          accusation.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The claims <span>(your resume)</span>
              </h2>
            </div>
            <ResumeCard
              value={resumeText}
              onChange={setResumeText}
              disabled={loading}
            />
            <p className="field-help mt-2">
              Every substantive claim gets checked against the sources you provide below.
            </p>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                The evidence <span>(optional, more is better)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="rt-linkedin" className="field-label">
                  LinkedIn Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="rt-linkedin"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  disabled={loading}
                  placeholder="Paste your LinkedIn About, Experience, Skills..."
                  rows={5}
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="rt-github" className="field-label">
                  GitHub Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="rt-github"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  disabled={loading}
                  placeholder="Paste your README, pinned repos, contribution summary..."
                  rows={5}
                  className="field-control"
                />
              </div>
            </div>
            <div className="input-grid mt-3">
              <div className="input-pane">
                <label htmlFor="rt-portfolio" className="field-label">
                  Portfolio / Project Links <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="rt-portfolio"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  disabled={loading}
                  placeholder="Project names, URLs, what each demonstrates..."
                  rows={4}
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="rt-jd" className="field-label">
                  Job Description <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="rt-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the target JD for relevance context..."
                  rows={4}
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
              Check My Receipts <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onRecheck,
  onReset,
}: {
  result: ResumeTruthResult;
  onRecheck: () => void;
  onReset: () => void;
}) {
  const grouped: Record<ClaimVerdict, ClaimAssessment[]> = {
    green: result.claims.filter((c) => c.verdict === "green"),
    yellow: result.claims.filter((c) => c.verdict === "yellow"),
    gray: result.claims.filter((c) => c.verdict === "gray"),
    red: result.claims.filter((c) => c.verdict === "red"),
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Evidence Score
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900">
            {result.evidenceScore}
            <span className="text-lg text-zinc-400">/100</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            How well your resume is supported by the sources you provided.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={
                result.evidenceScore >= 70
                  ? "h-full rounded-full bg-emerald-500"
                  : result.evidenceScore >= 40
                    ? "h-full rounded-full bg-amber-500"
                    : "h-full rounded-full bg-red-500"
              }
              style={{ width: `${result.evidenceScore}%` }}
            />
          </div>
        </section>

        {result.claims.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">C</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  The Claims
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Each claim, its source, the evidence, and the verdict.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-4">
              {(["green", "yellow", "gray", "red"] as ClaimVerdict[]).map((verdict) => {
                const claims = grouped[verdict];
                if (claims.length === 0) return null;
                const s = VERDICT_STYLES[verdict];
                return (
                  <div key={verdict}>
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${s.border} ${s.bg}`}>
                      <span
                        className={`inline-block rounded-full border border-current px-2 py-0.5 text-[10px] font-bold tracking-wider ${s.text}`}
                      >
                        {s.label}
                      </span>
                      <span className="text-xs text-zinc-600">{s.blurb}</span>
                      <span className={`ml-auto text-xs font-bold ${s.text}`}>
                        {claims.length}
                      </span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {claims.map((c, i) => (
                        <ClaimRow key={`${verdict}-${i}`} claim={c} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {result.contradictions.length > 0 && (
          <section className="card mt-4 border-red-200 bg-red-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Contradictions
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Genuine inconsistencies between the sources you provided.
            </p>
            <div className="mt-2 space-y-2">
              {result.contradictions.map((c, i) => (
                <div key={i} className="rounded-md border border-red-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900">
                      <span className="text-zinc-400">{i + 1}.</span> {c.issue}
                    </p>
                    <CopyButton
                      text={[c.sources, c.issue, c.detail].filter(Boolean).join("\n")}
                    />
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                    {c.sources}
                  </span>
                  {c.detail && (
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">{c.detail}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {result.cleanup.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">W</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">Cleanup</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Every suggestion stays within what you can actually support.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-4">
              {(["clarify", "substantiate", "reword"] as CleanupCategory[]).map((cat) => {
                const items = result.cleanup.filter((c) => c.category === cat);
                if (items.length === 0) return null;
                const meta = CLEANUP_META[cat];
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {meta.label} <span className="text-zinc-300">&middot;</span>{" "}
                      <span className="font-normal normal-case tracking-normal text-zinc-500">
                        {meta.blurb}
                      </span>
                    </p>
                    <div className="mt-2 space-y-2">
                      {items.map((item, i) => (
                        <CleanupRow key={`${cat}-${i}`} item={item} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {result.noCapMode.enabled && (
          <section className="card mt-4 border-zinc-900/10 bg-zinc-900 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              NO CAP MODE
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-100">
              {result.noCapMode.explanation}
            </p>
          </section>
        )}

        {result.summary && (
          <section className="card mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{result.summary}</p>
          </section>
        )}

        <p className="mt-4 text-center text-xs font-medium text-zinc-400">
          {result.funnyLine || "The evidence department has concerns."}
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onRecheck} className="cta-primary action-primary">
            Re-check
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function ClaimRow({ claim }: { claim: ClaimAssessment }) {
  const s = VERDICT_STYLES[claim.verdict];
  const copyText = [
    `Claim: ${claim.claim}`,
    claim.source ? `Source: ${claim.source}` : null,
    `Evidence: ${claim.evidence || "No supporting evidence found in the provided sources."}`,
    claim.assessment ? `Assessment: ${claim.assessment}` : null,
    `Verdict: ${s.label}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className={`rounded-md border bg-white p-3 ${s.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{claim.claim}</p>
          {claim.source && (
            <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
              {claim.source}
            </span>
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
            <span className="font-semibold text-zinc-500">Evidence:</span>{" "}
            {claim.evidence || (
              <span className="italic text-zinc-400">
                No supporting evidence found in the provided sources.
              </span>
            )}
          </p>
          {claim.assessment && (
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-500">Assessment:</span>{" "}
              {claim.assessment}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <CopyButton text={copyText} />
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${s.border} ${s.bg} ${s.text}`}
          >
            {s.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function CleanupRow({ item }: { item: CleanupItem }) {
  const copyText = [
    `Claim: ${item.claim}`,
    `Issue: ${item.issue}`,
    `Suggestion: ${item.suggestion}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{item.claim}</p>
          {item.issue && (
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-500">Issue:</span> {item.issue}
            </p>
          )}
          {item.suggestion && (
            <p className="mt-1 text-xs leading-relaxed text-emerald-700">
              <span className="font-semibold">Suggestion:</span> {item.suggestion}
            </p>
          )}
        </div>
        <CopyButton text={copyText} />
      </div>
    </div>
  );
}