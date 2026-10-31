"use client";

import { useEffect, useRef, useState } from "react";
import type { VaultChunk, VaultChunkKind, VaultProfile } from "@/lib/engine/types";
import { chunkResume, manualChunk } from "@/lib/vault/chunker";
import {
  announceVaultChange,
  clearVault,
  deleteChunk,
  deleteChunksFromSource,
  exportVault,
  importVault,
  saveChunks,
  saveProfile,
} from "@/lib/vault/store";
import { useVault } from "@/lib/vault/useVault";

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
  const { chunks, profile, loaded, reload } = useVault();
  const [draftProfile, setDraftProfile] = useState(profile);
  const [resumeText, setResumeText] = useState("");
  const [preview, setPreview] = useState<VaultChunk[] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKind, setNewKind] = useState<VaultChunkKind>("story");
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraftProfile(profile), [profile]);

  async function changed(message: string) {
    await reload();
    announceVaultChange();
    setStatus(message);
    setError("");
  }

  async function handleUpload(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: form });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) throw new Error(json.error || "Couldn't read that file.");
      setResumeText(json.text);
      setPreview(chunkResume(json.text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function commitResume() {
    if (!preview?.length) return;
    const hasResume = chunks.some((c) => c.source === "resume");
    if (hasResume && !window.confirm("Replace the resume chunks already in your vault? Stories, wins and notes you added stay.")) return;
    await deleteChunksFromSource("resume");
    await saveChunks(preview);
    setPreview(null);
    setResumeText("");
    await changed(`Saved ${preview.length} chunks from your resume.`);
  }

  async function addManual() {
    if (!newText.trim()) return;
    await saveChunks([manualChunk(newKind, newTitle || KIND_LABEL[newKind].replace(/s$/, ""), newText)]);
    setNewTitle("");
    setNewText("");
    await changed("Added to your vault.");
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
      const { chunks: n } = await importVault(await file.text());
      await changed(`Imported ${n} chunks.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  async function handleClear() {
    if (!window.confirm("Delete everything in your Career Vault on this browser? Export first if you want a backup.")) return;
    await clearVault();
    await changed("Vault cleared.");
  }

  const grouped = KIND_ORDER.map((kind) => ({ kind, items: chunks.filter((c) => c.kind === kind) })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      {(status || error) && <p className={error ? "form-error" : "text-[13px] font-medium text-emerald-700"}>{error || status}</p>}

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
            await changed("Profile saved.");
          }}
        >
          Save profile
        </button>
      </section>

      {/* Resume import */}
      <section className="rounded-xl border border-zinc-200 p-5">
        <h2 className="text-[15px] font-bold text-zinc-900">Add your resume</h2>
        <p className="mt-1 text-[13px] text-zinc-500">Upload a PDF/DOCX/TXT or paste the text. You'll see exactly how it's split before anything is saved.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="cta-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Reading…" : "Upload file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0])}
          />
        </div>
        <textarea
          className="field-control mt-3"
          rows={8}
          value={resumeText}
          placeholder="…or paste your resume here"
          onChange={(e) => {
            setResumeText(e.target.value);
            setPreview(e.target.value.trim() ? chunkResume(e.target.value) : null);
          }}
        />
        {preview && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-zinc-800">
              {preview.length} chunks:{" "}
              {KIND_ORDER.map((k) => [k, preview.filter((c) => c.kind === k).length] as const)
                .filter(([, n]) => n)
                .map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}`)
                .join(", ")}
            </p>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-[12px] text-zinc-600">
              {preview.map((c) => (
                <li key={c.id} className="truncate">
                  <span className="font-semibold text-zinc-800">[{c.kind}]</span> {c.title} — {c.text.slice(0, 100)}
                </li>
              ))}
            </ul>
            <button type="button" className="cta-primary mt-3" onClick={() => void commitResume()}>
              Save to vault
            </button>
          </div>
        )}
      </section>

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
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
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
