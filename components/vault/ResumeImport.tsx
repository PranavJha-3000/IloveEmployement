"use client";

import { useEffect, useRef, useState } from "react";
import type { VaultChunk, VaultChunkKind, VaultProfile } from "@/lib/engine/types";
import { useAccess } from "@/components/engine/AccessPanel";
import { needsLookCount } from "@/lib/profile/confidence";
import { planConfirm } from "@/lib/profile/confirm";
import { refineProfile, REFINE_MAX_CHARS } from "@/lib/profile/client";
import { safeExtractProfile } from "@/lib/profile/extract";
import { mergeExtractions } from "@/lib/profile/refine";
import type { ConfirmedProfile, ExtractionResult, StructuredProfile } from "@/lib/profile/schema";
import { chunkResume } from "@/lib/vault/chunker";
import { deleteChunksFromSource, saveChunks, saveProfile, saveResumeVersion, saveStructuredProfile } from "@/lib/vault/store";
import { focusProfileReview, ProfileReview } from "./ProfileReview";

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

const MIN_PASTE_CHARS = 200;
const REPLACE_PROMPT = "Replace the resume chunks already in your vault? Stories, wins and notes you added stay.";
const FAILED_COPY =
  "We couldn't build a structured profile from this resume. You can still save it: your resume will be split into chunks like before, and tools will work as usual.";

type Phase = "idle" | "ready" | "refining" | "failed" | "confirmed";
type Pending = null | "upload" | "refine";

interface Props {
  chunks: VaultChunk[];
  profile: VaultProfile;
  structuredProfile: ConfirmedProfile | null;
  onChanged: (message: string) => Promise<void> | void;
  /** True while a Profile Review panel is open and unconfirmed. */
  onReviewOpenChange?: (open: boolean) => void;
  /** Opens the saved-profile review in the Profile section. */
  onOpenSavedReview?: () => void;
}

export function ResumeImport({ chunks, profile, structuredProfile, onChanged, onReviewOpenChange, onOpenSavedReview }: Props) {
  const access = useAccess();
  const [resumeText, setResumeText] = useState("");
  const [preview, setPreview] = useState<VaultChunk[] | null>(null);
  const [fromUpload, setFromUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  // The text and result the profile was extracted from; later textarea edits never desync a profile being reviewed.
  const [extractedText, setExtractedText] = useState("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [reviewKey, setReviewKey] = useState(0);
  const [refineNote, setRefineNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const confirmedRef = useRef<HTMLParagraphElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const reviewOpen = (phase === "ready" || phase === "refining") && result !== null;
  useEffect(() => {
    onReviewOpenChange?.(reviewOpen);
  }, [reviewOpen, onReviewOpenChange]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Move focus to the review heading each time a fresh profile is shown.
  useEffect(() => {
    if (phase === "ready") focusProfileReview();
  }, [phase, reviewKey]);
  useEffect(() => {
    if (phase === "confirmed") confirmedRef.current?.focus();
  }, [phase]);
  useEffect(() => {
    if (pending) keepRef.current?.focus();
  }, [pending]);

  const extracting = phase === "refining";
  const textReady = resumeText.trim().length >= MIN_PASTE_CHARS || (fromUpload && resumeText.trim().length > 0);

  function runExtract(text: string) {
    setRefineNote("");
    setExtractedText(text);
    const r = safeExtractProfile(text);
    if (!r) {
      setResult(null);
      setPhase("failed");
      return;
    }
    setResult(r);
    setReviewKey((k) => k + 1);
    setPhase("ready");
  }

  async function doUpload(file: File) {
    setBusy(true);
    setError("");
    setPhase("idle");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: form });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) throw new Error(json.error || "Couldn't read that file.");
      setResumeText(json.text);
      setPreview(chunkResume(json.text));
      setFromUpload(true);
      runExtract(json.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  function startUpload(file: File) {
    if (reviewOpen) {
      setPendingFile(file);
      setPending("upload");
      return;
    }
    void doUpload(file);
  }

  async function doRefine() {
    if (!result) return;
    const base = result;
    const text = extractedText;
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(null);
    setRefineNote("");
    setPhase("refining");
    try {
      const { result: refined } = await refineProfile(text, access.requestConfig, controller.signal);
      setResult(mergeExtractions(base, refined, text));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError") && !controller.signal.aborted) {
        console.error("Profile refinement failed.", err instanceof Error ? err.name : "error");
        setRefineNote("We couldn't refine this one. The profile below is from the quick read.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setReviewKey((k) => k + 1);
      setPhase("ready");
    }
  }

  async function commitChunksOnly() {
    if (!preview?.length) return;
    const hasResume = chunks.some((c) => c.source === "resume");
    if (hasResume && !window.confirm(REPLACE_PROMPT)) return;
    await deleteChunksFromSource("resume");
    await saveChunks(preview);
    setPreview(null);
    setResumeText("");
    setFromUpload(false);
    setPhase("idle");
    setResult(null);
    await onChanged(`Saved ${preview.length} chunks from your resume.`);
  }

  async function confirmProfile(p: StructuredProfile) {
    if (!result) return;
    setConfirming(true);
    setError("");
    try {
      const plan = planConfirm({ profile: p, method: result.method, resumeText: extractedText, existingVaultProfile: profile, now: Date.now() });
      if (plan.replaceChunks && chunks.some((c) => c.source === "resume") && !window.confirm(REPLACE_PROMPT)) return;
      if (plan.replaceChunks) {
        await deleteChunksFromSource("resume");
        await saveChunks(chunkResume(extractedText));
      }
      await saveStructuredProfile(plan.confirmed);
      await saveProfile(plan.vaultProfile);
      if (plan.baseVersion) await saveResumeVersion(plan.baseVersion);
      setPreview(null);
      setResumeText("");
      setFromUpload(false);
      setResult(null);
      setPhase("confirmed");
      await onChanged("Profile confirmed and saved to your vault.");
    } catch (err) {
      console.error("Confirm profile failed.", err instanceof Error ? err.name : "error");
      setError("We couldn't save your profile. Nothing was lost; try Confirm profile again.");
    } finally {
      setConfirming(false);
    }
  }

  function discard() {
    setResult(null);
    setPhase("idle");
    setRefineNote("");
  }

  const refineTooLong = extractedText.length > REFINE_MAX_CHARS;
  const refineDisabled = !access.ready || refineTooLong;
  const refineHelp = refineTooLong
    ? "This resume is too long to refine; the quick read above is complete."
    : !access.ready
      ? "Free runs aren't available right now. Add your own key on any tool page to use this."
      : "Reads this resume once more using your free runs or your own key, to fill fields the quick read missed. Only the resume text is sent, and nothing is stored on the server.";

  const headerExtra = (
    <div className="mt-3">
      <button type="button" className="cta-secondary" disabled={refineDisabled} aria-describedby="refine-help" onClick={() => setPending("refine")}>
        Refine profile
      </button>
      <p id="refine-help" className="field-help">
        {refineHelp}
      </p>
      {pending === "refine" && (
        <div className="review-inline-confirm" role="group" aria-label="Refine profile">
          <p>Refining rebuilds the profile and replaces any edits you have made so far. Continue?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" ref={keepRef} className="cta-secondary review-btn" onClick={() => setPending(null)}>
              Keep my edits
            </button>
            <button type="button" className="cta-secondary review-btn" onClick={() => void doRefine()}>
              Refine profile
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const counts = preview ? KIND_ORDER.map((k) => [k, preview.filter((c) => c.kind === k).length] as const).filter(([, n]) => n) : [];
  const previewList = preview && (
    <>
      <p className="text-[13px] font-semibold text-zinc-800">
        {preview.length} chunks: {counts.map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}`).join(", ")}
      </p>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-[12px] text-zinc-600">
        {preview.map((c) => (
          <li key={c.id} className="truncate">
            <span className="font-semibold text-zinc-800">[{c.kind}]</span> {c.title} — {c.text.slice(0, 100)}
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <section className="rounded-xl border border-zinc-200 p-5" aria-busy={extracting || undefined}>
      <h2 className="text-[15px] font-bold text-zinc-900">Add your resume</h2>
      <p className="mt-1 text-[13px] text-zinc-500">Upload a PDF/DOCX/TXT or paste the text. You'll see exactly how it's split before anything is saved.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="cta-secondary" disabled={busy || extracting} onClick={() => fileRef.current?.click()}>
          {busy ? "Reading…" : "Upload file"}
        </button>
        {textReady && (
          <button
            type="button"
            className="cta-secondary"
            disabled={busy || extracting}
            onClick={() => (reviewOpen ? setPending("upload") : runExtract(resumeText))}
          >
            Extract profile
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) startUpload(f);
          }}
        />
      </div>

      {pending === "upload" && (
        <div className="review-inline-confirm mt-3" role="group" aria-label="Replace profile">
          <p>Start over with a new resume? The profile you are reviewing, including your edits and confirmations, will be lost.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" ref={keepRef} className="cta-secondary review-btn" onClick={() => { setPending(null); setPendingFile(null); }}>
              Keep reviewing
            </button>
            <button
              type="button"
              className="cta-secondary review-btn review-btn-danger"
              onClick={() => {
                const f = pendingFile;
                setPending(null);
                setPendingFile(null);
                if (f) void doUpload(f);
                else runExtract(resumeText);
              }}
            >
              Discard profile
            </button>
          </div>
        </div>
      )}

      <textarea
        className="field-control mt-3"
        rows={8}
        value={resumeText}
        readOnly={extracting}
        placeholder="…or paste your resume here"
        onChange={(e) => {
          setResumeText(e.target.value);
          setFromUpload(false);
          setPreview(e.target.value.trim() ? chunkResume(e.target.value) : null);
        }}
      />

      {error && (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      )}

      {extracting && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="doc-spinner" aria-hidden="true" />
            <p role="status" aria-live="polite" className="text-[13px] font-medium text-zinc-700">
              Reading your resume and building a profile…
            </p>
            <button type="button" className="review-textbtn" onClick={() => abortRef.current?.abort()}>
              Stop reading
            </button>
          </div>
          <div className="mt-3 space-y-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-bar" />
            ))}
          </div>
        </div>
      )}

      {phase === "ready" && result && (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-[13px] font-medium text-emerald-700">
            Profile ready to review. {needsLookCount(result.confidence)} fields need a look.
          </p>
          {refineNote && (
            <p role="status" aria-live="polite" className="text-[13px] font-medium text-amber-700">
              {refineNote}
            </p>
          )}
          <ProfileReview
            key={reviewKey}
            initial={{ result }}
            onConfirm={confirmProfile}
            onDiscard={discard}
            confirming={confirming}
            headerExtra={headerExtra}
          />
        </div>
      )}

      {phase === "failed" && (
        <div className="mt-4">
          <p className="form-error" role="alert">
            {FAILED_COPY}
          </p>
          <button type="button" className="cta-secondary mt-3" onClick={() => runExtract(extractedText || resumeText)}>
            Try again
          </button>
        </div>
      )}

      {phase === "confirmed" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p ref={confirmedRef} tabIndex={-1} role="status" className="text-[13px] font-medium text-emerald-700">
            Profile confirmed and saved to your vault.
          </p>
          {structuredProfile && onOpenSavedReview && (
            <button type="button" className="cta-secondary" onClick={onOpenSavedReview}>
              Review structured profile
            </button>
          )}
        </div>
      )}

      {preview && phase === "ready" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-zinc-800">How your resume was split ({preview.length} chunks)</summary>
          <div className="mt-2">{previewList}</div>
        </details>
      )}
      {preview && phase !== "ready" && <div className="mt-4">{previewList}</div>}
      {preview && (
        <button type="button" className="cta-primary mt-3" disabled={extracting} onClick={() => void commitChunksOnly()}>
          Save to vault
        </button>
      )}
    </section>
  );
}
