"use client";

import { useEffect, useState } from "react";
import type { AiRequestConfig } from "@/lib/types";
import { getDefaultConfig } from "@/lib/providers";
import { ProviderConfig } from "@/components/ProviderConfig";

const SESSION_KEY = "ile:byok";

interface AccessInfo {
  freeTier: boolean;
  model: string | null;
  dailyLimit: number;
}

/**
 * Free tier by default; "use my own key" reveals the provider picker. The key
 * lives in sessionStorage only (gone when the tab closes) and is sent per run.
 */
export function useAccess() {
  const [info, setInfo] = useState<AccessInfo | null>(null);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [config, setConfig] = useState<AiRequestConfig>(getDefaultConfig());

  useEffect(() => {
    fetch("/api/access")
      .then((r) => r.json())
      .then((j: AccessInfo) => {
        setInfo(j);
        if (!j.freeTier) setUseOwnKey(true);
      })
      .catch(() => setInfo({ freeTier: false, model: null, dailyLimit: 0 }));
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        setConfig(JSON.parse(saved) as AiRequestConfig);
        setUseOwnKey(true);
      }
    } catch {
      // sessionStorage blocked; the key just won't survive a reload.
    }
  }, []);

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
  const ready = Boolean(requestConfig) || Boolean(info?.freeTier && !useOwnKey);

  return { info, useOwnKey, setUseOwnKey, config, updateConfig, requestConfig, ready };
}

export function AccessPanel({ access, remaining }: { access: ReturnType<typeof useAccess>; remaining: number | null }) {
  const { info, useOwnKey, setUseOwnKey, config, updateConfig } = access;
  if (!info) return <div className="h-10 animate-pulse rounded-lg bg-zinc-100" />;

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
              : remaining === null
                ? `${info.dailyLimit} free runs a day. No sign-up.`
                : `${remaining} free run${remaining === 1 ? "" : "s"} left today.`}
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
      {useOwnKey && (
        <div className="mt-4">
          <ProviderConfig config={config} onChange={updateConfig} />
        </div>
      )}
    </div>
  );
}
