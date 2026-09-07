"use client";
import type { AtsCheckResult } from "@/lib/types";

interface Props {
  result: AtsCheckResult;
}

export function AtsFixes({ result }: Props) {
  if (result.topFixes.length === 0) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
        Fix these first
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        Ranked by impact on ATS parseability and matching.
      </p>
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

      {result.bossFightComment && (
        <div className="mt-6 pt-5 border-t border-zinc-100">
          <p className="text-xs text-red-600 font-semibold uppercase tracking-widest">
            ATS Boss Fight
          </p>
          <p className="mt-2 text-sm text-zinc-700 italic leading-relaxed">
            &ldquo;{result.bossFightComment}&rdquo;
          </p>
        </div>
      )}
    </section>
  );
}