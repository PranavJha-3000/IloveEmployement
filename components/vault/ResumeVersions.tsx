"use client";

import { useRef, useState } from "react";
import { deleteResumeVersion } from "@/lib/vault/store";
import {
  compareWithBase,
  filterVersions,
  orderPair,
  toggleCompare,
  versionCounts,
  type VersionFilter,
} from "@/lib/vault/versionList";
import type { ResumeVersion } from "@/lib/vault/versions";
import { VersionDiff } from "./VersionDiff";
import { VersionRow } from "./VersionRow";

interface Props {
  versions: ResumeVersion[];
  loaded: boolean;
  /** A Profile Review panel is open and unconfirmed, so Compare is not the page's primary action. */
  reviewOpen: boolean;
  onChanged: (message: string) => Promise<void> | void;
  onReviewProfile?: () => void;
}

const FILTERS: { id: VersionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "base", label: "Base" },
  { id: "tailored", label: "Tailored" },
];

export function ResumeVersions({ versions, loaded, reviewOpen, onChanged, onReviewProfile }: Props) {
  const [filter, setFilter] = useState<VersionFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const compareBtnRef = useRef<HTMLButtonElement>(null);

  if (!loaded) return null;

  const ids = new Set(versions.map((v) => v.id));
  const fromId = ids.has(from) ? from : "";
  const toId = ids.has(to) ? to : "";
  const selected = [fromId, toId].filter(Boolean);
  const counts = versionCounts(versions);
  const shown = filterVersions(versions, filter);
  const hasBase = counts.base > 0;
  const ready = Boolean(fromId && toId && fromId !== toId);
  const fromV = versions.find((v) => v.id === fromId);
  const toV = versions.find((v) => v.id === toId);

  function select(next: string[]) {
    setDiffOpen(false);
    if (next.length === 2) {
      const p = orderPair(versions, next[0], next[1]);
      setFrom(p.from.id);
      setTo(p.to.id);
    } else {
      setFrom(next[0] ?? "");
      setTo("");
    }
  }

  function clear() {
    setFrom("");
    setTo("");
    setDiffOpen(false);
  }

  async function remove(id: string) {
    await deleteResumeVersion(id);
    setDeletingId(null);
    if (expandedId === id) setExpandedId(null);
    await onChanged("Version deleted.");
  }

  const primaryCls = reviewOpen ? "cta-secondary" : "cta-primary";

  return (
    <section className="rounded-xl border border-zinc-200 p-5" aria-labelledby="resume-versions-heading">
      <h2 id="resume-versions-heading" className="text-[15px] font-bold text-zinc-900">
        Resume versions
      </h2>

      {versions.length === 0 ? (
        <div className="empty mt-3">
          <h3 className="text-[19px] font-bold">No resume versions yet</h3>
          <p>Confirm your profile above to save your base resume. Tailored versions show up here, with the job each one targeted.</p>
          {onReviewProfile && (
            <button type="button" className="cta-secondary" onClick={onReviewProfile}>
              Review your profile
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter versions">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span className="chip-count">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          {selected.length >= 1 && (
            <fieldset className="mt-4 rounded-lg border border-[var(--rule)] p-4">
              <legend className="px-1 text-[13px] font-semibold text-zinc-800">Choose two versions to compare</legend>
              <p className="text-[13px] text-[var(--slate)]">{selected.length} of 2 selected</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="compare-from">
                    From
                  </label>
                  <select
                    id="compare-from"
                    className="field-control"
                    value={fromId}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setDiffOpen(false);
                    }}
                  >
                    <option value="">Choose a version</option>
                    {versions.filter((v) => v.id !== toId).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="compare-to">
                    To
                  </label>
                  <select
                    id="compare-to"
                    className="field-control"
                    value={toId}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setDiffOpen(false);
                    }}
                  >
                    <option value="">Choose a version</option>
                    {versions.filter((v) => v.id !== fromId).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selected.length === 2 && <p className="field-help">You can compare two versions at a time.</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="cta-secondary"
                  style={{ minHeight: 44 }}
                  disabled={!fromId && !toId}
                  onClick={() => {
                    setFrom(toId);
                    setTo(fromId);
                    setDiffOpen(false);
                  }}
                >
                  Swap
                </button>
                <button
                  type="button"
                  ref={compareBtnRef}
                  className={primaryCls}
                  style={{ minHeight: 44 }}
                  aria-disabled={!ready}
                  aria-describedby={ready ? undefined : "compare-help"}
                  onClick={() => ready && setDiffOpen(true)}
                >
                  Compare versions
                </button>
                <button type="button" className="review-textbtn" onClick={clear}>
                  Clear selection
                </button>
              </div>
              {!ready && (
                <p id="compare-help" className="field-help">
                  Select one more version.
                </p>
              )}
            </fieldset>
          )}

          {diffOpen && ready && fromV && toV && (
            <div className="mt-4">
              <VersionDiff
                from={fromV}
                to={toV}
                onClose={() => {
                  setDiffOpen(false);
                  requestAnimationFrame(() => compareBtnRef.current?.focus());
                }}
              />
            </div>
          )}

          <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {shown.map((v) => (
              <VersionRow
                key={v.id}
                version={v}
                selected={selected.includes(v.id)}
                compareDisabled={selected.length >= 2}
                expanded={expandedId === v.id}
                hasBase={hasBase}
                deleting={deletingId === v.id}
                onToggleExpand={() => setExpandedId(expandedId === v.id ? null : v.id)}
                onToggleCompare={() => select(toggleCompare(selected, v.id))}
                onCompareWithBase={() => {
                  const pair = compareWithBase(versions, v.id);
                  if (!pair) return;
                  select(pair);
                  setDiffOpen(true);
                }}
                onAskDelete={() => setDeletingId(v.id)}
                onCancelDelete={() => setDeletingId(null)}
                onDelete={() => void remove(v.id)}
              />
            ))}
          </ul>
          {shown.length === 0 && <p className="mt-3 text-[13px] text-[var(--slate)]">No versions in this filter.</p>}
          {versions.length === 1 && (
            <p className="mt-3 text-[13px] text-[var(--slate)]">Tailor your resume to a job and the new version will appear here so you can compare.</p>
          )}
        </>
      )}
    </section>
  );
}
