"use client";
import type { AtsCheckResult, AtsFormatStatus } from "@/lib/types";

interface Props {
  result: AtsCheckResult;
}

const STATUS_STYLE: Record<AtsFormatStatus, { label: string; cls: string }> = {
  pass: { label: "Pass", cls: "bg-green-50 text-green-700 border-green-200" },
  warning: { label: "Warning", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  fail: { label: "Fail", cls: "bg-red-50 text-red-700 border-red-200" },
};

export function FormatCheck({ result }: Props) {
  if (result.formatChecks.length === 0) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
        Format Check
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        How reliably an ATS can parse your layout and structure.
      </p>
      <ul className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-3">
        {result.formatChecks.map((item, i) => {
          const s = STATUS_STYLE[item.status] ?? STATUS_STYLE.warning;
          return (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-block flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${s.cls}`}
              >
                {s.label}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-800 leading-snug">{item.check}</p>
                {item.detail && (
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{item.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}