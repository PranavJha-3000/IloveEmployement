// Bounded patterns and parsers for the deterministic profile extractor.
// Every regex uses bounded quantifiers, has no nested unbounded quantifier and
// no alternation inside a repeated group. Text is processed line by line with
// each line sliced to MAX_LINE, so no pattern ever sees more than 1,000
// characters at once. Pure and offline.
import type { YearMonth } from "./schema";

export const MAX_LINE = 1000;

function eachLine(text: string): string[] {
  if (typeof text !== "string") return [];
  return text.split("\n").map((l) => (l.length > MAX_LINE ? l.slice(0, MAX_LINE) : l));
}

function unique(items: string[], key: (s: string) => string = (s) => s): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

// ─── Emails ──────────────────────────────────────────────────────────────────

const EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,5}/g;

export function findEmails(text: string): string[] {
  const out: string[] = [];
  for (const line of eachLine(text)) {
    for (const m of line.matchAll(EMAIL)) {
      const e = m[0].replace(/[.-]+$/, "").toLowerCase();
      const tld = e.slice(e.lastIndexOf(".") + 1);
      if (/^[a-z]{2,24}$/.test(tld)) out.push(e);
    }
  }
  return unique(out);
}

// ─── Phones ──────────────────────────────────────────────────────────────────

const PHONE =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,5}(?:[\s.-]\d{2,5}){1,4}|(?<![\d])\+?\d{10,15}(?!\d)/g;
const YEAR_SPAN = /^(?:19|20)\d{2}\s{0,2}[-.]\s{0,2}(?:19|20)\d{2}$/;

export function findPhones(text: string): string[] {
  const out: string[] = [];
  for (const line of eachLine(text)) {
    for (const m of line.matchAll(PHONE)) {
      const s = m[0].trim();
      const digits = s.replace(/\D/g, "").length;
      if (digits < 7 || digits > 15) continue;
      if (YEAR_SPAN.test(s)) continue;
      out.push(s);
    }
  }
  return unique(out, (s) => s.replace(/\D/g, ""));
}

// ─── URLs ────────────────────────────────────────────────────────────────────

const URL_TAIL = `[^\\s<>"'()|,;]{1,300}`;
const URL_RE = new RegExp(
  `(?:https?:\\/\\/|www\\.)${URL_TAIL}|(?<![@\\w.\\/-])(?:[A-Za-z0-9-]{1,63}\\.){1,3}[A-Za-z]{2,24}\\/${URL_TAIL}`,
  "g",
);

export function findUrls(text: string): string[] {
  const out: string[] = [];
  for (const line of eachLine(text)) {
    for (const m of line.matchAll(URL_RE)) {
      const u = m[0].replace(/[.,;:!?)\]}>'"]+$/, "");
      if (u.length > 4 && !u.includes("@")) out.push(u);
    }
  }
  return unique(out, (s) => s.toLowerCase());
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5,
  june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

const validYear = (y: number) => Number.isInteger(y) && y >= 1950 && y <= 2100;

export function parseYearMonth(token: string): YearMonth | null {
  if (typeof token !== "string") return null;
  const t = token.trim().slice(0, 40);
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})[-.](\d{1,2})$/))) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    return validYear(y) && mo >= 1 && mo <= 12 ? { year: y, month: mo } : null;
  }
  if ((m = t.match(/^(\d{1,2})\/(\d{4})$/))) {
    const y = Number(m[2]);
    const mo = Number(m[1]);
    return validYear(y) && mo >= 1 && mo <= 12 ? { year: y, month: mo } : null;
  }
  if ((m = t.match(/^([A-Za-z]{3,9})\.?,?\s{1,3}(\d{4})$/))) {
    const mo = MONTHS[m[1].toLowerCase()];
    const y = Number(m[2]);
    return mo && validYear(y) ? { year: y, month: mo } : null;
  }
  if ((m = t.match(/^(\d{4})$/))) {
    const y = Number(m[1]);
    return validYear(y) ? { year: y, month: null } : null;
  }
  return null;
}

const MONTH_SRC =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const YEAR_SRC = "(?:19|20)\\d{2}";
const DATE_SRC = `(?:${MONTH_SRC}\\.?,?\\s{0,3}${YEAR_SRC}|\\d{1,2}\\/${YEAR_SRC}|${YEAR_SRC}[-.]\\d{1,2}(?!\\d)|${YEAR_SRC})`;
const PRESENT_SRC = "(?:present|current|now|today|ongoing)";
const RANGE = new RegExp(
  `(?<![\\w])(${DATE_SRC})\\s{0,3}(?:[-–—]|to|until|till)\\s{0,3}(${DATE_SRC}|${PRESENT_SRC})(?![\\w])`,
  "i",
);
const PRESENT_ONLY = /^(?:present|current|now|today|ongoing)$/i;

export function parseDateRange(
  line: string,
): { start: YearMonth | null; end: YearMonth | null; current: boolean; matched: string } | null {
  if (typeof line !== "string") return null;
  const l = line.length > MAX_LINE ? line.slice(0, MAX_LINE) : line;
  const m = RANGE.exec(l);
  if (!m) return null;
  const current = PRESENT_ONLY.test(m[2].trim());
  const start = parseYearMonth(m[1]);
  const end = current ? null : parseYearMonth(m[2]);
  if (!start && !end && !current) return null;
  return { start, end, current, matched: m[0] };
}
