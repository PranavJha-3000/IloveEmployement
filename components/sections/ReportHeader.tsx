"use client";
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { DESPERATION_LEVELS } from "@/lib/prompts";
interface Props { result: AnalysisResult; desperationLevel?: number; }
function gc(score: number): string { if (score >= 70) return "text-green-700"; if (score >= 45) return "text-amber-600"; if (score >= 25) return "text-orange-500"; return "text-red-600"; }
export function ReportHeader({ result, desperationLevel }: Props) {
  const [display, setDisplay] = useState(0);
  useEffect(() => { const target = result.selectionChance; if (target === 0) { setDisplay(0); return; } const duration = 900; const start = performance.now(); let raf = 0; function tick(now: number) { const t = Math.min(1, (now - start) / duration); const eased = 1 - Math.pow(1 - t, 3); setDisplay(Math.round(eased * target)); if (t < 1) raf = requestAnimationFrame(tick); } raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [result.selectionChance]);
  const desp = desperationLevel != null ? DESPERATION_LEVELS[Math.min(5, Math.max(0, desperationLevel))] : null;
  return (
    <div className="card text-center py-10 sm:py-14">
      <p className="text-xs uppercase tracking-widest text-zinc-400">Your Employment Report</p>
      <p className={"mt-6 text-7xl sm:text-8xl font-bold tabular-nums " + gc(result.selectionChance)}>{display}%</p>
      <p className="mt-2 text-lg text-zinc-500">Estimated selection chance</p>
      {result.selectionChanceExplanation && <p className="mt-4 text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">{result.selectionChanceExplanation}</p>}
      <p className="mt-6 text-xs text-zinc-400 italic">Not a prophecy. Just an AI reading your career lore.</p>
      {desp && <div className="mt-5 flex justify-center"><span className="pill">Desperation: {desp.level}/5 - {desp.label}</span></div>}
    </div>
  );
}
