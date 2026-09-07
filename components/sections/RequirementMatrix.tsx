"use client";
import { useMemo } from "react";
import type { AnalysisResult, EvidenceItem, ImportanceLevel } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

type MatchStatus = "Strong" | "Partial" | "Missing";

interface MatrixRow {
  requirement: string;
  importance: string;
  evidence: string;
  status: MatchStatus;
}

const STATUS_STYLE: Record<MatchStatus, string> = {
  Strong: "bg-green-50 text-green-700 border-green-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
  Missing: "bg-red-50 text-red-700 border-red-200",
};

function importanceLabel(imp?: ImportanceLevel): string {
  if (imp === "high") return "Required";
  if (imp === "medium") return "Preferred";
  if (imp === "low") return "Nice-to-have";
  return "Required";
}

/** Build matrix rows from strengths (Strong) and weaknesses (Partial / Missing). */
function buildMatrix(result: AnalysisResult): MatrixRow[] {
  const rows: MatrixRow[] = [];
  const seen = new Set<string>();

  const push = (item: EvidenceItem, status: MatchStatus) => {
    const req = item.area?.trim();
    if (!req || seen.has(req.toLowerCase())) return;
    seen.add(req.toLowerCase());
    rows.push({
      requirement: req,
      importance: importanceLabel(item.importance),
      evidence: item.text,
      status,
    });
  };

  for (const s of result.strengths) push(s, "Strong");
  for (const w of result.weaknesses) {
    if (w.evidence === "none") push(w, "Missing");
    else if (w.evidence === "weak") push(w, "Partial");
  }
  return rows;
}

export function RequirementMatrix({ result }: Props) {
  const rows = useMemo(() => buildMatrix(result), [result]);
  if (rows.length === 0) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
        Requirement Match
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
                Importance
              </th>
              <th className="py-2 pr-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                Your Evidence
              </th>
              <th className="py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                Match
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 align-top">
                <td className="py-3 pr-4 font-medium text-zinc-900 whitespace-nowrap">
                  {row.requirement}
                </td>
                <td className="py-3 pr-4 text-zinc-600 whitespace-nowrap">{row.importance}</td>
                <td className="py-3 pr-4 text-zinc-600 leading-relaxed">{row.evidence}</td>
                <td className="py-3">
                  <span
                    className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${STATUS_STYLE[row.status]}`}
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