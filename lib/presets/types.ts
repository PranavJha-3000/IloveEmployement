import type { EngineId, FieldSpec, PresetCategory } from "../engine/types";

export type MessageFormat = "email" | "dm" | "letter" | "doc" | "script";

export interface PresetBase {
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
}

export interface MessagePreset extends PresetBase {
  engine: "message";
  /** Knowledge-base tags this preset may draw on. */
  kbTags: string[];
  /** Whether the Career Vault is offered as context. */
  usesVault: boolean;
  /** Query used to retrieve vault chunks; built from the user's inputs. */
  vaultQuery: (inputs: Record<string, string>) => string;
  format: MessageFormat | ((inputs: Record<string, string>) => MessageFormat);
  /** The instruction for this run, built from the user's inputs. */
  task: (inputs: Record<string, string>) => string;
}

export type Preset = MessagePreset;

export function resolveFormat(preset: MessagePreset, inputs: Record<string, string>): MessageFormat {
  return typeof preset.format === "function" ? preset.format(inputs) : preset.format;
}
