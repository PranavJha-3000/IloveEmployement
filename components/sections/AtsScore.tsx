"use client";
import { useEffect, useState } from "react";
import type { AtsCheckResult, AtsRiskLevel } from "@/lib/types";

interface Props {
  result: AtsCheckResult;
}

const RISK_STYLE: Record<AtsRiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HIGH: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 45) return "text-amber-500";
  if (score >= 25) return "text-orange-500";
  return "text-red-600";
}

export function AtsScore({ result }: Props) {
  const [display, setDisplay] = useState(0);
  const risk = RISK_STYLE[result.riskLevel] ?? RISK_STYLE.MEDIUM;

  useEffect(() => {
    const target = result.atsScore;
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
  }, [result.atsScore]);

  return (
    <section className="card text-center">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
        ATS Score
      </p>
      <p className={`mt-2 text-7xl sm:text-8xl font-bold tabular-nums ${scoreColor(result.atsScore)}`}>
        {display}
      </p>
      <p className="text-xs text-zinc-400 mt-1">out of 100 &middot; model estimate, not a guarantee</p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <span
          className={`inline-block text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-md border ${risk.bg} ${risk.text} ${risk.border}`}
        >
          ATS Risk: {result.riskLevel}
        </span>
      </div>

      {result.strongResumeNote && (
        <p className="mt-5 text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
          {result.strongResumeNote}
        </p>
      )}
    </section>
  );
}