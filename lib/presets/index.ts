import type { PresetCategory } from "../engine/types";
import { INTERVIEW_PRESETS } from "./interview";
import { MATCH_PRESETS } from "./match";
import { MESSAGE_PRESETS } from "./message";
import { OFFER_PRESETS } from "./offer";
import { TAILOR_PRESETS } from "./tailor";
import type { Preset } from "./types";

export type { Preset, MessagePreset, ReportPreset } from "./types";

export const PRESETS: Preset[] = [...MATCH_PRESETS, ...TAILOR_PRESETS, ...INTERVIEW_PRESETS, ...OFFER_PRESETS, ...MESSAGE_PRESETS];

/** Presets with their own page and card (hidden ones are internal steps of another tool). */
export const PUBLIC_PRESETS = PRESETS.filter((p) => !p.hidden);

export const PRESET_CATEGORY_LABELS: Record<PresetCategory, string> = {
  target: "Target",
  materials: "Resume & Profile",
  outreach: "Outreach",
  interview: "Interview",
  offer: "Offer",
  transition: "Join & Leave",
  work: "At Work",
  growth: "Growth",
  fun: "Fun",
};

const bySlug = new Map(PRESETS.map((p) => [p.slug, p]));
const byId = new Map(PRESETS.map((p) => [p.id, p]));

export function getPresetBySlug(slug: string): Preset | undefined {
  return bySlug.get(slug);
}

export function getPresetById(id: string): Preset | undefined {
  return byId.get(id);
}

if (process.env.NODE_ENV !== "production") {
  if (bySlug.size !== PRESETS.length || byId.size !== PRESETS.length) {
    throw new Error("lib/presets: preset ids and slugs must be unique.");
  }
}
