// Offline tests of the version list and compare-selection rules.
import assert from "node:assert";
import { test } from "node:test";
import { compareWithBase, filterVersions, orderPair, toggleCompare, versionCounts, versionSubtitle } from "../lib/vault/versionList";
import type { ResumeVersion } from "../lib/vault/versions";

const v = (id: string, kind: "base" | "tailored", createdAt: number, job?: ResumeVersion["job"]): ResumeVersion => ({
  id,
  kind,
  label: kind === "base" ? "Base resume" : "Tailored",
  text: "x",
  createdAt,
  origin: kind === "base" ? "profile-confirm" : "tailor-tool",
  ...(job ? { job } : {}),
});
const list = [v("t2", "tailored", 30), v("t1", "tailored", 20), v("b1", "base", 10)];

test("filter and counts", () => {
  assert.deepEqual(versionCounts(list), { all: 3, base: 1, tailored: 2 });
  assert.equal(filterVersions(list, "base").length, 1);
  assert.equal(filterVersions(list, "tailored").length, 2);
  assert.equal(filterVersions(list, "all").length, 3);
});

test("toggleCompare keeps at most two", () => {
  assert.deepEqual(toggleCompare([], "a"), ["a"]);
  assert.deepEqual(toggleCompare(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggleCompare(["a", "b"], "c"), ["a", "b"]);
  assert.deepEqual(toggleCompare(["a", "b"], "a"), ["b"]);
});

test("orderPair puts the older version first", () => {
  assert.equal(orderPair(list, "t2", "b1").from.id, "b1");
  assert.equal(orderPair(list, "b1", "t2").from.id, "b1");
  assert.equal(orderPair(list, "b1", "t2").to.id, "t2");
});

test("compareWithBase uses the most recent base", () => {
  assert.deepEqual(compareWithBase([...list, v("b2", "base", 25)], "t2"), ["b2", "t2"]);
  assert.equal(compareWithBase([v("t1", "tailored", 1)], "t1"), null);
});

test("versionSubtitle", () => {
  assert.equal(versionSubtitle(v("b", "base", 1)), "Your base resume");
  assert.equal(versionSubtitle(v("t", "tailored", 1, { title: "Dev", company: "Acme" })), "Targeted: Dev at Acme");
  assert.equal(versionSubtitle(v("t", "tailored", 1, { title: "Dev", company: "" })), "Targeted: Dev");
  assert.equal(versionSubtitle(v("t", "tailored", 1)), "Targeted job not recorded");
});
