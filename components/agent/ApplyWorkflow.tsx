"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { AccessPanel, useAccess } from "@/components/engine/AccessPanel";
import { CopyButton } from "@/components/shared/CopyButton";
import {
  AGENT_MAX_BUDGET_RESETS,
  AGENT_TOOL_LABELS,
  AGENT_TOOL_PRESETS,
  AGENT_WORK_TOOLS,
  type AgentWorkTool,
} from "@/lib/agent/config";
import {
  applyStepResponse,
  approveGateA,
  approveGateB,
  buildStepRequest,
  continueWithNewBudget,
  declineOutreach,
  localNextAction,
  overrideSkip,
  rerunFitCheck,
  retrieveForTools,
  revertArtifactEdit,
  saveArtifactEdit,
  stopRun,
} from "@/lib/agent/client";
import { createRunRecord, isAgentRunRecord, jobLabel, normalizeForResume } from "@/lib/agent/record";
import type { AgentJob, AgentNextAction, AgentRunRecord, AgentStepRecord, AgentStepResponse } from "@/lib/agent/types";
import type { MessageResult } from "@/lib/engine/schemas";
import { getPresetById } from "@/lib/presets";
import { announceVaultChange, listAgentRuns, loadAgentRun, saveAgentRun } from "@/lib/vault/store";
import { useSemanticOrder } from "@/lib/vault/useSemantic";
import { useVault } from "@/lib/vault/useVault";
import { ArtifactEditor } from "./ArtifactEditor";
import { BudgetMeter } from "./BudgetMeter";
import { GateBar, type OutreachOptions } from "./GateBar";
import { JobInput } from "./JobInput";
import { RunBanner } from "./RunBanner";
import type { StepCardProps, StepCardState } from "./StepCard";
import { StepTimeline } from "./StepTimeline";

const EMPTY_JOB: AgentJob = { description: "", company: "", role: "", url: "", notes: "" };
const MAX_STEPS_PER_ADVANCE = 8;
const FREE_NOTE = "Each step uses one of today's free runs. A full application usually takes 4 to 6.";

/** A run the user stopped can be reopened; it comes back paused so the policy decides what is next. */
function reopen(r: AgentRunRecord): AgentRunRecord {
  const rec = normalizeForResume(r);
  if (rec.stopReason?.kind !== "user") return rec;
  const { stopReason: _cleared, ...rest } = rec;
  return { ...rest, status: "paused" };
}

const cleanJob = (j: AgentJob): AgentJob => ({
  description: j.description.trim(),
  company: j.company.trim(),
  role: j.role.trim(),
  ...(j.url?.trim() ? { url: j.url.trim() } : {}),
  ...(j.notes?.trim() ? { notes: j.notes.trim() } : {}),
});

function liveStep(tool: AgentWorkTool, step: AgentStepRecord, next: AgentNextAction): string {
  const label = AGENT_TOOL_LABELS[tool];
  if (step.status === "error") return `${label} didn't finish.`;
  if (step.status === "rejected") return "The planner picked a step that isn't allowed yet, so it was skipped.";
  const verdict = tool === "fit_check" && step.verdict ? ` Verdict: ${step.verdict.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}.` : "";
  const tail = next.kind === "gate" ? " Needs your approval." : next.kind === "complete" ? " Application ready." : "";
  return `${label} finished.${verdict}${tail} Saved to your Career Vault.`;
}

function pickUp(next: AgentNextAction): string {
  if (next.kind === "step") return AGENT_TOOL_LABELS[next.allowed[0]];
  if (next.kind === "gate") return next.gate === "A" ? "your fit check approval" : "your outreach decision";
  return "your saved steps";
}

function sentence(text: string): string {
  return text.replace(/\s+$/, "").replace(/[.!?]$/, "");
}

function artifactText(step: AgentStepRecord): string {
  const data = (step.output?.data ?? {}) as Record<string, unknown>;
  if (step.tool === "cover_letter" || step.tool === "outreach_message") {
    const r = data as unknown as MessageResult;
    const subject = step.edit ? step.edit.subject ?? r.subject : r.subject;
    const body = step.edit ? step.edit.body : r.body;
    return [subject, body].filter(Boolean).join("\n\n");
  }
  if (step.tool === "fit_check") return [data.headline, data.summary].filter((x): x is string => typeof x === "string").join("\n\n");
  const lines: string[] = [];
  if (typeof data.headline === "string") lines.push(data.headline);
  const summary = data.summary as { text?: string } | undefined;
  if (summary?.text) lines.push(summary.text);
  for (const section of (data.sections as { title?: string; entries?: { heading?: string; bullets?: { text?: string }[] }[] }[] | undefined) ?? []) {
    if (section.title) lines.push("", section.title);
    for (const entry of section.entries ?? []) {
      if (entry.heading) lines.push(entry.heading);
      for (const b of entry.bullets ?? []) if (b.text) lines.push(`- ${b.text}`);
    }
  }
  if (Array.isArray(data.skills) && data.skills.length) lines.push("", `Skills: ${data.skills.join(", ")}`);
  return lines.join("\n");
}

function fitGaps(step: AgentStepRecord | undefined): string[] {
  const gaps = (step?.output?.data as { gaps?: { gap?: unknown }[] } | undefined)?.gaps;
  return (gaps ?? []).map((g) => g.gap).filter((g): g is string => typeof g === "string" && g.length > 0);
}

export function ApplyWorkflow() {
  const params = useSearchParams();
  const runParam = params.get("run");
  const access = useAccess();
  const { chunks, profile, loaded } = useVault();

  const [record, setRecord] = useState<AgentRunRecord | null>(null);
  const [draft, setDraft] = useState<AgentJob>(EMPTY_JOB);
  const [busy, setBusy] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [offered, setOffered] = useState<AgentRunRecord | null>(null);
  const [resumed, setResumed] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<AgentWorkTool, boolean>>>({});
  const [editing, setEditing] = useState<AgentWorkTool | null>(null);
  const [editingJob, setEditingJob] = useState<AgentJob | null>(null);
  const [inputFocus, setInputFocus] = useState(false);

  const recordRef = useRef<AgentRunRecord | null>(null);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const announced80 = useRef<string | null>(null);
  const bannerRef = useRef<HTMLHeadingElement | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const fitRef = useRef<HTMLHeadingElement | null>(null);
  const tailorRef = useRef<HTMLHeadingElement | null>(null);
  const coverRef = useRef<HTMLHeadingElement | null>(null);
  const outreachRef = useRef<HTMLHeadingElement | null>(null);
  const headingRefs: Record<AgentWorkTool, RefObject<HTMLHeadingElement | null>> = {
    fit_check: fitRef,
    tailor_resume: tailorRef,
    cover_letter: coverRef,
    outreach_message: outreachRef,
  };

  const activeJob = record?.job ?? draft;
  const outreachPreset = getPresetById(AGENT_TOOL_PRESETS.outreach_message);
  const semanticQuery = outreachPreset
    ? outreachPreset.vaultQuery({ jobDescription: activeJob.description, company: activeJob.company, role: activeJob.role, hook: activeJob.notes ?? "" })
    : "";
  const semanticOrder = useSemanticOrder(chunks, semanticQuery, chunks.length > 0 && activeJob.description.trim().length > 0);

  const focusSoon = useCallback((el: () => HTMLElement | null) => {
    requestAnimationFrame(() => el()?.focus());
  }, []);

  // Persist after every change. Silent: never moves focus.
  const commit = useCallback((next: AgentRunRecord) => {
    recordRef.current = next;
    setRecord(next);
    void saveAgentRun(next)
      .then(() => {
        announceVaultChange();
        setSavedAt(Date.now());
      })
      .catch(() => {
        // The run stays usable in memory; the Saved line just does not update.
      });
  }, []);

  // Mobile: hide the sticky action bar while a text field outside it has focus.
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.closest(".agent-actionbar");
    const onIn = (e: FocusEvent) => setInputFocus(isField(e.target));
    const onOut = () => setInputFocus(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  // Load a saved run: ?run=id, else offer the most recent unfinished one.
  useEffect(() => {
    let live = true;
    void (async () => {
      if (runParam) {
        const found = await loadAgentRun(runParam);
        if (!live || !found || !isAgentRunRecord(found)) return;
        const rec = reopen(found);
        recordRef.current = rec;
        setRecord(rec);
        setResumed(true);
        focusSoon(() => bannerRef.current);
        return;
      }
      const all = await listAgentRuns();
      if (!live) return;
      const open = all.find((r) => r.status !== "completed" && r.status !== "stopped");
      if (open) {
        setOffered(reopen(open));
        focusSoon(() => bannerRef.current);
      }
    })();
    return () => {
      live = false;
    };
  }, [runParam, focusSoon]);

  const advance = useCallback(
    async (start: AgentRunRecord) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setFetchError("");
      const controller = new AbortController();
      abortRef.current = controller;
      let rec: AgentRunRecord = { ...start, status: "running" };
      commit(rec);
      try {
        for (let i = 0; i < MAX_STEPS_PER_ADVANCE; i++) {
          const next = localNextAction(rec);
          if (next.kind !== "step") break;
          const retrieved = retrieveForTools(chunks, rec.job, next.allowed, semanticOrder ?? undefined);
          const profileForRun = Object.fromEntries(Object.entries(profile).filter(([, v]) => v));
          const body = buildStepRequest(rec, {
            vault: retrieved.vault,
            retrieval: retrieved.retrieval,
            ...(Object.keys(profileForRun).length ? { profile: profileForRun } : {}),
            ...(access.requestConfig ? { config: access.requestConfig } : {}),
          });
          setLiveMessage(`${AGENT_TOOL_LABELS[next.allowed[0]]} running`);
          const res = await fetch("/api/agent/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          const json = (await res.json()) as AgentStepResponse | { error: string };
          if (!res.ok || "error" in json) {
            const message = "error" in json ? json.error : "Something went wrong.";
            commit({ ...rec, status: "error", updatedAt: Date.now() });
            setFetchError(message);
            setLiveMessage("The step didn't finish. Your earlier steps are saved.");
            return;
          }
          rec = applyStepResponse(rec, json, Date.now());
          commit(rec);
          if (json.kind === "blocked") break;
          if (json.remaining !== null) setRemaining(json.remaining);
          setLiveMessage(liveStep(json.step.tool === "finish" ? next.allowed[0] : (json.step.tool as AgentWorkTool), json.step, json.next));

          const pct = Math.max(json.budget.stepsUsed / json.budget.stepBudget, json.budget.tokensUsed / json.budget.tokenBudget);
          const key = `${rec.id}-${json.budget.stepBudget}`;
          if (pct >= 0.8 && pct < 1 && announced80.current !== key) {
            announced80.current = key;
            setLiveMessage((m) => `${m} You have used 80 percent of this run's budget.`);
          }
          if (json.next.kind === "gate") {
            const tool: AgentWorkTool = json.next.gate === "A" ? "fit_check" : "outreach_message";
            focusSoon(() => headingRefs[tool].current);
          }
          if (json.step.status === "error" || rec.status === "paused" || json.next.kind !== "step") break;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setLiveMessage("Run stopped. Your finished steps are saved.");
        } else {
          commit({ ...rec, status: "error", updatedAt: Date.now() });
          setFetchError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        inFlight.current = false;
        abortRef.current = null;
        setBusy(false);
      }
    },
    // headingRefs are stable refs; chunks/profile/config change between runs of advance by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chunks, profile, semanticOrder, access.requestConfig, commit, focusSoon],
  );

  // ─── Actions ───────────────────────────────────────────────────────────────

  const current = () => recordRef.current;

  function start(e?: FormEvent) {
    e?.preventDefault();
    if (inFlight.current) return;
    const rec = { ...createRunRecord(cleanJob(draft), { id: crypto.randomUUID(), now: Date.now() }), status: "running" as const };
    setResumed(false);
    setOffered(null);
    setExpanded({});
    setEditing(null);
    commit(rec);
    focusSoon(() => fitRef.current);
    void advance(rec);
  }

  function resume(rec: AgentRunRecord) {
    setOffered(null);
    setRecord(rec);
    recordRef.current = rec;
    const next = localNextAction(rec);
    if (next.kind === "step") void advance(rec);
    else focusSoon(() => headingRefs[next.kind === "gate" && next.gate === "B" ? "outreach_message" : "fit_check"].current);
  }

  function approveA() {
    const rec = current();
    if (!rec) return;
    const next = approveGateA(rec, Date.now());
    commit(next);
    void advance(next);
  }

  function rerun(patch: AgentJob) {
    const rec = current();
    if (!rec) return;
    const next = rerunFitCheck(rec, cleanJob(patch), Date.now());
    setEditingJob(null);
    commit(next);
    void advance(next);
  }

  function doStop() {
    const rec = current();
    abortRef.current?.abort();
    if (!rec) return;
    const stopped = stopRun(recordRef.current ?? rec, Date.now());
    commit(stopped);
    setFetchError("");
  }

  function doOverride() {
    const rec = current();
    if (rec) commit(overrideSkip(rec, Date.now()));
  }

  function draftOutreach(opts: OutreachOptions) {
    const rec = current();
    if (!rec) return;
    const next = approveGateB(rec, { ...(opts.recipientName ? { recipientName: opts.recipientName } : {}), recipientRole: opts.recipientRole, channel: opts.channel }, Date.now());
    commit(next);
    void advance(next);
  }

  function declineOut() {
    const rec = current();
    if (rec) commit(declineOutreach(rec, Date.now()));
  }

  function newBudget() {
    const rec = current();
    if (!rec) return;
    const next = continueWithNewBudget(rec, Date.now());
    commit(next);
    void advance(next);
  }

  function retry() {
    const rec = current();
    if (rec) void advance(rec);
  }

  function startOver() {
    setRecord(null);
    recordRef.current = null;
    setDraft(EMPTY_JOB);
    setResumed(false);
    setExpanded({});
    setEditing(null);
    setFetchError("");
    setLiveMessage("");
  }

  function setPause(v: boolean) {
    const rec = current();
    if (rec) commit({ ...rec, pauseAfterStep: v });
  }

  // ─── Derived view ──────────────────────────────────────────────────────────

  const next: AgentNextAction | null = record ? localNextAction(record) : null;
  const liveSteps = record ? record.steps.filter((s) => !s.invalidated) : [];
  const latestFor = (tool: AgentWorkTool) => [...liveSteps].reverse().find((s) => s.tool === tool && s.status !== "rejected");
  const fitStep = latestFor("fit_check");
  const budgetStop = next?.kind === "stop" && (next.reason === "step_budget" || next.reason === "token_budget");
  const skipStop = next?.kind === "stop" && next.reason === "skip_verdict";
  const userStopped = record?.status === "stopped" && record.stopReason?.kind === "user";
  const allowed = next?.kind === "step" ? next.allowed : [];
  const firstAllowed = allowed[0];
  const canContinueBudget =
    budgetStop && record !== null && record.budget.resets < AGENT_MAX_BUDGET_RESETS && (Boolean(access.requestConfig) || (remaining !== null && remaining >= 1));

  function stateFor(tool: AgentWorkTool): StepCardState {
    if (!record) return "locked";
    const step = latestFor(tool);
    const wasCleared = record.steps.some((s) => s.tool === tool && s.invalidated);
    if (step?.status === "done") {
      if (tool === "fit_check" && next?.kind === "gate" && next.gate === "A" && !userStopped) return "awaiting";
      return "done";
    }
    if (step?.status === "error") return "error";
    if (tool === "outreach_message" && next?.kind === "gate" && next.gate === "B" && !userStopped) return "awaiting";
    if (busy && tool === firstAllowed) return "running";
    if (step?.status === "interrupted" || step?.status === "running") return allowed.includes(tool) ? "interrupted" : "locked";
    if (skipStop && tool !== "fit_check") return "skipped";
    if (budgetStop) return "budget";
    if (userStopped) return "locked";
    if (allowed.includes(tool)) return "ready";
    if (wasCleared) return "cleared";
    return "locked";
  }

  const states = Object.fromEntries(AGENT_WORK_TOOLS.map((t) => [t, stateFor(t)])) as Record<AgentWorkTool, StepCardState>;
  const ACTIVE = new Set<StepCardState>(["awaiting", "running", "ready", "error", "interrupted"]);
  const activeTool = AGENT_WORK_TOOLS.find((t) => ACTIVE.has(states[t]));
  const showSkipBar = skipStop && fitStep?.status === "done";

  function gateFor(tool: AgentWorkTool): React.ReactNode {
    if (!record) return null;
    const st = states[tool];
    const step = latestFor(tool);
    if (tool === "fit_check") {
      if (editingJob) {
        return (
          <div className="agent-confirm" role="group" aria-label="Edit job details">
            <JobInput value={editingJob} onChange={setEditingJob} />
            <div className="agent-confirm-actions" style={{ marginTop: 16 }}>
              <button type="button" className="cta-primary" disabled={!editingJob.description.trim() || busy} onClick={() => rerun(editingJob)}>
                Re-run fit check
              </button>
              <button type="button" className="cta-secondary" onClick={() => setEditingJob(null)}>
                Cancel
              </button>
            </div>
          </div>
        );
      }
      if (showSkipBar) return <GateBar mode="skip" busy={busy} onStop={doStop} onOverride={doOverride} firstButtonRef={firstButtonRef} />;
      if (st === "awaiting")
        return <GateBar mode="gateA" busy={busy} onApprove={approveA} onEdit={() => setEditingJob({ ...EMPTY_JOB, ...record.job })} onStop={doStop} firstButtonRef={firstButtonRef} />;
    }
    if (tool === "outreach_message" && st === "awaiting") {
      return <GateBar mode="gateB" busy={busy} onDraftOutreach={draftOutreach} onDeclineOutreach={declineOut} onStop={doStop} firstButtonRef={firstButtonRef} />;
    }
    if (st === "running") return <GateBar mode="running" busy={false} onStop={doStop} />;
    if (tool === activeTool && !busy && (st === "error" || (fetchError && st === "ready"))) {
      return <GateBar mode="error" busy={busy} onRetry={retry} onStop={doStop} firstButtonRef={firstButtonRef} />;
    }
    if ((tool === "cover_letter" || tool === "outreach_message") && st === "done" && step?.output) {
      const label = AGENT_TOOL_LABELS[tool];
      if (editing === tool) return null;
      return (
        <div className="agent-actionbar" style={{ position: "static" }}>
          <button type="button" className="cta-secondary" disabled={busy} onClick={() => setEditing(tool)}>
            Edit draft<span className="sr-only"> {label}</span>
          </button>
        </div>
      );
    }
    return null;
  }

  function editSlotFor(tool: AgentWorkTool): React.ReactNode {
    if (editing !== tool) return undefined;
    const step = latestFor(tool);
    const result = step?.output?.data as MessageResult | undefined;
    if (!step || !result) return undefined;
    const subject = step.edit ? step.edit.subject ?? result.subject : result.subject;
    return (
      <ArtifactEditor
        label={AGENT_TOOL_LABELS[tool]}
        initialSubject={subject ? subject : undefined}
        initialBody={step.edit?.body ?? result.body}
        hasEdit={Boolean(step.edit)}
        onSave={(edit) => {
          const rec = current();
          if (rec) commit(saveArtifactEdit(rec, step.id, edit, Date.now()));
          setEditing(null);
          setLiveMessage("Edit saved. Saved to your Career Vault.");
        }}
        onCancel={() => setEditing(null)}
        onRevert={() => {
          const rec = current();
          if (rec) commit(revertArtifactEdit(rec, step.id, Date.now()));
          setEditing(null);
        }}
      />
    );
  }

  const lockedReasons: Partial<Record<AgentWorkTool, string>> = {
    tailor_resume: "Waiting for your fit check approval.",
    cover_letter: "Waiting for your fit check approval.",
    outreach_message: "Waiting for your resume and cover letter.",
  };

  const cards: StepCardProps[] = AGENT_WORK_TOOLS.map((tool, i) => {
    const step = latestFor(tool);
    const st = states[tool];
    return {
      index: i + 1,
      tool,
      label: AGENT_TOOL_LABELS[tool],
      state: st,
      lockedReason: st === "locked" ? lockedReasons[tool] : undefined,
      step: st === "done" || st === "awaiting" || st === "error" || st === "interrupted" ? step : undefined,
      active: tool === activeTool,
      expanded: expanded[tool] ?? (tool === activeTool || (st === "done" && tool === [...AGENT_WORK_TOOLS].reverse().find((t) => states[t] === "done"))),
      onToggle: () => setExpanded((prev) => ({ ...prev, [tool]: !(prev[tool] ?? true) })),
      profileName: profile.name ?? "",
      headingRef: headingRefs[tool],
      badges: {
        edited: Boolean(step?.edit),
        overridden: tool === "fit_check" && Boolean(record?.approvals.skipOverride && step && record.approvals.skipOverride.fitStepId === step.id),
      },
      editSlot: editSlotFor(tool),
      children: gateFor(tool),
    };
  });

  // ─── Left panel ────────────────────────────────────────────────────────────

  const missing = [
    ...(draft.description.trim() ? [] : ["Job description"]),
    ...(access.ready ? [] : ["an AI source (free tier or your own key)"]),
  ];
  const noVault = loaded && chunks.length === 0;
  const canStart = missing.length === 0 && !noVault && !busy;

  const view = record?.budget;
  const done = record?.status === "completed";
  const resumeButton =
    record && !busy && resumed && next?.kind === "step" ? (
      <button type="button" className="cta-primary" style={{ marginTop: 16, width: "100%" }} onClick={() => resume(record)}>
        Resume application
      </button>
    ) : null;
  const pausedButton =
    record && !busy && record.status === "paused" && next?.kind === "step" && !resumed ? (
      <button type="button" className="cta-primary" style={{ marginTop: 16, width: "100%" }} onClick={() => void advance(record)}>
        Resume application
      </button>
    ) : null;

  const summary =
    record === null ? null : (
      <div>
        <h2>{jobLabel(record.job)}</h2>
        <p className="agent-wrap" style={{ margin: 0, fontSize: 15 }}>
          {record.job.description.length.toLocaleString("en-US")} characters of job description
        </p>
        <p className="agent-meta" style={{ margin: "8px 0 0" }}>
          {record.status === "awaiting_approval" ? "Waiting for you. Nothing runs until you continue." : "Your progress is saved to your Career Vault."}
        </p>
      </div>
    );

  return (
    <div className="agent-layout" data-input-focus={inputFocus || undefined}>
      <aside className="agent-aside">
        {record === null ? (
          <form onSubmit={start}>
            <JobInput value={draft} onChange={setDraft} disabled={busy} />
            {loaded && noVault && (
              <div className="rounded-xl border border-zinc-200 p-4" style={{ marginTop: 16 }}>
                <p className="text-[14px] text-zinc-600">
                  <span className="font-semibold text-zinc-800">Make it about you.</span> Add your resume to your{" "}
                  <Link href="/vault" className="font-semibold text-red-600 hover:underline">
                    Career Vault
                  </Link>{" "}
                  first, then every step writes from your real experience, with citations.
                </p>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <AccessPanel access={access} remaining={remaining} />
            </div>
            {!access.requestConfig && <p className="field-help">{FREE_NOTE}</p>}
            <button type="submit" disabled={!canStart} className="cta-primary w-full disabled:cursor-not-allowed disabled:opacity-50" style={{ marginTop: 16 }}>
              Start application
            </button>
            {(missing.length > 0 || noVault) && (
              <p className="field-help" style={{ textAlign: "center" }}>
                Still needed: {[...missing, ...(noVault ? ["your resume in the Career Vault"] : [])].join(", ")}
              </p>
            )}
          </form>
        ) : (
          <div>
            {summary}
            <div style={{ marginTop: 16 }}>
              <AccessPanel access={access} remaining={remaining} />
            </div>
            {!access.requestConfig && <p className="field-help">{FREE_NOTE}</p>}
            {resumeButton}
            {pausedButton}
            {view && (
              <BudgetMeter
                budget={{
                  stepsUsed: view.stepsUsed,
                  tokensUsed: view.tokensUsed,
                  stepBudget: view.stepBudget,
                  tokenBudget: view.tokenBudget,
                  rejectedChoices: view.rejectedChoices,
                }}
              />
            )}
            <label className="agent-check">
              <input type="checkbox" checked={record.pauseAfterStep} onChange={(e) => setPause(e.target.checked)} />
              Pause after this step
            </label>
            {savedAt !== null && (
              <p className="agent-saved">Saved to your Career Vault {new Date(savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
            )}
          </div>
        )}
      </aside>

      <section aria-label="Application progress">
        {record === null && offered && (
          <div style={{ marginBottom: 16 }}>
            <RunBanner kind="resumed" stepName={pickUp(localNextAction(offered))} headingRef={bannerRef}>
              <p className="agent-meta" style={{ margin: "8px 0 0" }}>
                {jobLabel(offered.job)}
              </p>
              <button type="button" className="cta-primary" style={{ marginTop: 16 }} onClick={() => resume(offered)}>
                Resume application
              </button>
            </RunBanner>
          </div>
        )}

        {record === null && (
          <div className="empty" style={{ maxWidth: "none" }}>
            <h2>Paste a job, get a full application</h2>
            <p>
              Add the job description above and press Start application. Your progress is saved to your Career Vault, so you can close this page and pick it up later.
            </p>
          </div>
        )}

        {record && (
          <div style={{ display: "grid", gap: 16 }}>
            {resumed && (
              <RunBanner kind="resumed" stepName={pickUp(next as AgentNextAction)} headingRef={bannerRef}>
                {record.updatedAt ? (
                  <p className="agent-meta" style={{ margin: "8px 0 0" }}>
                    Last activity {new Date(record.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                ) : null}
              </RunBanner>
            )}
            {skipStop && <RunBanner kind="skipped" gaps={fitGaps(fitStep)} />}
            {budgetStop && next?.kind === "stop" && (
              <RunBanner kind="budget" message={next.message}>
                {canContinueBudget && (
                  <div style={{ marginTop: 16 }}>
                    <GateBar mode="budget" busy={busy} canContinueBudget onContinueBudget={newBudget} onStop={doStop} />
                  </div>
                )}
              </RunBanner>
            )}
            {userStopped && (
              <p className="agent-meta" style={{ margin: 0 }}>
                {record.stopReason?.message}
              </p>
            )}
            {fetchError && (
              <RunBanner
                kind="error"
                message={`${AGENT_TOOL_LABELS[activeTool ?? "fit_check"]} didn't finish: ${sentence(fetchError)}. Your earlier steps are saved. Try again, or stop here and keep what you have.`}
              />
            )}
            {done && (
              <RunBanner kind="completed">
                <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "grid", gap: 8 }}>
                  {AGENT_WORK_TOOLS.map((tool) => {
                    const step = latestFor(tool);
                    return (
                      <li key={tool} style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 600 }}>{AGENT_TOOL_LABELS[tool]}</span>
                        {step?.output ? (
                          <>
                            <CopyButton text={artifactText(step)} label="Copy" />
                            <button
                              type="button"
                              className="cta-secondary"
                              style={{ minHeight: 44 }}
                              onClick={() => {
                                const el = headingRefs[tool].current;
                                el?.scrollIntoView({ behavior: "smooth", block: "start" });
                                el?.focus();
                              }}
                            >
                              Jump to step<span className="sr-only"> {AGENT_TOOL_LABELS[tool]}</span>
                            </button>
                          </>
                        ) : (
                          <span className="agent-meta">Skipped</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div style={{ marginTop: 16 }}>
                  <button type="button" className="cta-secondary" onClick={startOver}>
                    Start another job
                  </button>
                </div>
              </RunBanner>
            )}
            {(userStopped || skipStop || budgetStop) && !done && (
              <div>
                <button type="button" className="cta-secondary" onClick={startOver}>
                  Start another job
                </button>
              </div>
            )}
            <StepTimeline cards={cards} liveMessage={liveMessage} />
          </div>
        )}
      </section>
    </div>
  );
}
