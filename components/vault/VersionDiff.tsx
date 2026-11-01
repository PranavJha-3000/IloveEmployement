"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildResumeDiff, type DiffRow, type ResumeDiff, type WordSegment } from "@/lib/diff";
import type { ResumeVersion } from "@/lib/vault/versions";

const BIG_LINES = 2000;
const lineCount = (t: string) => t.split("\n").length;

function Segments({ parts }: { parts: WordSegment[] }) {
  return (
    <>
      {parts.map((s, i) => (s.changed ? <span key={i} className="diff-mark">{s.text}</span> : <span key={i}>{s.text}</span>))}
    </>
  );
}

function Line({ kind, children, change }: { kind: "add" | "del" | "ctx"; children: ReactNode; change?: number }) {
  const gutter = kind === "add" ? "+" : kind === "del" ? "−" : "";
  const prefix = kind === "add" ? "Added: " : kind === "del" ? "Removed: " : "";
  return (
    <li className={`diff-line diff-${kind}`} data-change={change} tabIndex={change !== undefined ? -1 : undefined}>
      <span className="diff-gutter" aria-hidden="true">
        {gutter}
      </span>
      <span>
        {prefix && <span className="sr-only">{prefix}</span>}
        {children}
      </span>
    </li>
  );
}

export function VersionDiff({ from, to, onClose }: { from: ResumeVersion; to: ResumeVersion; onClose: () => void }) {
  const missing = !from.text.trim() || !to.text.trim();
  const big = lineCount(from.text) > BIG_LINES || lineCount(to.text) > BIG_LINES;
  const small = useMemo<ResumeDiff | null>(() => (missing || big ? null : buildResumeDiff(from.text, to.text)), [from.text, to.text, missing, big]);
  const [deferred, setDeferred] = useState<ResumeDiff | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(-1);
  const bodyRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setDeferred(null);
    setExpanded(new Set());
    setCursor(-1);
    if (missing || !big) return;
    const id = requestAnimationFrame(() => setDeferred(buildResumeDiff(from.text, to.text)));
    return () => cancelAnimationFrame(id);
  }, [from.text, to.text, missing, big]);

  const diff = small ?? deferred;

  function go(step: 1 | -1) {
    if (!diff || diff.changeCount === 0) return;
    const next = (cursor + step + diff.changeCount) % diff.changeCount;
    setCursor(next);
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-change="${next}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  }

  function renderRow(row: DiffRow, i: number) {
    switch (row.type) {
      case "context":
        return (
          <Line key={i} kind="ctx">
            {row.text}
          </Line>
        );
      case "added":
        return (
          <Line key={i} kind="add" change={row.changeIndex}>
            {row.text}
          </Line>
        );
      case "removed":
        return (
          <Line key={i} kind="del" change={row.changeIndex}>
            {row.text}
          </Line>
        );
      case "changed":
        return (
          <li key={i} style={{ listStyle: "none" }}>
            <ul role="group" aria-label="Changed line" className="m-0 list-none p-0" data-change={row.changeIndex} tabIndex={-1}>
              <Line kind="del">
                <Segments parts={row.from} />
              </Line>
              <Line kind="add">
                <Segments parts={row.to} />
              </Line>
            </ul>
          </li>
        );
      case "collapsed":
        return expanded.has(i) ? (
          <li key={i} style={{ listStyle: "none" }}>
            <ul className="m-0 list-none p-0">
              {row.lines.map((t, k) => (
                <Line key={k} kind="ctx">
                  {t}
                </Line>
              ))}
            </ul>
          </li>
        ) : (
          <li key={i} style={{ listStyle: "none" }}>
            <button
              type="button"
              className="review-textbtn w-full border-y border-[var(--rule)] bg-[var(--mist)] text-center"
              aria-expanded={false}
              onClick={() => setExpanded((s) => new Set(s).add(i))}
            >
              Show {row.count} unchanged lines
            </button>
          </li>
        );
    }
  }

  return (
    <section className="rounded-xl border border-[var(--rule)]" aria-label="Version comparison">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] bg-[var(--mist)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-zinc-900">
            Comparing {from.label} → {to.label}
          </p>
          {diff && (
            <p role="status" className="text-[13px] text-[var(--slate)]">
              {diff.counts.added} added · {diff.counts.removed} removed · {diff.counts.changed} changed
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cta-secondary" style={{ minHeight: 44 }} disabled={!diff || diff.changeCount === 0} onClick={() => go(-1)}>
            Previous change
          </button>
          <button type="button" className="cta-secondary" style={{ minHeight: 44 }} disabled={!diff || diff.changeCount === 0} onClick={() => go(1)}>
            Next change
          </button>
          <button type="button" className="cta-secondary" style={{ minHeight: 44 }} onClick={onClose}>
            Close diff
          </button>
        </div>
      </div>
      <div className="p-4">
        {missing ? (
          <p className="form-error" role="alert">
            One of these versions has no text to compare.
          </p>
        ) : !diff ? (
          <p role="status" className="text-[13px] text-[var(--slate)]">
            Comparing…
          </p>
        ) : diff.identical ? (
          <p className="text-[14px] text-zinc-800">These two versions are identical.</p>
        ) : (
          <ul ref={bodyRef} className="diff">
            {diff.rows.map(renderRow)}
          </ul>
        )}
      </div>
    </section>
  );
}
