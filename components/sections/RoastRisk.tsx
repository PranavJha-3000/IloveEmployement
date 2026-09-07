"use client";
import type { ResumeRoastResult, RoastRiskLevel } from "@/lib/types";

interface Props {
  result: ResumeRoastResult;
}

const RISK_STYLE: Record<RoastRiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HIGH: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

export function RoastRisk({ result }: Props) {
  const risk = RISK_STYLE[result.recruiterSkipRisk] ?? RISK_STYLE.MEDIUM;

  return (
    <section className="card">
      {/* Recruiter skip risk */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
          Recruiter Skip Risk
        </h3>
        <span
          className={`inline-block mt-3 text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-md border ${risk.bg} ${risk.text} ${risk.border}`}
        >
          {result.recruiterSkipRisk}
        </span>
        {result.recruiterSkipWhy && (
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{result.recruiterSkipWhy}</p>
        )}
      </div>

      {/* Bullets that need help */}
      {result.bulletsThatNeedHelp.length > 0 && (
        <div className="mt-8 pt-6 border-t border-zinc-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Bullets That Need Help
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Original bullet, then a sharper rewrite using only facts already in it.
          </p>
          <div className="mt-4 space-y-4">
            {result.bulletsThatNeedHelp.slice(0, 5).map((b, i) => (
              <div key={i} className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">
                    Bad
                  </p>
                  <p className="text-sm text-zinc-600 leading-relaxed">{b.original}</p>
                </div>
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">
                    Better
                  </p>
                  <p className="text-sm text-zinc-800 leading-relaxed">{b.better}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}