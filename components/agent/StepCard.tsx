"use client";

import type { ReactNode, RefObject } from "react";
import { MessageResultView } from "@/components/engine/MessageResultView";
import { ReportView } from "@/components/engine/ReportView";
import { AGENT_TOOL_PRESETS, type AgentWorkTool } from "@/lib/agent/config";
import type { AgentStepRecord } from "@/lib/agent/types";
import type { MessageResult } from "@/lib/engine/schemas";
import { getPresetById } from "@/lib/presets";

export type StepCardState =
  | "locked"
  | "running"
  | "awaiting"
  | "ready"
  | "done"
  | "error"
  | "skipped"
  | "budget"
  | "cleared"
  | "interrupted";

export interface StepCardProps {
  index: number;
  tool: AgentWorkTool;
  label: string;
  state: StepCardState;
  lockedReason?: string;
  step?: AgentStepRecord;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  profileName: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** Gate slot (GateBar) rendered under the artifact. */
  children?: ReactNode;
  /** When set, replaces the message view (the inline ArtifactEditor). */
  editSlot?: ReactNode;
  badges: { edited?: boolean; overridden?: boolean };
}

const LOCKED_STATES: StepCardState[] = ["locked", "skipped", "budget", "cleared"];

const DEFAULT_REASON: Partial<Record<StepCardState, string>> = {
  locked: "Waiting for the previous step.",
  skipped: "Skipped because of the SKIP verdict.",
  budget: "Not run: budget reached.",
  cleared: "Cleared because the fit check changed",
};

function StatusIcon({ state }: { state: StepCardState }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (state) {
    case "done":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M5.25 8.25l1.9 1.9 3.6-4" />
        </svg>
      );
    case "awaiting":
    case "ready":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 4.5V8l2.25 1.5" />
        </svg>
      );
    case "error":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 4.75v3.9M8 11v.01" />
        </svg>
      );
    case "skipped":
    case "budget":
    case "interrupted":
      return (
        <svg {...common}>
          <path d="M8 2l6.25 11H1.75L8 2z" />
          <path d="M8 6.5v3M8 11.5v.01" />
        </svg>
      );
    case "running":
      return <span className="agent-spinner" aria-hidden="true" />;
    default:
      return (
        <svg {...common}>
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
          <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" />
        </svg>
      );
  }
}

function statusText(p: StepCardProps): string {
  switch (p.state) {
    case "running":
      return `Running: ${p.label}. ${p.index} of 4`;
    case "awaiting":
      return "Needs your approval";
    case "ready":
    case "interrupted":
      return "Ready to continue";
    case "done":
      return "Done";
    case "error":
      return `${p.label} didn't finish`;
    default:
      return p.lockedReason ?? DEFAULT_REASON[p.state] ?? "";
  }
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return "";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function inputSummary(inputs: Record<string, string>): string {
  const parts = Object.entries(inputs)
    .filter(([, v]) => v)
    .map(([k, v]) => (k === "jobDescription" ? `${k}: ${v.length.toLocaleString("en-US")} characters` : `${k}: ${v.slice(0, 60)}${v.length > 60 ? "…" : ""}`));
  return parts.length ? parts.join("; ") : "none";
}

function ToolCall({ step, label }: { step: AgentStepRecord; label: string }) {
  return (
    <details className="agent-toolcall">
      <summary>Tool call</summary>
      <dl>
        <dt>Tool</dt>
        <dd className="agent-wrap">{step.presetId ?? step.tool}</dd>
        <dt>Input</dt>
        <dd className="agent-wrap">{inputSummary(step.inputs)}</dd>
        <dt>Duration</dt>
        <dd>{formatDuration(step.durationMs) || "n/a"}</dd>
        <dt>Tokens</dt>
        <dd>
          planner {step.usage.planner.toLocaleString("en-US")}, {label.toLowerCase()} {step.usage.tool.toLocaleString("en-US")}, total{" "}
          {step.usage.total.toLocaleString("en-US")}
        </dd>
      </dl>
    </details>
  );
}

function Artifact({ p }: { p: StepCardProps }) {
  const step = p.step;
  const output = step?.output;
  if (!step || !output) return null;
  const preset = getPresetById(AGENT_TOOL_PRESETS[p.tool]);
  const share = { name: preset?.name ?? p.label, slug: preset?.slug ?? p.tool };
  if (p.tool === "fit_check" || p.tool === "tailor_resume") {
    return (
      <ReportView
        kind={p.tool === "fit_check" ? "fit" : "resume"}
        data={output.data}
        meta={output.meta}
        sentChunks={output.sent}
        profileName={p.profileName}
        share={share}
      />
    );
  }
  if (p.editSlot) return <>{p.editSlot}</>;
  const result = output.data as MessageResult;
  const shown: MessageResult = step.edit ? { ...result, subject: step.edit.subject ?? result.subject, body: step.edit.body } : result;
  return (
    <div className="space-y-4">
      {step.edit && step.edit.grounding.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[14px] font-semibold text-amber-800">Check before using</p>
          <ul className="mt-2 space-y-1 text-[13px] text-amber-900">
            {step.edit.grounding.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </div>
      )}
      <MessageResultView result={shown} meta={output.meta} sentChunks={output.sent} />
    </div>
  );
}

export function StepCard(p: StepCardProps) {
  const locked = LOCKED_STATES.includes(p.state);
  const hasBody = !locked && p.state !== "ready" && p.state !== "interrupted";
  const showArtifact = (p.state === "done" || p.state === "awaiting") && Boolean(p.step?.output);
  const bodyId = `agent-step-body-${p.tool}`;
  const preset = getPresetById(AGENT_TOOL_PRESETS[p.tool]);
  const runningText = preset?.review ? "Drafting, then a second AI reviews it for invented claims…" : "Retrieving playbooks, assembling context, checking every fact…";

  return (
    <li className="agent-step" data-state={p.state} aria-current={p.active ? "step" : undefined} aria-disabled={locked || undefined}>
      <div className="agent-step-head">
        <span className="agent-step-num" aria-hidden="true">
          {p.index}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 tabIndex={-1} ref={p.headingRef}>
            {p.label}
          </h3>
          <p className="agent-status" style={{ margin: 0 }}>
            <StatusIcon state={p.state} />
            <span>{statusText(p)}</span>
            {p.state === "running" && <span className="agent-working">Working</span>}
          </p>
          {p.step?.durationMs !== undefined && (
            <p className="agent-meta" style={{ margin: 0 }}>
              {formatDuration(p.step.durationMs)} · {p.step.usage.total.toLocaleString("en-US")} tokens
            </p>
          )}
        </div>
        {hasBody && (
          <button
            type="button"
            className="cta-secondary"
            style={{ flex: "none", minHeight: 44, minWidth: 44, padding: "0 16px" }}
            aria-expanded={p.expanded}
            aria-controls={bodyId}
            onClick={p.onToggle}
          >
            {p.expanded ? "Collapse" : "Expand"}
            <span className="sr-only"> {p.label}</span>
          </button>
        )}
      </div>

      {(p.badges.edited || p.badges.overridden) && (
        <div className="agent-badges">
          {p.badges.edited && <span className="agent-badge">Edited by you</span>}
          {p.badges.overridden && <span className="agent-badge">Verdict overridden by you</span>}
        </div>
      )}

      {p.state === "interrupted" && <p className="agent-reminder">This step was interrupted when the page closed and will restart.</p>}

      {p.step && p.step.status !== "rejected" && <ToolCall step={p.step} label={p.label} />}

      {hasBody && p.expanded && (
        <div id={bodyId} className="agent-step-body">
          {p.state === "running" && (
            <div aria-busy="true">
              <div className="animate-pulse space-y-2" aria-hidden="true">
                <div className="h-4 w-3/4 rounded bg-zinc-200" />
                <div className="h-4 w-full rounded bg-zinc-200" />
                <div className="h-4 w-5/6 rounded bg-zinc-200" />
              </div>
              <p className="agent-reminder">{runningText}</p>
            </div>
          )}
          {p.state === "error" && (
            <p className="form-error" role="alert">
              {p.label} didn&apos;t finish: {p.step?.error ?? "something went wrong"}. Your earlier steps are saved. Try again, or stop here and keep what you have.
            </p>
          )}
          {showArtifact && (
            <>
              <Artifact p={p} />
              <p className="agent-reminder">Reused from the standalone tools: claims cite your resume; figures not in your material are flagged.</p>
            </>
          )}
        </div>
      )}

      {p.children}
    </li>
  );
}
