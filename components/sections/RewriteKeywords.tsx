"use client";
import type { ResumeRewriteResult } from "@/lib/types";

interface Props {
  result: ResumeRewriteResult;
}

export function RewriteKeywords({ result }: Props) {
  const hasMatched = result.keywordCoverage.matched.length > 0;
  const hasMissing = result.keywordCoverage.missing.length > 0;
  if (!hasMatched && !hasMissing) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        Keyword Coverage
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        JD keywords present vs. missing. Missing keywords were NOT inserted — you have no evidence for them.
      </p>
      <div className="mt-4 grid sm:grid-cols-2 gap-6">
        {hasMatched && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-green-700">
              Matched keywords
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.keywordCoverage.matched.map((k, i) => (
                <span key={i} className="inline-block text-xs font-medium text-zinc-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
        {hasMissing && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-700">
              Missing legitimate keywords
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.keywordCoverage.missing.map((k, i) => (
                <span key={i} className="inline-block text-xs font-medium text-zinc-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {k}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              These were not added because your resume shows no evidence for them.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}