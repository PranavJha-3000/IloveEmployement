// ─── Blind hand-labelling: item selection, offline sheet, label validation ───
// The human labels about 30 outputs without seeing judge scores or generator
// model ids. Selection never reads judge fields. The sheet is one HTML file
// that works from file:// with no server and no network; all model text is
// inserted with textContent and the data sits in a JSON script element with
// "<" escaped, so untrusted output cannot run script in the page.

import { z } from "zod";
import { contentHash } from "../../lib/retrieval/fusion";
import { extractJson } from "../../lib/pipeline";
import { CASES, type EvalCase } from "../cases";
import { prepareCase } from "./caseRun";
import { finalDraftText } from "./citations";
import type { CaseOutcome } from "./metrics";
import { AGREEMENT_SEED, CITATION_VERDICTS, loadRubric, rubricHash } from "./rubric";

const OUTPUT_MAX = 12000;
const MAX_UNITS = 5;
const MIN_PER_ENGINE = 3;

// ─── Item selection ──────────────────────────────────────────────────────────

type Selectable = CaseOutcome & { notRun?: string };

/**
 * Seeded, stratified pick. Eligibility is "ran ok and was judged" (a judge result exists);
 * no judge score, claim or verdict is read. Each engine gets up to MIN_PER_ENGINE items first,
 * the rest is filled round-robin across engines. Inside an engine, models alternate round-robin
 * and each model's cases are ordered by contentHash(`${seed}:${caseId}:${modelKey}`).
 * The result is returned in hash order so item ids carry no engine or model pattern.
 */
export function selectLabelItems<T extends Selectable>(outcomes: T[], opts: { n?: number; seed?: number } = {}): T[] {
  const { n = 30, seed = AGREEMENT_SEED } = opts;
  const order = (o: T) => contentHash(`${seed}:${o.caseId}:${o.modelKey}`);
  const eligible = outcomes.filter((o) => o.ok && !o.notRun && o.judge && o.judge.ok);

  const byEngine = new Map<string, T[]>();
  for (const o of eligible) byEngine.set(o.engine, [...(byEngine.get(o.engine) ?? []), o]);

  const strata: T[][] = [...byEngine.keys()].sort().map((engine) => {
    const byModel = new Map<string, T[]>();
    for (const o of byEngine.get(engine) as T[]) byModel.set(o.modelKey, [...(byModel.get(o.modelKey) ?? []), o]);
    const queues = [...byModel.keys()].sort().map((m) => (byModel.get(m) as T[]).sort((a, b) => order(a).localeCompare(order(b)) || a.caseId.localeCompare(b.caseId)));
    const interleaved: T[] = [];
    for (let i = 0; queues.some((q) => i < q.length); i++) for (const q of queues) if (i < q.length) interleaved.push(q[i]);
    return interleaved;
  });

  const picked: T[] = [];
  const taken = strata.map(() => 0);
  const take = (s: number) => {
    picked.push(strata[s][taken[s]++]);
  };
  for (let s = 0; s < strata.length; s++) {
    while (taken[s] < Math.min(MIN_PER_ENGINE, strata[s].length) && picked.length < n) take(s);
  }
  for (let progress = true; picked.length < n && progress; ) {
    progress = false;
    for (let s = 0; s < strata.length && picked.length < n; s++) {
      if (taken[s] < strata[s].length) {
        take(s);
        progress = true;
      }
    }
  }
  return picked.sort((a, b) => order(a).localeCompare(order(b)) || a.caseId.localeCompare(b.caseId));
}

// ─── Items ───────────────────────────────────────────────────────────────────

export interface LabelUnit {
  index: number;
  path: string;
  chunkId: string;
  claim: string;
  chunkText: string;
}

export interface LabelItem {
  id: string;
  description: string;
  preset: string;
  task: string;
  inputs: Array<{ label: string; value: string; untrusted: boolean }>;
  vault: Array<{ id: string; title: string; text: string }>;
  output: string;
  units: LabelUnit[];
}

export type LabelKey = Record<string, { caseId: string; modelKey: string }>;

function outputText(o: CaseOutcome): string {
  const draft = finalDraftText(o.calls) ?? "";
  let text = draft;
  if (draft) {
    try {
      text = JSON.stringify(extractJson(draft), null, 2);
    } catch {
      text = draft;
    }
  }
  return text.length > OUTPUT_MAX ? `${text.slice(0, OUTPUT_MAX)}\n[truncated]` : text;
}

/** Opaque ids L01.. in the given order; the key (itemId -> caseId, modelKey) is returned separately and never goes into the sheet. */
export function buildLabelItems(selected: CaseOutcome[], cases: EvalCase[] = CASES): { items: LabelItem[]; key: LabelKey } {
  const items: LabelItem[] = [];
  const key: LabelKey = {};
  selected.forEach((o, i) => {
    const c = cases.find((x) => x.id === o.caseId);
    if (!c) throw new Error(`Unknown case id ${o.caseId}`);
    const prepared = prepareCase(c);
    const id = `L${String(i + 1).padStart(2, "0")}`;
    const chunkById = new Map(prepared.vault.map((v) => [v.id, v]));
    const fieldFor = (k: string) => prepared.preset.fields.find((f) => f.key === k);
    items.push({
      id,
      description: c.description,
      preset: prepared.preset.name,
      task: prepared.preset.task(c.inputs),
      inputs: Object.entries(c.inputs).map(([k, value]) => ({ label: fieldFor(k)?.label ?? k, value, untrusted: fieldFor(k)?.untrusted === true })),
      vault: prepared.vault.map((v) => ({ id: v.id, title: v.title, text: v.text })),
      output: outputText(o),
      units: o.units
        .filter((u) => u.idValid)
        .slice(0, MAX_UNITS)
        .map((u) => ({ index: u.index, path: u.path, chunkId: u.chunkId, claim: u.claim, chunkText: chunkById.get(u.chunkId)?.text ?? "" })),
    });
    key[id] = { caseId: o.caseId, modelKey: o.modelKey };
  });
  return { items, key };
}

// ─── Hand labels ─────────────────────────────────────────────────────────────

const score = z.number().int().min(1).max(4);

export const handLabelsSchema = z.object({
  labeller: z.string().trim().min(1, "labeller must not be empty"),
  labelledAt: z.string().refine((s) => /^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(Date.parse(s)), "labelledAt must be an ISO date-time string"),
  rubricHash: z.string().min(1),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      groundedness: score,
      task_fit: score,
      clarity: score,
      fabricationPresent: z.boolean(),
      citations: z.array(z.object({ index: z.number().int().positive(), verdict: z.enum(CITATION_VERDICTS) })),
      notes: z.string().optional(),
    }),
  ),
});
export type HandLabels = z.infer<typeof handLabelsSchema>;

export type ParseResult = { ok: true; labels: HandLabels } | { ok: false; problems: string[] };

/** Validate hand labels against the items they must cover. `expectedRubricHash` defaults to the current RUBRIC.md. */
export function parseHandLabels(
  json: unknown,
  items: Array<{ id: string; units: Array<{ index: number }> }>,
  expectedRubricHash: string = rubricHash(loadRubric()),
): ParseResult {
  const problems: string[] = [];
  const parsed = handLabelsSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) problems.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  const rawItems = (json as { items?: unknown } | null)?.items;
  const seenIds = new Set<string>();
  if (Array.isArray(rawItems)) {
    for (const r of rawItems) if (r && typeof (r as { itemId?: unknown }).itemId === "string") seenIds.add((r as { itemId: string }).itemId);
  }
  const wanted = new Set(items.map((i) => i.id));
  for (const item of items) if (!seenIds.has(item.id)) problems.push(`missing item ${item.id}`);
  for (const id of seenIds) if (!wanted.has(id)) problems.push(`unknown item ${id}`);

  if (parsed.success) {
    const l = parsed.data;
    if (l.rubricHash !== expectedRubricHash) {
      problems.push(`rubricHash ${l.rubricHash} does not match the current RUBRIC.md (${expectedRubricHash}); labels were made against a different rubric`);
    }
    const counts = new Map<string, number>();
    for (const li of l.items) counts.set(li.itemId, (counts.get(li.itemId) ?? 0) + 1);
    for (const [id, c] of counts) if (c > 1) problems.push(`duplicate item ${id}`);
    for (const li of l.items) {
      const item = items.find((i) => i.id === li.itemId);
      if (!item) continue;
      const have = new Set(li.citations.map((c) => c.index));
      for (const u of item.units) if (!have.has(u.index)) problems.push(`item ${li.itemId}: missing citation verdict for unit ${u.index}`);
      const valid = new Set(item.units.map((u) => u.index));
      for (const c of li.citations) if (!valid.has(c.index)) problems.push(`item ${li.itemId}: unknown citation unit ${c.index}`);
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, labels: (parsed as { data: HandLabels }).data };
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

/**
 * The rubric text a labeller needs: dimensions, claims and citation units.
 * Metric definitions, agreement and limitations are left out, and the word
 * for the automated rater is replaced, so the sheet says nothing about it.
 */
export function humanRubric(rubricText: string): string {
  const start = rubricText.indexOf("## Dimensions");
  const end = rubricText.indexOf("## Metric definitions");
  const body = start >= 0 ? rubricText.slice(start, end > start ? end : undefined) : rubricText;
  return body.replace(/\bjudge(s?)\b/gi, (m: string, plural: string) => (m[0] === "J" ? "Labeller" : "labeller") + plural);
}

const SHEET_STYLE = `
body{font:15px/1.5 system-ui,sans-serif;max-width:60rem;margin:1rem auto;padding:0 1rem;color:#1a1a1a}
h1{font-size:1.4rem} h2{font-size:1.1rem;margin:.6rem 0 .2rem} h3{font-size:.95rem;margin:.8rem 0 .2rem}
pre{white-space:pre-wrap;word-break:break-word;background:#f6f6f6;padding:.6rem;border-radius:4px;max-height:28rem;overflow:auto;font-size:13px}
details.item{border:1px solid #ccc;border-radius:6px;margin:.8rem 0;padding:.4rem .8rem}
details.item>summary{font-weight:600;cursor:pointer}
.untrusted{border-left:3px solid #c80;padding-left:.5rem}
.row{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;margin:.2rem 0}
.unit{border-top:1px dashed #ccc;margin-top:.5rem;padding-top:.3rem}
textarea,input[type=text]{width:100%;box-sizing:border-box;font:inherit}
button{font:inherit;padding:.4rem .9rem}
#status{margin:.5rem 0;color:#a00;white-space:pre-wrap}
.done>summary::after{content:" (complete)";font-weight:400;color:#070}
`;

// Plain DOM code: every piece of data reaches the page through textContent or a value property.
const SHEET_SCRIPT = `
(function () {
  var data = JSON.parse(document.getElementById("sheet-data").textContent);
  var STORE = "hand-labels-" + data.rubricHash;
  var DIMS = [["groundedness", "Groundedness"], ["task_fit", "Task fit"], ["clarity", "Clarity"]];
  var VERDICTS = [["supports", "Supports"], ["partial", "Partial"], ["does_not_support", "Does not support"]];
  var state = { labeller: "", items: {} };
  try { var saved = localStorage.getItem(STORE); if (saved) state = JSON.parse(saved); } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text !== undefined && text !== null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function entry(id) {
    if (!state.items[id]) state.items[id] = { cites: {}, notes: "" };
    return state.items[id];
  }
  function radios(parent, name, options, current, onPick) {
    var row = el("div", null, "row");
    options.forEach(function (o) {
      var label = el("label");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = String(o[0]);
      input.checked = current !== undefined && String(current) === String(o[0]);
      input.addEventListener("change", function () { onPick(o[0]); save(); refresh(); });
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + o[1]));
      row.appendChild(label);
    });
    parent.appendChild(row);
  }
  function block(parent, title, text, cls) {
    parent.appendChild(el("h3", title));
    var pre = el("pre", text);
    if (cls) pre.className = cls;
    parent.appendChild(pre);
  }
  var nodes = {};
  function render() {
    var root = document.getElementById("items");
    data.items.forEach(function (item) {
      var e = entry(item.id);
      var d = el("details", null, "item");
      nodes[item.id] = d;
      d.appendChild(el("summary", "Item " + item.id + " - " + item.preset));
      d.appendChild(el("p", item.description));
      block(d, "Task given", item.task);
      item.inputs.forEach(function (i) {
        block(d, i.label + (i.untrusted ? " (pasted by the user, untrusted)" : ""), i.value, i.untrusted ? "untrusted" : "");
      });
      block(d, "Supplied vault chunks", item.vault.length ? item.vault.map(function (v) { return "[" + v.id + "] " + v.title + "\\n" + v.text; }).join("\\n\\n") : "(none supplied)");
      block(d, "Output to label", item.output || "(no output text recorded)");
      d.appendChild(el("h2", "Your labels"));
      DIMS.forEach(function (dim) {
        d.appendChild(el("h3", dim[1] + " (1-4)"));
        radios(d, item.id + "-" + dim[0], [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], e[dim[0]], function (v) { e[dim[0]] = v; });
      });
      d.appendChild(el("h3", "Is there at least one claim about the candidate that is not supported by the inputs or vault?"));
      radios(d, item.id + "-fab", [["yes", "Yes"], ["no", "No"]], e.fab, function (v) { e.fab = v; });
      if (item.units.length) d.appendChild(el("h3", "Citation units"));
      item.units.forEach(function (u) {
        var box = el("div", null, "unit");
        box.appendChild(el("div", "Unit " + u.index + " - cited chunk " + u.chunkId));
        box.appendChild(el("pre", "Claim: " + u.claim + "\\n\\nCited chunk text:\\n" + (u.chunkText || "(not found)")));
        radios(box, item.id + "-u" + u.index, VERDICTS, e.cites[u.index], function (v) { e.cites[u.index] = v; });
        d.appendChild(box);
      });
      d.appendChild(el("h3", "Notes (optional)"));
      var notes = el("textarea");
      notes.rows = 3;
      notes.value = e.notes || "";
      notes.addEventListener("input", function () { e.notes = notes.value; save(); });
      d.appendChild(notes);
      root.appendChild(d);
    });
  }
  function missingFor(item) {
    var e = state.items[item.id] || { cites: {} };
    var m = [];
    DIMS.forEach(function (dim) { if (!e[dim[0]]) m.push(dim[0]); });
    if (!e.fab) m.push("fabrication");
    item.units.forEach(function (u) { if (!e.cites || !e.cites[u.index]) m.push("unit " + u.index); });
    return m;
  }
  function refresh() {
    var left = 0;
    data.items.forEach(function (item) {
      var done = missingFor(item).length === 0;
      if (!done) left++;
      nodes[item.id].className = done ? "item done" : "item";
    });
    document.getElementById("progress").textContent = (data.items.length - left) + " of " + data.items.length + " items complete";
  }
  function download() {
    var status = document.getElementById("status");
    var problems = [];
    if (!state.labeller || !state.labeller.trim()) problems.push("Enter your name in the labeller field.");
    data.items.forEach(function (item) {
      var m = missingFor(item);
      if (m.length) problems.push("Item " + item.id + " is missing: " + m.join(", "));
    });
    status.textContent = problems.join("\\n");
    if (problems.length) return;
    var out = {
      labeller: state.labeller.trim(),
      labelledAt: new Date().toISOString(),
      rubricHash: data.rubricHash,
      items: data.items.map(function (item) {
        var e = state.items[item.id];
        var r = {
          itemId: item.id,
          groundedness: Number(e.groundedness),
          task_fit: Number(e.task_fit),
          clarity: Number(e.clarity),
          fabricationPresent: e.fab === "yes",
          citations: item.units.map(function (u) { return { index: u.index, verdict: e.cites[u.index] }; })
        };
        if (e.notes) r.notes = e.notes;
        return r;
      })
    };
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hand-labels.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  document.getElementById("rubric").textContent = data.rubric;
  var who = document.getElementById("labeller");
  who.value = state.labeller || "";
  who.addEventListener("input", function () { state.labeller = who.value; save(); });
  document.getElementById("download").addEventListener("click", download);
  render();
  refresh();
})();
`;

const escJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** One self-contained HTML file. Contains the items, the labeller-facing rubric and the rubric hash; nothing else. */
export function renderLabelSheet(items: LabelItem[], rubricText: string): string {
  const payload = { rubricHash: rubricHash(rubricText), rubric: humanRubric(rubricText), items };
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    "<title>Hand-labelling sheet</title>",
    `<style>${SHEET_STYLE}</style></head><body>`,
    "<h1>Hand-labelling sheet</h1>",
    "<p>Read each item, apply the rubric, and fill in every field. Your answers are saved in this browser as you go. When all items are complete, download the file and save it as <code>evals/llm/labels/hand-labels.json</code>.</p>",
    '<details><summary>Rubric</summary><pre id="rubric"></pre></details>',
    '<p><label>Labeller name <input type="text" id="labeller" autocomplete="off"></label></p>',
    '<p id="progress"></p>',
    '<div id="items"></div>',
    '<p><button id="download" type="button">Download hand-labels.json</button></p>',
    '<div id="status"></div>',
    `<script type="application/json" id="sheet-data">${escJson(payload)}</script>`,
    `<script>${SHEET_SCRIPT}</script>`,
    "</body></html>",
    "",
  ].join("\n");
}
