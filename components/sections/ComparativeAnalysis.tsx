"use client";
import type { AnalysisResult, EvidenceLevel } from "@/lib/types";
interface Props { result: AnalysisResult; }
const EB: Record<EvidenceLevel, { label: string; className: string }> = {
  strong: { label: "Strong", className: "bg-green-50 text-green-700 border-green-200" },
  weak: { label: "Weak", className: "bg-amber-50 text-amber-700 border-amber-200" },
  none: { label: "None", className: "bg-red-50 text-red-700 border-red-200" },
};
const CAND: Record<EvidenceLevel, string> = { strong: "You: STRONG", weak: "You: PARTIAL", none: "You: NONE" };
const IMP: Record<string, { label: string; className: string }> = {
  high: { label: "JD: HIGH", className: "bg-red-50 text-red-700 border-red-200" },
  medium: { label: "JD: MED", className: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "JD: LOW", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};
function src(s?: string): string | null { if (!s) return null; if (s === "resume") return "from resume"; if (s === "linkedin") return "from LinkedIn"; if (s === "github") return "from GitHub"; return "inferred"; }
export function ComparativeAnalysis({ result }: Props) {
  const matches = result.strengths.slice(0, 5);
  return (
    <section className="card space-y-7">
      <h3 className="text-sm font-semibold text-zinc-900">Comparative Analysis</h3>
      <div><h4 className="text-xs uppercase tracking-widest text-green-700 font-semibold mb-3">Strongest Matches</h4>
        {matches.length === 0 ? <p className="text-sm text-zinc-500 italic">No significant matches found.</p> : (<div className="space-y-2">{matches.map((item, i) => { const b = EB[item.evidence] ?? EB.weak; const s = src(item.source); return <div key={i} className="flex items-start justify-between gap-3 bg-zinc-50 border border-zinc-200 rounded-lg p-3"><div className="flex items-start gap-2.5 min-w-0"><span className="text-green-600 mt-0.5 flex-shrink-0">+</span><p className="text-sm text-zinc-800 font-medium leading-relaxed">{item.text}</p></div><div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">{s && <span className="text-[10px] text-zinc-500">{s}</span>}<span className={"text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border " + b.className}>{b.label}</span></div></div>; })}</div>)}
      </div>
      <div><h4 className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-3">Biggest Problems</h4>
        {result.weaknesses.length === 0 ? <p className="text-sm text-zinc-500 italic">Nothing major flagged.</p> : (<div className="space-y-3">{result.weaknesses.map((item, i) => { const b = EB[item.evidence] ?? EB.weak; const imp = item.importance ? IMP[item.importance] : null; return <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5"><div className="flex items-start justify-between gap-3 flex-wrap"><p className="text-sm font-semibold text-zinc-800 flex items-center gap-2"><span className="text-amber-600">!</span>{item.area || "Weakness"}</p><div className="flex items-center gap-1.5 flex-wrap">{imp && <span className={"text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border " + imp.className}>{imp.label}</span>}<span className={"text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border " + b.className}>{CAND[item.evidence]}</span></div></div><p className="text-sm text-zinc-600 leading-relaxed mt-1.5">{item.text}</p></div>; })}</div>)}
      </div>
      {result.fatalGaps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2">Fatal Gaps</h4>
          <p className="text-xs text-red-400/80 mb-3">Hard requirements from the JD you clearly do not meet.</p>
          <div className="space-y-2">{result.fatalGaps.map((gap, i) => <div key={i} className="flex items-start gap-2.5"><span className="text-red-600 font-bold flex-shrink-0">X</span><p className="text-sm text-zinc-800 leading-relaxed">{gap.text}</p></div>)}</div>
        </div>
      )}
    </section>
  );
}
