"use client";
import type { AnalysisResult, EvidenceItem } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

/** Pick the single most damaging finding, from fatal gaps down to weak evidence. */
function findBiggestGap(result: AnalysisResult): EvidenceItem | null {
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

export function FitAnalysis({ result }: Props) {
  const biggestGap = findBiggestGap(result);

  return (
    <section className="card">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Why you should apply */}
        <div>
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Why you should apply
          </h3>
          {result.strengths.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400 italic">No standout strengths detected.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {result.strengths.slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="text-green-500 mt-0.5 flex-shrink-0" aria-hidden>
                    +
                  </span>
                  <p className="text-sm text-zinc-700 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Why you shouldn't */}
        <div className="md:border-l md:border-zinc-100 md:pl-8">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Why you shouldn&apos;t
          </h3>
          {result.weaknesses.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400 italic">Nothing major holding you back.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {result.weaknesses.slice(0, 3).map((w, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="text-red-400 mt-0.5 flex-shrink-0" aria-hidden>
                    &ndash;
                  </span>
                  <p className="text-sm text-zinc-700 leading-relaxed">{w.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Reality check */}
      <div className="mt-8 pt-6 border-t border-zinc-100">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
          Reality check
        </h3>
        <p className="mt-3 text-sm text-zinc-700 leading-relaxed">{result.summary}</p>
      </div>

      {/* Biggest gap */}
      {biggestGap && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider">
            Biggest gap
          </h3>
          <p className="mt-2 text-sm text-red-900 leading-relaxed">{biggestGap.text}</p>
          {biggestGap.area && (
            <p className="mt-1.5 text-xs text-red-700">
              Area: <span className="font-medium">{biggestGap.area}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}