"use client";
import type { EvidenceStrength } from "@/lib/evidence";
import { CopyButton } from "./CopyButton";

const STRENGTH_LABELS: Record<EvidenceStrength, { label: string; color: string; bg: string; border: string }> =
  {
    STRONG: { label: "STRONG", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    PARTIAL: { label: "PARTIAL", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    MISSING: { label: "MISSING", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    UNVERIFIED: { label: "UNVERIFIED", color: "text-zinc-700", bg: "bg-zinc-50", border: "border-zinc-200" },
  };

export interface EvidenceRow {
  requirement: string;
  classification: EvidenceStrength;
  evidence: string;
  reasoning: string;
}

interface Props {
  rows: EvidenceRow[];
  showCopy?: boolean;
  className?: string;
}

/**
 * Evidence table — displays evidence classifications for JD requirements.
 * Shows STRONG / PARTIAL / MISSING / UNVERIFIED with evidence snippets.
 */
export function EvidenceTable({ rows, showCopy = true, className }: Props) {
  const copyText = rows
    .map((r) => `${r.classification}: ${r.requirement}\nEvidence: ${r.evidence}\nReasoning: ${r.reasoning}`)
    .join("\n\n");

  return (
    <div className={`space-y-2 ${className || ""}`}>
      {rows.map((row, i) => {
        const style = STRENGTH_LABELS[row.classification];
        return (
          <div
            key={i}
            className={`border rounded-md p-3 ${style.bg} ${style.border}`}
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <p className="font-semibold text-sm text-zinc-900">
                <span className="text-zinc-400 mr-1">{i + 1}.</span>
                {row.requirement}
              </p>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${style.color} ${style.bg} border ${style.border}`}
              >
                {style.label}
              </span>
            </div>
            {row.evidence && (
              <p className="text-xs text-zinc-600 mb-1">
                <span className="font-semibold">Evidence:</span> {row.evidence}
              </p>
            )}
            {row.reasoning && (
              <p className="text-xs text-zinc-500">
                <span className="font-semibold">Why:</span> {row.reasoning}
              </p>
            )}
            {showCopy && (
              <div className="mt-2">
                <CopyButton
                  text={`${row.classification}: ${row.requirement}\nEvidence: ${row.evidence}\nReasoning: ${row.reasoning}`}
                  label="Copy"
                />
              </div>
            )}
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="text-sm text-zinc-500">No evidence rows available.</p>
      )}
    </div>
  );
}
