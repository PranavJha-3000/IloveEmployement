"use client";
import type { AnalysisResult, Verdict } from "@/lib/types";
interface Props { result: AnalysisResult; }
const V: Record<Verdict, { caption: string; badge: string; border: string }> = {
  APPLY: { caption: "Your resume has some legit strengths.", badge: "bg-green-50 text-green-700 border-green-200", border: "border-l-4 border-l-green-500" },
  BORDERLINE: { caption: "Could go either way. Lock in.", badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-l-4 border-l-amber-500" },
  "LONG SHOT": { caption: "Possible. The odds are doing cardio.", badge: "bg-orange-50 text-orange-700 border-orange-200", border: "border-l-4 border-l-orange-500" },
  "ABSOLUTELY COOKED": { caption: "Respectfully, this application needs character development.", badge: "bg-red-50 text-red-700 border-red-200", border: "border-l-4 border-l-red-500" },
};
export function VerdictCard({ result }: Props) {
  const c = V[result.verdict] ?? V.BORDERLINE;
  return (
    <div className={"card " + c.border}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={"text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border " + c.badge}>{result.verdict}</span>
        <span className="text-lg sm:text-xl font-bold text-zinc-900">{c.caption}</span>
      </div>
      {result.summary && <p className="mt-4 text-sm text-zinc-600 leading-relaxed">{result.summary}</p>}
    </div>
  );
}
