"use client";

import type { ReactNode } from "react";
import type { ReportResult } from "@/lib/engine/reports";
import type { Evidence, FitScore } from "@/lib/engine/scoring";
import type { RunMeta, VaultContextChunk } from "@/lib/engine/types";
import type { ReportKind } from "@/lib/presets/types";
import { CopyButton } from "@/components/shared/CopyButton";
import { RunDetails, RunWarnings } from "./RunDetails";

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
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
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
  reqs: { requirement: string; importance: "must" | "nice"; evidence: Evidence; proof: string; chunkIds: string[] }[];
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

function FitView({ r, chunks }: { r: ReportResult<"fit"> } & Ctx) {
  const v = VERDICT_LABEL[r.score.verdict];
  return (
    <>
      <ScoreHeader score={r.score.score} label={v.label} sub={r.headline} tone={v.tone} />
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
              title={k.found ? `Matched as "${k.matchedAs}"` : k.evidenced ? "You have this; add the wording" : "Not in your material"}
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

function resumeToText(r: ReportResult<"resume">, name: string): string {
  const out: string[] = [];
  if (name) out.push(name);
  out.push(r.headline, "", "SUMMARY", r.summary.text, "");
  for (const s of r.sections) {
    out.push(s.title.toUpperCase());
    for (const e of s.entries) {
      out.push(e.heading);
      for (const b of e.bullets) out.push(`• ${b.text}`);
      out.push("");
    }
  }
  if (r.skills.length) out.push("SKILLS", r.skills.join(", "));
  return out.join("\n").trim();
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

function ResumeView({ r, chunks, name }: { r: ReportResult<"resume">; name: string } & Ctx) {
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

// ─── Entry ───────────────────────────────────────────────────────────────────

export function ReportView({
  kind,
  data,
  meta,
  sentChunks,
  profileName,
}: {
  kind: ReportKind;
  data: unknown;
  meta: RunMeta;
  sentChunks: VaultContextChunk[];
  profileName: string;
}) {
  const chunks = new Map(sentChunks.map((c) => [c.id, c]));
  const body = (() => {
    switch (kind) {
      case "fit":
        return <FitView r={data as ReportResult<"fit">} chunks={chunks} />;
      case "jd":
        return <JdView r={data as ReportResult<"jd">} />;
      case "gap":
        return <GapView r={data as ReportResult<"gap">} chunks={chunks} />;
      case "ats":
        return <AtsView r={data as ReportResult<"ats">} chunks={chunks} />;
      case "resume":
        return <ResumeView r={data as ReportResult<"resume">} chunks={chunks} name={profileName} />;
      case "bullets":
        return <BulletsView r={data as ReportResult<"bullets">} />;
      case "linkedin":
        return <LinkedInView r={data as ReportResult<"linkedin">} chunks={chunks} />;
      case "proof":
        return <ProofView r={data as ReportResult<"proof">} chunks={chunks} />;
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
