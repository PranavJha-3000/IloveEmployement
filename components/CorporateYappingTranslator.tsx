"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  CorporateYappingResult,
  YappingCategory,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";

type Phase = "idle" | "loading" | "success" | "error";

const LOADING_MESSAGES = [
  "Decoding corporate speak...",
  "Translating HR to human...",
  "Detecting buzzwords...",
  "Reading between the bullet points...",
];

/** Result sections in presentation order, mapped to prompt categories. */
const SECTIONS: {
  key: YappingCategory;
  label: string;
  accent: string;
  border: string;
  note: string;
}[] = [
  { key: "required_skills", label: "Must Have", accent: "text-blue-700", border: "border-blue-200", note: "Required skills." },
  { key: "nice_to_have", label: "Nice To Have", accent: "text-amber-700", border: "border-amber-200", note: "Preferred skills." },
  { key: "what_they_want", label: "What You'll Actually Do", accent: "text-green-700", border: "border-green-200", note: "Plain-language responsibilities." },
  { key: "likely_interview_topics", label: "Likely Interview Topics", accent: "text-purple-700", border: "border-purple-200", note: "Based only on the JD." },
  { key: "potential_red_flags", label: "Potential Red Flags", accent: "text-red-700", border: "border-red-200", note: "Only actual signals found in the text." },
  { key: "corporate_yapping", label: "Corporate Yapping", accent: "text-zinc-500", border: "border-zinc-200", note: "Pure fluff." },
];

const inputClass = "field-control";

interface Props {
  /** When true (overlay context), hide the breadcrumb + page heading. */
  embedded?: boolean;
}

export function CorporateYappingTranslator({ embedded = false }: Props) {
  const [jd, setJd] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CorporateYappingResult | null>(null);
  const [err, setErr] = useState("");
  const [vErr, setVErr] = useState("");
  const [copied, setCopied] = useState(false);

  const canSubmit = Boolean(jd.trim() && config.apiKey.trim());

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setVErr("");
    setErr("");
    if (!config.apiKey.trim())
      return setVErr("API key is required. This app runs on your key.");
    if (!jd.trim()) return setVErr("Job description is required.");

    setPhase("loading");
    setResult(null);
    try {
      const r = await fetch("/api/translate-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          jobDescription: jd,
          companyName: companyName.trim() || undefined,
          roleTitle: roleTitle.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Translation failed.");
      setResult(j as CorporateYappingResult);
      setPhase("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Translation failed.");
      setPhase("error");
    }
  }

  async function copyAll() {
    if (!result) return;
    const lines = result.translations.map(
      (t) =>
        "COMPANY SAID: " +
        t.companySaid +
        "\nTHEY MEAN: " +
        t.theyProbablyMean +
        "\nWE SAY: " +
        t.iLoveEmploymentSays
    );
    await navigator.clipboard.writeText(lines.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setResult(null);
    setErr("");
    setVErr("");
    setCopied(false);
    setPhase("idle");
  }

  return (
    <TranslatorView
      embedded={embedded}
      phase={phase}
      result={result}
      err={err}
      vErr={vErr}
      copied={copied}
      canSubmit={canSubmit}
      config={config}
      setConfig={setConfig}
      jd={jd}
      setJd={setJd}
      companyName={companyName}
      setCompanyName={setCompanyName}
      roleTitle={roleTitle}
      setRoleTitle={setRoleTitle}
      onTranslate={go}
      onReset={reset}
      onCopy={copyAll}
    />
  );
}

interface ViewProps {
  embedded: boolean;
  phase: Phase;
  result: CorporateYappingResult | null;
  err: string;
  vErr: string;
  copied: boolean;
  canSubmit: boolean;
  config: AiRequestConfig;
  setConfig: (c: AiRequestConfig) => void;
  jd: string;
  setJd: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  roleTitle: string;
  setRoleTitle: (v: string) => void;
  onTranslate: (e: React.FormEvent) => void;
  onReset: () => void;
  onCopy: () => void;
}

function TranslatorView(props: ViewProps) {
  const { embedded, phase, result, copied, onReset } = props;

  // ─── Loading state ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-white">
        {!embedded && (
          <div className="max-w-[1180px] mx-auto px-6 pt-6">
            <Breadcrumb />
          </div>
        )}
        <LoadingState messages={LOADING_MESSAGES} />
      </main>
    );
  }

  // ─── Results view ────────────────────────────────────────────────────────
  if (phase === "success" && result) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-[900px] mx-auto px-6 pt-6 pb-20 space-y-4">
          {!embedded && <Breadcrumb />}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={onReset}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              &larr; Translate another JD
            </button>
            <button
              onClick={props.onCopy}
              className="text-xs text-zinc-500 hover:text-red-600 underline underline-offset-2 transition"
            >
              {copied ? "Copied" : "Copy all"}
            </button>
          </div>
          {result.yappingScore != null && <YappingScore score={result.yappingScore} />}
          {SECTIONS.map((section) => {
            const items = result.translations.filter((t) => t.category === section.key);
            if (items.length === 0) return null;
            return (
              <section key={section.key} className="card">
                <div className="flex items-baseline gap-2">
                  <h3 className={"text-sm font-bold uppercase tracking-wider " + section.accent}>
                    {section.label}
                  </h3>
                  <span className="text-xs text-zinc-400">{items.length}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{section.note}</p>
                <div className="mt-4 space-y-3">
                  {items.map((t, i) => (
                    <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-lg p-4">
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                            Company Said
                          </p>
                          <p className="text-sm text-zinc-600 italic">
                            &ldquo;{t.companySaid}&rdquo;
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                            They Probably Mean
                          </p>
                          <p className="text-sm text-zinc-700">{t.theyProbablyMean}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">
                            IloveEmployment Says
                          </p>
                          <p className="text-sm text-zinc-800 font-medium">
                            {t.iLoveEmploymentSays}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <p className="text-xs text-zinc-400 text-center pt-4">
            Everything above comes from the JD text itself. Nothing is inferred about company
            culture, salary, or working hours beyond what is written.
          </p>
        </div>
      </main>
    );
  }

  // ─── Input workspace (defined below) ─────────────────────────────────────
  return <InputWorkspace {...props} />;
}
/** Corporate Yapping Score with band explanation. */
function YappingScore({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  let band = "";
  let color = "";
  let border = "";
  let bg = "";
  let explanation = "";
  if (clamped <= 30) {
    band = "Unusually specific";
    color = "text-green-700";
    border = "border-green-200";
    bg = "bg-green-50";
    explanation = "Low score: this JD is unusually specific and direct.";
  } else if (clamped <= 69) {
    band = "Typical corporate mix";
    color = "text-amber-700";
    border = "border-amber-200";
    bg = "bg-amber-50";
    explanation = "Mid score: a typical mix of substance and corporate language.";
  } else {
    band = "Heavy corporate yapping";
    color = "text-red-700";
    border = "border-red-200";
    bg = "bg-red-50";
    explanation = "High score: lots of generic corporate language.";
  }
  return (
    <section className={"card text-center " + bg + " " + border}>
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
        Corporate Yapping Score
      </p>
      <p className={"mt-2 text-6xl font-bold tabular-nums " + color}>{clamped}</p>
      <p className="text-xs text-zinc-400 mt-1">out of 100</p>
      <span
        className={
          "inline-block mt-3 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-md border bg-white " +
          color +
          " " +
          border
        }
      >
        {band}
      </span>
      <p className="mt-3 text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">{explanation}</p>
      <p className="mt-2 text-xs text-zinc-400">
        Low = unusually specific JD. High = lots of generic corporate language.
      </p>
    </section>
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">JD Translator</span>
    </nav>
  );
}
function InputWorkspace(props: ViewProps) {
  const {
    embedded,
    phase,
    err,
    vErr,
    canSubmit,
    config,
    setConfig,
    jd,
    setJd,
    companyName,
    setCompanyName,
    roleTitle,
    setRoleTitle,
    onTranslate,
  } = props;

  return (
    <main className="min-h-screen bg-white">
      <div className="workflow-wrap pt-6">
        {!embedded && <Breadcrumb />}
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Decode the corporate yapping.
        </h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-xl leading-relaxed">
          Find out what they actually mean before you spend an hour applying.
        </p>

        <form onSubmit={onTranslate} className="mt-6">
          <section className="workflow-card">
            <div className="workflow-heading">
              <span className="step-badge">1</span>
              <h2>
                The job description <span>(paste the whole thing)</span>
              </h2>
            </div>
            <label htmlFor="jdTranslate" className="field-label">
              Job Description
            </label>
            <textarea
              id="jdTranslate"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              disabled={phase === "loading"}
              placeholder="Paste the job description here..."
              rows={10}
              className={`${inputClass} jd-input`}
            />
            <p className="field-help">
              We translate what is written. We do not invent culture, salary, or hours.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="jdCompany" className="field-label">
                  Company name <em>(optional)</em>
                </label>
                <input
                  id="jdCompany"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="e.g. Acme Corp"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="jdRole" className="field-label">
                  Role title <em>(optional)</em>
                </label>
                <input
                  id="jdRole"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="e.g. Senior Frontend Engineer"
                  className={inputClass}
                />
              </div>
            </div>

            {/* AI configuration */}
            <div className="config-card">
              <ProviderConfig config={config} onChange={setConfig} compact />
            </div>

            {(vErr || err) && (
              <div className="form-error" role="alert">
                {vErr || err}
              </div>
            )}

            <div className="action-row">
              <button
                type="submit"
                disabled={!canSubmit || phase === "loading"}
                className="cta-primary action-primary"
              >
                Translate This Yapping <span aria-hidden>&rarr;</span>
              </button>
            </div>
            <p className="field-help text-center">
              Runs on your own API key. Sent per-request, never stored.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}