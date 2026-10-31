// ─── Deterministic scoring ───────────────────────────────────────────────────
// The model classifies evidence; code turns classifications into numbers and
// verdicts. Same classifications in → same score out, every time, and the
// formula is visible to the user instead of a vibe-based "73/100".

export type Evidence = "STRONG" | "PARTIAL" | "MISSING" | "UNVERIFIED";
export type Importance = "must" | "nice";

const EVIDENCE_VALUE: Record<Evidence, number> = { STRONG: 1, PARTIAL: 0.5, UNVERIFIED: 0.25, MISSING: 0 };
const IMPORTANCE_WEIGHT: Record<Importance, number> = { must: 2, nice: 1 };

export type FitVerdict = "APPLY" | "STRETCH" | "LONG_SHOT" | "SKIP";

export interface FitScore {
  score: number;
  verdict: FitVerdict;
  counts: Record<Evidence, number>;
  missingMustHaves: number;
  formula: string;
}

export function scoreRequirements(reqs: { importance: Importance; evidence: Evidence }[]): FitScore {
  const counts: Record<Evidence, number> = { STRONG: 0, PARTIAL: 0, MISSING: 0, UNVERIFIED: 0 };
  let earned = 0;
  let possible = 0;
  let missingMustHaves = 0;
  for (const r of reqs) {
    counts[r.evidence] += 1;
    const w = IMPORTANCE_WEIGHT[r.importance];
    earned += w * EVIDENCE_VALUE[r.evidence];
    possible += w;
    if (r.importance === "must" && r.evidence === "MISSING") missingMustHaves += 1;
  }
  const score = possible ? Math.round((earned / possible) * 100) : 0;

  let verdict: FitVerdict;
  if (score >= 70 && missingMustHaves === 0) verdict = "APPLY";
  else if (score >= 50 && missingMustHaves <= 1) verdict = "STRETCH";
  else if (score >= 30) verdict = "LONG_SHOT";
  else verdict = "SKIP";

  return {
    score,
    verdict,
    counts,
    missingMustHaves,
    formula: "Must-haves count double. Strong = 1, partial = ½, unverified = ¼, missing = 0. Any missing must-have caps the verdict.",
  };
}

// ─── ATS checks ──────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ")} `;
}

/** Whole-term match, tolerant of punctuation (e.g. "Node.js" vs "node js"). */
export function containsTerm(haystackNormalized: string, term: string): boolean {
  const t = normalize(term).trim();
  if (!t) return false;
  return haystackNormalized.includes(` ${t} `) || haystackNormalized.includes(` ${t.replace(/\./g, " ")} `);
}

export interface KeywordCoverage {
  term: string;
  importance: Importance;
  found: boolean;
  matchedAs: string;
  /** The model judged the user has this capability (cites vault chunks). */
  evidenced: boolean;
}

export function keywordCoverage(
  resumeText: string,
  keywords: { term: string; importance: Importance; synonyms: string[]; evidencedBy: string[] }[],
): { items: KeywordCoverage[]; score: number } {
  const hay = normalize(resumeText);
  let earned = 0;
  let possible = 0;
  const items = keywords.map((k) => {
    const candidates = [k.term, ...k.synonyms];
    const hit = candidates.find((c) => containsTerm(hay, c));
    const w = IMPORTANCE_WEIGHT[k.importance];
    possible += w;
    if (hit) earned += w;
    return { term: k.term, importance: k.importance, found: Boolean(hit), matchedAs: hit ?? "", evidenced: k.evidencedBy.length > 0 };
  });
  return { items, score: possible ? Math.round((earned / possible) * 100) : 0 };
}

export interface FormatCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export function formatChecks(resumeText: string): { checks: FormatCheck[]; score: number } {
  const text = resumeText;
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split(/\n/);
  const headings = ["experience", "education", "skills"].filter((h) => new RegExp(`^\\s*[A-Za-z ]*${h}[A-Za-z ]*:?\\s*$`, "im").test(text));
  const bulletLines = lines.filter((l) => /^\s*([•●▪◦‣\-–*]|\d+[.)])\s+/.test(l)).length;
  const pipeHeavy = lines.filter((l) => (l.match(/[|│┃]/g)?.length ?? 0) >= 3 || (l.match(/\t/g)?.length ?? 0) >= 3).length;
  const glyphs = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}-]/gu)?.length ?? 0;
  const dateStyles = new Set(
    (text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\b\d{1,2}\/\d{4}|\b\d{4}\s*[-–]\s*(?:\d{4}|present)/gi) ?? []).map((d) =>
      /\//.test(d) ? "numeric" : /^\d{4}/.test(d) ? "year" : "month",
    ),
  );

  const checks: FormatCheck[] = [
    { id: "email", label: "Email address as plain text", pass: /[\w.+-]+@[\w-]+\.[\w.]+/.test(text), detail: "ATS parsers need the email as text, not an icon or image." },
    { id: "phone", label: "Phone number", pass: /(\+?\d[\d\s().-]{8,}\d)/.test(text), detail: "Include a phone number with country code if applying abroad." },
    {
      id: "headings",
      label: "Standard section headings",
      pass: headings.length >= 2,
      detail: headings.length >= 2 ? `Found: ${headings.join(", ")}.` : "Use plain headings like Experience, Education and Skills so parsers can segment the resume.",
    },
    { id: "bullets", label: "Bulleted achievements", pass: bulletLines >= 4, detail: `${bulletLines} bullet line${bulletLines === 1 ? "" : "s"} found.` },
    {
      id: "length",
      label: "Reasonable length",
      pass: words >= 250 && words <= 1300,
      detail: `${words} words. Roughly 400–900 words fits one to two pages.`,
    },
    { id: "columns", label: "No table or multi-column layout", pass: pipeHeavy === 0, detail: pipeHeavy ? `${pipeHeavy} line(s) look like table or column text, which many parsers scramble.` : "Single-column text extracts cleanly." },
    { id: "glyphs", label: "No icon glyphs", pass: glyphs === 0, detail: glyphs ? `${glyphs} icon/emoji glyph(s) may extract as garbage characters.` : "No icon glyphs in the text layer." },
    { id: "dates", label: "Consistent date format", pass: dateStyles.size <= 1, detail: dateStyles.size <= 1 ? "Dates use one style." : "Mixes date styles; pick one (e.g. 'Mar 2023 – Present')." },
  ];
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { checks, score };
}
