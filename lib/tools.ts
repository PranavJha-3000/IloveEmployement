// ─── Tool Marketplace Data ──────────────────────────────────────────────────
// Every tool card, derived from the preset registry (lib/presets): adding a
// preset is all it takes for it to get a card, a nav entry and a /tools/<slug>
// page. This file only adds presentation: icons (lib/toolIcons) and category colours.

import type { PresetCategory } from "./engine/types";
import { PRESET_CATEGORY_LABELS, PUBLIC_PRESETS } from "./presets";
import { APPLY_ICON, FALLBACK_ICON, TOOL_ICONS, type ToolIconSpec } from "./toolIcons";

export type CategoryId = "all" | PresetCategory;

export interface Category {
  id: CategoryId;
  label: string;
  /** one line under the section heading saying what the group is for */
  blurb: string;
}

/** Ordered along the employment lifecycle, from finding a job to growing in it. */
const CATEGORY_ORDER: PresetCategory[] = ["target", "materials", "outreach", "interview", "offer", "transition", "work", "growth", "fun"];

const CATEGORY_BLURBS: Record<PresetCategory, string> = {
  target: "Decide which jobs are worth your time.",
  materials: "Get your resume past the robots and the humans.",
  outreach: "Messages to recruiters and referrers that get replies.",
  interview: "Prepare, practise and debrief.",
  offer: "Negotiate, accept or decline.",
  transition: "Resign, start a new job, or explain a gap.",
  work: "Everyday emails and plans for the job you have.",
  growth: "Reviews, promotions and raises.",
  fun: "Roasts, bingo and aura checks. Still useful.",
};

export const CATEGORIES: Category[] = [
  { id: "all", label: "All", blurb: "" },
  ...CATEGORY_ORDER.map((id) => ({ id, label: PRESET_CATEGORY_LABELS[id], blurb: CATEGORY_BLURBS[id] })),
];

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: Exclude<CategoryId, "all">;
  /** composite icon: main symbol plus an optional badge (see lib/toolIcons) */
  icon: ToolIconSpec;
  /** accent color for the icon tile */
  accent: string;
  /** background tint behind the icon */
  tint: string;
  /** route path on the site this tool card opens */
  target: `/${string}`;
}

// ─── Engine presets ──────────────────────────────────────────────────────────
// Accent/tint per category keeps preset cards visually grouped.
const CATEGORY_COLORS: Record<PresetCategory, { accent: string; tint: string }> = {
  target: { accent: "#e5322d", tint: "#fdecea" },
  materials: { accent: "#f0603c", tint: "#fef0eb" },
  outreach: { accent: "#b0479b", tint: "#f8ecf6" },
  interview: { accent: "#3b6fd8", tint: "#ebf1fc" },
  offer: { accent: "#3e9b4f", tint: "#ecf6ee" },
  transition: { accent: "#e0a100", tint: "#fdf5e0" },
  work: { accent: "#4a6fa5", tint: "#edf1f7" },
  growth: { accent: "#1f9aa0", tint: "#e8f6f6" },
  fun: { accent: "#e0457b", tint: "#fdedf2" },
};

// Ids are already checked for uniqueness in lib/presets.
export const TOOLS: Tool[] = PUBLIC_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  description: preset.tagline,
  category: preset.category,
  icon: TOOL_ICONS[preset.id] ?? FALLBACK_ICON,
  ...CATEGORY_COLORS[preset.category],
  target: `/tools/${preset.slug}` as const,
})).sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

/**
 * The agent workflow card. Deliberately NOT part of TOOLS: it is not a preset,
 * so it must not show up in search, header menus or /tools/[slug] static params.
 */
export const APPLY_TOOL: Tool = {
  id: "apply-to-this-job",
  name: "Apply to this job",
  description: "Fit check, tailored resume, cover letter and outreach in one guided run.",
  category: "target",
  icon: APPLY_ICON,
  ...CATEGORY_COLORS.target,
  target: "/apply",
};

// ─── Search ──────────────────────────────────────────────────────────────────
// Plain words people type mapped to the words the tools actually use, so
// "email" finds message tools and "quit" finds the resignation letter.
const SYNONYMS: Record<string, string[]> = {
  email: ["message", "mail", "note", "reply", "letter"],
  mail: ["message", "email"],
  dm: ["message", "cold"],
  linkedin: ["message", "profile", "cold"],
  cv: ["resume"],
  pay: ["salary", "raise", "negotiation"],
  money: ["salary", "raise", "negotiation"],
  quit: ["resignation", "notice"],
  resign: ["resignation"],
  leave: ["leave", "resignation", "time"],
  fired: ["layoff", "gap"],
  laid: ["layoff"],
  job: ["fit", "jd"],
  posting: ["jd", "job"],
  promo: ["promotion"],
  boss: ["manager", "1:1"],
  practice: ["mock", "interview"],
};

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9:]+/).filter(Boolean);
}

/** Tools ranked by how well they match `query`; name matches count most. */
export function searchTools(query: string): Tool[] {
  const terms = words(query);
  if (terms.length === 0) return TOOLS;

  const scored = TOOLS.map((tool) => {
    const name = words(tool.name);
    const rest = words(`${tool.description} ${PRESET_CATEGORY_LABELS[tool.category]} ${tool.id}`);
    let score = 0;
    for (const term of terms) {
      const variants = [term, ...(SYNONYMS[term] ?? [])];
      const hit = (pool: string[]) => pool.some((w) => variants.some((v) => w.startsWith(v)));
      if (hit(name)) score += 3;
      else if (hit(rest)) score += 1;
    }
    return { tool, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.tool);
}

export function toolById(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}
