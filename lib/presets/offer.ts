// ─── Offer Engine Presets ────────────────────────────────────────────────────
// The model extracts each figure with a verbatim quote from the offer text;
// lib/engine/scoring.ts#offerTotals does every calculation. A figure the model
// can't quote is treated as unstated rather than trusted.

import { area, chips, text } from "./fields";
import type { ReportPreset } from "./types";

const offerText = (key: string, label: string, required: boolean) =>
  area(key, label, {
    required,
    untrusted: true,
    maxLength: 6000,
    placeholder: "Paste the offer letter or the numbers: base/fixed, bonus %, joining bonus, equity grant and vesting, benefits",
  });

export const OFFER_PRESETS: ReportPreset[] = [
  {
    id: "offer-comparator",
    slug: "job-offer-comparison",
    engine: "offer",
    output: "offers",
    category: "offer",
    name: "Offer Comparator",
    tagline: "Compare offers on real money, with the math shown.",
    description:
      "Compare up to three job offers side by side: year-one cash, recurring pay and a four-year total computed from the numbers in your offers (each one quoted back to you), plus equity explained in plain English and the questions to ask before you sign.",
    icon: "scale",
    fields: [
      offerText("offerA", "Offer A", true),
      offerText("offerB", "Offer B", true),
      offerText("offerC", "Offer C (optional)", false),
      text("current", "Current compensation", { placeholder: "Optional, e.g. ₹24 LPA fixed + 10% bonus", maxLength: 300 }),
      chips("priority", "What matters most right now?", [
        ["money", "Money"],
        ["growth", "Growth"],
        ["stability", "Stability"],
        ["balance", "Work-life balance"],
      ], "growth"),
    ],
    kbTags: ["offer", "equity"],
    usesVault: false,
    vaultQuery: () => "",
    task: (i) =>
      `Extract each offer's figures. For every number, copy the exact text it comes from into its quote field; if a figure isn't stated, use 0 and an empty quote. Do not compute totals, they are calculated in code. Convert shorthand to full units (₹32 LPA → 3200000, $150k → 150000). Fixed pay is base; don't fold PF, gratuity or insurance into base, list them in nonCash. Explain the equity in plain English. Weigh tradeoffs with the user's priority (${i.priority || "growth"}) in mind, and list the questions to clarify with each company.`,
  },
];
