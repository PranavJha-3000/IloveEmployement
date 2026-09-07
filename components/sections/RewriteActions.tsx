"use client";
import { useState } from "react";
import type { ResumeRewriteResult } from "@/lib/types";

interface Props {
  result: ResumeRewriteResult;
}

/** Build a plain-text version of the optimized resume for copy / download. */
function buildPlainText(result: ResumeRewriteResult): string {
  const lines: string[] = [];
  for (const sec of result.optimizedResume) {
    if (!sec.content.trim()) continue;
    lines.push(sec.title.toUpperCase());
    lines.push(sec.content.trim());
    lines.push("");
  }
  if (result.professionalNote) {
    lines.push("---");
    lines.push(result.professionalNote);
  }
  return lines.join("\n");
}

export function RewriteActions({ result }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildPlainText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable - no-op */
    }
  }

  function handleDownload() {
    const text = buildPlainText(result);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimized-resume.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
          Truth Filter
        </h3>
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-md border bg-green-50 text-green-700 border-green-200">
          ON
        </span>
      </div>
      {result.professionalNote && (
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{result.professionalNote}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={handleCopy} className="cta-primary">
          {copied ? "Copied" : "Copy Optimized Resume"}
        </button>
        <button onClick={handleDownload} className="cta-secondary">
          Download
        </button>
      </div>
    </section>
  );
}