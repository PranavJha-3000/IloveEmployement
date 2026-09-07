"use client";
import type { DeluluCheckResult } from "@/lib/types";

interface Props {
  result: DeluluCheckResult;
}

export function DeluluPlan({ result }: Props) {
  if (result.howToBecomeLessDelulu.length === 0) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        How To Become Less Delulu
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        Concrete improvements before you apply.
      </p>
      <ol className="mt-4 space-y-3">
        {result.howToBecomeLessDelulu.slice(0, 5).map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-md bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-600 flex items-center justify-center">
              {i + 1}
            </span>
            <p className="text-sm text-zinc-700 leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>

      {result.finalLine && (
        <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
          <p className="text-sm text-zinc-700 italic leading-relaxed">
            &ldquo;{result.finalLine}&rdquo;
          </p>
        </div>
      )}
    </section>
  );
}