// Offline structural tests of the LLM eval case set. No network, no model calls.
import assert from "node:assert";
import { test } from "node:test";
import { BACKEND_RESUME, CASES, type EvalCase } from "../evals/cases";
import { prepareCase, stableChunks } from "../evals/llm/caseRun";
import { caseFingerprint } from "../evals/llm/fingerprint";
import type { RunMeta } from "../lib/engine/types";
import { getPresetById } from "../lib/presets";
import { contentHash } from "../lib/retrieval/fusion";
import { DEFAULT_VAULT_LIMIT } from "../lib/presets/types";

test("stableChunks is deterministic with content-derived ids", () => {
  const a = stableChunks(BACKEND_RESUME);
  const b = stableChunks(BACKEND_RESUME);
  assert.deepStrictEqual(a, b);
  assert.ok(a.length > 3);
  const key = contentHash(BACKEND_RESUME);
  a.forEach((c, i) => {
    assert.strictEqual(c.id, `${key}-${String(i + 1).padStart(2, "0")}`);
    assert.strictEqual(c.createdAt, 0);
  });
});

test("prepareCase: no resume gives an empty vault and default profile name", () => {
  const c = CASES.find((x) => x.id === "jd-red-flags-quoted") as EvalCase;
  const p = prepareCase(c);
  assert.deepStrictEqual(p.vault, []);
  assert.strictEqual(p.profile.name, "Priya Sharma");
});

test("prepareCase: vault preset respects the limit and uses stable ids", () => {
  const c = CASES.find((x) => x.id === "fit-strong-match") as EvalCase;
  const p = prepareCase(c);
  assert.ok(p.vault.length > 0);
  assert.ok(p.vault.length <= (p.preset.vaultLimit ?? DEFAULT_VAULT_LIMIT));
  const ids = new Set(stableChunks(c.resume as string).map((x) => x.id));
  for (const v of p.vault) assert.ok(ids.has(v.id), `unexpected id ${v.id}`);
  assert.strictEqual(p.profile.name, "Priya Sharma");
  assert.deepStrictEqual(prepareCase(c).vault, p.vault);
});

test("prepareCase throws on an unknown preset", () => {
  const bad: EvalCase = { id: "x", presetId: "nope", description: "", inputs: {}, tags: ["baseline"], expect: () => [] };
  assert.throws(() => prepareCase(bad), /Unknown preset nope/);
});

test("caseFingerprint is stable and sensitive to inputs", () => {
  assert.strictEqual(caseFingerprint(CASES), caseFingerprint(CASES));
  const changed = CASES.map((c, i) => (i === 0 ? { ...c, inputs: { ...c.inputs, extra: "changed" } } : c));
  assert.notStrictEqual(caseFingerprint(changed), caseFingerprint(CASES));
});

// ─── Case-set structure ──────────────────────────────────────────────────────

const EMPTY_META = { injection: [], grounding: [] } as unknown as RunMeta;
const NEW_FROM = 10;

test("case set size, unique ids, engines and adversarial tags", () => {
  assert.ok(CASES.length >= 25);
  assert.strictEqual(new Set(CASES.map((c) => c.id)).size, CASES.length);
  const engines = new Set(CASES.map((c) => getPresetById(c.presetId)?.engine));
  assert.deepStrictEqual([...engines].sort(), ["fun", "interview", "match", "message", "offer", "tailor"]);
  for (const tag of ["injection", "fabrication-bait", "missing-info", "unstated-offer"] as const) {
    assert.ok(CASES.filter((c) => c.tags.includes(tag)).length >= 2, `tag ${tag} needs 2+ cases`);
  }
});

test("every case has valid preset, required fields, limits and profile", () => {
  for (const c of CASES) {
    const preset = getPresetById(c.presetId);
    assert.ok(preset, `${c.id}: unknown preset ${c.presetId}`);
    for (const f of preset.fields) {
      if (f.kind === "resume") continue;
      const v = c.inputs[f.key];
      if (f.required) assert.ok(typeof v === "string" && v.trim().length > 0, `${c.id}: required field ${f.key} empty`);
      if (typeof v === "string" && f.maxLength) assert.ok(v.length <= f.maxLength, `${c.id}: ${f.key} exceeds maxLength`);
      if (typeof v === "string" && v && f.kind === "chips") {
        assert.ok(f.options?.some((o) => o.value === v), `${c.id}: ${f.key}="${v}" not an allowed option`);
      }
    }
    if (preset.requiresProfile) assert.ok(c.resume, `${c.id}: requiresProfile but no resume`);
  }
});

test("new cases use fictional contact details only", () => {
  for (const c of CASES.slice(NEW_FROM)) {
    const text = [...Object.values(c.inputs), c.resume && c.resume !== BACKEND_RESUME ? c.resume : ""].join("\n");
    for (const email of text.match(/[\w.+-]+@[\w.-]+/g) ?? []) assert.ok(/@example\.com$/i.test(email), `${c.id}: non-example.com email ${email}`);
    for (const ph of text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []) {
      if (ph.replace(/\D/g, "").length < 9) continue;
      assert.ok(/555-01\d\d/.test(ph), `${c.id}: phone-like number ${ph}`);
    }
  }
});

test("no expectation passes vacuously on empty output", () => {
  for (const c of CASES) {
    let failures: string[] | null = null;
    try {
      failures = c.expect({}, EMPTY_META);
    } catch {
      continue; // a throw is treated as a failure by the runner
    }
    assert.ok(failures && failures.length > 0, `${c.id}: passes on empty data`);
  }
});
