"use client";
import type { ResumeRoastResult } from "@/lib/types";

interface Props {
  result: ResumeRoastResult;
}

export function RoastHumor({ result }: Props) {
  if (result.roast.length === 0 && result.topFixes.length === 0) return null;

  return (
    <section className="card">
      {/* The roast */}
      {result.roast.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">The Roast</h3>
          <ul className="mt-3 space-y-2.5">
            {result.roast.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-red-500 mt-0.5 flex-shrink-0 font-bold" aria-hidden>
                  &#8227;
                </span>
                <p className="text-sm text-zinc-800 italic leading-relaxed">{line}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Okay, jokes over */}
      {result.topFixes.length > 0 && (
        <div className="mt-8 pt-6 border-t border-zinc-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Okay, jokes over.
          </h3>
          <p className="text-xs text-zinc-400 mt-1">Top 5 fixes before applying.</p>
          <ol className="mt-4 space-y-3">
            {result.topFixes.slice(0, 5).map((fix, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-md bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-600 flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-zinc-700 leading-relaxed">{fix}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}