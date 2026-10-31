"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FieldSpec, RunMeta, RunSuccess, VaultContextChunk } from "@/lib/engine/types";
import type { MessageResult } from "@/lib/engine/schemas";
import { getPresetById } from "@/lib/presets";
import { useVault } from "@/lib/vault/useVault";
import { retrieveVault } from "@/lib/vault/retrieve";
import { AccessPanel, useAccess } from "./AccessPanel";
import { MessageResultView } from "./MessageResultView";

function initialInputs(fields: FieldSpec[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""]));
}

function Field({ field, value, onChange, disabled }: { field: FieldSpec; value: string; onChange: (v: string) => void; disabled: boolean }) {
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

export function PresetRunner({ presetId }: { presetId: string }) {
  const preset = getPresetById(presetId)!;
  const access = useAccess();
  const { chunks, profile, loaded } = useVault();

  const [inputs, setInputs] = useState(() => initialInputs(preset.fields));
  const [useVaultContext, setUseVaultContext] = useState(true);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ data: MessageResult; meta: RunMeta; sent: VaultContextChunk[] } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const vaultEnabled = preset.usesVault && useVaultContext && chunks.length > 0;
  const retrieved = useMemo(
    () => (vaultEnabled ? retrieveVault(chunks, preset.vaultQuery(inputs), 8) : []),
    [vaultEnabled, chunks, preset, inputs],
  );

  const missing = preset.fields.filter((f) => f.required && !inputs[f.key]?.trim());
  const canRun = access.ready && missing.length === 0 && phase !== "loading";

  async function run() {
    if (!canRun) return;
    setPhase("loading");
    setError("");
    try {
      const profileForRun = Object.fromEntries(Object.entries(profile).filter(([, v]) => v));
      const res = await fetch(`/api/run/${preset.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, vault: retrieved, profile: profileForRun, config: access.requestConfig }),
      });
      const json = (await res.json()) as RunSuccess<MessageResult> | { error: string };
      if (!res.ok || "error" in json) throw new Error("error" in json ? json.error : "Something went wrong.");
      setResult({ data: json.data, meta: json.meta, sent: retrieved });
      setRemaining(json.meta.remaining);
      setPhase("done");
      requestAnimationFrame(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {preset.fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={inputs[field.key] ?? ""}
              disabled={phase === "loading"}
              onChange={(v) => setInputs((prev) => ({ ...prev, [field.key]: v }))}
            />
          ))}
        </div>

        {preset.usesVault && loaded && (
          <div className="rounded-xl border border-zinc-200 p-4">
            {chunks.length === 0 ? (
              <p className="text-[12.5px] text-zinc-600">
                <span className="font-semibold text-zinc-800">Make it about you.</span> Add your resume to your{" "}
                <Link href="/vault" className="font-semibold text-red-600 hover:underline">
                  Career Vault
                </Link>{" "}
                once, and every tool writes from your real experience, with citations.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
                  <input type="checkbox" checked={useVaultContext} onChange={(e) => setUseVaultContext(e.target.checked)} />
                  Use my Career Vault
                </label>
                {useVaultContext && (
                  <details className="mt-2 text-[12px] text-zinc-500">
                    <summary className="cursor-pointer">
                      {retrieved.length} of {chunks.length} chunks will be sent for this task
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
          {phase === "loading" ? "Writing…" : `Write it`}
        </button>
        {missing.length > 0 && (
          <p className="text-center text-[11.5px] text-zinc-400">Still needed: {missing.map((f) => f.label).join(", ")}</p>
        )}
      </form>

      <div id="result" className="scroll-mt-24">
        {phase === "loading" && (
          <div className="space-y-3 rounded-xl border border-zinc-200 p-5">
            <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-zinc-100" />
            <p className="pt-2 text-[12px] text-zinc-400">Retrieving playbooks, assembling context, checking every fact…</p>
          </div>
        )}
        {phase !== "loading" && result && <MessageResultView result={result.data} meta={result.meta} sentChunks={result.sent} />}
        {phase === "idle" && !result && (
          <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-[13px] leading-relaxed text-zinc-500">
            <p className="font-semibold text-zinc-700">What you'll get</p>
            <ul className="mt-2 space-y-1">
              <li>• A ready-to-send draft plus alternatives</li>
              <li>• Highlighted [placeholders] for anything we don't know, never made-up facts</li>
              <li>• Citations to your Career Vault for every claim about you</li>
              <li>• A warning if any figure doesn't appear in what you gave us</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
