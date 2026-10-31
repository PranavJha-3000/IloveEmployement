import assert from "node:assert";
import { test } from "node:test";
import { CASES } from "../evals/cases";
import { prepareCase } from "../evals/llm/caseRun";
import { extractCitationUnits } from "../evals/llm/citations";
import { buildLabelItems, handLabelsSchema, parseHandLabels, renderLabelSheet, selectLabelItems } from "../evals/llm/labels";
import type { CaseOutcome } from "../evals/llm/metrics";
import type { CallRecord } from "../evals/llm/recordingModel";
import { loadRubric, rubricHash } from "../evals/llm/rubric";

// Everything here is synthetic test data: no real model output and no real human labels.

const MODELS = ["google:gen-alpha", "google:gen-beta"];

const call = (modelKey: string, caseId: string, responseText: string): CallRecord => ({
  caseId, modelKey, purpose: "generation", role: "generate", hash: "h", cached: false, latencyMs: 1,
  promptTokens: 1, completionTokens: 1, thoughtsTokens: 0, modelVersion: "v", temperature: 0.6, finishReason: "stop", responseText,
});

function outcomes(scoreValue: 1 | 2 | 3 | 4 = 3, extraBody = ""): CaseOutcome[] {
  const out: CaseOutcome[] = [];
  for (const c of CASES) {
    const p = prepareCase(c);
    const ids = new Set(p.vault.map((v) => v.id));
    const cited = p.vault.slice(0, 7).map((v) => ({ chunkId: v.id, claim: `claim about ${v.id}` }));
    const draft = JSON.stringify({ body: `synthetic body ${extraBody}`, citations: cited.length ? cited : [{ chunkId: "not-supplied", claim: "x" }] });
    for (const m of MODELS) {
      out.push({
        caseId: c.id, engine: p.engine, tags: [...c.tags], modelKey: m, ok: true, passed: true, failures: [],
        calls: [call(m, c.id, draft)], judgeCalls: [],
        units: extractCitationUnits(JSON.parse(draft), ids),
        judge: {
          ok: true, scores: { groundedness: scoreValue, task_fit: scoreValue, clarity: scoreValue },
          reasons: { groundedness: "", task_fit: "", clarity: "" }, claims: [], citationVerdicts: {}, unjudged: [], ignoredVerdicts: 0,
        },
      });
    }
  }
  return out;
}

const key = (o: CaseOutcome) => `${o.caseId}|${o.modelKey}`;

test("selectLabelItems: deterministic, stratified by engine, alternates models, caps at n", () => {
  const all = outcomes();
  const a = selectLabelItems(all, { n: 30 });
  const b = selectLabelItems([...all].reverse(), { n: 30 });
  assert.deepStrictEqual(a.map(key), b.map(key), "input order must not matter");
  assert.strictEqual(a.length, 30);
  const engines = new Set(all.map((o) => o.engine));
  for (const e of engines) assert.ok(a.filter((o) => o.engine === e).length >= Math.min(3, all.filter((o) => o.engine === e).length), `engine ${e}`);
  const perModel = MODELS.map((m) => a.filter((o) => o.modelKey === m).length);
  assert.ok(Math.abs(perModel[0] - perModel[1]) <= engines.size, `models should alternate, got ${perModel}`);
  assert.strictEqual(new Set(a.map(key)).size, 30);
});

test("selectLabelItems: fewer eligible than n returns all; failed and unjudged outcomes are not eligible", () => {
  const all = outcomes().slice(0, 10);
  all[0] = { ...all[0], ok: false };
  all[1] = { ...all[1], judge: undefined };
  all[2] = { ...all[2], judge: { ok: false, error: "x" } };
  assert.strictEqual(selectLabelItems(all, { n: 30 }).length, 7);
});

test("selectLabelItems ignores judge scores", () => {
  const low = selectLabelItems(outcomes(1), { n: 30 }).map(key);
  const high = selectLabelItems(outcomes(4), { n: 30 }).map(key);
  assert.deepStrictEqual(low, high);
});

test("items and sheet are blind: no judge, scores, reasons or model ids", () => {
  // Preset task text is shown to the labeller verbatim, and one preset legitimately uses the verb
  // "judge" in its own prompt wording. The blindness grep covers everything else, so leave that case out.
  const usesVerb = new Set(CASES.filter((c) => /judge/i.test(prepareCase(c).preset.task(c.inputs))).map((c) => c.id));
  const selected = selectLabelItems(outcomes().filter((o) => !usesVerb.has(o.caseId)), { n: 30 });
  const { items, key: keyMap } = buildLabelItems(selected);
  assert.strictEqual(items.length, 30);
  assert.deepStrictEqual(items.map((i) => i.id).slice(0, 3), ["L01", "L02", "L03"]);
  assert.strictEqual(Object.keys(keyMap).length, 30);
  assert.deepStrictEqual(Object.keys(keyMap["L01"]).sort(), ["caseId", "modelKey"]);
  const rubric = loadRubric();
  const sheet = renderLabelSheet(items, rubric);
  for (const text of [JSON.stringify(items), sheet]) {
    for (const bad of [/judge/i, /scores/i, /reasons/i, /gen-alpha/, /gen-beta/, /google:/]) assert.ok(!bad.test(text), `leaked ${bad}`);
  }
  assert.ok(items.every((i) => i.units.length <= 5 && i.units.every((u) => u.chunkId)));
  assert.ok(items.some((i) => i.units.length > 0), "fixture should produce citation units");
});

test("buildLabelItems: marks pasted inputs untrusted, includes vault chunks and truncates long output", () => {
  const c = CASES.find((x) => x.tags.includes("injection")) ?? CASES[0];
  const long = outcomes().find((o) => o.caseId === c.id) as CaseOutcome;
  long.calls = [call(long.modelKey, long.caseId, JSON.stringify({ body: "x".repeat(20000) }))];
  const { items } = buildLabelItems([long]);
  assert.ok(items[0].output.length <= 12000 + "\n[truncated]".length);
  assert.ok(items[0].output.endsWith("[truncated]"));
  assert.ok(items[0].inputs.some((i) => i.untrusted) || prepareCase(c).preset.fields.every((f) => !f.untrusted));
  assert.strictEqual(items[0].vault.length, prepareCase(c).vault.length);
});

test("sheet: self-contained, textContent only, no external URLs, script-breaking text is escaped", () => {
  const hostile = "</script><img src=x onerror=alert(1)> <!-- ";
  const selected = selectLabelItems(outcomes(3, hostile), { n: 5 });
  const { items } = buildLabelItems(selected);
  items[0].output = hostile;
  const sheet = renderLabelSheet(items, loadRubric());
  assert.ok(!sheet.includes("innerHTML"));
  assert.ok(sheet.includes("textContent"));
  assert.ok(!/(?:src|href)\s*=\s*["']?https?:/i.test(sheet), "no external src/href");
  assert.ok(!/<link\b|<script[^>]*\ssrc=/i.test(sheet), "no linked styles or scripts");
  assert.ok(!sheet.includes(hostile), "hostile text must not appear raw");
  // The only "</script>" occurrences are the two real closing tags.
  assert.strictEqual(sheet.split("</script>").length - 1, 2);
  const data = /<script type="application\/json" id="sheet-data">([\s\S]*?)<\/script>/.exec(sheet);
  assert.ok(data);
  const parsed = JSON.parse(data[1]);
  assert.strictEqual(parsed.items[0].output, hostile, "round-trips through the JSON element");
  assert.strictEqual(parsed.rubricHash, rubricHash(loadRubric()));
  for (const needle of ["groundedness", "task_fit", "clarity", "supports", "partial", "does_not_support", "localStorage", "Download hand-labels.json", "hand-labels.json"]) {
    assert.ok(sheet.includes(needle), needle);
  }
  assert.ok(/type = "radio"/.test(sheet));
  assert.ok(/<textarea|createElement\("textarea"\)|el\("textarea"\)/.test(sheet));
});

// ─── parseHandLabels ─────────────────────────────────────────────────────────

const ITEMS = [
  { id: "L01", units: [{ index: 1 }, { index: 2 }] },
  { id: "L02", units: [] as Array<{ index: number }> },
];
const HASH = "testhash";
const good = () => ({
  labeller: "Test Labeller (synthetic)",
  labelledAt: "2026-11-01T10:00:00.000Z",
  rubricHash: HASH,
  items: [
    { itemId: "L01", groundedness: 3, task_fit: 4, clarity: 2, fabricationPresent: false, citations: [{ index: 1, verdict: "supports" }, { index: 2, verdict: "partial" }] },
    { itemId: "L02", groundedness: 1, task_fit: 1, clarity: 1, fabricationPresent: true, citations: [], notes: "n" },
  ],
});

test("parseHandLabels accepts complete labels", () => {
  const r = parseHandLabels(good(), ITEMS, HASH);
  assert.ok(r.ok);
  assert.ok(handLabelsSchema.safeParse(good()).success);
});

test("parseHandLabels rejects and lists: missing items, missing fields, out-of-range scores, missing unit verdicts, wrong rubric hash", () => {
  const g = good();
  g.items.pop();
  let r = parseHandLabels(g, ITEMS, HASH);
  assert.ok(!r.ok && r.problems.some((p) => p.includes("missing item L02")));

  const bad = good() as unknown as { items: Array<Record<string, unknown>>; labeller: string };
  delete bad.items[0].clarity;
  bad.items[1].groundedness = 7;
  bad.labeller = " ";
  r = parseHandLabels(bad, ITEMS, HASH);
  assert.ok(!r.ok);
  const text = (r as { problems: string[] }).problems.join("\n");
  assert.ok(text.includes("items.0.clarity"), text);
  assert.ok(text.includes("items.1.groundedness"), text);
  assert.ok(text.includes("labeller"), text);

  const noCite = good();
  noCite.items[0].citations.pop();
  r = parseHandLabels(noCite, ITEMS, HASH);
  assert.ok(!r.ok && r.problems.some((p) => p.includes("missing citation verdict for unit 2")));

  r = parseHandLabels(good(), ITEMS, "otherhash");
  assert.ok(!r.ok && r.problems.some((p) => p.includes("rubricHash")));

  r = parseHandLabels("not an object", ITEMS, HASH);
  assert.ok(!r.ok && r.problems.length > 0);

  const dup = good();
  dup.items.push({ ...dup.items[1] });
  r = parseHandLabels(dup, ITEMS, HASH);
  assert.ok(!r.ok && r.problems.some((p) => p.includes("duplicate item L02")));
});

test("parseHandLabels defaults to the current RUBRIC.md hash", () => {
  const g = { ...good(), rubricHash: rubricHash(loadRubric()) };
  assert.ok(parseHandLabels(g, ITEMS).ok);
  assert.ok(!parseHandLabels(good(), ITEMS).ok);
});
