"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  GitHubResumeRequestBody,
  GitHubResumeResult,
  ClaimCheck,
  EvidenceStrength,
  ProjectHighlight,
  ProfileQualityObservation,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Pulling up your receipts...",
  "Cross-referencing claims with commits...",
  "Inspecting the README situation...",
  "Counting tutorial repos...",
  "Checking if the GitHub lore checks out...",
];

const STRENGTH_STYLES: Record<
  EvidenceStrength,
  { label: string; text: string; bg: string; border: string }
> = {
  strong: { label: "STRONG EVIDENCE", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  weak: { label: "WEAK EVIDENCE", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  none: { label: "NO EVIDENCE FOUND", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
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
      <span className="text-zinc-600 font-medium">GitHub Resume Checker</span>
    </nav>
  );
}

export function GitHubResumeCheckerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GitHubResumeResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [githubInput, setGithubInput] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const canSubmit = Boolean(githubInput.trim() && config.apiKey.trim());

  async function check() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!githubInput.trim())
      return setValidationError("GitHub input is required. Paste your profile URL or repository content.");

    setPhase("loading");
    const body: GitHubResumeRequestBody = {
      config,
      githubInput,
      resumeText: resumeText.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
    };
    try {
      const res = await fetch("/api/check-github-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as GitHubResumeResult);
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
            Does your GitHub actually back up your resume?
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
      githubInput={githubInput}
      setGithubInput={setGithubInput}
      resumeText={resumeText}
      setResumeText={setResumeText}
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
  githubInput: string;
  setGithubInput: (t: string) => void;
  resumeText: string;
  setResumeText: (t: string) => void;
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
    githubInput,
    setGithubInput,
    resumeText,
    setResumeText,
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
          Does your GitHub actually back up your resume?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Because writing &ldquo;expert developer&rdquo; and having 14 tutorial repos is a dangerous
          combination.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your GitHub <span>(the receipts)</span>
              </h2>
            </div>
            <label htmlFor="gh-input" className="field-label">
              GitHub URL or pasted profile content
            </label>
            <textarea
              id="gh-input"
              value={githubInput}
              onChange={(e) => setGithubInput(e.target.value)}
              disabled={loading}
              placeholder={"https://github.com/yourusername\n\n— or paste your top repos, README, pinned projects, contribution summary..."}
              rows={8}
              className="field-control jd-input"
            />
            <p className="field-help">
              We can&apos;t browse GitHub directly. A URL alone gives a limited check &mdash; paste
              your profile/repos for the full analysis.
            </p>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                What to check it against <span>(optional but recommended)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <ResumeCard
                  value={resumeText}
                  onChange={setResumeText}
                  disabled={loading}
                />
                <p className="field-help mt-2">
                  Without a resume we can&apos;t check claim-level evidence.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="gh-jd" className="field-label">
                  Job Description <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="gh-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the target JD to weight project relevance..."
                  rows={8}
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
  result: GitHubResumeResult;
  onRecheck: () => void;
  onReset: () => void;
}) {
  const grouped: Record<EvidenceStrength, ClaimCheck[]> = {
    strong: result.claims.filter((c) => c.strength === "strong"),
    weak: result.claims.filter((c) => c.strength === "weak"),
    none: result.claims.filter((c) => c.strength === "none"),
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                GitHub Signal
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900">
                {result.githubSignal}
                <span className="text-lg text-zinc-400">/100</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                How well your GitHub supports the application.
              </p>
            </div>
            {result.profileQuality && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Profile Quality
                </p>
                <p className="text-2xl font-bold text-zinc-900">{result.profileQuality.score}</p>
                <p className="text-[10px] text-zinc-400">0&ndash;100</p>
              </div>
            )}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={
                result.githubSignal >= 70
                  ? "h-full rounded-full bg-emerald-500"
                  : result.githubSignal >= 40
                    ? "h-full rounded-full bg-amber-500"
                    : "h-full rounded-full bg-red-500"
              }
              style={{ width: `${result.githubSignal}%` }}
            />
          </div>
        </section>

        {result.projectsWorthShowing.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">P</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  Projects Worth Showing
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Repos that actually help your application.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-3">
              {result.projectsWorthShowing.map((p, i) => (
                <ProjectCard key={`proj-${i}`} index={i + 1} project={p} />
              ))}
            </div>
          </section>
        )}

        {result.missingFromResume.length > 0 && (
          <section className="card mt-4 border-blue-200 bg-blue-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Missing From Resume
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              GitHub projects that could strengthen the application.
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.missingFromResume.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.claims.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">C</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">
                  Resume Claims vs. GitHub
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  &ldquo;No evidence found&rdquo; means we couldn&apos;t see it &mdash; not that
                  the skill doesn&apos;t exist.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-4">
              {(["strong", "weak", "none"] as EvidenceStrength[]).map((strength) => {
                const claims = grouped[strength];
                if (claims.length === 0) return null;
                const s = STRENGTH_STYLES[strength];
                return (
                  <div key={strength}>
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${s.border} ${s.bg} ${s.text}`}
                    >
                      {s.label} &middot; {claims.length}
                    </span>
                    <div className="mt-2 space-y-2">
                      {claims.map((c, i) => (
                        <ClaimRow key={`${strength}-${i}`} claim={c} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {result.profileQuality.observations.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">Q</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">Profile Quality</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  What a recruiter sees, and what to fix.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-2">
              {result.profileQuality.observations.map((o, i) => (
                <ProfileObservation key={`obs-${i}`} observation={o} />
              ))}
            </div>
          </section>
        )}

        {result.githubRoast.some((r) => r) && (
          <section className="card mt-4 border-zinc-900/10 bg-zinc-900 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              GitHub Roast
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.githubRoast.filter(Boolean).map((r, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-100">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.disclaimer && (
          <section className="card mt-4 border-amber-200 bg-amber-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Heads up &mdash; limited data
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{result.disclaimer}</p>
          </section>
        )}

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

function ProjectCard({ index, project }: { index: number; project: ProjectHighlight }) {
  const copyText = [
    `${index}. ${project.repository}`,
    `Why relevant: ${project.whyRelevant}`,
    `Skills: ${project.skillsDemonstrated}`,
    project.resumeRelevance ? `Resume relevance: ${project.resumeRelevance}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-bold text-zinc-900">
          <span className="text-zinc-400">{index}.</span> {project.repository}
        </p>
        <CopyButton text={copyText} />
      </div>
      {project.whyRelevant && (
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">Why relevant:</span>{" "}
          {project.whyRelevant}
        </p>
      )}
      {project.skillsDemonstrated && (
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">Skills demonstrated:</span>{" "}
          {project.skillsDemonstrated}
        </p>
      )}
      {project.resumeRelevance && (
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">Resume relevance:</span>{" "}
          {project.resumeRelevance}
        </p>
      )}
    </div>
  );
}

function ClaimRow({ claim }: { claim: ClaimCheck }) {
  const s = STRENGTH_STYLES[claim.strength];
  const copyText = [
    `Claim: ${claim.claim}`,
    claim.githubEvidence
      ? `GitHub evidence: ${claim.githubEvidence}`
      : "GitHub evidence: none found in the provided information",
    `Strength: ${s.label}`,
  ].join("\n");

  return (
    <div className={`rounded-md border bg-white p-3 ${s.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{claim.claim}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            <span className="font-semibold text-zinc-500">GitHub evidence:</span>{" "}
            {claim.githubEvidence || (
              <span className="italic text-zinc-400">
                none found in the provided information (this is not proof the skill doesn&apos;t
                exist &mdash; private repos and unlisted work are common)
              </span>
            )}
          </p>
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

function ProfileObservation({
  observation,
}: {
  observation: ProfileQualityObservation;
}) {
  const copyText = [
    `${observation.area}: ${observation.assessment}`,
    observation.improvement ? `Fix: ${observation.improvement}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {observation.area}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-700">
            {observation.assessment}
          </p>
          {observation.improvement && (
            <p className="mt-1 text-xs leading-relaxed text-emerald-700">
              <span className="font-semibold">Fix:</span> {observation.improvement}
            </p>
          )}
        </div>
        <CopyButton text={copyText} />
      </div>
    </div>
  );
}