// ─── Grounding Check ─────────────────────────────────────────────────────────
// Cheap, deterministic verification after generation:
// 1. Every citation must point at a vault chunk that was actually supplied.
// 2. Every figure in the output (numbers, %, money) must appear somewhere in
//    the user's own material. Invented metrics are the most common way AI
//    career writing lies, and they are easy to catch.

import type { Citation, VaultContextChunk } from "./types";

const FIGURE = /(?:[$₹€£]\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|k|K|m|M|x|X|\+|lpa|LPA|cr|L)?/g;

function normalizeFigure(f: string): string {
  return f.replace(/[\s,]/g, "").toLowerCase();
}

function toValue(f: string): number {
  return Number(f.replace(/[^\d.]/g, "").replace(/\.$/, ""));
}

/** Figures that are structural, not claims: years, small ordinals, list numbers. */
function isNoise(fig: string): boolean {
  const n = Number(fig.replace(/[^\d.]/g, ""));
  if (Number.isNaN(n)) return true;
  if (/^(19|20)\d{2}$/.test(fig)) return true;
  return /^\d$/.test(fig) && n <= 9;
}

export function checkGrounding(
  outputText: string,
  citations: Citation[],
  vault: VaultContextChunk[],
  sourceText: string,
): { citations: Citation[]; problems: string[] } {
  const problems: string[] = [];
  const ids = new Set(vault.map((c) => c.id));

  const valid = citations.filter((c) => ids.has(c.chunkId));
  const invalid = citations.length - valid.length;
  if (invalid) problems.push(`Dropped ${invalid} citation${invalid === 1 ? "" : "s"} pointing at material that wasn't supplied.`);

  // Compare whole numeric values, not substrings: "2" must not be "found" inside "280ms".
  const source = `${sourceText}\n${vault.map((c) => c.text).join("\n")}`;
  const knownValues = new Set((source.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(toValue));
  const unsupported = new Set<string>();
  for (const match of outputText.match(FIGURE) ?? []) {
    const fig = normalizeFigure(match);
    if (!fig || isNoise(fig)) continue;
    if (!knownValues.has(toValue(fig))) unsupported.add(match.trim());
  }
  if (unsupported.size) {
    problems.push(
      `These figures don't appear in anything you provided — check them before sending: ${[...unsupported].slice(0, 6).join(", ")}.`,
    );
  }

  return { citations: valid, problems };
}
