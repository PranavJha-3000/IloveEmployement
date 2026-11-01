// Resume diff library tests. Pure functions, no DOM. Run with `npm test`.
import assert from "node:assert";
import { test } from "node:test";
import { buildResumeDiff, diffSequences, diffWords, normalizeResumeLines } from "../lib/diff";

test("diffSequences: replace puts delete before insert", () => {
  assert.deepStrictEqual(diffSequences(["a", "b", "c"], ["a", "x", "c"]), [
    { op: "equal", items: ["a"] },
    { op: "delete", items: ["b"] },
    { op: "insert", items: ["x"] },
    { op: "equal", items: ["c"] },
  ]);
});

test("diffSequences: empty sides", () => {
  assert.deepStrictEqual(diffSequences([], ["a"]), [{ op: "insert", items: ["a"] }]);
  assert.deepStrictEqual(diffSequences(["a"], []), [{ op: "delete", items: ["a"] }]);
  assert.deepStrictEqual(diffSequences([], []), []);
});

test("diffSequences: reconstructs both sides and merges runs", () => {
  const a = "the quick brown fox jumps over the lazy dog".split(" ");
  const b = "a quick red fox leaps over the very lazy dog".split(" ");
  const ops = diffSequences(a, b);
  assert.deepStrictEqual(ops.filter((o) => o.op !== "insert").flatMap((o) => o.items), a);
  assert.deepStrictEqual(ops.filter((o) => o.op !== "delete").flatMap((o) => o.items), b);
  for (let i = 1; i < ops.length; i++) assert.notStrictEqual(ops[i].op, ops[i - 1].op, "adjacent ops merged");
  // delete never follows insert inside one change region
  for (let i = 1; i < ops.length; i++) assert.ok(!(ops[i].op === "delete" && ops[i - 1].op === "insert"));
});

test("diffSequences: custom equality", () => {
  const ops = diffSequences(["A", "b"], ["a", "B"], (x, y) => x.toLowerCase() === y.toLowerCase());
  assert.deepStrictEqual(ops, [{ op: "equal", items: ["A", "b"] }]);
});

test("normalizeResumeLines: formatting-only differences vanish", () => {
  assert.deepStrictEqual(normalizeResumeLines("- Led team  \r\n\r\n\r\n* Shipped"), ["• Led team", "", "• Shipped"]);
  assert.deepStrictEqual(normalizeResumeLines("\n\n  ● a   b\n\n"), ["• a b"]);
  for (const g of ["•", "●", "▪", "◦", "‣", "∙", "·", "-", "–", "—", "*"]) {
    assert.deepStrictEqual(normalizeResumeLines(`${g} item`), ["• item"], g);
  }
  assert.deepStrictEqual(normalizeResumeLines("Rust-lang and C-level"), ["Rust-lang and C-level"]);
  assert.deepStrictEqual(normalizeResumeLines(""), []);
});

test("diffWords: only the inserted word is marked changed", () => {
  const d = diffWords("• Cut latency by 30%", "• Cut p99 latency by 30%");
  assert.ok(d.from.every((s) => !s.changed));
  const changed = d.to.filter((s) => s.changed).map((s) => s.text).join("");
  assert.strictEqual(changed.trim(), "p99");
  assert.strictEqual(d.to.map((s) => s.text).join(""), "• Cut p99 latency by 30%");
  assert.strictEqual(d.from.map((s) => s.text).join(""), "• Cut latency by 30%");
});

test("diffWords: changed words are marked and shared whitespace stays unchanged", () => {
  const d = diffWords("one two three", "one TWO THREE");
  assert.deepStrictEqual(d.from, [
    { text: "one ", changed: false },
    { text: "two", changed: true },
    { text: " ", changed: false },
    { text: "three", changed: true },
  ]);
});

// ─── buildResumeDiff ─────────────────────────────────────────────────────────

const lines = (n: number, prefix = "line") => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);

test("buildResumeDiff: identical texts", () => {
  const x = "Jane Doe\n• Led a team\n• Shipped";
  const d = buildResumeDiff(x, x);
  assert.strictEqual(d.identical, true);
  assert.deepStrictEqual(d.counts, { added: 0, removed: 0, changed: 0 });
  assert.strictEqual(d.changeCount, 0);
  assert.ok(d.rows.every((r) => r.type === "context"));
});

test("buildResumeDiff: formatting-only differences are identical", () => {
  const d = buildResumeDiff("- a\n- b", "• a\n• b");
  assert.strictEqual(d.identical, true);
  assert.strictEqual(buildResumeDiff("a\r\nb  \r\n\r\n\r\nc", "a\nb\n\nc").identical, true);
});

test("buildResumeDiff: a replaced line is one changed row with word emphasis", () => {
  const d = buildResumeDiff("Header\n• Cut latency by 30%\nFooter", "Header\n• Cut p99 latency by 30%\nFooter");
  const changed = d.rows.filter((r) => r.type === "changed");
  assert.strictEqual(changed.length, 1);
  const row = changed[0];
  assert.ok(row.type === "changed");
  assert.ok(row.from.every((s) => !s.changed));
  assert.strictEqual(row.to.filter((s) => s.changed).map((s) => s.text).join("").trim(), "p99");
  assert.deepStrictEqual(d.counts, { added: 0, removed: 0, changed: 1 });
  assert.strictEqual(d.identical, false);
  assert.strictEqual(d.changeCount, 1);
});

test("buildResumeDiff: 3 deleted then 2 inserted lines give 2 changed and 1 removed", () => {
  const d = buildResumeDiff("keep\nold one\nold two\nold three\nend", "keep\nnew one\nnew two\nend");
  assert.deepStrictEqual(d.counts, { added: 0, removed: 1, changed: 2 });
  const kinds = d.rows.map((r) => r.type);
  assert.deepStrictEqual(kinds, ["context", "changed", "changed", "removed", "context"]);
  assert.strictEqual(d.changeCount, 1);
  const idx = d.rows.flatMap((r) => (r.type === "changed" || r.type === "removed" ? [r.changeIndex] : []));
  assert.deepStrictEqual(idx, [0, 0, 0]);
});

test("buildResumeDiff: leftover inserts become added rows", () => {
  const d = buildResumeDiff("a\nb", "a\nB\nextra\nmore");
  assert.deepStrictEqual(d.counts, { added: 2, removed: 0, changed: 1 });
});

test("buildResumeDiff: a long unchanged run between two changes collapses", () => {
  const mid = lines(20);
  const d = buildResumeDiff(["A", ...mid, "Z"].join("\n"), ["A2", ...mid, "Z2"].join("\n"));
  const kinds = d.rows.map((r) => r.type);
  assert.deepStrictEqual(kinds, ["changed", "context", "context", "context", "collapsed", "context", "context", "context", "changed"]);
  const col = d.rows.find((r) => r.type === "collapsed");
  assert.ok(col && col.type === "collapsed");
  assert.strictEqual(col.count, 14);
  assert.deepStrictEqual(col.lines, mid.slice(3, 17));
  assert.strictEqual(d.changeCount, 2);
});

test("buildResumeDiff: runs of exactly 6 are not collapsed, leading and trailing runs collapse next to a change", () => {
  const six = lines(6);
  const d6 = buildResumeDiff(["A", ...six, "Z"].join("\n"), ["A2", ...six, "Z2"].join("\n"));
  assert.ok(!d6.rows.some((r) => r.type === "collapsed"));

  const many = lines(10);
  const d = buildResumeDiff([...many, "tail"].join("\n"), [...many, "tail changed"].join("\n"));
  assert.strictEqual(d.rows[0].type, "collapsed");
  const first = d.rows[0];
  assert.ok(first.type === "collapsed");
  assert.strictEqual(first.count, 7);
  assert.deepStrictEqual(d.rows.slice(1).map((r) => r.type), ["context", "context", "context", "changed"]);

  const e = buildResumeDiff(["head", ...many].join("\n"), ["head changed", ...many].join("\n"));
  const last = e.rows[e.rows.length - 1];
  assert.ok(last.type === "collapsed");
  assert.strictEqual(last.count, 7);
});

test("buildResumeDiff: custom context and collapseOver", () => {
  const mid = lines(10);
  const d = buildResumeDiff(["A", ...mid, "Z"].join("\n"), ["A2", ...mid, "Z2"].join("\n"), { context: 1, collapseOver: 4 });
  const col = d.rows.find((r) => r.type === "collapsed");
  assert.ok(col && col.type === "collapsed" && col.count === 8);
});

test("buildResumeDiff: change groups are numbered per contiguous block", () => {
  const d = buildResumeDiff("a\nb\nc\nd\ne", "a\nB\nc\nd\nE\nf");
  assert.strictEqual(d.changeCount, 2);
  const idx = d.rows.flatMap((r) => (r.type === "context" || r.type === "collapsed" ? [] : [r.changeIndex]));
  assert.deepStrictEqual(idx, [0, 1, 1]);
});

test("buildResumeDiff: one side empty", () => {
  const added = buildResumeDiff("", "one\ntwo");
  assert.strictEqual(added.identical, false);
  assert.deepStrictEqual(added.counts, { added: 2, removed: 0, changed: 0 });
  assert.ok(added.rows.every((r) => r.type === "added"));
  const removed = buildResumeDiff("one\ntwo", "");
  assert.deepStrictEqual(removed.counts, { added: 0, removed: 2, changed: 0 });
  assert.strictEqual(buildResumeDiff("", "  \n").identical, true);
});

test("buildResumeDiff: 2,000 lines differing in 10 builds in under 500 ms", () => {
  const base = lines(2000, "Responsibility item number");
  const other = base.slice();
  for (let i = 0; i < 10; i++) other[100 + i * 190] = `edited ${i}`;
  const t0 = performance.now();
  const d = buildResumeDiff(base.join("\n"), other.join("\n"));
  const ms = performance.now() - t0;
  assert.ok(ms < 500, `took ${ms.toFixed(0)} ms`);
  assert.strictEqual(d.counts.changed, 10);
  assert.strictEqual(d.changeCount, 10);
});
