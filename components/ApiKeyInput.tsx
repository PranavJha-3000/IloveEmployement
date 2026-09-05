"use client";
import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  docsUrl?: string;
  providerLabel?: string;
}

export function ApiKeyInput({ value, onChange, docsUrl, providerLabel }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor="apiKey" className="block text-sm font-semibold text-zinc-700">
          API Key <span className="text-red-500">*</span>
        </label>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
          >
            Get a {providerLabel ?? "provider"} key →
          </a>
        )}
      </div>
      <div className="relative">
        <input
          id="apiKey"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste your key here"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-white border border-zinc-300 rounded-lg px-3.5 py-2.5 pr-12 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mt-1.5">
        Bring your own API key. Sent per-request, never stored.
      </p>
    </div>
  );
}
