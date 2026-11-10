"use client";

import { useEffect, useState } from "react";
import type { AiRequestConfig } from "@/lib/types";
import { getDefaultConfig } from "@/lib/providers";
import { ProviderConfig } from "@/components/ProviderConfig";
import { authHeaders, sendCode, signOut, useSessionEmail, verifyCode } from "@/lib/auth/client";

const SESSION_KEY = "ile:byok";

interface AccessInfo {
  freeTier: boolean;
  model: string | null;
  dailyLimit: number;
  needsSignIn: boolean;
  remaining: number | null;
}

/**
 * Free tier by default; "use my own key" reveals the provider picker. The key
 * lives in sessionStorage only (gone when the tab closes) and is sent per run.
 */
export function useAccess() {
  const [info, setInfo] = useState<AccessInfo | null>(null);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [config, setConfig] = useState<AiRequestConfig>(getDefaultConfig());
  const email = useSessionEmail();

  useEffect(() => {
    authHeaders()
      .then((headers) => fetch("/api/access", { headers }))
      .then((r) => r.json())
      .then((j: AccessInfo) => {
        setInfo(j);
        if (!j.freeTier) setUseOwnKey(true);
      })
      .catch(() => setInfo({ freeTier: false, model: null, dailyLimit: 0, needsSignIn: false, remaining: null }));
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        setConfig(JSON.parse(saved) as AiRequestConfig);
        setUseOwnKey(true);
      }
    } catch {
      // sessionStorage blocked; the key just won't survive a reload.
    }
  }, [email]);

  function updateConfig(next: AiRequestConfig) {
    setConfig(next);
    try {
      if (next.apiKey) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }

  const requestConfig = useOwnKey && config.apiKey.trim() ? config : undefined;
  const ready = Boolean(requestConfig) || Boolean(info?.freeTier && !useOwnKey && (!info.needsSignIn || email));

  return { email, info, useOwnKey, setUseOwnKey, config, updateConfig, requestConfig, ready };
}

export function AccessPanel({ access, remaining }: { access: ReturnType<typeof useAccess>; remaining: number | null }) {
  const { email, info, useOwnKey, setUseOwnKey, config, updateConfig } = access;
  if (!info) return <div className="h-10 animate-pulse rounded-lg bg-zinc-100" />;
  const left = remaining ?? info.remaining;

  return (
    <div className="rounded-xl border border-zinc-200 bg-[#f3f4f7] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-zinc-900">
            {useOwnKey ? "Using your own API key" : `Free tier, running ${info.model}`}
          </p>
          <p className="text-[12.5px] text-zinc-500">
            {useOwnKey
              ? "Sent with each run, never stored on our server. Cleared when you close this tab."
              : info.needsSignIn && !email
                ? `Sign up free to get ${info.dailyLimit} free run${info.dailyLimit === 1 ? "" : "s"} a day.`
                : left === null
                  ? `${info.dailyLimit} free run${info.dailyLimit === 1 ? "" : "s"} a day.`
                  : `${left} free run${left === 1 ? "" : "s"} left today.`}
          </p>
        </div>
        {info.freeTier && (
          <button
            type="button"
            onClick={() => setUseOwnKey(!useOwnKey)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900"
          >
            {useOwnKey ? "Use free tier" : "Use my own key"}
          </button>
        )}
      </div>
      {info.freeTier && !useOwnKey && info.needsSignIn && (
        <div className="mt-4">
          {email ? (
            <p className="text-[12.5px] text-zinc-500">
              Signed in as {email}.{" "}
              <button type="button" onClick={signOut} className="font-semibold underline">
                Sign out
              </button>
            </p>
          ) : (
            <SignIn />
          )}
        </div>
      )}
      {useOwnKey && (
        <div className="mt-4">
          <ProviderConfig config={config} onChange={updateConfig} />
        </div>
      )}
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (sent) await verifyCode(email, code);
      else {
        await sendCode(email);
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  const field = "min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[14px]";
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      {sent ? (
        <input className={field} inputMode="numeric" autoComplete="one-time-code" placeholder="Code from your email" value={code} onChange={(e) => setCode(e.target.value)} required />
      ) : (
        <input className={field} type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      )}
      <button type="submit" disabled={busy} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
        {sent ? "Verify" : "Email me a code"}
      </button>
      {error && <p role="alert" className="w-full text-[12.5px] text-red-600">{error}</p>}
    </form>
  );
}
