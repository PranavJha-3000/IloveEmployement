"use client";

export type VerdictType =
  | "APPLY"
  | "BORDERLINE"
  | "LONG SHOT"
  | "ABSOLUTELY COOKED"
  | "STRONG FIT"
  | "WEAK FIT"
  | "RECOMMENDED";

interface Props {
  verdict: VerdictType;
  explanation?: string;
  score?: number;
  className?: string;
}

const VERDICT_STYLES: Record<VerdictType, { bg: string; border: string; text: string; label: string }> = {
  APPLY: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "✦ APPLY" },
  "STRONG FIT": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "✦ STRONG FIT" },
  BORDERLINE: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "BORDERLINE" },
  "WEAK FIT": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "WEAK FIT" },
  "LONG SHOT": { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", label: "LONG SHOT" },
  "ABSOLUTELY COOKED": { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "ABSOLUTELY COOKED" },
  RECOMMENDED: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", label: "✦ RECOMMENDED" },
};

/** Shared verdict badge with optional score and explanation. */
export function VerdictCard({ verdict, explanation, score, className }: Props) {
  const v = verdict in VERDICT_STYLES ? verdict : "BORDERLINE";
  const style = VERDICT_STYLES[v];

  return (
    <div className={`border rounded-lg p-4 ${style.bg} ${style.border} ${className || ""}`}>
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-bold ${style.text} ${style.bg} px-3 py-1 rounded-full border ${style.border}`}
        >
          {style.label}
        </span>
        {score !== undefined && (
          <span className="text-2xl font-bold text-zinc-900">{Math.round(score)}%</span>
        )}
      </div>
      {explanation && (
        <p className="text-sm text-zinc-700 mt-2 leading-relaxed">{explanation}</p>
      )}
    </div>
  );
}
