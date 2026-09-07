"use client";
import { useState } from "react";
import type { ResumeFixResult, ResumeIssue } from "@/lib/types";

interface Props {
  result: ResumeFixResult;
}

const SEVERITY_ORDER = ["CRITICAL", "WARNING", "OPTIONAL"];

function severityBadge(severity: string): string {
  if (severity === "CRITICAL") return "bg-red-50 text-red-700 border-red-200";
  if (severity === "WARNING")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function IssueCard({ issue, index }: { issue: ResumeIssue; index: number }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(issue.fix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable - no-op */
    }
  }

  return (
    <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${severityBadge(issue.severity)}`}
        >
          {issue.severity}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          {issue.category}
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Problem
          </p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {issue.problem}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Current
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap bg-white p-2 rounded border border-zinc-100">
            {issue.current}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">
            Fix
          </p>
          <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap bg-green-50 p-2 rounded border border-green-100">
            {issue.fix}
          </p>
        </div>
        {issue.why && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Why
            </p>
            <p className="text-sm text-zinc-500 leading-relaxed">{issue.why}</p>
          </div>
        )}
      </div>
      <button
        onClick={handleCopy}
        className="mt-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        {copied ? "Copied fix" : "Copy fix"}
      </button>
    </div>
  );
}

export function IssueList({ result }: Props) {
  const sorted = [...result.issues].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const critical = sorted.filter((i) => i.severity === "CRITICAL");
  const warning = sorted.filter((i) => i.severity === "WARNING");
  const optional = sorted.filter((i) => i.severity === "OPTIONAL");

  if (sorted.length === 0) {
    return (
      <section className="card">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
          Issues Found
        </h3>
        <p className="mt-2 text-sm text-zinc-500">
          No major issues detected. Your resume looks solid.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        Issues Found
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        {critical.length > 0 && `${critical.length} critical · `}
        {warning.length > 0 && `${warning.length} warning · `}
        {optional.length > 0 && `${optional.length} optional`}
      </p>
      <div className="mt-4 space-y-4">
        {sorted.map((issue, i) => (
          <IssueCard key={i} issue={issue} index={i} />
        ))}
      </div>
    </section>
  );
}
