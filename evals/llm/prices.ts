// Committed price table (USD per 1M tokens, Standard tier, text input).
// Source: https://ai.google.dev/gemini-api/docs/pricing, fetched 2026-11-01.
// Values were copied from that page, not recalled. Where the page shows a
// dated promotional price, the price in effect on the retrieval date is used
// and the later price is recorded in `notes`.

export interface PriceRow {
  provider: string;
  model: string;
  /** Model-id prefixes that map to this row when there is no exact match. */
  matches: string[];
  inputPerMTok: number;
  outputPerMTok: number;
  /** When a call's prompt exceeds this many tokens, the long* prices apply. */
  longContextThresholdTokens?: number;
  longInputPerMTok?: number;
  longOutputPerMTok?: number;
  freeTierAvailable: boolean;
  /** Billed USD when running on the free tier. Always 0. */
  freeTierBilledUsd: number;
  sourceUrl: string;
  /** YYYY-MM-DD date the price was read from sourceUrl. */
  retrieved: string;
  notes: string;
}

export interface TokenUsage {
  promptTokens: number | null | undefined;
  completionTokens: number | null | undefined;
  thoughtsTokens?: number | null | undefined;
}

const SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";

export const PRICE_TABLE_RETRIEVED = "2026-11-01";

export const PRICE_TABLE_NOTE =
  "Estimates use paid-tier Standard list prices (text input, thinking tokens billed at the output price). Free-tier usage is billed $0. A model with no row has unknown cost, not $0.";

export const PRICE_TABLE: PriceRow[] = [
  {
    provider: "google",
    model: "gemini-3.8-flash",
    matches: ["gemini-3.8-flash"],
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $0.75 in / $3.75 out through 2026-12-31; $1.50 / $7.50 starting 2027-01-01.",
  },
  {
    provider: "google",
    model: "gemini-3.6-flash",
    matches: ["gemini-3.6-flash"],
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $0.75 in / $3.75 out through 2026-12-31; $1.50 / $7.50 starting 2027-01-01.",
  },
  {
    provider: "google",
    model: "gemini-3.5-flash-lite",
    matches: ["gemini-3.5-flash-lite"],
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $0.30 in (text/image/video/audio), $2.50 out.",
  },
  {
    provider: "google",
    model: "gemini-3.1-flash-lite",
    matches: ["gemini-3.1-flash-lite"],
    inputPerMTok: 0.25,
    outputPerMTok: 1.5,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $0.25 in (text/image/video), $0.50 audio; $1.50 out.",
  },
  {
    provider: "google",
    model: "gemini-3-flash-preview",
    matches: ["gemini-3-flash"],
    inputPerMTok: 0.5,
    outputPerMTok: 3.0,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $0.50 in (text/image/video), $1.00 audio; $3.00 out. Labelled legacy on the page.",
  },
  {
    provider: "google",
    model: "gemini-3.1-pro-preview",
    matches: ["gemini-3.1-pro"],
    inputPerMTok: 2.0,
    outputPerMTok: 12.0,
    longContextThresholdTokens: 200_000,
    longInputPerMTok: 4.0,
    longOutputPerMTok: 18.0,
    freeTierAvailable: false,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: free tier 'Not available'. $2.00 in / $12.00 out; $4.00 / $18.00 for prompts > 200k tokens. freeTierBilledUsd is 0 only because no free-tier use exists.",
  },
  {
    provider: "google",
    model: "gemini-2.5-pro",
    matches: ["gemini-2.5-pro"],
    inputPerMTok: 1.25,
    outputPerMTok: 10.0,
    longContextThresholdTokens: 200_000,
    longInputPerMTok: 2.5,
    longOutputPerMTok: 15.0,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $1.25 in / $10.00 out; $2.50 / $15.00 for prompts > 200k tokens.",
  },
  {
    provider: "google",
    model: "gemini-2.5-flash",
    matches: ["gemini-2.5-flash"],
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $0.30 in (text/image/video), $1.00 audio; $2.50 out.",
  },
  {
    provider: "google",
    model: "gemini-2.5-flash-lite",
    matches: ["gemini-2.5-flash-lite"],
    inputPerMTok: 0.1,
    outputPerMTok: 0.4,
    freeTierAvailable: true,
    freeTierBilledUsd: 0,
    sourceUrl: SOURCE,
    retrieved: "2026-11-01",
    notes: "Page: $0.10 in (text/image/video), $0.30 audio; $0.40 out.",
  },
];

/** Exact model match first, then the longest matching prefix, else null. */
export function lookupPrice(provider: string, model: string): PriceRow | null {
  const rows = PRICE_TABLE.filter((r) => r.provider === provider);
  const exact = rows.find((r) => r.model === model);
  if (exact) return exact;
  let best: PriceRow | null = null;
  let bestLen = -1;
  for (const row of rows) {
    for (const prefix of row.matches) {
      if (model.startsWith(prefix) && prefix.length > bestLen) {
        best = row;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

function validCount(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * Estimated paid-tier list-price cost of ONE call. Returns null (unknown) when
 * there is no price row or a token count is missing; never 0 for unknown.
 * thoughtsTokens are billed at the output price.
 */
export function estimateCostUsd(usage: TokenUsage, row: PriceRow | null): number | null {
  if (!row) return null;
  const thoughts = usage.thoughtsTokens ?? 0;
  if (!validCount(usage.promptTokens) || !validCount(usage.completionTokens) || !validCount(thoughts)) {
    return null;
  }
  const long =
    row.longContextThresholdTokens !== undefined &&
    usage.promptTokens > row.longContextThresholdTokens &&
    row.longInputPerMTok !== undefined &&
    row.longOutputPerMTok !== undefined;
  const inPrice = long ? (row.longInputPerMTok as number) : row.inputPerMTok;
  const outPrice = long ? (row.longOutputPerMTok as number) : row.outputPerMTok;
  return (usage.promptTokens * inPrice + (usage.completionTokens + thoughts) * outPrice) / 1_000_000;
}
