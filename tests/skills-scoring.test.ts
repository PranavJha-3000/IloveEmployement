// DOC-02: scoring and finalizers match on canonical skills. No model calls.
import assert from "node:assert";
import { afterEach, test } from "node:test";
import { MockLanguageModelV1 } from "ai/test";
import { runPreset, setModelFactory } from "../lib/engine/run";
import { FINALIZERS, type FinalizeContext } from "../lib/engine/reports";
import { applySkillEvidence, canonicalSkillEvidence, keywordCoverage, skillInText } from "../lib/engine/scoring";
import type { RunMeta, VaultContextChunk } from "../lib/engine/types";
import { getPresetById } from "../lib/presets";

const KEY = { provider: "openai" as const, apiKey: "sk-test-not-real-1234567890", model: "mock" };

/** Scripts the model: each generate call returns the next object as JSON. */
function script(...responses: unknown[]) {
  let i = 0;
  setModelFactory(
    () =>
      new MockLanguageModelV1({
        doGenerate: async () => {
          const next = responses[Math.min(i++, responses.length - 1)];
          return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: { promptTokens: 100, completionTokens: 50 }, text: JSON.stringify(next) };
        },
      }),
  );
}
afterEach(() => setModelFactory(null));

function ok(outcome: Awaited<ReturnType<typeof runPreset>>) {
  if (!outcome.ok) throw new Error(`run failed: ${outcome.status} ${outcome.message}`);
  return outcome.result as { data: Record<string, unknown>; meta: RunMeta };
}

const kw = (term: string, synonyms: string[] = []) => ({ term, importance: "must" as const, synonyms, evidencedBy: [] as string[] });

test("keywordCoverage: alias in the resume satisfies the canonical term", () => {
  const c = keywordCoverage("Skills: JS, ReactJS", [kw("JavaScript"), kw("React")]);
  assert.deepStrictEqual(c.items.map((i) => i.found), [true, true]);
  assert.deepStrictEqual(c.items.map((i) => i.matchedAs), ["JS", "ReactJS"]);
  assert.deepStrictEqual(c.items.map((i) => i.canonical), ["JavaScript", "React"]);
  assert.strictEqual(c.score, 100);
});

test("keywordCoverage: works in the other direction too", () => {
  const c = keywordCoverage("Skills: JavaScript", [kw("JS")]);
  assert.strictEqual(c.items[0].found, true);
  assert.strictEqual(c.items[0].matchedAs, "JavaScript");
});

test("keywordCoverage: Go still does not match Google, and lowercase 'go' is not Go via aliases", () => {
  assert.strictEqual(keywordCoverage("Worked at Google on search", [kw("Go", ["Golang"])]).items[0].found, false);
  assert.strictEqual(keywordCoverage("We go to market fast", [kw("Golang")]).items[0].found, false);
  assert.strictEqual(keywordCoverage("Services written in Go", [kw("Golang")]).items[0].found, true);
});

test("keywordCoverage: unknown terms behave exactly as before", () => {
  const c = keywordCoverage("Built a zorblax pipeline", [kw("Zorblax"), kw("Flarbo", ["zorblax"]), kw("Quux")]);
  assert.deepStrictEqual(c.items.map((i) => i.found), [true, true, false]);
  assert.deepStrictEqual(c.items.map((i) => i.canonical), [null, null, null]);
  assert.strictEqual(c.items[1].matchedAs, "zorblax");
});

test("keywordCoverage: model synonyms are expanded to canonical aliases", () => {
  const c = keywordCoverage("Ran workloads on k8s", [kw("Container orchestration", ["Kubernetes"])]);
  assert.strictEqual(c.items[0].found, true);
  assert.strictEqual(c.items[0].canonical, "Kubernetes");
});

test("canonicalSkillEvidence", () => {
  assert.deepStrictEqual(canonicalSkillEvidence("Strong JavaScript and React", "Built UIs in JS and ReactJS"), {
    skills: ["JavaScript", "React"],
    matchedAs: ["JS", "ReactJS"],
  });
  assert.strictEqual(canonicalSkillEvidence("Excellent communication", "Built UIs in JS"), null);
  assert.strictEqual(canonicalSkillEvidence("5+ years experience", "Built UIs in JS"), null);
  assert.strictEqual(canonicalSkillEvidence("Strong JavaScript and React", "Built UIs in JS"), null, "every named skill must be present");
});

test("applySkillEvidence upgrades only MISSING to PARTIAL and does not mutate", () => {
  const reqs = [
    { requirement: "JavaScript", importance: "must" as const, evidence: "MISSING" as const },
    { requirement: "JavaScript", importance: "must" as const, evidence: "UNVERIFIED" as const },
    { requirement: "JavaScript", importance: "must" as const, evidence: "STRONG" as const },
    { requirement: "Rust", importance: "nice" as const, evidence: "MISSING" as const },
  ];
  const frozen = JSON.stringify(reqs);
  const out = applySkillEvidence(reqs, "Built UIs in JS");
  assert.strictEqual(JSON.stringify(reqs), frozen);
  assert.deepStrictEqual(out.map((r) => r.evidence), ["PARTIAL", "UNVERIFIED", "STRONG", "MISSING"]);
  assert.deepStrictEqual(out[0].skillMatch, { skills: ["JavaScript"], matchedAs: ["JS"], correctedFrom: "MISSING" });
  assert.strictEqual(out[1].skillMatch, undefined);
  assert.strictEqual(out[3].skillMatch, undefined);
  assert.notStrictEqual(out, reqs);
});

test("case-sensitive alias check escapes regex metacharacters", () => {
  const c = keywordCoverage("Wrote C++ and C# daily", [kw("C++"), kw("C#")]);
  assert.deepStrictEqual(c.items.map((i) => i.found), [true, true]);
});

// ─── Finalizers and pipeline ─────────────────────────────────────────────────

const RESUME = "Frontend engineer. Built UIs in JS and ReactJS. Ran workloads on k8s. Services written in Go.";
const ctx = (over: Partial<FinalizeContext> = {}): FinalizeContext => ({
  validIds: new Set(["c1"]),
  sourceText: RESUME,
  resumeText: RESUME,
  rawResume: RESUME,
  inputs: {},
  externalRefs: new Set(),
  ...over,
});

const fitOutput = (requirements: { requirement: string; importance: "must" | "nice"; evidence: "STRONG" | "PARTIAL" | "MISSING" | "UNVERIFIED" }[]) => ({
  headline: "h",
  summary: "s",
  requirements: requirements.map((r) => ({ ...r, proof: "", chunkIds: [] as string[] })),
  strengths: [],
  gaps: [],
  interviewRisks: [],
});

test("fit: a MISSING requirement the resume satisfies under an alias becomes PARTIAL, visibly, and scores from the corrected evidence", () => {
  const out = FINALIZERS.fit(fitOutput([{ requirement: "JavaScript", importance: "must", evidence: "MISSING" }]), ctx());
  assert.strictEqual(out.requirements[0].evidence, "PARTIAL");
  assert.deepStrictEqual(out.requirements[0].skillMatch?.matchedAs, ["JS"]);
  assert.strictEqual(out.requirements[0].skillMatch?.correctedFrom, "MISSING");
  assert.strictEqual(out.score.score, 50);
  assert.strictEqual(out.score.counts.MISSING, 0);

  const absent = FINALIZERS.fit(fitOutput([{ requirement: "Rust", importance: "must", evidence: "MISSING" }]), ctx());
  assert.strictEqual(absent.requirements[0].evidence, "MISSING");
  assert.strictEqual(absent.requirements[0].skillMatch, undefined);
});

test("gap: applies the same correction", () => {
  const base = fitOutput([{ requirement: "Kubernetes", importance: "must", evidence: "MISSING" }]);
  const out = FINALIZERS.gap({ summary: "s", requirements: base.requirements, transferable: [], plan: [], quickWins: [], honestNote: "n" } as unknown as Parameters<typeof FINALIZERS.gap>[0], ctx());
  assert.strictEqual(out.requirements[0].evidence, "PARTIAL");
  assert.deepStrictEqual(out.requirements[0].skillMatch?.skills, ["Kubernetes"]);
});

test("resume: keeps a skill the source has under an alias, still strips absent ones", () => {
  const out = FINALIZERS.resume(
    {
      headline: "h",
      summary: { text: "s", chunkIds: ["c1"] },
      sections: [],
      skills: ["Kubernetes", "JavaScript", "Rust", "Terraform"],
      changes: [],
      gapsLeft: [],
    },
    ctx(),
  );
  assert.deepStrictEqual(out.skills, ["Kubernetes", "JavaScript"]);
  assert.deepStrictEqual(out.audit.removedSkills, ["Rust", "Terraform"]);
});

test("ats pipeline: a scripted keyword 'JavaScript' is found through the alias 'JS' in the vault", async () => {
  script({
    jobTitle: "Frontend Engineer",
    keywords: [{ term: "JavaScript", importance: "must", synonyms: [], evidencedBy: ["c1"] }],
    titleAlignment: "ok",
    advice: [],
  });
  const vault: VaultContextChunk[] = [{ id: "c1", kind: "bullet", title: "Engineer, Acme | 2023", text: "Built UIs in JS" }];
  const res = ok(await runPreset(getPresetById("ats-check")!, { inputs: { jobDescription: "JavaScript engineer" }, vault, config: KEY }, "t-ats"));
  const coverage = res.data.coverage as { items: { found: boolean; matchedAs: string; canonical: string | null }[] };
  assert.strictEqual(coverage.items[0].found, true);
  assert.strictEqual(coverage.items[0].matchedAs, "JS");
  assert.strictEqual(coverage.items[0].canonical, "JavaScript");
});

test("CR-03: ordinary words and ambiguous acronyms are not skill evidence", () => {

  const cases: [string, string][] = [
    ["Golang", "Led the Go-to-market launch"],
    ["Next.js", "Next, I rebuilt the onboarding flow."],
    ["Spring Boot", "Spring 2021 intern at Acme."],
    ["Express.js", "Partnered with American Express"],
    ["PowerPoint", "Keynote speaker at a regional conference."],
    ["Computer vision", "CV\nJane Doe"],
    ["Public relations", "Opened a PR to fix the build."],
    ["Accounts payable", "Worked on AP style guides."],
    ["Microsoft Office", "Word of mouth campaign"],
  ];
  for (const [term, text] of cases) {
    const cov = keywordCoverage(text, [{ term, importance: "must", synonyms: [], evidencedBy: [] }]);
    assert.equal(cov.items[0].found, false, `${term} in "${text}"`);
    assert.equal(skillInText(term, text), false, `${term} in "${text}"`);
  }
  for (const [term, text] of [["JavaScript", "Built tools in JS."], ["Kubernetes", "Ran k8s clusters."], ["React", "Shipped ReactJS apps"]] as const) {
    assert.equal(skillInText(term, text), true, `${term} in "${text}"`);
  }
});
