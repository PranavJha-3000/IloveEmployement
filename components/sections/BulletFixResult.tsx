"use client";
import { useState } from "react";
import type { BulletFixResult } from "@/lib/types";

interface Props {
  result: BulletFixResult;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-zinc-500 w-20">{label}</span>
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            value >= 75 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-bold text-zinc-600 w-8 text-right">{value}</span>
    </div>
  );
}

export function BulletFixResultView({ result }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable - no-op */
    }
  }

  return (
    <div className="space-y-4">
      {/* Original vs Improved vs Stronger */}
      <section className="card">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
          Original vs Improved
        </h3>
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Original
            </p>
            <p className="text-sm text-zinc-600 leading-relaxed">{result.original}</p>
          </div>
          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">
                Improved
              </p>
              <button
                onClick={() => handleCopy(result.improved, "improved")}
                className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {copied === "improved" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-sm text-zinc-800 leading-relaxed">{result.improved}</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Stronger
              </p>
              <button
                onClick={() => handleCopy(result.stronger, "stronger")}
                className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {copied === "stronger" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-sm text-zinc-800 leading-relaxed">{result.stronger}</p>
          </div>
        </div>
      </section>

      {/* Why It's Better */}
      {result.whyBetter.length > 0 && (
        <section className="card">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Why It's Better
          </h3>
          <ul className="mt-3 space-y-1.5">
            {result.whyBetter.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="text-green-500 mt-0.5">+</span>
                {point}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Metric placeholder */}
      {result.metricPlaceholder && (
        <section className="card">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Missing Metric
          </h3>
          <p className="mt-2 text-sm text-zinc-500">{result.metricPlaceholder}</p>
        </section>
      )}

      {/* Bullet Score */}
      <section className="card">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
          Bullet Score
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Scored on the original bullet.
        </p>
        <div className="mt-4">
          <div className="text-center mb-4">
            <span className={`text-4xl font-bold ${getScoreColor(result.overallScore)}`}>
              {result.overallScore}
            </span>
            <p className="text-xs text-zinc-400 mt-1">Overall</p>
          </div>
          <div className="space-y-2">
            <ScoreBar label="Clarity" value={result.bulletScore.clarity} />
            <ScoreBar label="Specificity" value={result.bulletScore.specificity} />
            <ScoreBar label="Impact" value={result.bulletScore.impact} />
            <ScoreBar label="Relevance" value={result.bulletScore.relevance} />
          </div>
        </div>
      </section>

      {/* Roast */}
      {result.roast && (
        <section className="card text-center">
          <p className="text-sm text-zinc-500 italic">{result.roast}</p>
        </section>
      )}
    </div>
  );
}