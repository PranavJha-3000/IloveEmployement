"use client";
import type { ResumeRoastResult } from "@/lib/types";

interface Props {
  result: ResumeRoastResult;
}

export function RoastAnalysis({ result }: Props) {
  return (
    <section className="card">
      {/* Biggest L / Biggest W */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-red-800">Biggest L</h3>
          <p className="mt-2 text-sm text-red-900 leading-relaxed">{result.biggestL}</p>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-green-800">Biggest W</h3>
          <p className="mt-2 text-sm text-green-900 leading-relaxed">{result.biggestW}</p>
        </div>
      </div>

      {/* NPC content */}
      {result.npcContent.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            NPC Content
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Generic phrases that say almost nothing. Recruiters read past them on autopilot.
          </p>
          <ul className="mt-3 space-y-2.5">
            {result.npcContent.map((n, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-zinc-300 mt-0.5 flex-shrink-0" aria-hidden>
                  &ndash;
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-800">&ldquo;{n.phrase}&rdquo;</p>
                  {n.why && (
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{n.why}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Buried gold */}
      {result.buriedGold.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Buried Gold
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Real content in your resume that deserves way more spotlight.
          </p>
          <ul className="mt-3 space-y-2.5">
            {result.buriedGold.map((g, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-amber-500 mt-0.5 flex-shrink-0" aria-hidden>
                  &#9733;
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-800">{g.item}</p>
                  {g.reason && (
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{g.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}