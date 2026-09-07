"use client";
import type { ResumeFixResult } from "@/lib/types";

interface Props {
  result: ResumeFixResult;
}

export function QuickFix({ result }: Props) {
  return (
    <section className="card">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        5-Minute Fix
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        The three highest-impact changes. Do these first.
      </p>
      <div className="mt-4 space-y-3">
        {result.quickFix.map((fix, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 bg-zinc-50 border border-zinc-100 rounded-lg"
          >
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
              {i + 1}
            </span>
            <p className="text-sm text-zinc-700 leading-relaxed">{fix}</p>
          </div>
        ))}
      </div>
      {result.personalityCopy && (
        <p className="mt-4 text-sm text-zinc-500 italic text-center">
          {result.personalityCopy}
        </p>
      )}
    </section>
  );
}
