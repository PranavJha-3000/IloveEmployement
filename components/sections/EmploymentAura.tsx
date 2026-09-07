"use client";
import { useEffect, useState } from "react";
import type { AnalysisResult, Verdict } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

const VERDICT_BADGE: Record<Verdict, string> = {
  APPLY: "bg-green-50 text-green-700 border-green-200",
  BORDERLINE: "bg-amber-50 text-amber-700 border-amber-200",
  "LONG SHOT": "bg-orange-50 text-orange-700 border-orange-200",
  "ABSOLUTELY COOKED": "bg-red-50 text-red-700 border-red-200",
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 45) return "text-amber-500";
  if (score >= 25) return "text-orange-500";
  return "text-red-600";
}

export function EmploymentAura({ result }: Props) {
  const [display, setDisplay] = useState(0);

  // Count-up animation for the aura score.
  useEffect(() => {
    const target = result.overallScore;
    if (target === 0) {
      setDisplay(0);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result.overallScore]);

  return (
    <section className="card">
      <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
        {/* Employment Aura — the big number */}
        <div className="flex flex-col items-center sm:pr-8 sm:border-r sm:border-zinc-100">
          <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
            Employment Aura
          </p>
          <p className={`mt-2 text-6xl font-bold tabular-nums ${scoreColor(result.overallScore)}`}>
            {display}
          </p>
          <p className="text-xs text-zinc-400 mt-1">out of 100</p>
        </div>

        {/* Selection chance + verdict */}
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              Estimated Selection Chance
            </p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${scoreColor(result.selectionChance)}`}>
              {result.selectionChance}%
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              An estimate, not a prophecy.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Verdict</p>
            <span
              className={`inline-block mt-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border ${
                VERDICT_BADGE[result.verdict] ?? VERDICT_BADGE.BORDERLINE
              }`}
            >
              {result.verdict}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
