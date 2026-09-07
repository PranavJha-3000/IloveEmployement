"use client";
import type { AnalysisResult, EvidenceItem } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

/** Pick the single most damaging finding, from fatal gaps down to weak evidence. */
function findBiggestProblem(result: AnalysisResult): EvidenceItem | null {
  const fatalHigh =
    result.fatalGaps.find((g) => g.importance === "high") ?? result.fatalGaps[0];
  if (fatalHigh) return fatalHigh;
  const missingHigh = result.weaknesses.find(
    (w) => w.importance === "high" && w.evidence === "none"
  );
  if (missingHigh) return missingHigh;
  const missing = result.weaknesses.find((w) => w.evidence === "none");
  if (missing) return missing;
  return result.weaknesses[0] ?? null;
}

export function BiggestProblem({ result }: Props) {
  const problem = findBiggestProblem(result);

  if (!problem) {
    return (
      <section className="card border-l-4 border-l-green-500">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
          Biggest problem
        </h3>
        <p className="mt-3 text-sm text-zinc-700 leading-relaxed">
          No critical problem detected. Either your resume is genuinely strong, or the JD is
          too vague to fail you. Either way, read the summary above before celebrating.
        </p>
      </section>
    );
  }

  return (
    <section className="card border-l-4 border-l-red-500">
      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
        Biggest problem
      </h3>
      <p className="mt-3 text-sm text-zinc-700 leading-relaxed">{problem.text}</p>
      {problem.area && (
        <p className="mt-2.5 text-xs text-zinc-400">
          Area: <span className="font-medium text-zinc-600">{problem.area}</span>
        </p>
      )}
    </section>
  );
}
