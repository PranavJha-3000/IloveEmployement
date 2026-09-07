"use client";
import type { ResumeFixResult } from "@/lib/types";

interface Props {
  result: ResumeFixResult;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Strong resume";
  if (score >= 60) return "Decent, needs polish";
  if (score >= 40) return "Several issues to fix";
  return "Needs significant work";
}

export function ResumeHealth({ result }: Props) {
  return (
    <section className="card text-center">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        Resume Health
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        How your resume is doing overall.
      </p>
      <div
        className={`mt-4 text-6xl font-bold tracking-tight ${getScoreColor(result.healthScore)}`}
      >
        {result.healthScore}
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        {getScoreLabel(result.healthScore)}
      </p>
      <div className="mt-3 mx-auto w-full max-w-xs h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            result.healthScore >= 75
              ? "bg-green-500"
              : result.healthScore >= 50
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
          style={{ width: `${result.healthScore}%` }}
        />
      </div>
    </section>
  );
}
