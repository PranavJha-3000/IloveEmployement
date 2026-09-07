"use client";
import type { AnalysisResult, Verdict } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

type ApplyVerdict = "YES" | "MAYBE" | "NO";

interface ApplyInfo {
  verdict: ApplyVerdict;
  microcopy: string;
  bg: string;
  text: string;
  border: string;
}

/** Map the analysis verdict to a "should you spend 20 minutes applying" answer. */
function getApplyInfo(verdict: Verdict): ApplyInfo {
  if (verdict === "APPLY") {
    return {
      verdict: "YES",
      microcopy: "Send it. We have rizz.",
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    };
  }
  if (verdict === "BORDERLINE") {
    return {
      verdict: "MAYBE",
      microcopy: "Not cooked. Lock in.",
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    };
  }
  return {
    verdict: "NO",
    microcopy: "Respectfully, this one is looking rough.",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  };
}

export function ShouldApply({ result }: Props) {
  const info = getApplyInfo(result.verdict);

  return (
    <section className="card text-center">
      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
        Should you spend 20 minutes applying?
      </h3>
      <p
        className={`mt-4 inline-block text-3xl font-bold uppercase tracking-wider px-6 py-3 rounded-lg border ${info.bg} ${info.text} ${info.border}`}
      >
        {info.verdict}
      </p>
      <p className="mt-3 text-sm text-zinc-500 italic">{info.microcopy}</p>
      <p className="mt-4 text-xs text-zinc-400">Backed by your resume, not vibes.</p>
    </section>
  );
}