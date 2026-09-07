"use client";
import type { AtsCheckResult } from "@/lib/types";

interface Props {
  result: AtsCheckResult;
  /** Whether a job description was provided (controls visibility). */
  hasJobDescription: boolean;
}

export function JobMatch({ result, hasJobDescription }: Props) {
  if (!hasJobDescription) return null;

  const hasMatched = result.matchedKeywords.length > 0;
  const hasMissing = result.missingKeywords.length > 0;
  const hasPartial = result.partialMatches.length > 0;
  const hasNoEvidence = result.requirementsNoEvidence.length > 0;
  const isEmpty = !hasMatched && !hasMissing && !hasPartial && !hasNoEvidence;
  if (isEmpty) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
        Job Match
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        Keyword alignment between your resume and the job description.
      </p>

      <div className="mt-4 grid lg:grid-cols-2 gap-8">
        {/* Matched */}
        {hasMatched && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-green-700">
              Matched keywords
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.matchedKeywords.map((k, i) => (
                <span key={i} className="inline-block text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-2 py-1">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing */}
        {hasMissing && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-700">
              Missing keywords
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.missingKeywords.map((k, i) => (
                <span key={i} className="inline-block text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-2 py-1">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Partially matched concepts */}
      {hasPartial && (
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Partially matched concepts
          </h4>
          <ul className="mt-2 space-y-2">
            {result.partialMatches.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-zinc-300 mt-0.5 flex-shrink-0" aria-hidden>
                  &ndash;
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-800">{p.concept}</p>
                  {p.evidence && (
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{p.evidence}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Requirements with no evidence */}
      {hasNoEvidence && (
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Important JD requirements with no resume evidence
          </h4>
          <ul className="mt-2 space-y-2">
            {result.requirementsNoEvidence.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-red-400 mt-0.5 flex-shrink-0" aria-hidden>
                  &ndash;
                </span>
                <p className="text-sm text-zinc-700 leading-relaxed">{r}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-400">
            Don&apos;t add keywords you can&apos;t back up. Prove the skill with real evidence first.
          </p>
        </div>
      )}
    </section>
  );
}