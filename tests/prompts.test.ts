// Prompt lint over every preset: the cheap, deterministic part of "are the per-tool prompts good".
import assert from "node:assert/strict";
import { test } from "node:test";
import { KB } from "../lib/kb/entries";
import { PRESETS } from "../lib/presets";
import { resolveFormat } from "../lib/presets/types";

/** Sample inputs: every field filled, so task() sees the same shape a real run does. */
function sample(p: (typeof PRESETS)[number]): Record<string, string> {
  return Object.fromEntries(p.fields.map((f) => [f.key, f.options?.[0]?.value ?? "sample text"]));
}

const KB_TAGS = new Set(KB.flatMap((e) => e.tags));

test("every preset builds a substantive task instruction", () => {
  for (const p of PRESETS) {
    const t = p.task(sample(p));
    assert.ok(t.length >= 60, `${p.id}: task too short (${t.length})`);
  }
});

test("every kbTag resolves to at least one knowledge-base entry", () => {
  for (const p of PRESETS) for (const tag of p.kbTags) assert.ok(KB_TAGS.has(tag), `${p.id}: unknown kbTag "${tag}"`);
});

test("no task tells the model to invent facts", () => {
  const bad = /(?<!never )(?<!not )(?<!don.t )\b(make up|fabricate|invent (a|an|some|new)|pretend)\b/i;
  for (const p of PRESETS) assert.ok(!bad.test(p.task(sample(p))), `${p.id}: task invites invention`);
});

test("message presets resolve a format; high-stakes materials get a reviewer pass", () => {
  for (const p of PRESETS) if (p.engine === "message") assert.ok(resolveFormat(p, sample(p)), `${p.id}: no format`);
  for (const id of ["tailor-resume", "cover-letter"]) assert.equal(PRESETS.find((p) => p.id === id)?.review, true, `${id} needs review`);
});
