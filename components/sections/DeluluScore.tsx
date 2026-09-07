"use client";
import type { DeluluCheckResult, DeluluVerdict } from "@/lib/types";

interface Props {
  result: DeluluCheckResult;
}

const VERDICT_META: Record<
  DeluluVerdict,
  { label: string; cls: string; expl: string }
> = {
  APPLY: {
    label: "Apply",
    cls: "bg-green-50 text-green-700 border-green-200",
    expl: "Strong fit. Apply now.",
  },
  APPLY_AS_A_STRETCH: {
    label: "Apply As A Stretch",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    expl: "Possible but uncertain. Apply strategically.",
  },
  BUILD_MORE_EVIDENCE_FIRST: {
    label: "Build More Evidence First",
    cls: "bg-orange-50 text-orange-700 border-orange-200",
    expl: "Real gaps exist. Close them before applying.",
  },
  LOW_PROBABILITY: {
    label: "Low Probability",
    cls: "bg-red-50 text-red-700 border-red-200",
    expl: "Severe mismatch right now.",
  },
};

function scoreColor(score: number): string {
  if (score <= 20) return "text-green-600";
  if (score <= 40) return "text-amber-500";
  if (score <= 60) return "text-orange-500";
  if (score <= 80) return "text-red-400";
  return "text-red-600";
}

export function DeluluScore({ result }: Props) {
  const v = VERDICT_META[result.verdict] ?? VERDICT_META.BUILD_MORE_EVIDENCE_FIRST;
  return (
    <section className="card text-center">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
        Delulu Score
      </p>
      <p className={`mt-2 text-7xl sm:text-8xl font-bold tabular-nums ${scoreColor(result.deluluScore)}`}>
        {result.deluluScore}
      </p>
      <p className="text-xs text-zinc-400 mt-1">out of 100 &middot; gap between you and the JD</p>
      <div className="mt-4 flex justify-center">
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-md border ${v.cls}`}>
          {result.interpretation || v.label}
        </span>
      </div>

      <div className="mt-6 pt-6 border-t border-zinc-100">
        <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
          The Verdict
        </p>
        <span className={`inline-block mt-2 text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-md border ${v.cls}`}>
          {v.label}
        </span>
        <p className="mt-3 text-sm text-zinc-600">{v.expl}</p>
      </div>
    </section>
  );
}