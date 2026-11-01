// Skill taxonomy integrity and normalisation. No model calls.
import assert from "node:assert";
import { test } from "node:test";
import { canonicalizeSkill, normalizeSkills, skillKey, skillsMentioned, suggestSkills, surfaceForms } from "../lib/skills/normalize";
import { SKILL_TAXONOMY, TAXONOMY_VERSION, type SkillCategory } from "../lib/skills/taxonomy";

const names = (text: string) => skillsMentioned(text).map((m) => m.entry.name);

test("skillKey collapses punctuation and case", () => {
  assert.strictEqual(skillKey("React.js"), "reactjs");
  assert.strictEqual(skillKey("ReactJS"), "reactjs");
  assert.strictEqual(skillKey("react js"), "reactjs");
  assert.strictEqual(skillKey("C++"), "c++");
  assert.strictEqual(skillKey("C#"), "c#");
  assert.strictEqual(skillKey("  Node.JS "), "nodejs");
});

test("canonicalizeSkill resolves aliases", () => {
  const js = canonicalizeSkill("JS");
  assert.strictEqual(js.name, "JavaScript");
  assert.strictEqual(js.known, true);
  assert.strictEqual(canonicalizeSkill("ECMAScript").name, "JavaScript");
  assert.strictEqual(canonicalizeSkill("ReactJS").name, "React");
  assert.strictEqual(canonicalizeSkill("React.js").name, "React");
  assert.strictEqual(canonicalizeSkill("k8s").name, "Kubernetes");
  assert.strictEqual(canonicalizeSkill("Postgres").name, "PostgreSQL");
});

test("unknown skills are kept exactly as written and flagged", () => {
  const u = canonicalizeSkill("  Underwater basket weaving ");
  assert.strictEqual(u.known, false);
  assert.strictEqual(u.entry, null);
  assert.strictEqual(u.name, "Underwater basket weaving");
});

test("normalizeSkills dedupes by canonical id, keeps first-seen order and originals", () => {
  const out = normalizeSkills(["JS", "JavaScript", "ReactJS", "Zorblax"]);
  assert.strictEqual(out.length, 3);
  assert.deepStrictEqual(out[0], { name: "JavaScript", canonicalId: "javascript", matchedFrom: ["JS", "JavaScript"] });
  assert.deepStrictEqual(out[1], { name: "React", canonicalId: "react", matchedFrom: ["ReactJS"] });
  assert.strictEqual(out[2].name, "Zorblax");
  assert.strictEqual(out[2].canonicalId, null);
  assert.strictEqual(normalizeSkills(["Zorblax", "zorblax"]).length, 1);
  assert.strictEqual(normalizeSkills(["", "  "]).length, 0);
});

test("surfaceForms lists every way a known skill is written", () => {
  const forms = surfaceForms("JavaScript");
  for (const f of ["JavaScript", "JS", "ECMAScript"]) assert.ok(forms.includes(f), f);
  assert.deepStrictEqual(surfaceForms("Zorblax"), ["Zorblax"]);
});

test("skillsMentioned finds whole terms and respects case-sensitive short names", () => {
  const a = names("Built UIs in ReactJS and TypeScript");
  assert.ok(a.includes("React") && a.includes("TypeScript"));
  assert.ok(!names("Worked at Google").includes("Go"));
  const gtm = names("Owned the go-to-market plan");
  assert.ok(gtm.includes("Go-to-market strategy"));
  assert.ok(!gtm.includes("Go"));
  assert.ok(names("Wrote services in Go").includes("Go"));
  assert.ok(!names("we like to go home").includes("Go"));
  assert.ok(!names("R&D budget").includes("R"));
  assert.ok(names("Statistical work in R and Python.").includes("R"));
  assert.ok(names("Rebuilt the form in Node.js.").includes("Node.js"));
});

test("longest match wins over a contained shorter one", () => {
  const n = names("Shipped React Native apps");
  assert.ok(n.includes("React Native"));
  assert.ok(!n.includes("React"));
});

test("suggestSkills ranks exact and prefix matches", () => {
  assert.strictEqual(suggestSkills("js")[0].entry.name, "JavaScript");
  assert.deepStrictEqual(suggestSkills(""), []);
  assert.ok(suggestSkills("post").some((s) => s.entry.name === "PostgreSQL"));
  assert.ok(suggestSkills("a", 3).length <= 3);
});

test("skillsMentioned survives a 50k-char adversarial input quickly", () => {
  const evil = ("a".repeat(30) + " ").repeat(1600) + "Go".repeat(10);
  const t0 = Date.now();
  skillsMentioned(evil);
  skillsMentioned("go ".repeat(20000));
  assert.ok(Date.now() - t0 < 5000, "scan too slow");
});

test("taxonomy integrity", () => {
  assert.ok(SKILL_TAXONOMY.length >= 250, `only ${SKILL_TAXONOMY.length} entries`);
  assert.ok(TAXONOMY_VERSION.length > 0);
  assert.strictEqual(new Set(SKILL_TAXONOMY.map((e) => e.id)).size, SKILL_TAXONOMY.length, "ids unique");
  assert.strictEqual(new Set(SKILL_TAXONOMY.map((e) => e.name)).size, SKILL_TAXONOMY.length, "names unique");
  const owner = new Map<string, string>();
  for (const e of SKILL_TAXONOMY) {
    for (const form of [e.name, ...e.aliases, ...(e.caseSensitive ?? [])]) {
      const k = skillKey(form);
      assert.ok(k, `${e.id}: empty key for "${form}"`);
      const prev = owner.get(k);
      assert.ok(!prev || prev === e.id, `alias key "${k}" maps to both ${prev} and ${e.id}`);
      owner.set(k, e.id);
    }
  }
  const counts = new Map<SkillCategory, number>();
  for (const e of SKILL_TAXONOMY) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const cats: SkillCategory[] = ["language", "frontend", "backend", "data", "ai-ml", "cloud-devops", "mobile", "testing", "security", "design", "product", "operations", "business", "marketing", "finance", "people"];
  for (const c of cats) assert.ok((counts.get(c) ?? 0) >= 5, `category ${c} has ${counts.get(c) ?? 0}`);
});

test("synthetic eval resumes and cases use known skills", () => {
  for (const s of ["Go", "PostgreSQL", "Kafka", "Kubernetes", "gRPC", "AWS", "Swift", "SwiftUI", "Core Data", "XCTest", "Objective-C", "Terraform", "Storybook", "Figma", "Vite", "Jest", "Testing Library", "Sass", "Looker", "dbt", "Tableau", "Excel", "Chart.js", "IndexedDB", "GitHub Actions"]) {
    assert.ok(canonicalizeSkill(s).known, `${s} missing from taxonomy`);
  }
});
