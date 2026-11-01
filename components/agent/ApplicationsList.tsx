"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { jobLabel, runBadge } from "@/lib/agent/record";
import type { AgentRunRecord } from "@/lib/agent/types";
import { VAULT_EVENT, announceVaultChange, deleteAgentRun, listAgentRuns } from "@/lib/vault/store";

const DESTRUCTIVE = "min-h-[44px] rounded-xl border border-[#c4241f] bg-white px-4 text-[15px] font-semibold text-[#c4241f] hover:bg-[#fef3f2]";

/** "just now", "5 minutes ago", "3 days ago"; falls back to a date after a month. */
function relativeTime(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

function StatusIcon({ status }: { status: string }) {
  const path =
    status === "Completed"
      ? "M20 6 9 17l-5-5"
      : status === "Stopped"
        ? "M18 6 6 18 M6 6l12 12"
        : status === "Needs approval"
          ? "M12 8v5 M12 16h.01"
          : "M12 6v6l4 2";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

/** Vault section listing saved agent runs, with resume and a confirmed delete. */
export function ApplicationsList() {
  const [runs, setRuns] = useState<AgentRunRecord[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await listAgentRuns();
      setRuns([...all].sort((a, b) => b.updatedAt - a.updatedAt));
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(VAULT_EVENT, onChange);
    return () => window.removeEventListener(VAULT_EVENT, onChange);
  }, [load]);

  useEffect(() => {
    if (confirmId) keepRef.current?.focus();
  }, [confirmId]);

  function closeConfirm() {
    setConfirmId(null);
    openerRef.current?.focus();
  }

  async function remove(id: string) {
    await deleteAgentRun(id);
    setConfirmId(null);
    await load();
    announceVaultChange();
  }

  if (runs === null) return null;
  const now = Date.now();

  return (
    <section className="rounded-xl border border-zinc-200 p-5">
      <h2 className="text-[15px] font-bold text-zinc-900">Applications in progress</h2>
      {runs.length === 0 ? (
        <p className="mt-2 text-[13px] text-zinc-500">
          No applications yet. Start one from{" "}
          <Link href="/apply" className="font-semibold text-[#e5322d] hover:text-[#c4241f]">
            Apply to this job
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {runs.map((r) => {
            const label = jobLabel(r.job);
            const badge = runBadge(r.status);
            return (
              <li key={r.id} className="px-4 py-3" onKeyDown={(e) => e.key === "Escape" && confirmId === r.id && closeConfirm()}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-zinc-900">{label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
                      <span className="agent-status">
                        <StatusIcon status={badge} />
                        {badge}
                      </span>
                      <span>Last activity {relativeTime(r.updatedAt, now)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/apply?run=${encodeURIComponent(r.id)}`} className="cta-secondary">
                      Resume application
                    </Link>
                    <button
                      type="button"
                      className="min-h-[44px] text-[13px] font-semibold text-zinc-500 hover:text-[#c4241f]"
                      aria-expanded={confirmId === r.id}
                      onClick={(e) => {
                        openerRef.current = e.currentTarget;
                        setConfirmId(r.id);
                      }}
                    >
                      Delete application
                    </button>
                  </div>
                </div>
                {confirmId === r.id && (
                  <div className="agent-confirm mt-3" role="group" aria-label="Confirm delete application">
                    <p>Delete application: Delete this application and its drafts from your Career Vault? This can&apos;t be undone.</p>
                    <div className="agent-confirm-actions">
                      <button type="button" className={DESTRUCTIVE} onClick={() => void remove(r.id)}>
                        Delete application
                      </button>
                      <button type="button" ref={keepRef} className="cta-secondary" onClick={closeConfirm}>
                        Keep application
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
