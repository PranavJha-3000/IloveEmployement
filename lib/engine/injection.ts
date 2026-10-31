// ─── Injection Gate ──────────────────────────────────────────────────────────
// Deterministic screening for text the user pasted from elsewhere (job postings,
// emails they received). Runs before any model sees the text. It strips
// invisible characters outright and reports instruction-shaped lines; those lines
// stay in place but the whole block is fenced as data in the prompt.

const INVISIBLE = /[​-‍⁠﻿­]/g;
const BIDI = /[‪-‮⁦-⁩]/g;

const INSTRUCTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|all|any)\b.{0,20}\b(instructions?|rules|prompts?)\b/i, label: "asks the model to ignore its instructions" },
  { re: /\b(system|developer)\s+(prompt|message|instructions?)\b/i, label: "mentions a system prompt" },
  { re: /\byou are (now )?(an?|the) (ai|assistant|language model|llm|chatbot)\b/i, label: "tries to redefine the assistant" },
  { re: /\b(as an ai|if you are an ai|ai (model|assistant)s? (reading|processing) this)\b/i, label: "addresses AI readers directly" },
  { re: /\b(respond|reply|answer|output) (only )?with\b/i, label: "dictates the output" },
  { re: /<\|[a-z_]+\|>|\[\/?INST\]|<\/?(system|assistant|user)>/i, label: "contains chat-template tokens" },
  { re: /\b(rate|score|rank) (this|the) (candidate|applicant|resume) (as )?(highly|10|100|top)/i, label: "tries to steer the score" },
];

export interface GateResult {
  text: string;
  findings: string[];
}

export function screenUntrusted(raw: string): GateResult {
  const findings: string[] = [];

  const invisible = raw.match(INVISIBLE)?.length ?? 0;
  const bidi = raw.match(BIDI)?.length ?? 0;
  let text = raw.replace(INVISIBLE, "").replace(BIDI, "");
  if (invisible) findings.push(`Removed ${invisible} invisible character${invisible === 1 ? "" : "s"}.`);
  if (bidi) findings.push(`Removed ${bidi} text-direction control character${bidi === 1 ? "" : "s"}.`);

  for (const line of text.split(/\r?\n/)) {
    for (const { re, label } of INSTRUCTION_PATTERNS) {
      if (re.test(line)) {
        const excerpt = line.trim().slice(0, 90);
        findings.push(`A line ${label}: "${excerpt}${line.trim().length > 90 ? "…" : ""}"`);
        break;
      }
    }
  }

  // Collapse runs of blank lines that hidden-text tricks tend to leave behind.
  text = text.replace(/\n{4,}/g, "\n\n\n");
  return { text, findings };
}
