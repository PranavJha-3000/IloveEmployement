"use client";
import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/types";
interface Props { result: AnalysisResult; }
type Bucket = "lead" | "hide" | "fix";
const B: { key: Bucket; title: string; accent: string; dot: string }[] = [
  { key: "lead", title: "Lead with", accent: "text-green-700", dot: "bg-green-500" },
  { key: "hide", title: "De-emphasize", accent: "text-amber-700", dot: "bg-amber-500" },
  { key: "fix", title: "Fix before applying", accent: "text-red-600", dot: "bg-red-500" },
];
function cls(item: string): { bucket: Bucket; text: string } { if (item.startsWith("LEAD:")) return { bucket: "lead", text: item.slice(5).trim() }; if (item.startsWith("HIDE:")) return { bucket: "hide", text: item.slice(5).trim() }; if (item.startsWith("FIX:")) return { bucket: "fix", text: item.slice(4).trim() }; return { bucket: "lead", text: item }; }
export function StrategySection({ result }: Props) {
  const grouped = useMemo(() => { const m: Record<Bucket, string[]> = { lead: [], hide: [], fix: [] }; for (const raw of result.applicationStrategy) { const { bucket, text } = cls(raw); if (text) m[bucket].push(text); } return m; }, [result.applicationStrategy]);
  const empty = B.every((b) => grouped[b.key].length === 0);
  return (
    <section className="card">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">Application Strategy</h3>
      {empty ? <p className="text-sm text-zinc-500 italic">No strategy data was returned.</p> : (
        <div className="grid sm:grid-cols-3 gap-5">
          {B.map((b) => (
            <div key={b.key}>
              <div className="flex items-center gap-2 mb-2.5"><span className={"w-1.5 h-1.5 rounded-full " + b.dot} /><h4 className={"text-xs font-bold uppercase tracking-wider " + b.accent}>{b.title}</h4></div>
              {grouped[b.key].length === 0 ? <p className="text-xs text-zinc-400 italic">Nothing here.</p> : <ul className="space-y-1.5">{grouped[b.key].map((item, i) => <li key={i} className="text-sm text-zinc-600 leading-relaxed flex gap-1.5"><span className="text-zinc-400 mt-0.5 flex-shrink-0">-</span><span>{item}</span></li>)}</ul>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
