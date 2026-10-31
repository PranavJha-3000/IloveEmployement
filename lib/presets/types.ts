import type { EngineId, FieldSpec, PresetCategory } from "../engine/types";

export type MessageFormat = "email" | "dm" | "letter" | "doc" | "script";

/** Structured report shapes; each has a zod schema (lib/engine/reports.ts) and a renderer. */
export type ReportKind =
  | "fit"
  | "jd"
  | "gap"
  | "ats"
  | "resume"
  | "bullets"
  | "linkedin"
  | "proof"
  | "prep"
  | "star"
  | "mockPlan"
  | "answerEval"
  | "offers";

/** Outside evidence the server may fetch for a run. */
export type ExternalSource = "github";

interface PresetBase {
  id: string;
  /** Route segment: /tools/<slug>. Stable — it's an SEO URL. */
  slug: string;
  engine: EngineId;
  category: PresetCategory;
  name: string;
  /** One line for the tool card. */
  tagline: string;
  /** A sentence or two for the page and meta description. */
  description: string;
  /** Key into the icon set in lib/tools.ts. */
  icon: string;
  fields: FieldSpec[];
  /** Knowledge-base tags this preset may draw on. */
  kbTags: string[];
  /** Whether the Career Vault (or a pasted resume) is offered as context. */
  usesVault: boolean;
  /** The run is meaningless without a resume or vault (e.g. tailoring). */
  requiresProfile?: boolean;
  /** Query used to retrieve vault chunks; built from the user's inputs. */
  vaultQuery: (inputs: Record<string, string>) => string;
  /** Vault chunks to send. Whole-resume tools ask for (nearly) everything. */
  vaultLimit?: number;
  /** The instruction for this run, built from the user's inputs. */
  task: (inputs: Record<string, string>) => string;
  /** Run a second, independent reviewer pass and revise the draft if it finds problems. */
  review?: boolean;
  /** Internal step of another tool (e.g. per-answer grading); no card, no page. */
  hidden?: boolean;
}

export interface MessagePreset extends PresetBase {
  engine: "message";
  format: MessageFormat | ((inputs: Record<string, string>) => MessageFormat);
}

export interface ReportPreset extends PresetBase {
  engine: "match" | "tailor" | "interview" | "offer";
  output: ReportKind;
  sources?: ExternalSource[];
}

export type Preset = MessagePreset | ReportPreset;

export function resolveFormat(preset: MessagePreset, inputs: Record<string, string>): MessageFormat {
  return typeof preset.format === "function" ? preset.format(inputs) : preset.format;
}

export const DEFAULT_VAULT_LIMIT = 8;
export const MAX_VAULT_LIMIT = 60;
