"use client";
import { useState } from "react";
import type { AnalysisResult, RiskLevel } from "@/lib/types";
interface Props { result: AnalysisResult; }
const R: Record<RiskLevel, { badge: string; dot: string }> = {
  Low: { badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  Medium: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  High: { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};
export function RecruiterSimulator({ result }: Props) {
  const [open, setOpen] = useState(false);
  const sim = result.recruiterSimulation; const risk = sim?.tabClosingRisk;
  const hasData = sim && (sim.firstFiveSeconds || sim.fiveToFifteenSeconds || sim.fifteenToThirtySeconds || risk);
  if (!hasData) return null;
  const rs = risk ? R[risk.level] ?? R.Medium : R.Medium;
  const preview = (sim?.firstFiveSeconds || "").slice(0, 70) || "30-second recruiter scan generated.";
  const phases = [{ label: "0-5 sec", text: sim.firstFiveSeconds }, { label: "5-15 sec", text: sim.fiveToFifteenSeconds }, { label: "15-30 sec", text: sim.fifteenToThirtySeconds }];
  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">30-Second Recruiter Test</h3>{risk && <span className={"text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border " + rs.badge}>Tab-closing risk: {risk.level}</span>}</div><p className="text-sm text-zinc-500 mt-1.5 truncate pr-4">{preview}</p></div>
        <span className={"text-zinc-400 text-xs transition-transform flex-shrink-0 " + (open ? "rotate-180" : "")}>v</span>
      </button>
      {open && (<div className="mt-4 pt-4 border-t border-zinc-200 space-y-4 animate-fade-up">
        <div className="space-y-3">{phases.map((ph) => ph.text ? <div key={ph.label} className="flex gap-3 items-start"><span className="w-16 text-[10px] font-bold uppercase tracking-wide text-zinc-400 flex-shrink-0 pt-0.5">{ph.label}</span><p className="text-sm text-zinc-700 leading-relaxed">{ph.text}</p></div> : null)}</div>
        {risk?.explanation && <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 flex gap-3"><span className={"w-2 h-2 rounded-full mt-1.5 flex-shrink-0 " + rs.dot} /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Why</p><p className="text-sm text-zinc-600 leading-relaxed">{risk.explanation}</p></div></div>}
      </div>)}
    </section>
  );
}
