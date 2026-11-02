"use client";

import type { ReactNode, RefObject } from "react";

export type RunBannerKind = "skipped" | "budget" | "error" | "resumed" | "completed";

export interface RunBannerProps {
  kind: RunBannerKind;
  message?: string;
  gaps?: string[];
  stepName?: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}

const ICON = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Icon({ kind }: { kind: RunBannerKind }) {
  if (kind === "completed") {
    return (
      <svg {...ICON}>
        <circle cx="8" cy="8" r="6.25" />
        <path d="M5.25 8.25l1.9 1.9 3.6-4" />
      </svg>
    );
  }
  if (kind === "resumed") {
    return (
      <svg {...ICON}>
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 7.25v4M8 4.75v.01" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg {...ICON}>
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.75v3.9M8 11v.01" />
      </svg>
    );
  }
  return (
    <svg {...ICON}>
      <path d="M8 2l6.25 11H1.75L8 2z" />
      <path d="M8 6.5v3M8 11.5v.01" />
    </svg>
  );
}

const SKIP_HEADING = "Stopped: this looks like a poor fit. The fit check verdict is SKIP, so we haven't run the other steps.";

export function RunBanner({ kind, message, gaps, stepName, headingRef, children }: RunBannerProps) {
  const amber = kind === "skipped" || kind === "budget";
  const cls =
    kind === "error"
      ? "form-error"
      : kind === "completed"
        ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        : kind === "resumed"
          ? "rounded-xl border p-4"
          : "rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800";
  const style = kind === "resumed" ? { background: "var(--mist)", borderColor: "var(--rule)" } : undefined;

  let heading: string;
  if (kind === "skipped") heading = SKIP_HEADING;
  else if (kind === "resumed") heading = `Welcome back. We restored your application from your Career Vault.${stepName ? ` Pick up at ${stepName}.` : ""}`;
  else if (kind === "completed") heading = "Application ready. All four drafts are saved to your Career Vault.";
  else heading = message ?? "";

  const topGaps = (gaps ?? []).slice(0, 2);

  return (
    <div className={cls} style={style} role={amber || kind === "error" ? "alert" : undefined}>
      <div className="agent-status" style={{ margin: 0, color: "inherit", alignItems: "flex-start" }}>
        <Icon kind={kind} />
        <div>
          <h2 tabIndex={-1} ref={headingRef} style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55, margin: 0 }}>
            {heading}
          </h2>
        </div>
      </div>
      {kind === "skipped" && message && <p style={{ margin: "8px 0 0", fontSize: 15 }}>{message}</p>}
      {topGaps.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 15 }}>
          {topGaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}
