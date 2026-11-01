// ─── Deterministic scoring ───────────────────────────────────────────────────
// The model classifies evidence; code turns classifications into numbers and
// verdicts. Same classifications in → same score out, every time, and the
// formula is visible to the user instead of a vibe-based "73/100".

import { canonicalizeSkill, skillsMentioned, surfaceForms } from "../skills/normalize";

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
  /** Canonical skill name when the term (or one of its synonyms) is in the taxonomy. */
  canonical: string | null;
  /** The model judged the user has this capability (cites vault chunks). */
  evidenced: boolean;
}

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Forms the taxonomy lists as ordinary words ("Go", "Rust") only count when written with that exact capitalisation. */
function caseSensitiveFormPresent(form: string, rawText: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9+#.])${escapeRe(form)}(?![A-Za-z0-9+#])`).test(rawText);
}

/**
 * Whether a skill appears in the text under its own name or any alias.
 * `term` itself keeps the legacy whole-term rule; aliases of a taxonomy skill
 * that are ordinary words need their exact capitalisation.
 */
function skillFormFound(form: string, hs: Haystacks, rawText: string, entryCaseSensitive: readonly string[], isOriginal: boolean): boolean {
  if (isOriginal) return containsTerm(hs.strict, form);
  // Aliases also tolerate a sentence-final period ("...on k8s.") that the strict normaliser keeps attached.
  if (!containsTerm(hs.strict, form) && !containsTerm(hs.loose, form)) return false;
  return entryCaseSensitive.includes(form) ? caseSensitiveFormPresent(form, rawText) : true;
}

interface Haystacks {
  strict: string;
  loose: string;
}

function haystacks(rawText: string): Haystacks {
  return { strict: normalize(rawText), loose: ` ${rawText.toLowerCase().replace(/[^a-z0-9+#]+/g, " ")} ` };
}

/** Candidates for one source term: the term as written first, then every taxonomy form of it. */
function candidatesFor(source: string): { form: string; original: boolean; caseSensitive: readonly string[] }[] {
  const entry = canonicalizeSkill(source).entry;
  const cs = entry?.caseSensitive ?? [];
  return [{ form: source, original: true, caseSensitive: cs }, ...surfaceForms(source).map((form) => ({ form, original: false, caseSensitive: cs }))];
}

export function keywordCoverage(
  resumeText: string,
  keywords: { term: string; importance: Importance; synonyms: string[]; evidencedBy: string[] }[],
): { items: KeywordCoverage[]; score: number } {
  const hay = haystacks(resumeText);
  let earned = 0;
  let possible = 0;
  const items = keywords.map((k) => {
    const seen = new Set<string>();
    const candidates = [k.term, ...k.synonyms]
      .flatMap(candidatesFor)
      .filter((c) => {
        const key = c.form.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const hit = candidates.find((c) => skillFormFound(c.form, hay, resumeText, c.caseSensitive, c.original))?.form;
    const w = IMPORTANCE_WEIGHT[k.importance];
    possible += w;
    if (hit) earned += w;
    const canonical = [k.term, ...k.synonyms].map((t) => canonicalizeSkill(t)).find((c) => c.known)?.name ?? null;
    return { term: k.term, importance: k.importance, found: Boolean(hit), matchedAs: hit ?? "", canonical, evidenced: k.evidencedBy.length > 0 };
  });
  return { items, score: possible ? Math.round((earned / possible) * 100) : 0 };
}

/** True when `skill` (or any alias of it) is in `rawText`. Used to decide which skills a tailored resume may keep. */
export function skillInText(skill: string, rawText: string): boolean {
  const hay = haystacks(rawText);
  return candidatesFor(skill).some((c) => skillFormFound(c.form, hay, rawText, c.caseSensitive, c.original));
}

// ─── Canonical skill evidence for requirements ───────────────────────────────

export interface SkillMatch {
  skills: string[];
  matchedAs: string[];
  correctedFrom: "MISSING";
}

/**
 * When a requirement names taxonomy skills and EVERY one of them is in the
 * resume under some alias, returns which skills and how they were written.
 * Null when it names no taxonomy skill or any named skill is absent.
 */
export function canonicalSkillEvidence(requirement: string, resumeText: string): { skills: string[]; matchedAs: string[] } | null {
  const mentioned = skillsMentioned(requirement);
  if (!mentioned.length) return null;
  const hay = haystacks(resumeText);
  const skills: string[] = [];
  const matchedAs: string[] = [];
  for (const { entry } of mentioned) {
    const cs = entry.caseSensitive ?? [];
    const found = surfaceForms(entry.name).find((f) => skillFormFound(f, hay, resumeText, cs, false));
    if (!found) return null;
    skills.push(entry.name);
    matchedAs.push(found);
  }
  return { skills, matchedAs };
}

/**
 * Code-side correction of the model's classification: MISSING becomes PARTIAL
 * (never STRONG) when the resume provably contains every named skill. Returns a
 * new array; the correction is attached as `skillMatch` so the UI can show it.
 */
export function applySkillEvidence<R extends { requirement: string; evidence: Evidence }>(
  reqs: R[],
  resumeText: string,
): (R & { skillMatch?: SkillMatch })[] {
  return reqs.map((r) => {
    if (r.evidence !== "MISSING") return { ...r };
    const ev = canonicalSkillEvidence(r.requirement, resumeText);
    if (!ev) return { ...r };
    return { ...r, evidence: "PARTIAL" as const, skillMatch: { ...ev, correctedFrom: "MISSING" as const } };
  });
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

// ─── Offer math ──────────────────────────────────────────────────────────────
// The model only extracts numbers (each with a verbatim quote); all money
// arithmetic happens here so totals are reproducible and assumptions explicit.

export interface OfferNumbers {
  name: string;
  base: number;
  variablePct: number;
  joiningBonus: number;
  otherCash: number;
  equityKind: "rsu" | "options" | "none";
  equityGrantValue: number;
  equityVestYears: number;
}

export interface OfferTotals {
  name: string;
  variable: number;
  equityPerYear: number;
  /** Options are illiquid paper; excluded from the cash view. */
  equityIsPaper: boolean;
  year1Cash: number;
  annualRecurring: number;
  fourYearTotal: number;
}

export function offerTotals(o: OfferNumbers): OfferTotals {
  const variable = Math.round((o.base * o.variablePct) / 100);
  const vest = o.equityVestYears > 0 ? o.equityVestYears : 4;
  const equityPerYear = o.equityKind === "none" ? 0 : Math.round(o.equityGrantValue / vest);
  const equityIsPaper = o.equityKind === "options";
  const cashEquity = equityIsPaper ? 0 : equityPerYear;
  return {
    name: o.name,
    variable,
    equityPerYear,
    equityIsPaper,
    year1Cash: o.base + variable + o.joiningBonus + o.otherCash,
    annualRecurring: o.base + variable + cashEquity,
    fourYearTotal: 4 * (o.base + variable) + o.joiningBonus + o.otherCash + cashEquity * Math.min(4, vest),
  };
}

// ─── Interview answer signals ────────────────────────────────────────────────
// Cheap, explainable signals interviewers actually react to.

export interface AnswerSignals {
  words: number;
  /** Rough speaking time at ~140 words per minute. */
  seconds: number;
  iCount: number;
  weCount: number;
  hasNumbers: boolean;
  fillerCount: number;
  notes: string[];
}

export function answerSignals(answer: string): AnswerSignals {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const iCount = (answer.match(/\b(I|I'm|I've|I'd|my|me)\b/g) ?? []).length;
  const weCount = (answer.match(/\b(we|we're|we've|our|us)\b/gi) ?? []).length;
  const hasNumbers = /\d/.test(answer);
  const fillerCount = (answer.match(/\b(basically|actually|literally|kind of|sort of|like,|you know|stuff like that)\b/gi) ?? []).length;
  const seconds = Math.round((words / 140) * 60);

  const notes: string[] = [];
  if (words < 60) notes.push(`Short (${words} words): most behavioural answers need 90–150 seconds to land a result.`);
  if (seconds > 180) notes.push(`Long (~${Math.round(seconds / 60)} min spoken): aim for under two minutes, then let them ask.`);
  if (weCount > iCount * 2 && weCount >= 3) notes.push(`"We" ${weCount}× vs "I" ${iCount}×: say what *you* did.`);
  if (!hasNumbers) notes.push("No concrete numbers: add scale, time or impact if you have it.");
  if (fillerCount >= 3) notes.push(`${fillerCount} filler phrases: they read as hedging.`);
  return { words, seconds, iCount, weCount, hasNumbers, fillerCount, notes };
}
