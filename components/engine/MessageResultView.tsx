"use client";

import { useState } from "react";
import type { MessageResult } from "@/lib/engine/schemas";
import type { RunMeta, VaultContextChunk } from "@/lib/engine/types";
import { CopyButton } from "@/components/shared/CopyButton";

interface Props {
  result: MessageResult;
  meta: RunMeta;
  sentChunks: VaultContextChunk[];
}

/** Renders [placeholders] as highlighted spans so they can't be sent by accident. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{1,80}\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function MessageResultView({ result, meta, sentChunks }: Props) {
  const versions = [{ label: "Recommended", body: result.body }, ...result.variants];
  const [active, setActive] = useState(0);
  const body = versions[active]?.body ?? result.body;
  const fullText = result.subject && active === 0 ? `Subject: ${result.subject}\n\n${body}` : body;
  const chunkTitle = new Map(sentChunks.map((c) => [c.id, `${c.title}`]));
  const warnings = [...meta.injection.flatMap((i) => i.findings.map((f) => `${i.field}: ${f}`)), ...meta.grounding];

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[12px] font-bold uppercase tracking-wider text-amber-800">Check before sending</p>
          <ul className="mt-2 space-y-1 text-[13px] text-amber-900">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {versions.map((v, i) => (
              <button
                key={v.label + i}
                type="button"
                onClick={() => setActive(i)}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                  active === i ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <CopyButton text={fullText} label="Copy" />
        </div>
        {result.subject && active === 0 && (
          <p className="border-b border-zinc-100 px-4 py-2.5 text-[13px] text-zinc-500">
            <span className="font-semibold text-zinc-700">Subject:</span> <Highlighted text={result.subject} />
          </p>
        )}
        <div className="whitespace-pre-wrap px-4 py-4 text-[14px] leading-relaxed text-zinc-800">
          <Highlighted text={body} />
        </div>
      </div>

      {result.placeholders.length > 0 && (
        <p className="text-[12.5px] text-zinc-600">
          <span className="font-semibold text-zinc-800">Fill in:</span> {result.placeholders.join(", ")}
        </p>
      )}

      {result.notes.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <p className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">Why it's written this way</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">
            {result.notes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        </div>
      )}

      {result.citations.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-[12px] font-bold uppercase tracking-wider text-emerald-800">Grounded in your Career Vault</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-emerald-950">
            {result.citations.map((c, i) => (
              <li key={c.chunkId + i}>
                <span className="font-medium">“{c.claim}”</span>
                <span className="text-emerald-700"> ← {chunkTitle.get(c.chunkId) ?? c.chunkId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-xl border border-zinc-200 bg-white p-4 text-[12.5px] text-zinc-600">
        <summary className="cursor-pointer font-semibold text-zinc-700">How this was generated</summary>
        <div className="mt-3 space-y-3">
          <p>
            {meta.tier === "free" ? "Free tier" : "Your key"} · {meta.model}
            {meta.usage && ` · ${meta.usage.promptTokens.toLocaleString()} in / ${meta.usage.completionTokens.toLocaleString()} out tokens`}
          </p>
          <div>
            <p className="font-semibold text-zinc-700">Context assembled</p>
            <ul className="mt-1 space-y-0.5">
              {meta.context.map((c) => (
                <li key={c.id} className={c.dropped ? "text-zinc-400 line-through" : ""}>
                  {c.title} — ~{c.tokens.toLocaleString()} tokens{c.truncated ? " (truncated)" : ""}
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
              ? `${sentChunks.length} vault chunk${sentChunks.length === 1 ? "" : "s"} sent; the rest of your vault stayed in this browser.`
              : "No vault data was sent."}
          </p>
        </div>
      </details>
    </div>
  );
}
