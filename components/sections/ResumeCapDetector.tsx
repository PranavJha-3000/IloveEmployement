"use client";
import { useState } from "react";
import type { AnalysisResult, CapVerdict } from "@/lib/types";
interface Props { result: AnalysisResult; }
const M: Record<CapVerdict, { label: string; pill: string; border: string }> = {
  green: { label: "GREEN", pill: "bg-green-50 text-green-700 border-green-200", border: "border-l-green-500" },
  yellow: { label: "YELLOW", pill: "bg-amber-50 text-amber-700 border-amber-200", border: "border-l-amber-500" },
  red: { label: "RED", pill: "bg-red-50 text-red-700 border-red-200", border: "border-l-red-500" },
};
export function ResumeCapDetector({ result }: Props) {
  const [open, setOpen] = useState(false);
  const claims = result.capDetector?.claims ?? [];
  if (claims.length === 0) return null;
  const counts = claims.reduce((acc, c) => { acc[c.verdict] = (acc[c.verdict] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const summary = "G" + (counts.green ?? 0) + " Y" + (counts.yellow ?? 0) + " R" + (counts.red ?? 0) + " / " + claims.length;
  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Resume Cap Detector</h3><span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">{summary}</span></div><p className="text-sm text-zinc-500 mt-1.5 truncate pr-4">{claims[0].claim} - {claims[0].note}</p></div>
        <span className={"text-zinc-400 text-xs transition-transform flex-shrink-0 " + (open ? "rotate-180" : "")}>v</span>
      </button>
      {open && (<div className="mt-4 pt-4 border-t border-zinc-200 space-y-2.5 animate-fade-up">{claims.map((c, i) => { const m = M[c.verdict] ?? M.yellow; return <div key={i} className={"bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 " + m.border}><div className="flex items-start justify-between gap-3 flex-wrap"><p className="text-sm font-medium text-zinc-800 leading-relaxed">&ldquo;{c.claim}&rdquo;</p><span className={"text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border " + m.pill}>{m.label}</span></div>{c.note && <p className="text-sm text-zinc-500 italic mt-1.5">{c.note}</p>}</div>; })}</div>)}
    </section>
  );
}
