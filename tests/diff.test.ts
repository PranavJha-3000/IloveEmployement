// Resume diff library tests. Pure functions, no DOM. Run with `npm test`.
import assert from "node:assert";
import { test } from "node:test";
import { diffSequences, diffWords, normalizeResumeLines } from "../lib/diff";

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

test("diffWords: adjacent segments with the same flag are merged", () => {
  const d = diffWords("one two three", "one TWO THREE");
  assert.deepStrictEqual(d.from, [
    { text: "one ", changed: false },
    { text: "two", changed: true },
    { text: " ", changed: false },
    { text: "three", changed: true },
  ]);
  const e = diffWords("a b c d", "a x y d");
  assert.deepStrictEqual(e.to, [
    { text: "a ", changed: false },
    { text: "x y", changed: true },
    { text: " d", changed: false },
  ]);
});
