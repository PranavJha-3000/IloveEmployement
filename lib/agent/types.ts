// Agent workflow types. Client-safe, types only. Records never carry an API key.

import type { AiRequestConfig } from "../types";
import type { RunMeta, VaultContextChunk, VaultProfile } from "../engine/types";
import type { AgentToolName, AgentWorkTool } from "./config";

export type FitVerdict = "APPLY" | "STRETCH" | "LONG_SHOT" | "SKIP";

export type AgentRunStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "paused"
  | "stopped"
  | "completed"
  | "error";

export type AgentStopKind = "step_budget" | "token_budget" | "skip_verdict" | "user" | "error";

export interface AgentStopReason {
  kind: AgentStopKind;
  message: string;
  at: number;
}

export interface AgentUsage {
  planner: number;
  tool: number;
  /** prompt + completion tokens */
  total: number;
}

export type AgentStepStatus = "running" | "done" | "error" | "rejected" | "interrupted";

export interface AgentStepRecord {
  id: string;
  tool: AgentToolName;
  requestedTool?: string;
  presetId?: string;
  status: AgentStepStatus;
  plannedBy: "model" | "policy-fallback";
  inputs: Record<string, string>;
  output?: { data: unknown; meta: RunMeta; sent: VaultContextChunk[] };
  verdict?: FitVerdict;
  edit?: { subject?: string; body: string; editedAt: number; grounding: string[] };
  /** Set on tailor_resume steps; Phase 5 lists these as resume versions. */
  target?: { jobTitle: string; company: string; jobUrl?: string };
  usage: AgentUsage;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  error?: string;
  invalidated?: { reason: "fit_rerun"; at: number };
}

export interface AgentJob {
  description: string;
  company: string;
  role: string;
  url?: string;
  notes?: string;
}

export interface AgentApprovals {
  gateA?: { fitStepId: string; approvedAt: number };
  gateB?: {
    decision: "draft" | "decline";
    approvedAt: number;
    recipientName?: string;
    recipientRole?: "recruiter" | "hiring-manager" | "team-member";
    channel?: "linkedin-note" | "linkedin-message" | "email";
  };
  skipOverride?: { fitStepId: string; confirmedAt: number };
}

export interface AgentBudget {
  stepsUsed: number;
  tokensUsed: number;
  stepBudget: number;
  tokenBudget: number;
  rejectedChoices: number;
  resets: number;
}

export interface AgentRunRecord {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  updatedAt: number;
  status: AgentRunStatus;
  stopReason?: AgentStopReason;
  job: AgentJob;
  steps: AgentStepRecord[];
  approvals: AgentApprovals;
  budget: AgentBudget;
  pauseAfterStep: boolean;
}

// ─── Wire types ──────────────────────────────────────────────────────────────

/** Artifacts summary only: outputs never travel back to the server. */
export type AgentStepSummary = Pick<
  AgentStepRecord,
  "id" | "tool" | "status" | "verdict" | "usage" | "invalidated"
>;

export interface AgentStepRequest {
  runId: string;
  job: AgentJob;
  steps: AgentStepSummary[];
  approvals: AgentApprovals;
  budget: { resets: number; claimedStepsUsed: number; claimedTokensUsed: number };
  vault: Partial<Record<AgentWorkTool, VaultContextChunk[]>>;
  retrieval?: Partial<Record<AgentWorkTool, "hybrid" | "keyword" | "whole">>;
  profile?: Partial<VaultProfile>;
  config?: AiRequestConfig;
}

export type AgentNextAction =
  | { kind: "step"; allowed: AgentWorkTool[] }
  | { kind: "gate"; gate: "A" | "B" }
  | {
      kind: "stop";
      reason: "step_budget" | "token_budget" | "skip_verdict";
      message: string;
    }
  | { kind: "complete" };

export interface AgentBudgetView {
  stepsUsed: number;
  tokensUsed: number;
  stepBudget: number;
  tokenBudget: number;
  rejectedChoices: number;
}

export type AgentStepResponse =
  | {
      kind: "step";
      step: AgentStepRecord;
      budget: AgentBudgetView;
      remaining: number | null;
      next: AgentNextAction;
    }
  | {
      kind: "rejected";
      step: AgentStepRecord;
      budget: AgentBudgetView;
      remaining: number | null;
      next: AgentNextAction;
    }
  | { kind: "blocked"; budget: AgentBudgetView; next: AgentNextAction };
