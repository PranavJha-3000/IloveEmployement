// Skill normalisation over the curated taxonomy. Pure and deterministic.
// Deliberately imports nothing from lib/vault, lib/kb or lib/engine so the
// scoring code can depend on this module without a cycle.
import { SKILL_TAXONOMY, type SkillEntry } from "./taxonomy";

export interface NormalizedSkill {
  name: string;
  canonicalId: string | null;
  matchedFrom: string[];
}

const MAX_SCAN_CHARS = 50_000;

/**
 * Collision key: NFKC, lowercase, then every character outside [a-z0-9+#] is
 * removed. "React.js", "ReactJS" and "react js" collide on purpose.
 */
export function skillKey(s: string): string {
  return s.normalize("NFKC").toLowerCase().trim().replace(/[^a-z0-9+#]/g, "");
}

// ─── Alias index (built once) ────────────────────────────────────────────────

const BY_ID = new Map<string, SkillEntry>();
const INDEX = new Map<string, SkillEntry>();

function allForms(entry: SkillEntry): string[] {
  return [entry.name, ...entry.aliases, ...(entry.caseSensitive ?? [])];
}

for (const entry of SKILL_TAXONOMY) {
  if (BY_ID.has(entry.id)) throw new Error(`Duplicate skill id "${entry.id}"`);
  BY_ID.set(entry.id, entry);
  for (const form of allForms(entry)) {
    const key = skillKey(form);
    if (!key) throw new Error(`Skill "${entry.id}" has a form with an empty key: "${form}"`);
    const existing = INDEX.get(key);
    if (existing && existing.id !== entry.id) {
      throw new Error(`Skill alias collision on "${key}": "${existing.id}" and "${entry.id}" (form "${form}")`);
    }
    INDEX.set(key, entry);
  }
}

/** Test/inspection hook: every key with the entry it resolves to. */
export function aliasIndexSize(): number {
  return INDEX.size;
}

// ─── Canonicalisation ────────────────────────────────────────────────────────

export function canonicalizeSkill(raw: string): { input: string; entry: SkillEntry | null; name: string; known: boolean } {
  const input = raw.trim();
  const key = skillKey(input);
  const entry = key ? (INDEX.get(key) ?? null) : null;
  return { input, entry, name: entry ? entry.name : input, known: entry !== null };
}

export function normalizeSkills(raws: string[]): NormalizedSkill[] {
  const out: NormalizedSkill[] = [];
  const byKey = new Map<string, NormalizedSkill>();
  for (const raw of raws) {
    const c = canonicalizeSkill(raw);
    if (!c.input) continue;
    const k = c.entry ? `id:${c.entry.id}` : `raw:${skillKey(c.input) || c.input.toLowerCase()}`;
    let item = byKey.get(k);
    if (!item) {
      item = { name: c.name, canonicalId: c.entry?.id ?? null, matchedFrom: [] };
      byKey.set(k, item);
      out.push(item);
    }
    if (!item.matchedFrom.includes(c.input)) item.matchedFrom.push(c.input);
  }
  return out;
}

/** Every way a skill may be written: canonical name, aliases and case-sensitive forms. Unknown terms return [term]. */
export function surfaceForms(term: string): string[] {
  const { entry } = canonicalizeSkill(term);
  if (!entry) return [term.trim() || term];
  return [...new Set(allForms(entry))];
}

// ─── Scanning free text ──────────────────────────────────────────────────────

interface FormMatcher {
  entry: SkillEntry;
  form: string;
  length: number;
  regex: RegExp;
}

/** Short all-capitals forms ("AP", "CV", "PR") are ordinary words when lowercased, so they only count as written. */
function isCaseSensitiveForm(form: string, entry: SkillEntry): boolean {
  if (entry.caseSensitive?.includes(form)) return true;
  const letters = form.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return false;
  return form.length <= (form === entry.name ? 2 : 3);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Boundary rules mirror scoring's containsTerm: a form must not touch another
// [a-z0-9+#.] character, but a trailing sentence period is allowed.
const LEAD = "(?<![A-Za-z0-9+#.])";
const TRAIL = "(?![A-Za-z0-9+#]|\\.[A-Za-z0-9+#])";

function normalizedTokens(form: string): string[] {
  return form
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function buildPattern(tokens: string[]): string {
  // Literal tokens joined by a single flat quantifier: no nested quantifiers.
  return LEAD + tokens.map(escapeRegex).join("[^A-Za-z0-9+#.]+") + TRAIL;
}

let MATCHERS: FormMatcher[] | null = null;

function matchers(): FormMatcher[] {
  if (MATCHERS) return MATCHERS;
  const list: FormMatcher[] = [];
  for (const entry of SKILL_TAXONOMY) {
    const seen = new Set<string>();
    for (const form of allForms(entry)) {
      const sensitive = isCaseSensitiveForm(form, entry);
      if (sensitive) {
        const literal = form.trim();
        const sig = `s:${literal}`;
        if (!literal || seen.has(sig)) continue;
        seen.add(sig);
        // Exact-case literal; internal whitespace may vary.
        const tokens = literal.split(/\s+/).map(escapeRegex);
        // A bare letter ("R", "C") must not be lifted out of "R&D" or "A/B".
        const single = literal.length === 1;
        const lead = single ? LEAD + "(?<![&/])" : LEAD;
        const trail = single ? TRAIL + "(?![&/])" : TRAIL;
        list.push({ entry, form: literal, length: literal.length, regex: new RegExp(lead + tokens.join("\\s+") + trail, "g") });
        continue;
      }
      const tokens = normalizedTokens(form);
      if (!tokens.length) continue;
      const variants = [tokens];
      // "node.js" is also written "node js"; leading dots (".net") are left alone.
      const joined = tokens.join(" ");
      if (/[^.]\.[^.]/.test(joined)) variants.push(joined.replace(/\./g, " ").split(" ").filter(Boolean));
      for (const v of variants) {
        const sig = `i:${v.join(" ")}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        list.push({ entry, form, length: v.join(" ").length, regex: new RegExp(buildPattern(v), "gi") });
      }
    }
  }
  list.sort((a, b) => b.length - a.length);
  MATCHERS = list;
  return list;
}

/**
 * Canonical skills mentioned in free text. Whole-term matches, longest form
 * first; a shorter match overlapping an accepted longer one is discarded
 * ("Go-to-market" is not Go, "Google" is not Go). Results are ordered by first
 * position in the text. Input is capped at 50,000 characters.
 */
export function skillsMentioned(text: string): { entry: SkillEntry; matched: string }[] {
  const t = text.length > MAX_SCAN_CHARS ? text.slice(0, MAX_SCAN_CHARS) : text;
  if (!t.trim()) return [];
  const accepted: { start: number; end: number }[] = [];
  const found = new Map<string, { entry: SkillEntry; matched: string; at: number }>();
  for (const m of matchers()) {
    m.regex.lastIndex = 0;
    let hit: RegExpExecArray | null;
    while ((hit = m.regex.exec(t)) !== null) {
      if (hit[0].length === 0) {
        m.regex.lastIndex += 1;
        continue;
      }
      const start = hit.index;
      const end = start + hit[0].length;
      if (accepted.some((a) => start < a.end && end > a.start)) continue;
      accepted.push({ start, end });
      if (!found.has(m.entry.id)) found.set(m.entry.id, { entry: m.entry, matched: hit[0], at: start });
      else if (start < found.get(m.entry.id)!.at) found.set(m.entry.id, { entry: m.entry, matched: hit[0], at: start });
    }
  }
  return [...found.values()].sort((a, b) => a.at - b.at).map(({ entry, matched }) => ({ entry, matched }));
}

// ─── Autocomplete ────────────────────────────────────────────────────────────

/** Prefix suggestions for the skill editor: exact key, then name prefix, then alias prefix. */
export function suggestSkills(query: string, limit = 8): { entry: SkillEntry; matched: string }[] {
  const q = skillKey(query);
  if (!q || limit <= 0) return [];
  const ranked: { entry: SkillEntry; matched: string; rank: number; order: number }[] = [];
  SKILL_TAXONOMY.forEach((entry, order) => {
    let best: { matched: string; rank: number } | null = null;
    for (const form of allForms(entry)) {
      const key = skillKey(form);
      if (!key.startsWith(q)) continue;
      const isName = form === entry.name;
      const rank = key === q ? 0 : isName ? 1 : 2;
      if (!best || rank < best.rank) best = { matched: form, rank };
    }
    if (best) ranked.push({ entry, matched: best.matched, rank: best.rank, order });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.slice(0, limit).map(({ entry, matched }) => ({ entry, matched }));
}
