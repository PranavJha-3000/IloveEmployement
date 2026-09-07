"use client";
import type { AnalysisResult, EvidenceItem, EvidenceLevel } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

const EVIDENCE_BADGE: Record<EvidenceLevel, { label: string; cls: string }> = {
  strong: { label: "Strong evidence", cls: "bg-green-50 text-green-700 border-green-200" },
  weak: { label: "Weak evidence", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  none: { label: "No evidence", cls: "bg-red-50 text-red-700 border-red-200" },
};

function EvidenceList({ items, emptyText }: { items: EvidenceItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-400 italic">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.slice(0, 5).map((item, i) => {
        const badge = EVIDENCE_BADGE[item.evidence] ?? EVIDENCE_BADGE.weak;
        return (
          <li key={i} className="flex gap-2.5">
            <span className="text-zinc-300 mt-0.5 flex-shrink-0" aria-hidden>
              &ndash;
            </span>
            <div>
              <p className="text-sm text-zinc-700 leading-relaxed">{item.text}</p>
              <span
                className={`inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${badge.cls}`}
              >
                {badge.label}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MatchAnalysis({ result }: Props) {
  return (
    <section className="card">
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Why you match
          </h3>
          <div className="mt-3">
            <EvidenceList
              items={result.strengths}
              emptyText="No real strengths detected. Brutal."
            />
          </div>
        </div>
        <div className="md:border-l md:border-zinc-100 md:pl-8">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Why you&apos;re getting cooked
          </h3>
          <div className="mt-3">
            <EvidenceList
              items={result.weaknesses}
              emptyText="Nothing holding you back. Suspicious."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
