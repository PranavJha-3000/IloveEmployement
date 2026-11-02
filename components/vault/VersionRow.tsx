"use client";

import { useEffect, useRef } from "react";
import { versionSubtitle } from "@/lib/vault/versionList";
import type { ResumeVersion } from "@/lib/vault/versions";

function safeHttp(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function formatDate(ms: number): { text: string; iso: string } {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return { text: "", iso: "" };
  return { text: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), iso: d.toISOString() };
}

interface Props {
  version: ResumeVersion;
  selected: boolean;
  /** Two other versions are already selected. */
  compareDisabled: boolean;
  expanded: boolean;
  hasBase: boolean;
  deleting: boolean;
  onToggleExpand: () => void;
  onToggleCompare: () => void;
  onCompareWithBase: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

export function VersionRow(p: Props) {
  const v = p.version;
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (p.deleting) keepRef.current?.focus();
  }, [p.deleting]);
  const url = safeHttp(v.job?.url);
  const date = formatDate(v.createdAt);
  const textId = `version-text-${v.id}`;
  const checkId = `version-compare-${v.id}`;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="line-clamp-2 min-w-0 text-[15px] font-semibold text-zinc-900 min-[520px]:truncate">{v.label}</p>
        <span className="badge badge-neutral">{v.kind === "base" ? "Base" : "Tailored"}</span>
      </div>
      <p className="mt-1 text-[13px] font-normal text-[var(--slate)]">
        {versionSubtitle(v)}
        {url && (
          <>
            {" · "}
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
              View posting
            </a>
          </>
        )}
      </p>
      <p className="mt-0.5 text-[13px] font-normal text-[var(--slate)]">
        {date.text && <time dateTime={date.iso}>{date.text}</time>}
        {v.origin === "agent" && <span>{date.text ? " · " : ""}Created by the application workflow</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" className="review-textbtn" aria-expanded={p.expanded} aria-controls={textId} onClick={p.onToggleExpand}>
          {p.expanded ? "Hide text" : "View text"}
        </button>
        <label htmlFor={checkId} className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-2 text-[13px] font-semibold text-zinc-700">
          <input id={checkId} type="checkbox" checked={p.selected} disabled={p.compareDisabled && !p.selected} onChange={p.onToggleCompare} />
          Compare
        </label>
        {v.kind === "tailored" && p.hasBase && (
          <button type="button" className="review-textbtn" onClick={p.onCompareWithBase}>
            Compare with base
          </button>
        )}
        {!p.deleting && (
          <button type="button" className="review-textbtn" onClick={p.onAskDelete}>
            Delete version
          </button>
        )}
      </div>
      {p.expanded && (
        <pre id={textId} className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--rule)] bg-[var(--mist)] p-3 text-[13px] text-zinc-800">
          {v.text}
        </pre>
      )}
      {p.deleting && (
        <div className="review-inline-confirm mt-2" role="group" aria-label="Delete version">
          <p>Delete this resume version from your vault? Other versions aren&apos;t affected. This can&apos;t be undone.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" ref={keepRef} className="cta-secondary review-btn" onClick={p.onCancelDelete}>
              Keep version
            </button>
            <button type="button" className="cta-secondary review-btn review-btn-danger" onClick={p.onDelete}>
              Delete version
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
