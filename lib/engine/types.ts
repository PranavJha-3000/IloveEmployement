// ─── Engine Types ────────────────────────────────────────────────────────────
// Shared by the browser (forms, vault retrieval) and the server (run pipeline).
// Nothing in here may import server-only modules.

import type { AiRequestConfig } from "../types";

export type EngineId = "message" | "match" | "tailor" | "interview" | "offer" | "growth" | "fun";

export type PresetCategory =
  | "target"
  | "materials"
  | "outreach"
  | "interview"
  | "offer"
  | "transition"
  | "work"
  | "growth"
  | "fun";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  /**
   * "resume": a paste/upload box. When filled, the browser chunks it and sends
   * the chunks as this run's vault context (it is not saved unless asked).
   */
  kind: "text" | "textarea" | "select" | "chips" | "resume";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: FieldOption[];
  /** Default value for select/chips fields. */
  defaultValue?: string;
  maxLength?: number;
  /**
   * Text the user pasted from somewhere else (a job posting, an email they got).
   * It runs through the injection gate and is fenced as data in the prompt.
   */
  untrusted?: boolean;
}

// ─── Career Vault ────────────────────────────────────────────────────────────

export type VaultChunkKind =
  | "summary"
  | "experience"
  | "bullet"
  | "project"
  | "education"
  | "skill"
  | "story"
  | "win"
  | "note";

export interface VaultChunk {
  id: string;
  kind: VaultChunkKind;
  /** Short label shown in citations, e.g. "Senior Engineer @ Acme". */
  title: string;
  text: string;
  source: "resume" | "manual" | "star" | "linkedin" | "github";
  createdAt: number;
}

/** The subset of a chunk that leaves the browser for a run. */
export type VaultContextChunk = Pick<VaultChunk, "id" | "kind" | "title" | "text">;

// ─── Run contract ────────────────────────────────────────────────────────────

export interface VaultProfile {
  name: string;
  headline: string;
  location: string;
  targetRole: string;
  links: string;
}

export interface RunRequestBody {
  inputs: Record<string, string>;
  /** Chunks the browser retrieved from the user's vault for this task. */
  vault?: VaultContextChunk[];
  /** Basic identity from the vault, used for sign-offs and framing. */
  profile?: Partial<VaultProfile>;
  /** Omit (or leave apiKey empty) to use the free tier. */
  config?: AiRequestConfig;
}

export interface Citation {
  chunkId: string;
  claim: string;
}

export interface ContextManifestEntry {
  id: string;
  title: string;
  tokens: number;
  truncated: boolean;
  dropped: boolean;
}

export interface RunMeta {
  tier: "free" | "byok";
  model: string;
  /** Remaining free runs today; null for BYOK. */
  remaining: number | null;
  context: ContextManifestEntry[];
  knowledge: { id: string; title: string }[];
  usage: { promptTokens: number; completionTokens: number } | null;
  /** Problems the injection gate found in pasted text. */
  injection: { field: string; findings: string[] }[];
  /** Grounding problems: dropped citations, unsupported figures. */
  grounding: string[];
  /** Present when the preset runs a reviewer pass over its draft. */
  review?: { issues: ReviewIssue[]; revised: boolean };
  /** Outside evidence fetched for this run (e.g. GitHub repos). */
  sources?: { id: string; title: string; ok: boolean; detail: string }[];
}

export interface ReviewIssue {
  severity: "high" | "medium" | "low";
  where: string;
  problem: string;
  fix: string;
}

export interface RunSuccess<T> {
  data: T;
  meta: RunMeta;
}

export interface RunFailure {
  error: string;
}
