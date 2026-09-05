"use client";
import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
interface Props { result: AnalysisResult; }
export function ResumeOptimization({ result }: Props) {
  const [copied, setCopied] = useState(false);
  const pairs = Math.max(result.resumeProblems.length, result.resumeChanges.length);
  function build() { const l: string[] = ["RESUME OPTIMIZATION", ""]; for (let i = 0; i < pairs; i++) { if (result.resumeProblems[i]) l.push((i + 1) + ". PROBLEM: " + result.resumeProblems[i]); if (result.resumeChanges[i]) l.push("   FIX: " + result.resumeChanges[i]); l.push(""); } return l.join("\n").trim(); }
  async function handleCopy() { try { await navigator.clipboard.writeText(build()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }
  if (pairs === 0) return <section className="card"><h3 className="text-sm font-semibold text-zinc-900 mb-2">Resume Optimization</h3><p className="text-sm text-zinc-500 italic">No resume-specific issues identified.</p></section>;
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap"><h3 className="text-sm font-semibold text-zinc-900">Resume Optimization</h3><button onClick={handleCopy} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-700 hover:border-zinc-300 transition">{copied ? "Copied" : "Copy all fixes"}</button></div>
      <div className="space-y-4">{Array.from({ length: pairs }, (_, i) => { const p = result.resumeProblems[i]; const fx = result.resumeChanges[i]; return <div key={i} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span><div className="flex-1 min-w-0 space-y-1.5">{p && <p className="text-sm leading-relaxed"><span className="text-red-600 font-semibold">PROBLEM</span><span className="text-zinc-400"> - </span><span className="text-zinc-700">{p}</span></p>}{fx && <p className="text-sm leading-relaxed"><span className="text-green-700 font-semibold">FIX</span><span className="text-zinc-400"> - </span><span className="text-zinc-700">{fx}</span></p>}</div></div>; })}</div>
    </section>
  );
}
