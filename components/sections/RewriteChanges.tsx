"use client";
import type { ResumeRewriteResult } from "@/lib/types";

interface Props {
  result: ResumeRewriteResult;
}

export function RewriteChanges({ result }: Props) {
  if (result.changes.length === 0) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        What Changed
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        Every important change and why it was made.
      </p>
      <div className="mt-4 space-y-4">
        {result.changes.map((c, i) => (
          <div key={i} className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">
              {c.section}
            </p>
            <div className="mt-2 grid sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Original
                </p>
                <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                  {c.original}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">
                  Optimized
                </p>
                <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
                  {c.optimized}
                </p>
              </div>
            </div>
            {c.reason && (
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                <span className="font-semibold text-zinc-600">Reason:</span> {c.reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}