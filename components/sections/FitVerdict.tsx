"use client";
import { useEffect, useState } from "react";
import type { AnalysisResult, Verdict } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; border: string }> = {
  APPLY: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  BORDERLINE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "LONG SHOT": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  "ABSOLUTELY COOKED": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 45) return "text-amber-500";
  if (score >= 25) return "text-orange-500";
  return "text-red-600";
}

export function FitVerdict({ result }: Props) {
  const [fitDisplay, setFitDisplay] = useState(0);
  const [interviewDisplay, setInterviewDisplay] = useState(0);
  const vs = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE.BORDERLINE;

  useEffect(() => {
    const animate = (setter: (v: number) => void, target: number) => {
      if (target === 0) { setter(0); return; }
      const duration = 900;
      const start = performance.now();
      let raf = 0;
      function tick(now: number) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setter(Math.round(eased * target));
        if (t < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    };
    const c1 = animate(setFitDisplay, result.overallScore);
    const c2 = animate(setInterviewDisplay, result.selectionChance);
    return () => { c1?.(); c2?.(); };
  }, [result.overallScore, result.selectionChance]);

  return (
    <section className="card text-center">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Verdict</p>
      <p
        className={`mt-3 inline-block text-xl sm:text-2xl font-bold uppercase tracking-wider px-6 py-3 rounded-lg border ${vs.bg} ${vs.text} ${vs.border}`}
      >
        {result.verdict}
      </p>
      <div className="mt-6 grid sm:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
            Fit Score
          </p>
          <p className={`mt-2 text-5xl font-bold tabular-nums ${scoreColor(result.overallScore)}`}>
            {fitDisplay}
          </p>
          <p className="text-xs text-zinc-400 mt-1">out of 100</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
            Estimated interview likelihood
          </p>
          <p className={`mt-2 text-5xl font-bold tabular-nums ${scoreColor(result.selectionChance)}`}>
            {interviewDisplay}%
          </p>
          <p className="text-xs text-zinc-400 mt-1">model estimate &middot; not a prediction</p>
        </div>
      </div>
    </section>
  );
}