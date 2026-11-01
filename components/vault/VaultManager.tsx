"use client";

import { useEffect, useRef, useState } from "react";
import { applyQuickProfile } from "@/lib/profile/sync";
import { planConfirm } from "@/lib/profile/confirm";
import type { StructuredProfile } from "@/lib/profile/schema";
import type { VaultChunkKind, VaultProfile } from "@/lib/engine/types";
import { manualChunk } from "@/lib/vault/chunker";
import {
  announceVaultChange,
  clearVault,
  deleteChunk,
  exportVault,
  importVault,
  saveChunks,
  saveProfile,
  saveStructuredProfile,
} from "@/lib/vault/store";
import { useVault } from "@/lib/vault/useVault";
import { ApplicationsList } from "@/components/agent/ApplicationsList";
import { ProfileReview } from "./ProfileReview";
import { ResumeImport } from "./ResumeImport";
import { SemanticIndex } from "./SemanticIndex";

const KIND_LABEL: Record<VaultChunkKind, string> = {
  summary: "Summary",
  experience: "Roles",
  bullet: "Bullets",
  project: "Projects",
  education: "Education",
  skill: "Skills",
  story: "Stories",
  win: "Wins",
  note: "Notes",
};

const KIND_ORDER: VaultChunkKind[] = ["summary", "experience", "bullet", "project", "story", "win", "skill", "education", "note"];

const PROFILE_FIELDS: { key: keyof VaultProfile; label: string; placeholder: string }[] = [
  { key: "name", label: "Name", placeholder: "Used to sign your emails" },
  { key: "headline", label: "Headline", placeholder: "e.g. Backend engineer, 4 yrs in fintech" },
  { key: "targetRole", label: "Target role", placeholder: "e.g. Senior Backend Engineer" },
  { key: "location", label: "Location", placeholder: "e.g. Pune, open to remote" },
  { key: "links", label: "Links", placeholder: "LinkedIn, GitHub, portfolio" },
];

export function VaultManager() {
  const { chunks, profile, structuredProfile, loaded, reload } = useVault();
  const [draftProfile, setDraftProfile] = useState(profile);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedReviewOpen, setSavedReviewOpen] = useState(false);
  const [savedConfirming, setSavedConfirming] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [newKind, setNewKind] = useState<VaultChunkKind>("story");
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [quickWin, setQuickWin] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraftProfile(profile), [profile]);

  async function changed(message: string) {
    await reload();
    announceVaultChange();
    setStatus(message);
    setError("");
  }

  async function confirmSaved(p: StructuredProfile) {
    if (!structuredProfile) return;
    setSavedConfirming(true);
    try {
      const plan = planConfirm({ profile: p, method: structuredProfile.method, resumeText: null, existingVaultProfile: profile, now: Date.now() });
      await saveStructuredProfile({ ...plan.confirmed, sourceHash: structuredProfile.sourceHash });
      await saveProfile(plan.vaultProfile);
      setSavedReviewOpen(false);
      await changed("Profile confirmed and saved to your vault.");
    } catch (err) {
      console.error("Saving the structured profile failed.", err instanceof Error ? err.name : "error");
      setError("We couldn't save your profile. Nothing was lost; try again.");
    } finally {
      setSavedConfirming(false);
    }
  }

  async function addManual() {
    if (!newText.trim()) return;
    await saveChunks([manualChunk(newKind, newTitle || KIND_LABEL[newKind].replace(/s$/, ""), newText)]);
    setNewTitle("");
    setNewText("");
    await changed("Added to your vault.");
  }

  async function logWin() {
    if (!quickWin.trim()) return;
    const date = new Date().toISOString().slice(0, 10);
    await saveChunks([manualChunk("win", `Win · ${date}`, quickWin)]);
    setQuickWin("");
    await changed("Win logged. Self-reviews and promotion cases will find it.");
  }

  async function handleExport() {
    const blob = new Blob([await exportVault()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `career-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const { chunks: n, agentRuns: m, keptNewer } = await importVault(await file.text());
      const kept = keptNewer > 0 ? ` Kept ${keptNewer} newer ${keptNewer === 1 ? "application" : "applications"} already on this browser.` : "";
      await changed((m > 0 ? `Imported ${n} chunks and ${m} applications.` : `Imported ${n} chunks.`) + kept);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  async function handleClear() {
    if (!window.confirm("Delete everything in your Career Vault on this browser, including your saved applications? Export first if you want a backup.")) return;
    await clearVault();
    await changed("Vault cleared.");
  }

  const grouped = KIND_ORDER.map((kind) => ({ kind, items: chunks.filter((c) => c.kind === kind) })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      {(status || error) && <p className={error ? "form-error" : "text-[13px] font-medium text-emerald-700"}>{error || status}</p>}

      {/* Wins log */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
        <h2 className="text-[15px] font-bold text-zinc-900">Log a win</h2>
        <p className="mt-1 text-[13px] text-zinc-600">
          One line, the moment it happens. Come review season, Self-Review and Promotion Case write from these.
          {(() => {
            const year = new Date().getFullYear();
            const n = chunks.filter((c) => c.kind === "win" && new Date(c.createdAt).getFullYear() === year).length;
            return n ? ` ${n} logged this year.` : "";
          })()}
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void logWin();
          }}
        >
          <input
            className="field-control"
            value={quickWin}
            maxLength={500}
            onChange={(e) => setQuickWin(e.target.value)}
            placeholder="e.g. Shipped the refunds API two weeks early; support tickets down 30%"
          />
          <button type="submit" className="cta-primary shrink-0 disabled:opacity-50" disabled={!quickWin.trim()}>
            Log it
          </button>
        </form>
      </section>

      {/* Profile */}
      <section className="rounded-xl border border-zinc-200 p-5">
        <h2 className="text-[15px] font-bold text-zinc-900">Profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {PROFILE_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="field-label" htmlFor={`profile-${f.key}`}>
                {f.label}
              </label>
              <input
                id={`profile-${f.key}`}
                className="field-control"
                value={draftProfile[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setDraftProfile({ ...draftProfile, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="cta-secondary mt-4"
          onClick={async () => {
            await saveProfile(draftProfile);
            if (structuredProfile) {
              await saveStructuredProfile({ ...structuredProfile, profile: applyQuickProfile(structuredProfile.profile, draftProfile) });
            }
            await changed("Profile saved.");
          }}
        >
          Save profile
        </button>
        {structuredProfile && !savedReviewOpen && (
          <button type="button" className="cta-secondary mt-4 ml-2" onClick={() => setSavedReviewOpen(true)}>
            Review structured profile
          </button>
        )}
        {structuredProfile && savedReviewOpen && (
          <div className="mt-5">
            <ProfileReview
              initial={{ saved: structuredProfile }}
              confirming={savedConfirming}
              onDiscard={() => setSavedReviewOpen(false)}
              onConfirm={confirmSaved}
            />
          </div>
        )}
      </section>

      {/* Resume import */}
      <ResumeImport
        chunks={chunks}
        profile={profile}
        structuredProfile={structuredProfile}
        onChanged={changed}
        onReviewOpenChange={setReviewOpen}
        onOpenSavedReview={() => setSavedReviewOpen(true)}
      />

      <SemanticIndex chunks={chunks} />

      {/* Phase 4: Applications in progress. Phase 5 "Resume versions" goes directly below. */}
      <ApplicationsList />

      {/* Manual entries */}
      <section className="rounded-xl border border-zinc-200 p-5">
        <h2 className="text-[15px] font-bold text-zinc-900">Add a story, win or note</h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          Things that aren't on your resume: a STAR story, a win from this quarter, feedback you got. Tools cite these too.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <label className="field-label" htmlFor="new-kind">
              Type
            </label>
            <select id="new-kind" className="field-control" value={newKind} onChange={(e) => setNewKind(e.target.value as VaultChunkKind)}>
              {(["story", "win", "project", "skill", "note"] as VaultChunkKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k].replace(/s$/, "")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="new-title">
              Title
            </label>
            <input id="new-title" className="field-control" value={newTitle} placeholder="e.g. Cut checkout latency at Acme" onChange={(e) => setNewTitle(e.target.value)} />
          </div>
        </div>
        <textarea className="field-control mt-3" rows={4} value={newText} placeholder="What happened, what you did, the result" onChange={(e) => setNewText(e.target.value)} />
        <button type="button" className="cta-secondary mt-3" disabled={!newText.trim()} onClick={() => void addManual()}>
          Add
        </button>
      </section>

      {/* Contents */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-zinc-900">In your vault {loaded && `(${chunks.length})`}</h2>
          <div className="flex gap-2">
            <button type="button" className="cta-secondary" onClick={() => void handleExport()} disabled={!chunks.length}>
              Export
            </button>
            <button type="button" className="cta-secondary" onClick={() => importRef.current?.click()}>
              Import
            </button>
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void handleImport(e.target.files[0])} />
            <button type="button" className="cta-secondary" onClick={() => void handleClear()} disabled={!chunks.length}>
              Clear
            </button>
          </div>
        </div>
        {loaded && !chunks.length && <p className="mt-3 text-[13px] text-zinc-500">Nothing yet. Add your resume above to get started.</p>}
        <div className="mt-4 space-y-5">
          {grouped.map((g) => (
            <div key={g.kind}>
              <p className="text-[14px] font-semibold text-zinc-400">
                {KIND_LABEL[g.kind]} · {g.items.length}
              </p>
              <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {g.items.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-zinc-800">{c.title}</p>
                      <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-[12.5px] text-zinc-600">{c.text}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-[12px] font-semibold text-zinc-400 hover:text-red-600"
                      onClick={async () => {
                        await deleteChunk(c.id);
                        await changed("Removed.");
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
