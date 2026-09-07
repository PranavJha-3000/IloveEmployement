"use client";
import type { ResumeRoastResult } from "@/lib/types";

interface Props {
  result: ResumeRoastResult;
}

function levelColor(level: number): string {
  if (level >= 70) return "text-red-600";
  if (level >= 31) return "text-amber-500";
  return "text-green-600";
}

function levelLabel(level: number): { band: string; cls: string } {
  if (level >= 70)
    return { band: "Actively sabotaged", cls: "bg-red-50 text-red-700 border-red-200" };
  if (level >= 31)
    return { band: "Needs real work", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { band: "Mostly fine", cls: "bg-green-50 text-green-700 border-green-200" };
}

export function RoastLevel({ result }: Props) {
  const label = levelLabel(result.roastLevel);
  return (
    <section className="card text-center">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
        Roast Level
      </p>
      <p className={`mt-2 text-7xl sm:text-8xl font-bold tabular-nums ${levelColor(result.roastLevel)}`}>
        {result.roastLevel}
      </p>
      <p className="text-xs text-zinc-400 mt-1">out of 100 &middot; how hard the rewrite needs to hit</p>
      <div className="mt-4 flex justify-center">
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-md border ${label.cls}`}>
          {label.band}
        </span>
      </div>

      {result.verdict && (
        <div className="mt-6 pt-6 border-t border-zinc-100">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
            The Verdict
          </p>
          <p className="mt-2 text-lg sm:text-xl font-bold text-zinc-900 max-w-2xl mx-auto leading-snug">
            &ldquo;{result.verdict}&rdquo;
          </p>
        </div>
      )}
    </section>
  );
}