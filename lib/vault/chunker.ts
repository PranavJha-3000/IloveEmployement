// ─── Resume → Vault chunks ───────────────────────────────────────────────────
// Structure-aware chunking: a resume is split into sections by its headings,
// experience/projects into role blocks, and role blocks into one chunk per
// bullet. Each bullet chunk carries its role header in the title, so a
// retrieved bullet still knows where and when it happened. Deterministic and
// offline; an LLM structuring pass can refine it later.

import type { VaultChunk, VaultChunkKind } from "../engine/types";

const SECTION_PATTERNS: { kind: VaultChunkKind | "skip"; re: RegExp }[] = [
  { kind: "summary", re: /^(professional\s+)?(summary|profile|about( me)?|objective|overview)$/i },
  { kind: "experience", re: /^((work|professional|relevant)\s+)?(experience|employment( history)?|work history|career history)$/i },
  { kind: "project", re: /^(personal\s+|selected\s+|key\s+)?projects?$/i },
  { kind: "education", re: /^(education|academics?|academic background|qualifications)$/i },
  { kind: "skill", re: /^((technical|core|key)\s+)?(skills|competencies|tech(nical)? stack|tools( & technologies)?)$/i },
  { kind: "win", re: /^(achievements|awards|honou?rs|accomplishments|certifications?|publications|leadership)$/i },
  { kind: "skip", re: /^(references|contact|interests|hobbies|languages)$/i },
];

const BULLET = /^\s*([•●▪◦‣∙·\-–—*]|\d+[.)])\s+/;

function sectionKind(line: string): VaultChunkKind | "skip" | null {
  const clean = line.replace(/[:|_=\-–—]+$/g, "").trim();
  if (!clean || clean.length > 40) return null;
  for (const { kind, re } of SECTION_PATTERNS) if (re.test(clean)) return kind;
  return null;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

function chunk(kind: VaultChunkKind, title: string, text: string, now: number): VaultChunk {
  return { id: newId(), kind, title: title.slice(0, 120), text: text.trim(), source: "resume", createdAt: now };
}

/** Heading lines in a role block look like "Senior Engineer, Acme · 2022 – Present". */
function looksLikeRoleHeader(line: string): boolean {
  return !BULLET.test(line) && line.length <= 140 && (/(19|20)\d{2}|present|current/i.test(line) || /\s(@|at|\||,|–|—)\s/.test(line));
}

export function chunkResume(raw: string): VaultChunk[] {
  const now = Date.now();
  const lines = raw.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const chunks: VaultChunk[] = [];

  // Group lines under section headings; text before the first heading is the header/summary.
  const sections: { kind: VaultChunkKind | "skip"; lines: string[] }[] = [{ kind: "summary", lines: [] }];
  for (const line of lines) {
    const kind = sectionKind(line);
    if (kind) sections.push({ kind, lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }

  for (const section of sections) {
    const body = section.lines.filter(Boolean);
    if (!body.length || section.kind === "skip") continue;

    if (section.kind === "experience" || section.kind === "project") {
      let header: string[] = [];
      let bullets: string[] = [];
      const flush = () => {
        const title = header.join(" · ") || (section.kind === "project" ? "Project" : "Experience");
        if (header.length && !bullets.length) {
          chunks.push(chunk(section.kind as VaultChunkKind, title, header.join("\n"), now));
        } else if (bullets.length) {
          chunks.push(chunk(section.kind as VaultChunkKind, title, `${header.join("\n")}\n${bullets.map((b) => `- ${b}`).join("\n")}`, now));
          for (const b of bullets) chunks.push(chunk("bullet", title, b, now));
        }
        header = [];
        bullets = [];
      };

      for (const line of body) {
        if (BULLET.test(line)) {
          bullets.push(line.replace(BULLET, "").trim());
        } else if (bullets.length && !looksLikeRoleHeader(line) && line.length > 40) {
          // Wrapped continuation of the previous bullet.
          bullets[bullets.length - 1] += ` ${line}`;
        } else {
          if (bullets.length) flush();
          header.push(line);
        }
      }
      flush();
      continue;
    }

    if (section.kind === "summary") {
      // The first lines of a resume are usually name/contact; keep prose only.
      const prose = body.filter((l) => l.split(" ").length > 6);
      if (prose.length) chunks.push(chunk("summary", "Summary", prose.join(" "), now));
      continue;
    }

    if (section.kind === "win") {
      for (const line of body) chunks.push(chunk("win", "Achievement", line.replace(BULLET, ""), now));
      continue;
    }

    const title = section.kind === "skill" ? "Skills" : section.kind === "education" ? "Education" : "Note";
    chunks.push(chunk(section.kind, title, body.map((l) => l.replace(BULLET, "")).join("\n"), now));
  }

  // A resume with no recognisable headings still becomes useful chunks.
  if (!chunks.some((c) => c.kind !== "summary")) {
    const paragraphs = raw.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 30);
    return paragraphs.map((p, i) => chunk("note", `Resume part ${i + 1}`, p, now));
  }
  return chunks;
}

export function manualChunk(kind: VaultChunkKind, title: string, text: string, source: VaultChunk["source"] = "manual"): VaultChunk {
  return { id: newId(), kind, title: title.trim().slice(0, 120) || kind, text: text.trim(), source, createdAt: Date.now() };
}
