"use client";
import { useState } from "react";

interface Props {
  text: string;
  label?: string;
  className?: string;
}

/** Copy-to-clipboard button. Used across all tools for results. */
export function CopyButton({ text, label = "Copy", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // silently fail — user can manually copy
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      aria-label={copied ? "Copied" : label}
      className={`text-[11px] font-semibold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:border-red-300 rounded-md px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
