"use client";

import { useState, type ReactNode } from "react";
import type { ReportResult } from "@/lib/engine/reports";
import type { Evidence, FitScore } from "@/lib/engine/scoring";
import type { RunMeta, VaultContextChunk } from "@/lib/engine/types";
import type { ReportKind } from "@/lib/presets/types";
import { CopyButton } from "@/components/shared/CopyButton";
import { resumeToText } from "@/lib/engine/resumeText";
import { RunDetails, RunWarnings } from "./RunDetails";
import Link from "next/link";
import { ShareCard } from "./ShareCard";

// ─── Shared pieces ───────────────────────────────────────────────────────────

const EVIDENCE_STYLE: Record<Evidence, string> = {
  STRONG: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
  MISSING: "bg-red-50 text-red-700 border-red-200",
  UNVERIFIED: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

function EvidenceBadge({ value }: { value: Evidence }) {
  return <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide ${EVIDENCE_STYLE[value]}`}>{value}</span>;
}

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-[13px] text-zinc-400">None.</p>;
  return (
    <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-zinc-700">
      {items.map((t, i) => (
        <li key={i}>• {t}</li>
      ))}
    </ul>
  );
}

function Cites({ ids, chunks }: { ids: string[]; chunks: Map<string, VaultContextChunk> }) {
  if (!ids.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} title={chunks.get(id)?.text} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700">
          ↳ {chunks.get(id)?.title ?? "source"}
        </span>
      ))}
    </span>
  );
}

function ScoreHeader({ score, label, sub, tone }: { score: number; label: string; sub: string; tone: "good" | "mid" | "bad" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "mid" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-5">
      <div className={`text-[44px] font-bold leading-none tracking-tight ${color}`}>{score}</div>
      <div>
        <p className={`text-[15px] font-bold ${color}`}>{label}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{sub}</p>
      </div>
    </div>
  );
}

const VERDICT_LABEL: Record<FitScore["verdict"], { label: string; tone: "good" | "mid" | "bad" }> = {
  APPLY: { label: "Apply", tone: "good" },
  STRETCH: { label: "Stretch: apply with a plan", tone: "mid" },
  LONG_SHOT: { label: "Long shot", tone: "bad" },
  SKIP: { label: "Absolutely cooked (for this one)", tone: "bad" },
};

function RequirementsTable({
  reqs,
  chunks,
}: {
  reqs: { requirement: string; importance: "must" | "nice"; evidence: Evidence; proof: string; chunkIds: string[]; skillMatch?: { matchedAs: string[] } }[];
  chunks: Map<string, VaultContextChunk>;
}) {
  return (
    <ul className="divide-y divide-zinc-100">
      {reqs.map((r, i) => (
        <li key={i} className="py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceBadge value={r.evidence} />
            <span className="text-[13.5px] font-semibold text-zinc-800">{r.requirement}</span>
            <span className="text-[11px] text-zinc-400">{r.importance === "must" ? "must-have" : "nice-to-have"}</span>
          </div>
          {r.proof && <p className="mt-1 text-[12.5px] text-zinc-600">{r.proof}</p>}
          {r.skillMatch && (
            <p className="mt-1 text-[12.5px] text-zinc-600">Found in your resume as {r.skillMatch.matchedAs.join(", ")}; marked partial because the fit check didn&apos;t cite it.</p>
          )}
          <Cites ids={r.chunkIds} chunks={chunks} />
        </li>
      ))}
    </ul>
  );
}

function ScoreBreakdown({ score }: { score: FitScore }) {
  return (
    <p className="text-[12px] text-zinc-500">
      {score.counts.STRONG} strong · {score.counts.PARTIAL} partial · {score.counts.MISSING} missing · {score.counts.UNVERIFIED} unverified
      {score.missingMustHaves > 0 && ` · ${score.missingMustHaves} missing must-have${score.missingMustHaves === 1 ? "" : "s"}`}. {score.formula}
    </p>
  );
}

// ─── Renderers ───────────────────────────────────────────────────────────────

type Ctx = { chunks: Map<string, VaultContextChunk> };

function FitView({ r, chunks, share }: { r: ReportResult<"fit">; share: Share } & Ctx) {
  const v = VERDICT_LABEL[r.score.verdict];
  return (
    <>
      <ScoreHeader score={r.score.score} label={v.label} sub={r.headline} tone={v.tone} />
      <ShareCard tool={share.name} slug={share.slug} score={String(r.score.score)} label={v.label} headline={r.headline} accent="#059669" />
      <ScoreBreakdown score={r.score} />
      <Card title="Summary">
        <p className="text-[13.5px] leading-relaxed text-zinc-700">{r.summary}</p>
      </Card>
      <Card title="Requirement by requirement">
        <RequirementsTable reqs={r.requirements} chunks={chunks} />
      </Card>
      <Card title="Lead with">
        <ul className="space-y-2 text-[13.5px] text-zinc-700">
          {r.strengths.map((s, i) => (
            <li key={i}>
              • {s.text}
              <Cites ids={s.chunkIds} chunks={chunks} />
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Gaps and what to do">
        <ul className="space-y-2 text-[13.5px] text-zinc-700">
          {r.gaps.map((g, i) => (
            <li key={i}>
              <span className={g.severity === "high" ? "font-semibold text-red-600" : g.severity === "medium" ? "font-semibold text-amber-700" : "font-semibold"}>{g.gap}</span>
              <span className="text-zinc-600"> — {g.howToAddress}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Interview risks">
        <Bullets items={r.interviewRisks} />
      </Card>
    </>
  );
}

function JdView({ r }: { r: ReportResult<"jd"> }) {
  const tone = r.quality >= 70 ? "good" : r.quality >= 45 ? "mid" : "bad";
  return (
    <>
      <ScoreHeader score={r.quality} label="Posting quality" sub={r.realRole} tone={tone} />
      <Card title="In plain English">
        <p className="text-[13.5px] leading-relaxed text-zinc-700">{r.summary}</p>
        <p className="mt-2 text-[12.5px] text-zinc-500">Seniority: {r.seniority}</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Actually required">
          <Bullets items={r.mustHaves} />
        </Card>
        <Card title="Wish list">
          <Bullets items={r.niceToHaves} />
        </Card>
      </div>
      <Card title="Red flags">
        {r.redFlags.length === 0 ? (
          <p className="text-[13px] text-zinc-400">None found.</p>
        ) : (
          <ul className="space-y-3">
            {r.redFlags.map((f, i) => (
              <li key={i} className="text-[13.5px]">
                <span className={`font-semibold ${f.severity === "high" ? "text-red-600" : f.severity === "medium" ? "text-amber-700" : "text-zinc-700"}`}>{f.flag}</span>
                <blockquote className="mt-1 border-l-2 border-zinc-200 pl-2 text-[12.5px] italic text-zinc-500">
                  “{f.quote}” {!f.quoteVerified && <span className="not-italic text-amber-600">(not verbatim: interpretation)</span>}
                </blockquote>
                <p className="mt-1 text-[12.5px] text-zinc-600">Ask: {f.askInInterview}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Green flags">
        {r.greenFlags.length === 0 ? (
          <p className="text-[13px] text-zinc-400">None found.</p>
        ) : (
          <ul className="space-y-2 text-[13.5px] text-zinc-700">
            {r.greenFlags.map((g, i) => (
              <li key={i}>
                • {g.signal} <span className="text-[12px] italic text-zinc-500">“{g.quote}”</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Jargon decoded">
        <ul className="space-y-2 text-[13.5px]">
          {r.translations.map((t, i) => (
            <li key={i}>
              <span className="font-semibold text-zinc-800">“{t.phrase}”</span> <span className="text-zinc-600">→ {t.meaning}</span>{" "}
              <span className="text-[11px] text-zinc-400">({t.confidence} confidence)</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Not mentioned">
          <Bullets items={r.missingInfo} />
        </Card>
        <Card title="Ask the recruiter">
          <Bullets items={r.questionsToAsk} />
        </Card>
      </div>
    </>
  );
}

const ROUTE_LABEL = { reframe: "Reframe", project: "Build proof", learn: "Learn", "long-term": "Long-term" } as const;

function GapView({ r, chunks }: { r: ReportResult<"gap"> } & Ctx) {
  const v = VERDICT_LABEL[r.score.verdict];
  return (
    <>
      <ScoreHeader score={r.score.score} label={`Current fit: ${v.label}`} sub={r.summary} tone={v.tone} />
      <ScoreBreakdown score={r.score} />
      <Card title="Plan, in order">
        <ol className="space-y-3">
          {r.plan.map((p, i) => (
            <li key={i} className="text-[13.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-zinc-900">
                  {i + 1}. {p.skill}
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-zinc-600">{ROUTE_LABEL[p.route]}</span>
                <span className="text-[11.5px] text-zinc-400">{p.timeframe}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-zinc-600">{p.why}</p>
              <ul className="mt-1 space-y-0.5 text-[12.5px] text-zinc-700">
                {p.actions.map((a, j) => (
                  <li key={j}>→ {a}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>
      {r.transferable.length > 0 && (
        <Card title="Transferable strengths">
          <ul className="space-y-2 text-[13.5px] text-zinc-700">
            {r.transferable.map((t, i) => (
              <li key={i}>
                <span className="font-semibold">{t.from}</span> partly covers <span className="font-semibold">{t.coversFor}</span>: {t.why}
                <Cites ids={t.chunkIds} chunks={chunks} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Requirement by requirement">
        <RequirementsTable reqs={r.requirements} chunks={chunks} />
      </Card>
    </>
  );
}

function AtsView({ r, chunks }: { r: ReportResult<"ats"> } & Ctx) {
  const tone = r.atsScore >= 75 ? "good" : r.atsScore >= 55 ? "mid" : "bad";
  const missingButTrue = r.coverage.items.filter((k) => !k.found && k.evidenced);
  const realGaps = r.coverage.items.filter((k) => !k.found && !k.evidenced);
  return (
    <>
      <ScoreHeader
        score={r.atsScore}
        label={r.format ? `Keywords ${r.coverage.score} · Format ${r.format.score}` : `Keyword coverage ${r.coverage.score}`}
        sub={
          r.format
            ? "70% keyword coverage of the posting + 30% parsing checks, computed from your resume text. There's no universal ATS score; this is coverage, measured."
            : "Keyword coverage of the posting, computed from your Career Vault. Paste your resume's text above to also run the parsing checks."
        }
        tone={tone}
      />
      {missingButTrue.length > 0 && (
        <Card title="Add these: you have them, the wording doesn't show it">
          <ul className="space-y-2 text-[13.5px] text-zinc-700">
            {missingButTrue.map((k) => {
              const kw = r.keywords.find((x) => x.term === k.term);
              return (
                <li key={k.term}>
                  <span className="font-semibold">{k.term}</span> {k.importance === "must" && <span className="text-[11px] text-red-600">must-have</span>}
                  <Cites ids={kw?.evidencedBy ?? []} chunks={chunks} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Card title="Keyword coverage">
        <div className="flex flex-wrap gap-1.5">
          {r.coverage.items.map((k) => (
            <span
              key={k.term}
              title={k.found ? (k.canonical && k.matchedAs.toLowerCase() !== k.term.toLowerCase() ? `Matched as "${k.matchedAs}" (${k.canonical})` : `Matched as "${k.matchedAs}"`) : k.evidenced ? "You have this; add the wording" : "Not in your material"}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                k.found ? "border-emerald-200 bg-emerald-50 text-emerald-700" : k.evidenced ? "border-amber-200 bg-amber-50 text-amber-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"
              }`}
            >
              {k.found ? "✓" : k.evidenced ? "+" : "–"} {k.term}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-zinc-500">✓ found · + you have it, add the wording · – genuine gap: don't stuff it in</p>
      </Card>
      {realGaps.length > 0 && (
        <Card title="Genuine gaps">
          <p className="text-[13px] text-zinc-600">
            {realGaps.map((k) => k.term).join(", ")}. Adding these without evidence will fail the human read that follows the ATS.
          </p>
        </Card>
      )}
      {r.format && (
        <Card title="Parsing checks">
          <ul className="space-y-1.5 text-[13px]">
            {r.format.checks.map((c) => (
              <li key={c.id}>
                <span className={c.pass ? "text-emerald-600" : "text-red-600"}>{c.pass ? "✓" : "✗"}</span> <span className="font-medium text-zinc-800">{c.label}</span>{" "}
                <span className="text-zinc-500">— {c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Advice">
        <p className="mb-2 text-[13px] text-zinc-600">{r.titleAlignment}</p>
        <Bullets items={r.advice} />
      </Card>
    </>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function printResume(textContent: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = textContent
    .split("\n")
    .map((l) => (/^[A-Z][A-Z &]+$/.test(l) ? `<h2>${escape(l)}</h2>` : l.startsWith("• ") ? `<li>${escape(l.slice(2))}</li>` : l ? `<p>${escape(l)}</p>` : ""))
    .join("\n");
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Resume</title><style>body{font:11pt/1.4 Arial,Helvetica,sans-serif;max-width:7.5in;margin:.5in auto;color:#111}h2{font-size:11pt;border-bottom:1px solid #999;margin:14pt 0 4pt;letter-spacing:.05em}p{margin:2pt 0}li{margin:1pt 0 1pt 14pt}</style></head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}

const CHANGE_STYLE = { kept: "text-zinc-400", reworded: "text-blue-600", tailored: "text-emerald-600", reordered: "text-violet-600" } as const;

type SaveVersion = (v: { text: string; job: { title: string; company: string; url?: string } }) => Promise<void>;

function SaveVersionForm({ text, hint, onSave }: { text: string; hint?: { title: string; company: string }; onSave: SaveVersion }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function begin() {
    setTitle(hint?.title ?? "");
    setCompany(hint?.company ?? "");
    setUrl("");
    setError("");
    setSaved(false);
    setOpen(true);
  }

  async function save() {
    const link = url.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      setError("Use a link that starts with https://");
      return;
    }
    if (!title.trim()) {
      setError("Add the job title this version is for.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave({ text, job: { title: title.trim(), company: company.trim(), ...(link ? { url: link } : {}) } });
      setSaved(true);
      setOpen(false);
    } catch {
      setError("We couldn't save this version. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-3">
      {!open && (
        <button type="button" onClick={begin} className="rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300">
          Save as version
        </button>
      )}
      {open && (
        <form
          className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          aria-label="Save as version"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="version-title">
                Job title
              </label>
              <input id="version-title" className="field-control" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="version-company">
                Company
              </label>
              <input id="version-company" className="field-control" maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="version-url">
              Posting link (optional)
            </label>
            <input id="version-url" className="field-control" type="url" inputMode="url" maxLength={2048} value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={error ? true : undefined} />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="cta-primary" disabled={saving}>
              {saving ? "Saving…" : "Save version"}
            </button>
            <button type="button" className="cta-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <p role="status" aria-live="polite" className={saved ? "mt-2 text-[13px] font-medium text-emerald-700" : "sr-only"}>
        {saved ? (
          <>
            Saved to Resume versions in your Career Vault. <Link href="/vault" className="underline">Open the vault</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

function ResumeView({
  r,
  chunks,
  name,
  onSaveVersion,
  versionJobHint,
}: { r: ReportResult<"resume">; name: string; onSaveVersion?: SaveVersion; versionJobHint?: { title: string; company: string } } & Ctx) {
  const plain = resumeToText(r, name);
  return (
    <>
      <Card
        title="Tailored resume"
        right={
          <div className="flex gap-1.5">
            <CopyButton text={plain} label="Copy" />
            <button type="button" onClick={() => download("resume.txt", plain, "text/plain")} className="rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300">
              .txt
            </button>
            <button type="button" onClick={() => printResume(plain)} className="rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300">
              PDF
            </button>
          </div>
        }
      >
        {onSaveVersion && <SaveVersionForm text={plain} hint={versionJobHint} onSave={onSaveVersion} />}
        <p className="text-[15px] font-bold text-zinc-900">{r.headline}</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-700">{r.summary.text}</p>
        <Cites ids={r.summary.chunkIds} chunks={chunks} />
        {r.sections.map((s, i) => (
          <div key={i} className="mt-5">
            <p className="border-b border-zinc-200 pb-1 text-[11.5px] font-bold uppercase tracking-wider text-zinc-500">{s.title}</p>
            {s.entries.map((e, j) => (
              <div key={j} className="mt-3">
                <p className="text-[13.5px] font-semibold text-zinc-900">{e.heading}</p>
                <ul className="mt-1.5 space-y-2">
                  {e.bullets.map((b, k) => (
                    <li key={k} className="text-[13.5px] leading-relaxed text-zinc-700">
                      • {b.text} <span className={`text-[10.5px] font-semibold ${CHANGE_STYLE[b.change]}`}>{b.change}</span>
                      {b.chunkIds.length ? <Cites ids={b.chunkIds} chunks={chunks} /> : <span className="ml-1 text-[11px] font-semibold text-red-600">no source: check this</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
        {r.skills.length > 0 && (
          <div className="mt-5">
            <p className="border-b border-zinc-200 pb-1 text-[11.5px] font-bold uppercase tracking-wider text-zinc-500">Skills</p>
            <p className="mt-2 text-[13.5px] text-zinc-700">{r.skills.join(", ")}</p>
          </div>
        )}
      </Card>
      <Card title="What changed">
        <Bullets items={r.changes} />
      </Card>
      <Card title="Not added: no evidence">
        <Bullets items={r.gapsLeft} />
      </Card>
    </>
  );
}

function BulletsView({ r }: { r: ReportResult<"bullets"> }) {
  return (
    <>
      {r.bullets.map((b, i) => (
        <Card key={i} title={`Bullet ${i + 1}`}>
          <p className="text-[13px] text-zinc-500 line-through decoration-zinc-300">{b.original}</p>
          <p className="mt-1 text-[12.5px] text-amber-700">{b.problem}</p>
          <ul className="mt-3 space-y-2">
            {b.rewrites.map((w, j) => (
              <li key={j} className="flex items-start justify-between gap-3 rounded-lg bg-zinc-50 p-2.5">
                <div>
                  <p className="text-[13.5px] text-zinc-800">{w.text}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{w.angle}</p>
                </div>
                <CopyButton text={w.text} label="Copy" />
              </li>
            ))}
          </ul>
          {b.askForMetric && <p className="mt-2 text-[12.5px] text-zinc-600">To add a real number: {b.askForMetric}</p>}
        </Card>
      ))}
      {r.patterns.length > 0 && (
        <Card title="Patterns across your bullets">
          <Bullets items={r.patterns} />
        </Card>
      )}
    </>
  );
}

function LinkedInView({ r, chunks }: { r: ReportResult<"linkedin"> } & Ctx) {
  return (
    <>
      <Card title="Headline options">
        <ul className="space-y-2">
          {r.headlines.map((h, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-medium text-zinc-800">{h.text}</p>
                <p className="text-[11px] text-zinc-400">
                  {h.angle} · {h.text.length}/220
                </p>
              </div>
              <CopyButton text={h.text} label="Copy" />
            </li>
          ))}
        </ul>
      </Card>
      <Card title="About" right={<CopyButton text={r.about} label="Copy" />}>
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-700">{r.about}</p>
      </Card>
      <Card title="Experience">
        <div className="space-y-4">
          {r.experience.map((e, i) => (
            <div key={i}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13.5px] font-semibold text-zinc-900">{e.role}</p>
                <CopyButton text={e.text} label="Copy" />
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">{e.text}</p>
              <Cites ids={e.chunkIds} chunks={chunks} />
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Top skills, in order">
          <ol className="list-inside list-decimal space-y-0.5 text-[13px] text-zinc-700">
            {r.topSkills.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>
        <Card title="Featured ideas">
          <Bullets items={r.featuredIdeas} />
        </Card>
      </div>
      <Card title="Quick fixes">
        <Bullets items={r.quickFixes} />
      </Card>
    </>
  );
}

function ProofView({ r, chunks }: { r: ReportResult<"proof"> } & Ctx) {
  const strong = r.claims.filter((c) => c.evidence === "STRONG").length;
  const pct = r.claims.length ? Math.round((strong / r.claims.length) * 100) : 0;
  return (
    <>
      <ScoreHeader score={pct} label={`${strong} of ${r.claims.length} claims proven`} sub={r.summary} tone={pct >= 60 ? "good" : pct >= 35 ? "mid" : "bad"} />
      <Card title="Claims vs receipts">
        <ul className="divide-y divide-zinc-100">
          {r.claims.map((c, i) => (
            <li key={i} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <EvidenceBadge value={c.evidence} />
                <span className="text-[13.5px] font-semibold text-zinc-800">“{c.claim}”</span>
              </div>
              <p className="mt-1 text-[12.5px] text-zinc-600">{c.proof}</p>
              {c.sourceRefs.length > 0 && <p className="mt-1 text-[12px] text-zinc-500">Repos: {c.sourceRefs.join(", ")}</p>}
              <Cites ids={c.chunkIds} chunks={chunks} />
              <p className="mt-1.5 text-[12.5px] text-zinc-800">Fix: {c.fix}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Your strongest proof">
        <Bullets items={r.strongestProof} />
      </Card>
    </>
  );
}

// ─── Interview ───────────────────────────────────────────────────────────────

const RISK_STYLE = { high: "text-red-600", medium: "text-amber-700", low: "text-emerald-700" } as const;

function PrepView({ r, chunks }: { r: ReportResult<"prep"> } & Ctx) {
  const high = r.questions.filter((q) => q.risk === "high").length;
  return (
    <>
      <Card title="30-second recruiter scan">
        <p className="text-[13.5px] text-zinc-700">{r.recruiterScan.firstImpression}</p>
        <p className="mt-2 text-[12.5px] font-semibold text-zinc-800">They'll look for</p>
        <Bullets items={r.recruiterScan.theyWillLookFor} />
        <p className="mt-2 text-[13px] text-zinc-700">
          <span className="font-semibold">Make or break:</span> {r.recruiterScan.makeOrBreak}
        </p>
      </Card>
      <Card title={`Likely questions · ${high} high-risk`}>
        <ol className="space-y-4">
          {r.questions.map((q, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold text-zinc-900">
                  {i + 1}. {q.question}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-zinc-400">
                {q.category} · <span className={`font-semibold ${RISK_STYLE[q.risk]}`}>{q.risk} risk</span> · probing: {q.why}
              </p>
              <p className="mt-1.5 text-[13px] text-zinc-700">{q.answerPlan}</p>
              {q.storyHint && <p className="mt-1 text-[12.5px] text-zinc-500">Use: {q.storyHint}</p>}
              <Cites ids={q.chunkIds} chunks={chunks} />
            </li>
          ))}
        </ol>
      </Card>
      {r.weakSpots.length > 0 && (
        <Card title="Where you're exposed">
          <ul className="space-y-3 text-[13.5px]">
            {r.weakSpots.map((w, i) => (
              <li key={i}>
                <span className="font-semibold text-zinc-900">{w.topic}</span>
                <span className="text-zinc-600"> — {w.whyExposed}</span>
                <p className="mt-1 text-[13px] text-zinc-700">Bridge: {w.honestBridge}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Ask them">
        <Bullets items={r.questionsToAsk} />
      </Card>
    </>
  );
}

function SignalNotes({ signals }: { signals: { words: number; seconds: number; notes: string[] } }) {
  return (
    <div className="text-[12.5px] text-zinc-600">
      <p>
        {signals.words} words · ~{signals.seconds}s spoken
      </p>
      {signals.notes.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {signals.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StarView({ r, chunks, onSave }: { r: ReportResult<"star">; onSave?: (title: string, text: string) => Promise<void> } & Ctx) {
  const [saved, setSaved] = useState(false);
  const storyText = `Q: ${r.question}\nSituation: ${r.situation}\nTask: ${r.task}\nAction: ${r.action}\nResult: ${r.result}`;
  return (
    <>
      <Card
        title={r.title}
        right={
          onSave && (
            <button
              type="button"
              disabled={saved}
              onClick={async () => {
                await onSave(r.title, storyText);
                setSaved(true);
              }}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-60"
            >
              {saved ? "Saved to vault ✓" : "Save to Career Vault"}
            </button>
          )
        }
      >
        <p className="text-[12.5px] text-zinc-500">Best for: {r.question}</p>
        <dl className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed">
          {(
            [
              ["Situation", r.situation],
              ["Task", r.task],
              ["Action", r.action],
              ["Result", r.result],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] font-semibold text-zinc-500">{k}</dt>
              <dd className="text-zinc-800">{v}</dd>
            </div>
          ))}
        </dl>
        <Cites ids={r.chunkIds} chunks={chunks} />
      </Card>
      <Card title="Say it like this" right={<CopyButton text={r.spoken} label="Copy" />}>
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-800">{r.spoken}</p>
        <div className="mt-3">
          <SignalNotes signals={r.signals} />
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Make it stronger">
          <Bullets items={r.missing} />
        </Card>
        <Card title="Also answers">
          <Bullets items={r.alsoAnswers} />
        </Card>
      </div>
    </>
  );
}

const DIMENSIONS = ["structure", "specificity", "relevance", "ownership", "credibility"] as const;

export function AnswerEvalView({ r, chunks }: { r: ReportResult<"answerEval"> } & Ctx) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <span className={`text-[34px] font-bold leading-none ${r.overall >= 70 ? "text-emerald-600" : r.overall >= 50 ? "text-amber-600" : "text-red-600"}`}>{r.overall}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-zinc-600">
          {DIMENSIONS.map((d) => (
            <span key={d}>
              {d} <span className="font-bold text-zinc-900">{r.scores[d]}/5</span>
            </span>
          ))}
        </div>
      </div>
      <SignalNotes signals={r.signals} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="What worked">
          <Bullets items={r.whatWorked} />
        </Card>
        <Card title="Fix">
          <Bullets items={r.fix} />
        </Card>
      </div>
      <Card title="A stronger answer" right={<CopyButton text={r.strongerAnswer} label="Copy" />}>
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-800">{r.strongerAnswer}</p>
        <Cites ids={r.chunkIds} chunks={chunks} />
      </Card>
    </div>
  );
}

// ─── Offers ──────────────────────────────────────────────────────────────────

function money(n: number, currency: string): string {
  if (!n) return "—";
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  try {
    return new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

function OffersView({ r }: { r: ReportResult<"offers"> }) {
  const best = r.rankedByFourYear[0];
  const rows: [string, (o: (typeof r.offers)[number]) => string][] = [
    ["Base / fixed", (o) => money(o.base, r.currency)],
    ["Variable (target)", (o) => (o.variablePct ? `${o.variablePct}% · ${money(o.totals.variable, r.currency)}` : "—")],
    ["Joining + other one-time", (o) => money(o.joiningBonus + o.otherCash, r.currency)],
    ["Equity per year", (o) => (o.equityKind === "none" ? "—" : `${money(o.totals.equityPerYear, r.currency)}${o.totals.equityIsPaper ? " (options: paper)" : ""}`)],
    ["Year-one cash", (o) => money(o.totals.year1Cash, r.currency)],
    ["Recurring per year", (o) => money(o.totals.annualRecurring, r.currency)],
    ["4-year total", (o) => money(o.totals.fourYearTotal, r.currency)],
  ];
  return (
    <>
      <Card title="Side by side">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 text-[12px] text-zinc-500">
                <th className="py-2 pr-3 font-medium" />
                {r.offers.map((o) => (
                  <th key={o.name} className="py-2 pr-3 font-semibold text-zinc-900">
                    {o.name}
                    {o.name === best && r.offers.length > 1 && <span className="ml-1 text-[10.5px] font-bold text-emerald-600">highest 4-yr</span>}
                    <span className="block text-[11px] font-normal text-zinc-400">{o.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, cell]) => (
                <tr key={label} className={`border-b border-zinc-100 ${/total|Year-one/.test(label) ? "font-semibold text-zinc-900" : "text-zinc-700"}`}>
                  <td className="py-2 pr-3 text-zinc-500">{label}</td>
                  {r.offers.map((o) => (
                    <td key={o.name} className="py-2 pr-3">
                      {cell(o)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] text-zinc-500">
          Computed in code from the figures quoted from your offers. Variable at 100% of target; RSUs valued at the stated grant value, spread over vesting; stock options excluded from cash totals.
          {r.current.total > 0 && ` Current compensation: ${money(r.current.total, r.currency)}.`}
        </p>
      </Card>
      <Card title="Where each number came from">
        <ul className="space-y-2 text-[12.5px] text-zinc-600">
          {r.offers.map((o) => (
            <li key={o.name}>
              <span className="font-semibold text-zinc-800">{o.name}:</span>{" "}
              {[o.baseQuote, o.variableQuote, o.joiningQuote, o.otherCashQuote, o.equityQuote].filter(Boolean).map((q) => `“${q}”`).join(" · ") || "no figures quoted"}
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {r.offers.map((o) => (
          <Card key={o.name} title={o.name}>
            <p className="text-[12px] font-semibold text-zinc-500">Beyond the money</p>
            <Bullets items={o.nonCash} />
            {o.risks.length > 0 && (
              <>
                <p className="mt-2 text-[12px] font-semibold text-red-600">Watch out</p>
                <Bullets items={o.risks} />
              </>
            )}
          </Card>
        ))}
      </div>
      <Card title="Trade-offs">
        <Bullets items={r.tradeoffs} />
      </Card>
      <Card title="Equity, in plain English">
        <p className="text-[13.5px] leading-relaxed text-zinc-700">{r.equityExplainer}</p>
      </Card>
      <Card title="Ask before you sign">
        <Bullets items={r.questionsToClarify} />
      </Card>
    </>
  );
}

// ─── Fun ─────────────────────────────────────────────────────────────────────

type Share = { name: string; slug: string };

function RoastView({ r, share }: { r: ReportResult<"roast">; share: Share }) {
  const tone = r.score >= 70 ? "good" : r.score >= 45 ? "mid" : "bad";
  return (
    <>
      <ScoreHeader score={r.score} label={r.score >= 70 ? "Surprisingly not cooked" : r.score >= 45 ? "Medium rare" : "Well done (not a compliment)"} sub={r.headline} tone={tone} />
      <ShareCard tool={share.name} slug={share.slug} score={String(r.score)} label="Resume Roast score" headline={r.headline} accent="#dc2626" />
      <Card title="Scorecard">
        <ul className="space-y-2 text-[13px]">
          {r.dimensions.map((d) => (
            <li key={d.name}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-zinc-800">{d.name}</span>
                <span className="font-bold text-zinc-900">{d.score}/10</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
                <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${d.score * 10}%` }} />
              </div>
              <p className="mt-1 text-[12.5px] text-zinc-500">{d.comment}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="The roast">
        <ul className="space-y-4">
          {r.burns.map((b, i) => (
            <li key={i}>
              <blockquote className="border-l-2 border-red-200 pl-2 text-[12.5px] italic text-zinc-500">“{b.quote}”</blockquote>
              <p className="mt-1 text-[14px] font-medium text-zinc-900">🔥 {b.burn}</p>
              <p className="mt-1 text-[12.5px] text-emerald-700">Fix: {b.realFix}</p>
            </li>
          ))}
        </ul>
        {r.droppedBurns > 0 && <p className="mt-3 text-[11.5px] text-zinc-400">{r.droppedBurns} burn(s) removed because they didn't quote your resume accurately.</p>}
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Buried gold">
          <Bullets items={r.buriedGold} />
        </Card>
        <Card title="Fix these first">
          <Bullets items={r.topFixes} />
        </Card>
      </div>
    </>
  );
}

const COURT_STYLE = { Acquitted: "bg-emerald-50 text-emerald-700", Probation: "bg-amber-50 text-amber-700", "Hung jury": "bg-zinc-100 text-zinc-600", Guilty: "bg-red-50 text-red-700" } as const;

function CourtView({ r, chunks, share }: { r: ReportResult<"court">; share: Share } & Ctx) {
  const n = r.charges.length;
  return (
    <>
      <ScoreHeader
        score={r.guilty}
        label={`Guilty on ${r.guilty} of ${n} count${n === 1 ? "" : "s"}`}
        sub={r.caseTitle}
        tone={r.guilty === 0 ? "good" : r.guilty <= n / 3 ? "mid" : "bad"}
      />
      <ShareCard tool={share.name} slug={share.slug} score={`${r.guilty}/${n}`} label="counts guilty" headline={r.caseTitle} accent="#b45309" />
      <Card title="The charges">
        <ul className="divide-y divide-zinc-100">
          {r.charges.map((c, i) => (
            <li key={i} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${COURT_STYLE[c.verdict]}`}>{c.verdict.toUpperCase()}</span>
                <span className="text-[13.5px] font-semibold text-zinc-900">{c.charge}</span>
              </div>
              <blockquote className="mt-1 text-[12.5px] italic text-zinc-500">“{c.claim}”</blockquote>
              <p className="mt-1.5 text-[13px] text-zinc-700">
                <span className="font-semibold">Prosecution:</span> {c.prosecution}
              </p>
              <p className="mt-1 text-[13px] text-zinc-700">
                <span className="font-semibold">Defence:</span> {c.defense}
              </p>
              <Cites ids={c.chunkIds} chunks={chunks} />
              <p className="mt-1.5 text-[13px] text-emerald-700">
                <span className="font-semibold">Sentence:</span> {c.sentence}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] text-zinc-400">Verdicts follow the evidence: strong = acquitted, partial = probation, missing = guilty.</p>
      </Card>
      <Card title="Closing statement">
        <p className="text-[13.5px] text-zinc-700">{r.closing}</p>
      </Card>
    </>
  );
}

function AuraView({ r, chunks, share }: { r: ReportResult<"aura">; share: Share } & Ctx) {
  const sorted = [...r.components].sort((a, b) => b.points - a.points);
  return (
    <>
      <ScoreHeader score={r.total} label={`${r.tier} · ${r.archetype}`} sub={r.vibe} tone={r.total >= 700 ? "good" : r.total >= 0 ? "mid" : "bad"} />
      <ShareCard tool={share.name} slug={share.slug} score={`${r.total >= 0 ? "+" : ""}${r.total}`} label={`${r.tier} · ${r.archetype}`} headline={r.vibe} accent="#db2777" />
      <Card title="Aura ledger">
        <ul className="divide-y divide-zinc-100">
          {sorted.map((c, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5">
              <span className={`w-16 shrink-0 text-right text-[14px] font-bold ${c.points >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {c.points >= 0 ? "+" : ""}
                {c.points}
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-zinc-900">{c.name}</p>
                <p className="text-[12.5px] text-zinc-600">{c.reason}</p>
                <Cites ids={c.chunkIds} chunks={chunks} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] text-zinc-400">Total is summed from the ledger. Tiers: 1500+ main character · 700+ aura farmer · 0+ respectable NPC · below 0 aura debt.</p>
      </Card>
      <Card title="Glow-up moves">
        <Bullets items={r.glowUp} />
      </Card>
    </>
  );
}

const BINGO_LINES = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

function BingoView({ r }: { r: ReportResult<"bingo"> }) {
  const cells = [...r.squares.slice(0, 12), { phrase: "FREE (you're on mute)", quote: "", verified: false }, ...r.squares.slice(12, 24)];
  const [marked, setMarked] = useState<Set<number>>(() => new Set([12]));
  const lines = BINGO_LINES.filter((line) => line.every((i) => marked.has(i))).length;
  const toggle = (i: number) =>
    setMarked((m) => {
      if (i === 12) return m;
      const next = new Set(m);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <>
      <Card title={lines ? `BINGO ×${lines}` : "Click a square when someone says it"} right={<span className="text-[11.5px] text-zinc-400">{marked.size - 1}/24</span>}>
        <div className="grid grid-cols-5 gap-1.5">
          {cells.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              title={c.quote ? `“${c.quote}”` : undefined}
              className={`flex aspect-square items-center justify-center rounded-lg border p-1 text-center text-[10.5px] font-semibold leading-tight transition-colors sm:text-[12px] ${
                marked.has(i) ? "border-red-300 bg-red-500 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              }`}
            >
              {c.phrase}
              {c.verified && !marked.has(i) && <span className="sr-only"> (found in your text)</span>}
            </button>
          ))}
        </div>
        {r.fromText && (
          <p className="mt-3 text-[11.5px] text-zinc-500">
            {r.squares.filter((s) => s.verified).length} of 24 squares were found verbatim in your text; hover to see where.
          </p>
        )}
      </Card>
      <p className="text-[13px] italic text-zinc-600">{r.commentary}</p>
    </>
  );
}

// ─── Entry ───────────────────────────────────────────────────────────────────

export function ReportView({
  kind,
  data,
  meta,
  sentChunks,
  profileName,
  onSaveStory,
  onSaveVersion,
  versionJobHint,
  share,
}: {
  kind: ReportKind;
  data: unknown;
  meta: RunMeta;
  sentChunks: VaultContextChunk[];
  profileName: string;
  /** Writes a STAR story back into the Career Vault. */
  onSaveStory?: (title: string, text: string) => Promise<void>;
  /** Saves the tailored resume as a version in the Career Vault. */
  onSaveVersion?: (v: { text: string; job: { title: string; company: string; url?: string } }) => Promise<void>;
  versionJobHint?: { title: string; company: string };
  /** Tool name and slug for share images. */
  share: Share;
}) {
  const chunks = new Map(sentChunks.map((c) => [c.id, c]));
  const body = (() => {
    switch (kind) {
      case "fit":
        return <FitView r={data as ReportResult<"fit">} chunks={chunks} share={share} />;
      case "jd":
        return <JdView r={data as ReportResult<"jd">} />;
      case "gap":
        return <GapView r={data as ReportResult<"gap">} chunks={chunks} />;
      case "ats":
        return <AtsView r={data as ReportResult<"ats">} chunks={chunks} />;
      case "resume":
        return <ResumeView r={data as ReportResult<"resume">} chunks={chunks} name={profileName} onSaveVersion={onSaveVersion} versionJobHint={versionJobHint} />;
      case "bullets":
        return <BulletsView r={data as ReportResult<"bullets">} />;
      case "linkedin":
        return <LinkedInView r={data as ReportResult<"linkedin">} chunks={chunks} />;
      case "proof":
        return <ProofView r={data as ReportResult<"proof">} chunks={chunks} />;
      case "prep":
        return <PrepView r={data as ReportResult<"prep">} chunks={chunks} />;
      case "star":
        return <StarView r={data as ReportResult<"star">} chunks={chunks} onSave={onSaveStory} />;
      case "answerEval":
        return <AnswerEvalView r={data as ReportResult<"answerEval">} chunks={chunks} />;
      case "offers":
        return <OffersView r={data as ReportResult<"offers">} />;
      case "roast":
        return <RoastView r={data as ReportResult<"roast">} share={share} />;
      case "court":
        return <CourtView r={data as ReportResult<"court">} chunks={chunks} share={share} />;
      case "aura":
        return <AuraView r={data as ReportResult<"aura">} chunks={chunks} share={share} />;
      case "bingo":
        return <BingoView r={data as ReportResult<"bingo">} />;
      case "profile":
        // Rendered by ProfileReview in the vault, not on a tool page.
        return null;
      case "mockPlan":
        // Rendered as an interactive session by PresetRunner.
        return null;
    }
  })();

  return (
    <div className="space-y-4">
      <RunWarnings meta={meta} />
      {body}
      <RunDetails meta={meta} sentChunks={sentChunks} />
    </div>
  );
}
