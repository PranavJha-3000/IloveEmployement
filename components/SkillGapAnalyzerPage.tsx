"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  SkillGapRequestBody,
  SkillGapResult,
  GapClassification,
  RequirementRow,
  BigGap,
  TransferableSkill,
  FastestWin,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your resume against the JD...",
  "Checking what you've actually done...",
  "Refusing to panic about missing keywords...",
  "Separating real gaps from wording gaps...",
  "Ranking what actually matters...",
];

const CLASSIFICATION_STYLES: Record<GapClassification, { label: string; text: string; bg: string; border: string }> = {
  STRONG: { label: "STRONG", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  PARTIAL: { label: "PARTIAL", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  MISSING: { label: "MISSING", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

const IMPORTANCE_LABELS: Record<string, string> = {
  "must-have": "Must-have",
  "nice-to-have": "Nice-to-have",
  specialized: "Specialized",
};

const WIN_CATEGORY_LABELS: Record<string, string> = {
  "resume-positioning": "Resume positioning",
  "project-evidence": "Existing project evidence",
  "portfolio-addition": "Small portfolio addition",
  "interview-prep": "Interview preparation",
};

const COOKED_STYLES: Record<string, { text: string; bg: string; border: string; note: string }> = {
  LOW: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", note: "Mostly positioning problems, not capability problems." },
  MEDIUM: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", note: "Real gaps exist, but they're closable." },
  HIGH: { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", note: "A stretch role for now. That's information, not a verdict." },
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
      <span className="text-zinc-600 font-medium">Skill Gap Analyzer</span>
    </nav>
  );
}

export function SkillGapAnalyzerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SkillGapResult | null>(null);
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

  async function analyze() {
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key and never stores it.");
    if (!resumeText.trim())
      return setValidationError("Resume is required. Gaps are judged against what you've actually done.");
    if (!jobDescription.trim())
      return setValidationError("Job description is required. Gaps are only meaningful against a target.");

    setPhase("loading");
    const body: SkillGapRequestBody = {
      config,
      resumeText,
      jobDescription,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
    };
    try {
      const res = await fetch("/api/analyze-skill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as SkillGapResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void analyze();
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
            Find out what you&apos;re actually missing.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onReanalyze={() => void analyze()} onReset={handleReset} />;
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
      linkedin={linkedin}
      setLinkedin={setLinkedin}
      github={github}
      setGithub={setGithub}
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
  linkedin: string;
  setLinkedin: (t: string) => void;
  github: string;
  setGithub: (t: string) => void;
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
    linkedin,
    setLinkedin,
    github,
    setGithub,
    onSubmit,
  } = props;
  const loading = phase === "loading";
  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Find out what you&apos;re actually missing.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Not &ldquo;learn everything.&rdquo; The specific things standing between you and this job.
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          Good news: this is a skill gap, not a personality issue.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your profile vs. the job <span>(the comparison)</span>
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
                  Gaps are judged against evidence you actually have. No fabrication.
                </p>
              </div>
              <div className="input-pane">
                <label htmlFor="sg-jd" className="field-label">
                  Job Description
                </label>
                <textarea
                  id="sg-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="field-control jd-input"
                />
                <p className="field-help">
                  Missing keyword &ne; missing skill. The scan looks for capability, not exact words.
                </p>
              </div>
            </div>
          </section>

          <section className="workflow-card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">2</span>
              <h2>
                More evidence <span>(optional, sharpens the matrix)</span>
              </h2>
            </div>
            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="sg-linkedin" className="field-label">
                  LinkedIn Profile Content <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="sg-linkedin"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  disabled={loading}
                  placeholder="Paste your LinkedIn About, Experience, Skills..."
                  rows={5}
                  className="field-control"
                />
              </div>
              <div className="input-pane">
                <label htmlFor="sg-github" className="field-label">
                  GitHub Profile <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="sg-github"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  disabled={loading}
                  placeholder="Paste your README, pinned repo descriptions, tech stack..."
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
              disabled={!canSubmit || loading}
              className="cta-primary action-primary"
            >
              Find My Skill Gaps <span aria-hidden>&rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ResultsView({
  result,
  onReanalyze,
  onReset,
}: {
  result: SkillGapResult;
  onReanalyze: () => void;
  onReset: () => void;
}) {
  const counts = result.matrix.reduce(
    (acc, r) => {
      acc[r.classification] += 1;
      return acc;
    },
    { STRONG: 0, PARTIAL: 0, MISSING: 0 } as Record<GapClassification, number>,
  );
  const cooked = COOKED_STYLES[result.howCooked] ?? COOKED_STYLES.MEDIUM;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6 pb-14">
        <Breadcrumb />

        <section className="card mt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Requirement Matrix
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {result.matrix.length} requirements assessed
              </p>
            </div>
            <div className="flex gap-2">
              {(["STRONG", "PARTIAL", "MISSING"] as GapClassification[]).map((c) => {
                const s = CLASSIFICATION_STYLES[c];
                return (
                  <div
                    key={c}
                    className={`rounded-lg border px-3 py-2 text-center ${s.border} ${s.bg}`}
                  >
                    <p className={`text-lg font-bold ${s.text}`}>{counts[c]}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>
                      {s.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {result.matrix.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">M</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">The Matrix</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Requirement, importance, evidence, gap, priority.
                </p>
              </div>
            </div>
            <div className="mt-1 space-y-2">
              {result.matrix.map((row, i) => (
                <MatrixRow key={`row-${i}`} row={row} />
              ))}
            </div>
          </section>
        )}

        {result.biggestGaps.length > 0 && (
          <section className="card mt-4">
            <div className="workflow-heading">
              <span className="step-badge">G</span>
              <div>
                <h2 className="text-base font-bold leading-tight text-zinc-900">Biggest Gaps</h2>
                <p className="mt-0.5 text-xs text-zinc-500">Ranked by consequence, not by keyword.</p>
              </div>
            </div>
            <div className="mt-1 space-y-3">
              {result.biggestGaps.map((g, i) => (
                <BigGapCard key={`gap-${i}`} index={i + 1} gap={g} />
              ))}
            </div>
          </section>
        )}

        {result.transferableSkills.length > 0 && (
          <section className="card mt-4 border-blue-200 bg-blue-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Transferable Skills
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Adjacent skills you have that partially compensate.
            </p>
            <div className="mt-2 space-y-2">
              {result.transferableSkills.map((t, i) => (
                <div key={i} className="rounded-md border border-blue-200 bg-white p-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    {t.fromTheCandidate} <span className="text-zinc-400">&rarr;</span>{" "}
                    <span className="text-blue-700">{t.compensatesFor}</span>
                  </p>
                  {t.why && <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t.why}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {result.fastestWins.length > 0 && (
          <section className="card mt-4 border-emerald-200 bg-emerald-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Fastest Wins
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Gaps closable through positioning, evidence, or short preparation.
            </p>
            <div className="mt-2 space-y-2">
              {result.fastestWins.map((w, i) => (
                <FastWinCard key={`win-${i}`} index={i + 1} win={w} />
              ))}
            </div>
          </section>
        )}

        {result.longTermGaps.length > 0 && (
          <section className="card mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Long-Term Gaps
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Require substantial time or experience. Honest, not defeatist.
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.longTermGaps.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" aria-hidden />
                  {g}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`card mt-4 border ${cooked.border} ${cooked.bg}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            How cooked?
          </p>
          <p className={`mt-1 text-2xl font-bold tracking-tight ${cooked.text}`}>
            {result.howCooked}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{cooked.note}</p>
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
          Good news: this is a skill gap, not a personality issue.
        </p>

        <div className="action-row mt-2">
          <button type="button" onClick={onReanalyze} className="cta-primary action-primary">
            Re-analyze
          </button>
          <button type="button" onClick={onReset} className="cta-secondary">
            Edit inputs
          </button>
        </div>
      </div>
    </main>
  );
}

function MatrixRow({ row }: { row: RequirementRow }) {
  const cls = CLASSIFICATION_STYLES[row.classification];
  const copyText = [
    `Requirement: ${row.requirement}`,
    `Importance: ${IMPORTANCE_LABELS[row.importance] ?? row.importance}`,
    row.currentEvidence ? `Evidence: ${row.currentEvidence}` : null,
    `Gap: ${row.gap || "—"}`,
    `Priority: ${row.priority}`,
    `Status: ${cls.label}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${cls.border} ${cls.bg} ${cls.text}`}
            >
              {cls.label}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
              {IMPORTANCE_LABELS[row.importance] ?? row.importance}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
              P{row.priority}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-zinc-900">{row.requirement}</p>
          {row.currentEvidence && (
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-500">Your evidence:</span>{" "}
              {row.currentEvidence}
            </p>
          )}
          {row.gap && (
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-500">Gap:</span> {row.gap}
            </p>
          )}
        </div>
        <CopyButton text={copyText} />
      </div>
    </div>
  );
}

function BigGapCard({ index, gap }: { index: number; gap: BigGap }) {
  const copyText = [
    `${index}. ${gap.whatTheJdWants}`,
    `They want: ${gap.whatTheJdWants}`,
    `You have: ${gap.whatTheCandidateHas || "nothing directly relevant"}`,
    `Missing: ${gap.whatIsMissing}`,
    `Importance: ${IMPORTANCE_LABELS[gap.importance] ?? gap.importance}`,
  ].join("\n");

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-zinc-900">
          <span className="text-zinc-400">{index}.</span> {gap.whatTheJdWants}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <CopyButton text={copyText} />
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
            {IMPORTANCE_LABELS[gap.importance] ?? gap.importance}
          </span>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        <p className="text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">What the JD wants:</span>{" "}
          {gap.whatTheJdWants}
        </p>
        <p className="text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">What you have:</span>{" "}
          {gap.whatTheCandidateHas || "nothing directly relevant"}
        </p>
        <p className="text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-500">What&apos;s missing:</span>{" "}
          {gap.whatIsMissing}
        </p>
      </div>
    </div>
  );
}

function FastWinCard({ index, win }: { index: number; win: FastestWin }) {
  const copyText = [
    `${index}. ${win.gap}`,
    `Via: ${WIN_CATEGORY_LABELS[win.category] ?? win.category}`,
    `Action: ${win.action}`,
  ].join("\n");

  return (
    <div className="rounded-md border border-emerald-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">
            <span className="text-zinc-400">{index}.</span> {win.gap}
          </p>
          <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            {WIN_CATEGORY_LABELS[win.category] ?? win.category}
          </span>
          {win.action && (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{win.action}</p>
          )}
        </div>
        <CopyButton text={copyText} />
      </div>
    </div>
  );
}