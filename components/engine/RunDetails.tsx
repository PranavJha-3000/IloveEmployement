"use client";

import type { RunMeta, VaultContextChunk } from "@/lib/engine/types";
import type { RunTrace } from "@/lib/engine/trace";

/** Warnings the user must see before using the output. */
export function RunWarnings({ meta }: { meta: RunMeta }) {
  const warnings = [...meta.injection.flatMap((i) => i.findings.map((f) => `${i.field}: ${f}`)), ...meta.grounding];
  const failedSources = meta.sources?.filter((s) => !s.ok) ?? [];
  if (!warnings.length && !failedSources.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[14px] font-semibold text-amber-800">Check before using</p>
      <ul className="mt-2 space-y-1 text-[13px] text-amber-900">
        {failedSources.map((s) => (
          <li key={s.id}>• {s.title}: {s.detail}</li>
        ))}
        {warnings.map((w) => (
          <li key={w}>• {w}</li>
        ))}
      </ul>
    </div>
  );
}

/** Per-step timing waterfall built from the run's trace. */
function TraceWaterfall({ trace }: { trace: RunTrace }) {
  const total = Math.max(trace.totalMs, 1);
  const tokens = (a: RunTrace["spans"][number]["attrs"]) =>
    typeof a.promptTokens === "number" ? ` · ${a.promptTokens.toLocaleString()} in / ${Number(a.completionTokens ?? 0).toLocaleString()} out` : "";
  return (
    <div>
      <p className="font-semibold text-zinc-700">Steps · {(trace.totalMs / 1000).toFixed(2)} s total</p>
      <ol className="mt-1 space-y-1" aria-label="Run steps with timings">
        {trace.spans.map((s, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-2">
            <span className="truncate" title={s.name}>
              {s.name}
            </span>
            <span className="relative block h-4 rounded bg-zinc-100" aria-label={`${s.durationMs} ms${tokens(s.attrs)}`}>
              <span
                className={`absolute inset-y-0 rounded ${s.attrs.ok === false ? "bg-red-400" : s.name.startsWith("model") ? "bg-[var(--brand,#e5322d)]" : "bg-zinc-400"}`}
                style={{ left: `${(s.startMs / total) * 100}%`, width: `max(2px, ${(s.durationMs / total) * 100}%)` }}
              />
            </span>
            <span className="col-start-2 -mt-1 text-[11.5px] text-zinc-500">
              {s.durationMs < 1 ? "<1" : Math.round(s.durationMs)} ms{tokens(s.attrs)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "How this was generated": the context-engineering trail behind a result. */
export function RunDetails({ meta, sentChunks }: { meta: RunMeta; sentChunks: VaultContextChunk[] }) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-4 text-[12.5px] text-zinc-600">
      <summary className="cursor-pointer font-semibold text-zinc-700">How this was generated</summary>
      <div className="mt-3 space-y-3">
        <p>
          {meta.tier === "free" ? "Free tier" : "Your key"} · {meta.model}
          {meta.usage && ` · ${meta.usage.promptTokens.toLocaleString()} in / ${meta.usage.completionTokens.toLocaleString()} out tokens`}
        </p>

        {meta.trace && meta.trace.spans.length > 0 && <TraceWaterfall trace={meta.trace} />}

        {meta.review && (
          <div>
            <p className="font-semibold text-zinc-700">
              Reviewer pass: {meta.review.issues.length} issue{meta.review.issues.length === 1 ? "" : "s"} found
              {meta.review.revised ? ", draft revised" : ", draft approved as-is"}
            </p>
            {meta.review.issues.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {meta.review.issues.map((i, idx) => (
                  <li key={idx}>
                    <span className={i.severity === "high" ? "font-semibold text-red-600" : i.severity === "medium" ? "text-amber-700" : "text-zinc-500"}>
                      [{i.severity}]
                    </span>{" "}
                    {i.where}: {i.problem}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {meta.sources && (
          <div>
            <p className="font-semibold text-zinc-700">Sources fetched</p>
            {meta.sources.map((s) => (
              <p key={s.id}>
                {s.ok ? "✓" : "✗"} {s.title}: {s.detail}
              </p>
            ))}
          </div>
        )}

        <div>
          <p className="font-semibold text-zinc-700">Context assembled</p>
          <ul className="mt-1 space-y-0.5">
            {meta.context.map((c) => (
              <li key={c.id} className={c.dropped ? "text-zinc-400 line-through" : ""}>
                {c.title}: ~{c.tokens.toLocaleString()} tokens{c.truncated ? " (truncated)" : ""}
                {c.dropped ? " (dropped: over budget)" : ""}
              </li>
            ))}
          </ul>
        </div>

        {meta.knowledge.length > 0 && (
          <div>
            <p className="font-semibold text-zinc-700">Playbooks retrieved</p>
            <p className="mt-1">{meta.knowledge.map((k) => k.title).join(" · ")}</p>
          </div>
        )}

        <p>
          {sentChunks.length
            ? `${sentChunks.length} profile chunk${sentChunks.length === 1 ? "" : "s"} sent${
                meta.retrieval === "hybrid"
                  ? ", picked by hybrid search (keyword + on-device semantic, fused with RRF)"
                  : meta.retrieval === "whole"
                    ? " (whole resume, in document order)"
                    : ", picked by keyword search (BM25)"
              }; the rest of your vault stayed in this browser.`
            : "No profile data was sent."}
        </p>
      </div>
    </details>
  );
}
