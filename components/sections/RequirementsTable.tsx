"use client";
import { useMemo } from "react";
import type { AnalysisResult, EvidenceItem, ImportanceLevel } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

type ReqStatus = "Strong" | "Partial" | "Missing";

interface RequirementRow {
  requirement: string;
  importance: ImportanceLevel;
  evidence: string;
  status: ReqStatus;
}

const STATUS_STYLES: Record<ReqStatus, string> = {
  Strong: "bg-green-50 text-green-700 border-green-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
  Missing: "bg-red-50 text-red-700 border-red-200",
};

const IMPORTANCE_LABEL: Record<ImportanceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Build requirement rows from strengths (Strong) and weaknesses (Partial / Missing). */
function buildRows(result: AnalysisResult): RequirementRow[] {
  const rows: RequirementRow[] = [];
  const seen = new Set<string>();

  const push = (
    item: EvidenceItem,
    status: ReqStatus,
    fallbackImportance: ImportanceLevel
  ) => {
    const requirement = item.area?.trim();
    if (!requirement || seen.has(requirement.toLowerCase())) return;
    seen.add(requirement.toLowerCase());
    rows.push({
      requirement,
      importance: item.importance ?? fallbackImportance,
      evidence: item.text,
      status,
    });
  };

  for (const s of result.strengths) push(s, "Strong", "medium");
  for (const w of result.weaknesses) {
    if (w.evidence === "none") push(w, "Missing", "high");
    else if (w.evidence === "weak") push(w, "Partial", "medium");
  }
  return rows;
}

export function RequirementsTable({ result }: Props) {
  const rows = useMemo(() => buildRows(result), [result]);

  if (rows.length === 0) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
        Missing / weak requirements
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        What the JD asks for vs. what your resume proves.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-zinc-200 text-left">
              <th className="py-2 pr-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                Requirement
              </th>
              <th className="py-2 pr-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                JD importance
              </th>
              <th className="py-2 pr-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                Candidate evidence
              </th>
              <th className="py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 align-top">
                <td className="py-3 pr-4 font-medium text-zinc-900 whitespace-nowrap">
                  {row.requirement}
                </td>
                <td className="py-3 pr-4 text-zinc-600 whitespace-nowrap">
                  {IMPORTANCE_LABEL[row.importance]}
                </td>
                <td className="py-3 pr-4 text-zinc-600 leading-relaxed">{row.evidence}</td>
                <td className="py-3">
                  <span
                    className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${STATUS_STYLES[row.status]}`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
