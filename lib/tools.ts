// ─── Tool Marketplace Data ──────────────────────────────────────────────────
// Every tool card, derived from the preset registry (lib/presets): adding a
// preset is all it takes for it to get a card, a nav entry and a /tools/<slug>
// page. This file only adds presentation: icons and category colours.

import type { PresetCategory } from "./engine/types";
import { PRESET_CATEGORY_LABELS, PUBLIC_PRESETS } from "./presets";

export type CategoryId = "all" | PresetCategory;

export interface Category {
  id: CategoryId;
  label: string;
}

/** Ordered along the employment lifecycle, from finding a job to growing in it. */
const CATEGORY_ORDER: PresetCategory[] = ["target", "materials", "outreach", "interview", "offer", "transition", "work", "growth", "fun"];

export const CATEGORIES: Category[] = [
  { id: "all", label: "All" },
  ...CATEGORY_ORDER.map((id) => ({ id, label: PRESET_CATEGORY_LABELS[id] })),
];

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: Exclude<CategoryId, "all">;
  /** simple line-art SVG path(s) drawn on a 24x24 viewBox */
  iconPaths: string[];
  /** accent color for the icon tile */
  accent: string;
  /** background tint behind the icon */
  tint: string;
  /** route path on the site this tool card opens */
  target: `/${string}`;
}

// ─── Icon paths (24x24, stroke-based, lucide-style) ─────────────────────────
const I = {
  fileSearch:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M11.5 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M14.5 15.5 17 18",
  target:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  robot:
    "M12 2v4 M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M9 11h.01 M15 11h.01 M9 15h6",
  languages: "m5 8 6 6 M4 14l6-6 2-3 M2 5h12 M7 2h1 M22 22l-5-10-5 10 M14 18h6",
  flame:
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  glasses:
    "M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M9 12a3 3 0 0 1 6 0 M3 12H2 M22 12h-1",
  penLine: "M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z",
  wrench:
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  listChecks: "m3 17 2 2 4-4 M3 7l2 2 4-4 M13 6h8 M13 12h8 M13 18h8",
  linkedin:
    "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v1.5A5.98 5.98 0 0 1 16 8z M6 9H2v12h4z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6 12 13 2 6",
  shieldAlert: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01",
  gap: "M3 3v18h18 M7 15l4-6 4 3 5-8",
  github:
    "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
  scale:
    "M12 3v18 M7 21h10 M5 7l7-4 7 4 M5 7 2 13a3 3 0 0 0 6 0z M19 7l-3 6a3 3 0 0 0 6 0z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  messages:
    "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5",
  swords:
    "M14.5 17.5 3 6V3h3l11.5 11.5 M13 19l6-6 M16 16l4 4 M19 21l2-2 M3 21l6-6 M5 18l-2 2",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z",
  userCircle:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 10h.01 M15 10h.01 M8.5 16.5a5 5 0 0 1 7 0",
  zap: "M13 2 3 14h9l-1 8 10-12h-9z",
  gauge: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 12l4-4 M12 9v3",
  skull:
    "M12 2a8 8 0 0 0-8 8c0 2.5 1.2 4.7 3 6.1V19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.9c1.8-1.4 3-3.6 3-6.1a8 8 0 0 0-8-8z M9 12h.01 M15 12h.01 M10 17h4",
  gavel:
    "m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10 M16 16l6-6 M8 8l6-6 M9 7l8 8 M21 11l-8-8",
  bug: "M8 2l1.5 3 M16 2l-1.5 3 M9 5h6a4 4 0 0 1 4 4v3a7 7 0 0 1-14 0V9a4 4 0 0 1 4-4z M3 10h2 M19 10h2 M3 15h2.5 M18.5 15H21 M9 21l1-3 M15 21l-1-3",

  // Added so every tool has a unique glyph. See the icon audit below.
  /** clipboard with lines — prepping/notes */
  clipboardList:
    "M8 2h8a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 12h6 M9 16h6",
  /** four-point sparkle — charm / rizz */
  sparkles:
    "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z",
  /** game controller — boss fight */
  gamepad:
    "M6 11h4 M8 9v4 M15 12h.01 M18 10h.01 M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z",
};

// ─── Engine presets ──────────────────────────────────────────────────────────
// Accent/tint per category keeps preset cards visually grouped.
const CATEGORY_COLORS: Record<PresetCategory, { accent: string; tint: string }> = {
  target: { accent: "#059669", tint: "#ecfdf5" },
  materials: { accent: "#2563eb", tint: "#eff6ff" },
  outreach: { accent: "#7c3aed", tint: "#f5f3ff" },
  interview: { accent: "#0891b2", tint: "#ecfeff" },
  offer: { accent: "#d97706", tint: "#fffbeb" },
  transition: { accent: "#b45309", tint: "#fff7ed" },
  work: { accent: "#475569", tint: "#f1f5f9" },
  growth: { accent: "#16a34a", tint: "#f0fdf4" },
  fun: { accent: "#db2777", tint: "#fdf2f8" },
};

// Ids are already checked for uniqueness in lib/presets.
export const TOOLS: Tool[] = PUBLIC_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  description: preset.tagline,
  category: preset.category,
  iconPaths: [I[preset.icon as keyof typeof I] ?? I.messages],
  ...CATEGORY_COLORS[preset.category],
  target: `/tools/${preset.slug}` as const,
})).sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
