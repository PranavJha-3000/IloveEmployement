"use client";
import { useState } from "react";
import type { AiRequestConfig, AnalysisResult, ChangeCategory, ResumeOptimizationResult } from "@/lib/types";
interface Props { open: boolean; onClose: () => void; aiConfig: AiRequestConfig | null; analysis: AnalysisResult; resumeText: string; jobDescription: string; linkedinUrl?: string; githubUrl?: string; }
const CS: Record<ChangeCategory, { label: string; className: string }> = {
  structure: { label: "Structure", className: "bg-blue-50 text-blue-700 border-blue-200" },
  wording: { label: "Wording", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  keywords: { label: "Keywords", className: "bg-amber-50 text-amber-700 border-amber-200" },
  emphasis: { label: "Emphasis", className: "bg-green-50 text-green-700 border-green-200" },
  clarity: { label: "Clarity", className: "bg-blue-50 text-blue-700 border-blue-200" },
  relevance: { label: "Relevance", className: "bg-orange-50 text-orange-700 border-orange-200" },
};
const LOAD = ["Polishing your bullets...", "Weaponizing your keywords...", "Straightening the skill section...", "Making your resume say things professionally...", "Truth filter armed."];
type Tab = "original" | "optimized" | "changes";
type Phase = "idle" | "loading" | "success" | "error";
export function ResumeRewriteModal({ open, onClose, aiConfig, analysis, resumeText, jobDescription, linkedinUrl, githubUrl }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ResumeOptimizationResult | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("original");
  const [copied, setCopied] = useState(false);
  const [mi, setMi] = useState(0);
  if (!open) return null;
  async function startOptimize() {
    setPhase("loading"); setError(""); setResult(null); setTab("optimized"); setMi(0);
    const timer = setInterval(() => setMi((i) => (i + 1) % LOAD.length), 1800);
    try {
      const res = await fetch("/api/optimize-resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: aiConfig, resumeText, jobDescription, analysis, linkedinUrl, githubUrl }) });
      const json = await res.json(); clearInterval(timer);
      if (!res.ok) throw new Error(json.error || "Optimization failed.");
      setResult(json as ResumeOptimizationResult); setPhase("success");
    } catch (err) { clearInterval(timer); setError(err instanceof Error ? err.message : "Optimization failed."); setPhase("error"); }
  }
  async function handleCopy() { if (!result) return; try { await navigator.clipboard.writeText(result.optimizedResume); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }
  function handleDownload() { if (!result) return; const blob = new Blob([result.optimizedResume], { type: "text/markdown;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "optimized-resume.md"; a.click(); URL.revokeObjectURL(url); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-lg font-bold text-zinc-900">Resume Rewrite</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition text-xl leading-none">x</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {phase === "idle" && (<div className="text-center py-10"><p className="text-sm text-zinc-600 mb-5">Let the AI rewrite your resume to target this specific job.</p><button onClick={startOptimize} className="cta-primary">Start Rewrite</button></div>)}
          {phase === "loading" && (<div className="text-center py-12"><div className="w-10 h-10 border-4 border-zinc-200 border-t-red-600 rounded-full animate-spin mx-auto"></div><p className="text-sm text-zinc-600 mt-4">{LOAD[mi]}</p></div>)}
          {phase === "error" && (<div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>)}
          {phase === "success" && result && (
            <div>
              <div className="flex gap-2 mb-4 bg-zinc-100 rounded-lg p-1">
                {(["original", "optimized", "changes"] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={"px-3 py-1.5 text-xs font-medium rounded-md transition " + (tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>{t === "original" ? "Original" : t === "optimized" ? "Optimized" : "Changes"}</button>)}
              </div>
              {tab === "original" && <pre className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{resumeText}</pre>}
              {tab === "optimized" && <MarkdownResume content={result.optimizedResume} />}
              {tab === "changes" && (result.whatChanged.length === 0 ? <p className="text-sm text-zinc-500 italic">No changes recorded.</p> : <ul className="space-y-3">{result.whatChanged.map((c, i) => <li key={i} className="flex gap-3"><span className={"text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 " + (CS[c.category]?.className ?? CS.wording.className)}>{CS[c.category]?.label ?? c.category}</span><div><p className="text-sm text-zinc-700 leading-relaxed">{c.description}</p>{c.section && <p className="text-xs text-zinc-400 mt-1">Affects: {c.section}</p>}</div></li>)}</ul>)}
            </div>
          )}
        </div>
        {phase === "success" && result && (
          <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-zinc-200">
            <button onClick={handleCopy} className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition">{copied ? "Copied" : "Copy Optimized"}</button>
            <button onClick={handleDownload} className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition">Download .md</button>
          </div>
        )}
      </div>
    </div>
  );
}
function MarkdownResume({ content }: { content: string }) {
  const lines = content.split("\n"); const out: React.ReactNode[] = []; let list: string[] = []; let key = 0;
  function flushList() { if (list.length > 0) { out.push(<ul key={"ul" + key++} className="space-y-1 my-1.5 list-disc list-inside">{list.map((li, i) => <li key={i} className="text-sm text-zinc-700 leading-relaxed">{li}</li>)}</ul>); list = []; } }
  for (const raw of lines) { const line = raw.replace(/\*\*/g, "").trim(); if (!line) { flushList(); continue; } if (/^[-*]\s+/.test(line)) { list.push(line.replace(/^[-*]\s+/, "")); continue; } flushList(); if (/^#{1,2}\s+/.test(line)) { out.push(<p key={"h" + key++} className="text-sm font-bold text-zinc-900 uppercase tracking-wide mt-3 mb-1.5 first:mt-0">{line.replace(/^#+\s+/, "")}</p>); } else if (/^#{3,}\s+/.test(line)) { out.push(<p key={"h" + key++} className="text-xs font-semibold text-zinc-700 mt-2 mb-1">{line.replace(/^#+\s+/, "")}</p>); } else { out.push(<p key={"p" + key++} className="text-sm text-zinc-700 leading-relaxed my-1">{line}</p>); } }
  flushList();
  return <div>{out}</div>;
}
