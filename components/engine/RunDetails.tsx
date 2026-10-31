"use client";

import type { RunMeta, VaultContextChunk } from "@/lib/engine/types";

/** Warnings the user must see before using the output. */
export function RunWarnings({ meta }: { meta: RunMeta }) {
  const warnings = [...meta.injection.flatMap((i) => i.findings.map((f) => `${i.field}: ${f}`)), ...meta.grounding];
  const failedSources = meta.sources?.filter((s) => !s.ok) ?? [];
  if (!warnings.length && !failedSources.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[12px] font-bold uppercase tracking-wider text-amber-800">Check before using</p>
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
