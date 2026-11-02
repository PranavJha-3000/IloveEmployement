// Deterministic first-pass profile extractor. Reuses the chunker's section and
// role detection, adds bounded regexes for contact details and dates, and
// computes confidence in code. Pure, offline, instant. Never calls a network;
// the LLM pass (a later plan) only refines what this returns.
import { contentHash } from "../retrieval/fusion";
import { canonicalizeSkill, normalizeSkills, skillsMentioned } from "../skills/normalize";
import { BULLET, looksLikeRoleHeader, sectionKind } from "../vault/chunker";
import { computeConfidence } from "./confidence";
import { findEmails, findPhones, findUrls, MAX_LINE, parseDateRange } from "./patterns";
import { StructuredProfileSchema, emptyProfile, type ExtractionResult, type StructuredProfile } from "./schema";

export const EXTRACTOR_VERSION = "det-1";
export const MAX_EXTRACT_CHARS = 50_000;

const MIN_SAFE_CHARS = 200;
const TRUNCATION_WARNING = "Resume text was longer than 50,000 characters; only the first 50,000 were read.";

type Kind = ReturnType<typeof sectionKind>;
interface Section {
  kind: NonNullable<Kind> | "summary";
  lines: string[];
}
interface Block {
  header: string[];
  bullets: string[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const trimSeps = (s: string) => squash(s.replace(/^[\s|,;:\-–—·•(\[]+|[\s|,;:\-–—·•)\]]+$/g, ""));

// ─── Sections (same grouping as chunkResume) ─────────────────────────────────

function groupSections(lines: string[]): Section[] {
  const sections: Section[] = [{ kind: "summary", lines: [] }];
  for (const line of lines) {
    const kind = sectionKind(line);
    if (kind) sections.push({ kind, lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  return sections;
}

const URL_ONLY = /^(?:https?:\/\/|www\.)\S+$/i;

function nameLike(line: string): boolean {
  return line.length <= 80 && !/[.!]$/.test(line) && !URL_ONLY.test(line) && /^[\p{Lu}\d]/u.test(line);
}

/** Header/bullet blocks with the same wrapped-bullet rule chunkResume uses. */
function splitBlocks(body: string[], mode: "experience" | "project"): Block[] {
  const blocks: Block[] = [];
  let header: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (header.length || bullets.length) blocks.push({ header, bullets });
    header = [];
    bullets = [];
  };
  for (const line of body) {
    if (BULLET.test(line)) {
      bullets.push(line.replace(BULLET, "").trim());
    } else if (bullets.length && !looksLikeRoleHeader(line) && line.length > 40) {
      bullets[bullets.length - 1] += ` ${line}`;
    } else {
      if (bullets.length) flush();
      else if (mode === "experience" && header.some((h) => parseDateRange(h)) && parseDateRange(line)) flush();
      else if (mode === "project" && header.length >= 1 && nameLike(line)) flush();
      header.push(line);
    }
  }
  flush();
  return blocks;
}

// ─── Contact ─────────────────────────────────────────────────────────────────

const TITLE_WORDS = [
  "engineer", "developer", "manager", "analyst", "designer", "intern", "lead", "director", "specialist",
  "coordinator", "consultant", "assistant", "scientist", "officer", "associate", "head", "architect",
  "administrator", "nurse", "accountant", "founder", "president", "executive", "supervisor", "programmer",
  "representative", "technician", "strategist", "advisor", "trainee",
];
const TITLE_RE = new RegExp(`(?<![\\p{L}])(?:${TITLE_WORDS.join("|")})s?(?![\\p{L}])`, "iu");
const hasTitleWord = (s: string) => TITLE_RE.test(s);

const NAME_WORD = /^\p{L}[\p{L}'.\-]*$/u;
const NOT_A_NAME = /^(?:curriculum vitae|resume|résumé|cv|contact|profile)$/i;

function findName(headerLines: string[]): { name: string; index: number } {
  for (let i = 0; i < Math.min(headerLines.length, 8); i++) {
    const line = headerLines[i];
    if (!line || /[\d@|]/.test(line) || NOT_A_NAME.test(line) || hasTitleWord(line)) continue;
    if (sectionKind(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => NAME_WORD.test(w))) return { name: squash(line), index: i };
  }
  return { name: "", index: -1 };
}

const NOT_LOCATION = /linkedin|github|gitlab|portfolio|website|email|e-mail|phone|mobile|tel\b|www\.|http/i;

function findLocation(headerLines: string[], nameIndex: number): string {
  for (let i = 0; i < Math.min(headerLines.length, 8); i++) {
    if (i === nameIndex) continue;
    const line = headerLines[i];
    if (!line || line.split(" ").length > 12) continue;
    for (const seg of line.split(/\s*\|\s*|\s{2,}|\s*[•·]\s*/)) {
      const s = squash(seg);
      if (!s || s.length > 40 || /\d|@|:/.test(s) || NOT_LOCATION.test(s) || hasTitleWord(s) || !/\p{L}/u.test(s)) continue;
      if (nameIndex >= 0 && s === headerLines[nameIndex]) continue;
      if (!/^[\p{L}][\p{L} .,'\-]*$/u.test(s)) continue;
      return s;
    }
  }
  return "";
}

// ─── Roles ───────────────────────────────────────────────────────────────────

const SEP = /\s+(?:@|at)\s+|\s*[|,–—·]\s*|\s+-\s+/;
const COMPANY_SUFFIX = /^(?:inc|llc|ltd|limited|corp|co|gmbh|pvt|plc)\.?$/i;

function splitParts(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(SEP)) {
    const p = trimSeps(raw);
    if (!p) continue;
    if (out.length && COMPANY_SUFFIX.test(p)) out[out.length - 1] += `, ${p}`;
    else out.push(p);
  }
  return out;
}

function stripMatched(line: string, matched: string): string {
  return line.replace(matched, " ").replace(/\(\s*\)|\[\s*\]/g, " ");
}

function buildRole(block: Block): StructuredProfile["roles"][number] | null {
  let start: StructuredProfile["roles"][number]["start"] = null;
  let end: StructuredProfile["roles"][number]["end"] = null;
  let current = false;
  let dated = false;
  const texts: string[] = [];
  for (const line of block.header) {
    const range = dated ? null : parseDateRange(line);
    if (range) {
      dated = true;
      start = range.start;
      end = range.end;
      current = range.current;
      texts.push(stripMatched(line, range.matched));
    } else {
      texts.push(line);
    }
  }
  const parts = texts.flatMap(splitParts);
  let title = "";
  let company = "";
  let location = "";
  if (parts.length === 1) {
    if (hasTitleWord(parts[0])) title = parts[0];
    else company = parts[0];
  } else if (parts.length >= 2) {
    const [a, b] = parts;
    const aT = hasTitleWord(a);
    const bT = hasTitleWord(b);
    if (bT && !aT) {
      title = b;
      company = a;
    } else {
      title = a;
      company = b;
    }
    if (parts[2] && parts[2].length <= 40) location = parts[2];
  }
  if (!title && !company && !block.bullets.length) return null;
  if (!block.bullets.length && !dated && !(title && hasTitleWord(title))) return null;
  return { title, company, location, start, end: current ? null : end, current, bullets: block.bullets.slice(0, 40).map((b) => clip(b, 600)) };
}

// ─── Education ───────────────────────────────────────────────────────────────

const DEGREE_CI = /(?<![\p{L}])(?:b\.?\s?tech|m\.?\s?tech|bsc|b\.sc|msc|m\.sc|mba|ph\.?d|bachelors?|masters?|diploma|certificate|associate|hnd|a-levels)(?![\p{L}])/iu;
const DEGREE_CS = /(?<![\p{L}])(?:B\.?E\.?|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?)(?![\p{L}])/u;
const INSTITUTION = /(?<![\p{L}])(?:university|college|institute|school|academy|polytechnic)(?![\p{L}])/iu;
const EDU_DETAIL = /gpa|cgpa|grade|percentage|honou?rs|distinction|cum laude|coursework|thesis|dean|scholarship|%/i;
const YEAR_G = /(?<![\d])(?:19|20)\d{2}(?![\d])/g;

const isDegree = (s: string) => DEGREE_CI.test(s) || DEGREE_CS.test(s);

interface EduLine {
  degree: string;
  institution: string;
  detail: string[];
  startYear: number | null;
  endYear: number | null;
}

function parseEduLine(rawLine: string): EduLine {
  let line = rawLine.replace(BULLET, "");
  let startYear: number | null = null;
  let endYear: number | null = null;
  const range = parseDateRange(line);
  if (range) {
    startYear = range.start?.year ?? null;
    endYear = range.current ? null : (range.end?.year ?? null);
    line = stripMatched(line, range.matched);
  } else {
    const years = [...line.matchAll(YEAR_G)].map((m) => Number(m[0]));
    if (years.length === 1) endYear = years[0];
    else if (years.length >= 2) {
      startYear = years[0];
      endYear = years[1];
    }
  }
  const textual = line
    .replace(YEAR_G, " ")
    .replace(/\b(?:expected|graduated|graduation|class of)\b:?/gi, " ")
    .replace(/\(\s*\)|\[\s*\]/g, " ");
  const out: EduLine = { degree: "", institution: "", detail: [], startYear, endYear };
  const segs = textual.split(/\s*[,|–—·]\s*|\s+-\s+/).map(trimSeps).filter(Boolean);
  if (!segs.length) return out;
  const degIdx = segs.findIndex(isDegree);
  const instIdx = segs.findIndex((s) => INSTITUTION.test(s));
  if (degIdx < 0 && instIdx < 0 && EDU_DETAIL.test(textual)) {
    out.detail.push(trimSeps(textual));
    return out;
  }
  const rest: string[] = [];
  segs.forEach((s, i) => {
    if (i === degIdx) out.degree = s;
    else if (i === instIdx) out.institution = s;
    else rest.push(s);
  });
  if (!out.institution && rest.length) out.institution = rest.pop() as string;
  if (!out.degree && !out.institution) return out;
  out.detail.push(...rest);
  return out;
}

function buildEducation(body: string[]): StructuredProfile["education"] {
  const entries: StructuredProfile["education"] = [];
  let cur: StructuredProfile["education"][number] | null = null;
  for (const line of body) {
    const e = parseEduLine(line);
    const hasContent = e.degree || e.institution || e.detail.length || e.startYear !== null || e.endYear !== null;
    if (!hasContent) continue;
    const newEntry = !cur || (e.degree && cur.degree) || (e.institution && cur.institution);
    if (newEntry) {
      if (!e.degree && !e.institution) continue;
      cur = { degree: e.degree, institution: e.institution, detail: e.detail.join("; "), startYear: e.startYear, endYear: e.endYear };
      entries.push(cur);
    } else if (cur) {
      if (!cur.degree) cur.degree = e.degree;
      if (!cur.institution) cur.institution = e.institution;
      if (e.detail.length) cur.detail = cur.detail ? `${cur.detail}; ${e.detail.join("; ")}` : e.detail.join("; ");
      if (cur.startYear === null) cur.startYear = e.startYear;
      if (cur.endYear === null) cur.endYear = e.endYear;
    }
  }
  return entries;
}

// ─── Skills ──────────────────────────────────────────────────────────────────

function skillTokens(body: string[]): string[] {
  const out: string[] = [];
  for (const rawLine of body) {
    let line = rawLine.replace(BULLET, "").replace(/^[\p{L}][\p{L} &/+.#\-]{0,40}:\s*/u, "");
    line = line.replace(/[()]/g, ",");
    for (const chunk of line.split(/[,;|•·\t]+|\s{3,}/)) {
      const c = trimSeps(chunk).replace(/\.$/, "");
      if (!c) continue;
      const pieces = c.includes("/") && !canonicalizeSkill(c).known ? c.split("/") : [c];
      for (const p of pieces) {
        const t = trimSeps(p);
        if (t && t.length <= 60 && t.split(/\s+/).length <= 6) out.push(t);
      }
    }
  }
  return out;
}

// ─── Projects ────────────────────────────────────────────────────────────────

function buildProject(block: Block): StructuredProfile["projects"][number] | null {
  const head = block.header[0] ?? "";
  const extra = block.header.slice(1);
  let link = "";
  for (const h of block.header.slice(0, 2)) {
    const u = findUrls(h)[0];
    if (u) {
      link = u;
      break;
    }
  }
  let nameLine = head;
  for (const u of findUrls(head)) nameLine = nameLine.replace(u, " ");
  const range = parseDateRange(nameLine);
  if (range) nameLine = stripMatched(nameLine, range.matched);
  nameLine = nameLine.replace(YEAR_G, " ").replace(/\(\s*\)|\[\s*\]/g, " ");
  const parts = nameLine.split(/\s*[|–—]\s*|\s+-\s+/).map(trimSeps).filter(Boolean);
  const name = parts[0] ?? "";
  if (!name) return null;
  const descBits = [...parts.slice(1), ...extra.filter((l) => !URL_ONLY.test(l)), ...block.bullets];
  const description = squash(descBits.join(" "));
  const skills = [...new Set(skillsMentioned(description).map((m) => m.entry.name))].slice(0, 30);
  return { name, description: clip(description, 1000), link, skills };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function extractProfile(raw: string): ExtractionResult {
  const warnings: string[] = [];
  let text = raw;
  if (text.length > MAX_EXTRACT_CHARS) {
    text = text.slice(0, MAX_EXTRACT_CHARS);
    warnings.push(TRUNCATION_WARNING);
  }
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => clip(l, MAX_LINE).trim());
  const sections = groupSections(lines);
  const headerLines = sections[0].lines.filter(Boolean);

  const profile = emptyProfile();
  const rawSkills: string[] = [];

  // Contact
  const { name, index } = findName(headerLines);
  const topText = headerLines.join("\n");
  profile.contact.name = name;
  profile.contact.email = findEmails(topText)[0] ?? findEmails(text)[0] ?? "";
  profile.contact.phone = findPhones(topText)[0] ?? findPhones(lines.slice(0, 12).join("\n"))[0] ?? "";
  profile.contact.location = findLocation(headerLines, index);
  profile.contact.links = findUrls(topText).slice(0, 10);

  for (const section of sections) {
    const body = section.lines.filter(Boolean);
    if (!body.length) continue;
    if (section.kind === "experience") {
      for (const block of splitBlocks(body, "experience")) {
        const role = buildRole(block);
        if (role) profile.roles.push(role);
      }
    } else if (section.kind === "education") {
      profile.education.push(...buildEducation(body));
    } else if (section.kind === "skill") {
      rawSkills.push(...skillTokens(body));
    } else if (section.kind === "project") {
      for (const block of splitBlocks(body, "project")) {
        const project = buildProject(block);
        if (project) profile.projects.push(project);
      }
    }
  }

  // Skills were collected as raw tokens above; normalise once, in order.
  profile.skills = normalizeSkills(rawSkills).slice(0, 150).map((s) => ({ name: clip(s.name, 200), canonicalId: s.canonicalId, matchedFrom: s.matchedFrom.slice(0, 20).map((m) => clip(m, 200)) }));

  profile.roles = profile.roles.slice(0, 30);
  profile.education = profile.education.slice(0, 30).map((e) => ({ ...e, degree: clip(e.degree, 200), institution: clip(e.institution, 200), detail: clip(e.detail, 600) }));
  profile.projects = profile.projects.slice(0, 30);

  const parsed = StructuredProfileSchema.parse(clipProfile(profile));
  return {
    profile: parsed,
    confidence: computeConfidence(parsed, raw),
    method: "deterministic",
    sourceHash: contentHash(raw),
    warnings,
  };
}

function clipProfile(p: StructuredProfile): StructuredProfile {
  return {
    contact: {
      name: clip(p.contact.name, 200),
      email: clip(p.contact.email, 254),
      phone: clip(p.contact.phone, 40),
      location: clip(p.contact.location, 200),
      links: p.contact.links.slice(0, 10).map((l) => clip(l, 300)),
    },
    roles: p.roles.map((r) => ({ ...r, title: clip(r.title, 200), company: clip(r.company, 200), location: clip(r.location, 200) })),
    education: p.education,
    skills: p.skills,
    projects: p.projects.map((x) => ({ ...x, name: clip(x.name, 200), link: clip(x.link, 300), skills: x.skills.map((s) => clip(s, 200)) })),
  };
}

/** Never throws. Null when the text is too short or nothing usable was found. */
export function safeExtractProfile(raw: string): ExtractionResult | null {
  try {
    if (typeof raw !== "string" || raw.length < MIN_SAFE_CHARS) return null;
    const result = extractProfile(raw);
    const p = result.profile;
    if (!p.contact.name && p.roles.length === 0 && p.skills.length === 0) return null;
    return result;
  } catch {
    return null;
  }
}
