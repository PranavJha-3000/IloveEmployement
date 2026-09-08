"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  LinkedInOptimizerRequestBody,
  LinkedInOptimizerResult,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { ResumeCard } from "./ResumeCard";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your LinkedIn...",
  "Comparing it to your resume...",
  "Hunting for NPC content...",
  "Drafting recruiter-friendly rewrites...",
  "Polishing the copy...",
];

const STATUS_LABEL: Record<"good" | "weak" | "missing", string> = {
  good: "Solid",
  weak: "Weak",
  missing: "Missing",
};

const STATUS_COLOR: Record<"good" | "weak" | "missing", string> = {
  good: "#12b76a",
  weak: "#b54708",
  missing: "#b42318",
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

function StatusPill({ status }: { status: "good" | "weak" | "missing" }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{
        color: STATUS_COLOR[status],
        backgroundColor: STATUS_COLOR[status] + "14",
        border: `1px solid ${STATUS_COLOR[status]}33`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color = clamped >= 75 ? "#12b76a" : clamped >= 50 ? "#b54708" : "#b42318";
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[120px] h-[120px] flex items-center justify-center">
        <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r="52" stroke="#e5e7eb" strokeWidth="8" fill="none" />
          <circle
            cx="60"
            cy="60"
            r="52"
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped / 100)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset .4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight text-zinc-900">{clamped}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">/ 100</span>
        </div>
      </div>
      <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">LinkedIn Optimizer</span>
    </nav>
  );
}

export function LinkedInOptimizerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<LinkedInOptimizerResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinContent, setLinkedinContent] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");

  const canSubmit = Boolean(
    (linkedinUrl.trim() || linkedinContent.trim()) && config.apiKey.trim()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!linkedinUrl.trim() && !linkedinContent.trim())
      return setValidationError(
        "LinkedIn profile is required. Paste your profile content or provide a profile URL."
      );

    setPhase("loading");
    const body: LinkedInOptimizerRequestBody = {
      config,
      linkedinUrl: linkedinUrl.trim() || undefined,
      linkedinContent: linkedinContent.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
      resumeText: resumeText.trim() || undefined,
    };
    try {
      const res = await fetch("/api/optimize-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as LinkedInOptimizerResult);
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
        <div className="workflow-wrap pt-6">
          <Breadcrumb />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
            Make your LinkedIn less NPC.
          </h1>
          <LoadingState messages={LOADING_MESSAGES} />
        </div>
      </main>
    );
  }

  if (phase === "results" && result) {
    return <ResultsView result={result} onReset={handleReset} />;
  }

  return (
    <InputWorkspace
      phase={phase}
      canSubmit={canSubmit}
      error={error}
      validationError={validationError}
      config={config}
      setConfig={setConfig}
      linkedinUrl={linkedinUrl}
      setLinkedinUrl={setLinkedinUrl}
      linkedinContent={linkedinContent}
      setLinkedinContent={setLinkedinContent}
      jobDescription={jobDescription}
      setJobDescription={setJobDescription}
      resumeText={resumeText}
      setResumeText={setResumeText}
      onSubmit={handleSubmit}
    />
  );
}

const inputClass = "field-control";

function InputWorkspace(props: {
  phase: Phase;
  canSubmit: boolean;
  error: string;
  validationError: string;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  linkedinContent: string;
  setLinkedinContent: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  resumeText: string;
  setResumeText: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    phase, canSubmit, error, validationError, config, setConfig,
    linkedinUrl, setLinkedinUrl, linkedinContent, setLinkedinContent,
    jobDescription, setJobDescription, resumeText, setResumeText, onSubmit,
  } = props;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Make your LinkedIn less NPC.
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Fix the profile recruiters actually see after they find your resume.
        </p>

        <form onSubmit={onSubmit} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                Your LinkedIn <span>(paste text &mdash; best for accuracy)</span>
              </h2>
            </div>

            <div className="input-grid">
              <div className="input-pane">
                <label htmlFor="liUrl" className="field-label">
                  LinkedIn Profile URL <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <input
                  id="liUrl"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="linkedin.com/in/yourprofile"
                  className={inputClass}
                />
                <p className="field-help">
                  Public profile fetching is best-effort &mdash; pasting content is more reliable.
                </p>

                <p className="paste-label">or paste your profile content</p>
                <textarea
                  value={linkedinContent}
                  onChange={(e) => setLinkedinContent(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste your headline, About, experience, skills, etc. here..."
                  rows={9}
                  className={`${inputClass} resume-textarea`}
                />
              </div>
              <div className="input-pane">
                <label htmlFor="liJd" className="field-label">
                  Target Job Description <em className="text-zinc-400 font-normal">(optional)</em>
                </label>
                <textarea
                  id="liJd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="Paste the JD here to sharpen keyword targeting..."
                  rows={9}
                  className={`${inputClass} jd-input`}
                />
                <p className="field-help">Optional. Without a JD, we optimize for general professionalism.</p>
              </div>
            </div>

            <div className="input-pane mt-3">
              <ResumeCard
                value={resumeText}
                onChange={setResumeText}
                disabled={phase === "loading"}
              />
              <p className="field-help mt-2">
                Strongly recommended &mdash; the consistency check needs it.
              </p>
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
                Optimize My LinkedIn <span aria-hidden>&rarr;</span>
              </button>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}

function ResultsView({ result, onReset }: { result: LinkedInOptimizerResult; onReset: () => void }) {
  const completenessItems: Array<{ key: keyof LinkedInOptimizerResult["completeness"]; label: string }> = [
    { key: "headline", label: "Headline" },
    { key: "about", label: "About" },
    { key: "experience", label: "Experience" },
    { key: "projects", label: "Projects" },
    { key: "skills", label: "Skills" },
    { key: "keywords", label: "Keywords" },
    { key: "resumeConsistency", label: "Resume Consistency" },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        <Breadcrumb />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Your LinkedIn audit.
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Every fix is grounded in what you actually shared. No fake titles, no invented metrics.
        </p>

        <section className="card mt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ScoreCircle score={result.linkedinScore} label="LinkedIn Score" />
            <div className="flex-1 w-full">
              <h2 className="text-base font-bold text-zinc-900 mb-1">Profile Completeness</h2>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, result.completeness.score))}%`,
                      background:
                        result.completeness.score >= 75
                          ? "#12b76a"
                          : result.completeness.score >= 50
                          ? "#b54708"
                          : "#b42318",
                      transition: "width .4s ease",
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-zinc-700 w-10 text-right">
                  {result.completeness.score}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {completenessItems.map(({ key, label }) => {
                  if (key === "score") return null;
                  const item = result.completeness[key];
                  if (!item) return null;
                  return (
                    <div key={key} className="border border-zinc-200 rounded-md p-2.5 bg-zinc-50/40">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-zinc-700">{label}</span>
                        <StatusPill status={item.status} />
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">{item.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="headline" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">2</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">Headline</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Three versions &mdash; pick one. All fit LinkedIn&rsquo;s 220-character limit.</p>
            </div>
          </div>
          {result.headline.current && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Current</p>
              <div className="border border-zinc-200 rounded-md p-3 bg-zinc-50 text-sm text-zinc-700">
                {result.headline.current}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <HeadlineOption label="Professional" body={result.headline.options.professional} />
            <HeadlineOption label="Recruiter-focused" body={result.headline.options.recruiterFocused} />
            <HeadlineOption label="Slightly more personality" body={result.headline.options.personality} />
          </div>
        </section>

        <section id="about" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">3</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">About</h2>
              <p className="text-xs text-zinc-500 mt-0.5">A polished rewrite based only on your actual experience.</p>
            </div>
          </div>
          <CompareBlock
            current={result.about.current}
            optimized={result.about.optimized}
            why={result.about.why}
            copyText={result.about.optimized}
            copyLabel="Copy About"
          />
        </section>

        <section id="experience" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">4</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">Experience</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Tightened up where your descriptions were weak or vague.</p>
            </div>
          </div>
          <CompareBlock
            current={result.experience.current}
            optimized={result.experience.optimized}
            why={result.experience.why}
            copyText={result.experience.optimized}
            copyLabel="Copy Experience"
            multiline
          />
        </section>

        <section id="skills" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">5</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">Skills</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Keep what&rsquo;s real, add what&rsquo;s supported, drop the noise.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <SkillList
              label="Keep"
              items={result.skills.keep}
              accent="#12b76a"
              copyText={result.skills.keep.join("\n")}
            />
            <SkillList
              label="Add if genuinely supported"
              items={result.skills.add}
              accent="#0b62a4"
              copyText={result.skills.add.join("\n")}
            />
            <SkillList
              label="Remove / de-emphasize"
              items={result.skills.remove}
              accent="#b42318"
              copyText={result.skills.remove.join("\n")}
            />
          </div>
        </section>

        <section id="consistency" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">6</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">Resume &harr; LinkedIn consistency</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Recruiters notice when these don&rsquo;t match.</p>
            </div>
          </div>
          {result.resumeConsistency.contradictions.length === 0 ? (
            <p className="text-sm text-zinc-600 italic">
              {result.resumeConsistency.summary ||
                "No contradictions found between LinkedIn and the resume."}
            </p>
          ) : (
            <>
              <ul className="space-y-1.5 mb-3">
                {result.resumeConsistency.contradictions.map((c, i) => (
                  <li key={i} className="text-sm text-zinc-700 border-l-2 border-red-400 pl-3 py-1">
                    {c}
                  </li>
                ))}
              </ul>
              {result.resumeConsistency.summary && (
                <p className="text-xs text-zinc-500 italic">{result.resumeConsistency.summary}</p>
              )}
            </>
          )}
        </section>

        <section id="biggest" className="card mt-4 scroll-mt-20">
          <div className="workflow-heading">
            <span className="step-badge">7</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">The verdict</h2>
              <p className="text-xs text-zinc-500 mt-0.5">One big problem, one big strength.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border border-zinc-200 rounded-md p-4 bg-red-50/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1.5">
                Biggest Profile L
              </p>
              <p className="text-sm text-zinc-800 leading-relaxed">{result.biggestL}</p>
            </div>
            <div className="border border-zinc-200 rounded-md p-4 bg-green-50/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1.5">
                Biggest Profile W
              </p>
              <p className="text-sm text-zinc-800 leading-relaxed">{result.biggestW}</p>
            </div>
          </div>
        </section>

        <div className="action-row mt-8">
          <button type="button" onClick={onReset} className="cta-secondary">
            Audit Another Profile
          </button>
        </div>
      </div>
    </main>
  );
}

function HeadlineOption({ label, body }: { label: string; body: string }) {
  return (
    <div className="border border-zinc-200 rounded-md p-3 bg-white">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400">{body.length}/220</span>
          <CopyButton text={body} label="Copy" />
        </div>
      </div>
      <p className="text-sm text-zinc-800 leading-relaxed">{body}</p>
    </div>
  );
}

function CompareBlock({
  current, optimized, why, copyText, copyLabel, multiline = false,
}: {
  current: string;
  optimized: string;
  why: string;
  copyText: string;
  copyLabel: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-3">
      {current && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
            Current
          </p>
          <div
            className={`border border-zinc-200 rounded-md p-3 bg-zinc-50 text-sm text-zinc-700 ${
              multiline ? "whitespace-pre-wrap" : ""
            }`}
          >
            {current}
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">
            Optimized
          </p>
          <CopyButton text={copyText} label={copyLabel} />
        </div>
        <div
          className={`border border-red-200 rounded-md p-3 bg-red-50/30 text-sm text-zinc-800 leading-relaxed ${
            multiline ? "whitespace-pre-wrap" : ""
          }`}
        >
          {optimized}
        </div>
      </div>
      {why && (
        <p className="text-xs text-zinc-500 italic">
          <span className="font-semibold not-italic text-zinc-700">Why:</span> {why}
        </p>
      )}
    </div>
  );
}

function SkillList({
  label, items, accent, copyText,
}: {
  label: string;
  items: string[];
  accent: string;
  copyText: string;
}) {
  return (
    <div className="border border-zinc-200 rounded-md p-3 bg-zinc-50/40">
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {label}
        </p>
        {items.length > 0 && <CopyButton text={copyText} label="Copy" />}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400 italic">Nothing here.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-zinc-700 flex items-start gap-1.5">
              <span className="text-zinc-400 mt-0.5">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}