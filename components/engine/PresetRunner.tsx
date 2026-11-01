"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { FieldSpec, RunMeta, RunSuccess, VaultChunk, VaultContextChunk } from "@/lib/engine/types";
import type { MessageResult } from "@/lib/engine/schemas";
import { getPresetById } from "@/lib/presets";
import { DEFAULT_VAULT_LIMIT, type ReportKind } from "@/lib/presets/types";
import { chunkResume, manualChunk } from "@/lib/vault/chunker";
import { retrieveVault } from "@/lib/vault/retrieve";
import { announceVaultChange, deleteChunksFromSource, saveChunks, saveResumeVersion } from "@/lib/vault/store";
import { jobHintFromJd, tailoredVersionFromTool } from "@/lib/vault/tailoredVersion";
import { useSemanticOrder } from "@/lib/vault/useSemantic";
import { useVault } from "@/lib/vault/useVault";
import { AccessPanel, useAccess } from "./AccessPanel";
import { MessageResultView } from "./MessageResultView";
import { MockSession } from "./MockSession";
import type { ReportResult } from "@/lib/engine/reports";
import { ReportView } from "./ReportView";

function initialInputs(fields: FieldSpec[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""]));
}

interface FieldProps {
  field: FieldSpec;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

function ResumeField({ field, value, onChange, disabled, vaultCount, pasted }: FieldProps & { vaultCount: number; pasted: VaultChunk[] | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  async function upload(file: File) {
    setStatus("Reading…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: form });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) throw new Error(json.error || "Couldn't read that file.");
      onChange(json.text);
      setStatus("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  async function saveToVault() {
    if (!pasted?.length) return;
    if (vaultCount && !window.confirm("Replace the resume chunks in your Career Vault with this resume? Stories, wins and notes stay.")) return;
    await deleteChunksFromSource("resume");
    await saveChunks(pasted);
    announceVaultChange();
    setStatus(`Saved ${pasted.length} chunks to your Career Vault.`);
  }

  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between">
        <label htmlFor="field-resume" className="field-label">
          {field.label}
        </label>
        <div className="mb-1.5 flex gap-3 text-[13px] font-semibold">
          <button type="button" disabled={disabled} onClick={() => fileRef.current?.click()} className="text-zinc-600 hover:text-red-600">
            Upload PDF/DOCX
          </button>
          {pasted && (
            <button type="button" onClick={() => void saveToVault()} className="text-zinc-600 hover:text-red-600">
              Save to vault
            </button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <textarea
        id="field-resume"
        rows={value ? 8 : 3}
        value={value}
        disabled={disabled}
        maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={vaultCount ? `Leave empty to use your Career Vault (${vaultCount} chunks), or paste a different resume` : "Paste your resume or upload a file"}
        className="field-control"
      />
      <p className="field-help">
        {status ||
          (pasted
            ? `Using this resume for this run (${pasted.length} chunks). It isn't saved unless you click "Save to vault".`
            : vaultCount
              ? "Using your Career Vault."
              : "Tip: save it to your Career Vault once and every tool can use it.")}
      </p>
    </div>
  );
}

function Field({ field, value, onChange, disabled }: FieldProps) {
  const id = `field-${field.key}`;
  const label = (
    <label htmlFor={id} className="field-label">
      {field.label}
      {field.required && <span className="text-red-600"> *</span>}
    </label>
  );

  if (field.kind === "chips" && field.options) {
    return (
      <div>
        <p className="field-label">{field.label}</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={field.label}>
          {field.options.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  active ? "border-red-300 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.kind === "select" && field.options) {
    return (
      <div>
        {label}
        <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="field-control">
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const common = {
    id,
    value,
    disabled,
    placeholder: field.placeholder,
    maxLength: field.maxLength,
    className: "field-control",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };

  return (
    <div className={field.kind === "textarea" ? "sm:col-span-2" : ""}>
      {label}
      {field.kind === "textarea" ? <textarea rows={field.untrusted ? 7 : 4} {...common} /> : <input type="text" {...common} />}
      {field.help && <p className="field-help">{field.help}</p>}
    </div>
  );
}

type RunResult = { kind: "message" | ReportKind; data: unknown; meta: RunMeta; sent: VaultContextChunk[] };

export function PresetRunner({ presetId }: { presetId: string }) {
  const preset = getPresetById(presetId)!;
  const access = useAccess();
  const { chunks, profile, loaded } = useVault();

  const [inputs, setInputs] = useState(() => initialInputs(preset.fields));
  const [useVaultContext, setUseVaultContext] = useState(true);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const hasResumeField = preset.fields.some((f) => f.kind === "resume");
  const pastedResume = inputs.resume?.trim() ?? "";
  const pastedChunks = useMemo(() => (pastedResume ? chunkResume(pastedResume) : null), [pastedResume]);
  const sourceChunks = pastedChunks ?? chunks;

  const vaultEnabled = preset.usesVault && (useVaultContext || Boolean(pastedChunks)) && sourceChunks.length > 0;
  const vaultLimit = preset.vaultLimit ?? DEFAULT_VAULT_LIMIT;
  const wholeResume = vaultLimit > 12;
  const vaultQuery = preset.vaultQuery(inputs);
  // Hybrid search needs saved vectors, so it applies to the saved vault, not a pasted resume.
  const semanticOrder = useSemanticOrder(chunks, vaultQuery, vaultEnabled && !pastedChunks && !wholeResume);
  const retrieved = useMemo(
    () => (vaultEnabled ? retrieveVault(sourceChunks, vaultQuery, vaultLimit, semanticOrder ?? undefined) : []),
    [vaultEnabled, sourceChunks, vaultQuery, vaultLimit, semanticOrder],
  );
  const retrievalMode = wholeResume ? "whole" : semanticOrder ? "hybrid" : "keyword";

  const missing = preset.fields.filter((f) => f.required && !inputs[f.key]?.trim());
  const missingProfile = Boolean(preset.requiresProfile) && retrieved.length === 0;
  const canRun = access.ready && missing.length === 0 && !missingProfile && phase !== "loading";
  const steps = preset.review ? "Drafting, then a second AI reviews it for invented claims…" : "Retrieving playbooks, assembling context, checking every fact…";

  async function run() {
    if (!canRun) return;
    setPhase("loading");
    setError("");
    try {
      const profileForRun = Object.fromEntries(Object.entries(profile).filter(([, v]) => v));
      const res = await fetch(`/api/run/${preset.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, vault: retrieved, profile: profileForRun, config: access.requestConfig, retrieval: retrievalMode }),
      });
      const json = (await res.json()) as RunSuccess<unknown> | { error: string };
      if (!res.ok || "error" in json) throw new Error("error" in json ? json.error : "Something went wrong.");
      setResult({ kind: preset.engine === "message" ? "message" : preset.output, data: json.data, meta: json.meta, sent: retrieved });
      setRemaining(json.meta.remaining);
      setPhase("done");
      requestAnimationFrame(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  const setField = (key: string) => (v: string) => setInputs((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {preset.fields.map((field) =>
            field.kind === "resume" ? (
              <ResumeField
                key={field.key}
                field={field}
                value={inputs[field.key] ?? ""}
                disabled={phase === "loading"}
                onChange={setField(field.key)}
                vaultCount={chunks.length}
                pasted={pastedChunks}
              />
            ) : (
              <Field key={field.key} field={field} value={inputs[field.key] ?? ""} disabled={phase === "loading"} onChange={setField(field.key)} />
            ),
          )}
        </div>

        {preset.usesVault && loaded && !pastedChunks && (
          <div className="rounded-xl border border-zinc-200 p-4">
            {chunks.length === 0 ? (
              <p className="text-[14px] text-zinc-600">
                <span className="font-semibold text-zinc-800">Make it about you.</span>{" "}
                {hasResumeField ? "Paste your resume above, or add it to your " : "Add your resume to your "}
                <Link href="/vault" className="font-semibold text-red-600 hover:underline">
                  Career Vault
                </Link>{" "}
                once, and every tool writes from your real experience, with citations.
              </p>
            ) : (
              <>
                {!preset.requiresProfile && (
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
                    <input type="checkbox" checked={useVaultContext} onChange={(e) => setUseVaultContext(e.target.checked)} />
                    Use my Career Vault
                  </label>
                )}
                {(useVaultContext || preset.requiresProfile) && (
                  <details className="mt-1 text-[12px] text-zinc-500">
                    <summary className="cursor-pointer">
                      {retrieved.length} of {chunks.length} vault chunks will be sent for this task
                      {retrievalMode === "hybrid" ? " · hybrid search" : ""}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {retrieved.map((c) => (
                        <li key={c.id} className="truncate">
                          <span className="font-medium text-zinc-700">{c.title}</span> — {c.text.slice(0, 90)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        )}

        <AccessPanel access={access} remaining={remaining} />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={!canRun} className="cta-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
          {phase === "loading"
            ? "Working…"
            : preset.engine === "message"
              ? "Write it"
              : preset.engine === "tailor"
                ? "Tailor it"
                : preset.id === "mock-interview"
                  ? "Start the interview"
                  : preset.engine === "offer"
                    ? "Compare"
                    : preset.engine === "interview"
                      ? "Build it"
                      : "Analyze"}
        </button>
        {(missing.length > 0 || missingProfile) && (
          <p className="text-center text-[13px] text-zinc-500">
            Still needed: {[...missing.map((f) => f.label), ...(missingProfile && !missing.some((f) => f.kind === "resume") ? ["your resume"] : [])].join(", ")}
          </p>
        )}
      </form>

      <div id="result" className="scroll-mt-24">
        {phase === "loading" && (
          <div className="space-y-3 rounded-2xl border border-zinc-200 p-6">
            <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-zinc-100" />
            <p className="pt-2 text-[13px] text-zinc-500">{steps}</p>
          </div>
        )}
        {phase !== "loading" && result?.kind === "message" && (
          <MessageResultView result={result.data as MessageResult} meta={result.meta} sentChunks={result.sent} />
        )}
        {phase !== "loading" && result?.kind === "mockPlan" && (
          <MockSession
            plan={result.data as ReportResult<"mockPlan">}
            planMeta={result.meta}
            inputs={inputs}
            sourceChunks={sourceChunks}
            profile={Object.fromEntries(Object.entries(profile).filter(([, v]) => v))}
            config={access.requestConfig}
            onRemaining={setRemaining}
          />
        )}
        {phase !== "loading" && result && result.kind !== "message" && result.kind !== "mockPlan" && (
          <ReportView
            kind={result.kind}
            data={result.data}
            meta={result.meta}
            sentChunks={result.sent}
            profileName={profile.name}
            share={{ name: preset.name, slug: preset.slug }}
            onSaveStory={async (title, text) => {
              await saveChunks([manualChunk("story", title, text, "star")]);
              announceVaultChange();
            }}
            {...(preset.id === "tailor-resume"
              ? {
                  versionJobHint: jobHintFromJd(inputs.jobDescription ?? ""),
                  onSaveVersion: async (v: { text: string; job: { title: string; company: string; url?: string } }) => {
                    await saveResumeVersion(tailoredVersionFromTool({ ...v, now: Date.now() }));
                    announceVaultChange();
                  },
                }
              : {})}
          />
        )}
        {phase === "idle" && !result && (
          <div className="rounded-2xl bg-[#f3f4f7] p-6 text-[14px] leading-relaxed text-zinc-600">
            <p className="text-[16px] font-semibold text-zinc-900">How this tool stays honest</p>
            <ul className="mt-2 space-y-1">
              <li>• It works only from what you give it and your Career Vault. Unknowns become highlighted [placeholders].</li>
              <li>• Claims about you cite the exact part of your resume they came from.</li>
              {preset.engine !== "message" && <li>• Scores are computed by code from the evidence, not guessed by the AI.</li>}
              {preset.review && <li>• A second AI reviews the draft for invented or stretched claims before you see it.</li>}
              <li>• Figures that don't appear in your material are flagged.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
