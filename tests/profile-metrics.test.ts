// Hand-computed cases for the profile extraction metrics.
import assert from "node:assert";
import { test } from "node:test";
import { aggregateCounts, FIELD_KEYS, prf, scoreProfile, type FieldCounts, type FieldKey } from "../evals/profile/metrics";
import { emptyProfile, type StructuredProfile } from "../lib/profile/schema";
import { normalizeSkills } from "../lib/skills/normalize";

function gold(): StructuredProfile {
  return {
    contact: { name: "Ann Lee", email: "ann.lee@example.com", phone: "555-0142", location: "Leeds", links: ["github.com/annlee"] },
    roles: [
      { title: "Backend Engineer", company: "Acme Corp", location: "", start: { year: 2022, month: 3 }, end: null, current: true, bullets: ["Built the billing API", "Cut latency by half"] },
      { title: "Intern", company: "Beta Labs", location: "", start: { year: 2020, month: 6 }, end: { year: 2020, month: 9 }, current: false, bullets: ["Wrote test fixtures"] },
    ],
    education: [{ degree: "BSc Physics", institution: "State University", detail: "", startYear: null, endYear: 2020 }],
    skills: normalizeSkills(["Python", "SQL"]),
    projects: [{ name: "Tool X", description: "", link: "", skills: [] }],
  };
}

const counts = (c: FieldCounts, k: FieldKey) => [c[k].tp, c[k].fp, c[k].fn];

test("gold against itself has no errors and exact matches everywhere", () => {
  const c = scoreProfile(gold(), gold());
  for (const k of FIELD_KEYS) assert.equal(c[k].fp + c[k].fn, 0, k);
  assert.deepEqual(counts(c, "roles.title"), [2, 0, 0]);
  assert.deepEqual(counts(c, "roles.end"), [1, 0, 0]); // the current role's empty end is not counted
  assert.deepEqual(counts(c, "roles.bullets"), [3, 0, 0]);
  assert.deepEqual(counts(c, "skills.canonical"), [2, 0, 0]);
  assert.deepEqual(c.exact.contact, { hit: 1, total: 1 });
  assert.deepEqual(c.exact.roles, { hit: 2, total: 2 });
});

test("a swapped title and company is aligned, then counted wrong in both fields", () => {
  const p = gold();
  p.roles[0].title = "Acme Corp";
  p.roles[0].company = "Backend Engineer";
  const c = scoreProfile(p, gold());
  assert.deepEqual(counts(c, "roles.title"), [1, 1, 1]);
  assert.deepEqual(counts(c, "roles.company"), [1, 1, 1]);
  assert.deepEqual(counts(c, "roles.start"), [2, 0, 0]);
  assert.deepEqual(c.exact.roles, { hit: 1, total: 2 });
});

test("a missing role costs recall on every non-empty field", () => {
  const p = gold();
  p.roles = [p.roles[0]];
  const c = scoreProfile(p, gold());
  assert.deepEqual(counts(c, "roles.title"), [1, 0, 1]);
  assert.deepEqual(counts(c, "roles.company"), [1, 0, 1]);
  assert.deepEqual(counts(c, "roles.start"), [1, 0, 1]);
  assert.deepEqual(counts(c, "roles.end"), [0, 0, 1]);
  assert.deepEqual(counts(c, "roles.bullets"), [2, 0, 1]);
  assert.deepEqual(c.exact.roles, { hit: 1, total: 2 });
});

test("a hallucinated role costs precision on every non-empty field", () => {
  const p = gold();
  p.roles.push({
    title: "Chief Wizard",
    company: "Hogwarts",
    location: "",
    start: { year: 2019, month: 1 },
    end: { year: 2019, month: 12 },
    current: false,
    bullets: ["Cast spells", "Taught potions"],
  });
  const c = scoreProfile(p, gold());
  assert.deepEqual(counts(c, "roles.title"), [2, 1, 0]);
  assert.deepEqual(counts(c, "roles.company"), [2, 1, 0]);
  assert.deepEqual(counts(c, "roles.start"), [2, 1, 0]);
  assert.deepEqual(counts(c, "roles.end"), [1, 1, 0]);
  assert.deepEqual(counts(c, "roles.bullets"), [3, 2, 0]);
  assert.deepEqual(c.exact.roles, { hit: 2, total: 2 });
});

test("a wrong end month is a miss, not a half match", () => {
  const p = gold();
  p.roles[1].end = { year: 2020, month: 8 };
  const c = scoreProfile(p, gold());
  assert.deepEqual(counts(c, "roles.end"), [0, 1, 1]);
  assert.deepEqual(counts(c, "roles.start"), [2, 0, 0]);
  assert.deepEqual(c.exact.roles, { hit: 1, total: 2 });
  // A null month does not equal a known month.
  const q = gold();
  q.roles[1].end = { year: 2020, month: null };
  assert.deepEqual(counts(scoreProfile(q, gold()), "roles.end"), [0, 1, 1]);
});

test("role order does not matter", () => {
  const p = gold();
  p.roles.reverse();
  const c = scoreProfile(p, gold());
  for (const k of FIELD_KEYS) assert.equal(c[k].fp + c[k].fn, 0, k);
});

test("scalar normalisation: phone digits, email case, link decoration, skill aliases", () => {
  const p = gold();
  p.contact.phone = "(555) 0142";
  p.contact.email = "ANN.LEE@Example.com";
  p.contact.name = "  ann lee. ";
  p.contact.links = ["https://www.github.com/annlee/"];
  // A lower-case raw "python" still compares equal to the canonical Python.
  p.skills = [{ name: "python", canonicalId: null, matchedFrom: ["python"] }, ...normalizeSkills(["SQL"])];
  const c = scoreProfile(p, gold());
  for (const k of ["contact.name", "contact.email", "contact.phone", "contact.links", "skills.canonical"] as FieldKey[]) {
    assert.equal(c[k].fp + c[k].fn, 0, k);
  }
  assert.deepEqual(c.exact.contact, { hit: 1, total: 1 });
});

test("scalar cases: both empty, missing, spurious and different", () => {
  const e = emptyProfile();
  const g = emptyProfile();
  assert.deepEqual(counts(scoreProfile(e, g), "contact.name"), [0, 0, 0]);

  const gn = emptyProfile();
  gn.contact.name = "Ann Lee";
  assert.deepEqual(counts(scoreProfile(emptyProfile(), gn), "contact.name"), [0, 0, 1]); // missing
  assert.deepEqual(counts(scoreProfile(gn, emptyProfile()), "contact.name"), [0, 1, 0]); // spurious
  const other = emptyProfile();
  other.contact.name = "Bob Ray";
  assert.deepEqual(counts(scoreProfile(other, gn), "contact.name"), [0, 1, 1]); // different
  assert.deepEqual(scoreProfile(emptyProfile(), emptyProfile()).exact.contact, { hit: 1, total: 1 });
});

test("education alignment and endYear", () => {
  const p = gold();
  p.education[0].endYear = 2021;
  assert.deepEqual(counts(scoreProfile(p, gold()), "education.endYear"), [0, 1, 1]);
  p.education = [];
  const c = scoreProfile(p, gold());
  assert.deepEqual(counts(c, "education.degree"), [0, 0, 1]);
  assert.deepEqual(counts(c, "education.institution"), [0, 0, 1]);
  assert.deepEqual(counts(c, "education.endYear"), [0, 0, 1]);
});

test("set fields: extra and missing skills, projects and links", () => {
  const p = gold();
  p.skills = normalizeSkills(["Python", "Rust"]);
  p.projects = [];
  p.contact.links = ["github.com/annlee", "ann.example.net"];
  const c = scoreProfile(p, gold());
  assert.deepEqual(counts(c, "skills.canonical"), [1, 1, 1]);
  assert.deepEqual(counts(c, "projects.name"), [0, 0, 1]);
  assert.deepEqual(counts(c, "contact.links"), [1, 1, 0]);
});

test("prf: empty denominators are n/a and the hand-computed case rounds to 4 dp", () => {
  assert.deepEqual(prf({ tp: 0, fp: 0, fn: 0 }), { precision: null, recall: null, f1: null, support: 0 });
  assert.deepEqual(prf({ tp: 3, fp: 1, fn: 2 }), { precision: 0.75, recall: 0.6, f1: 0.6667, support: 5 });
  // Predicted nothing, gold had something: precision is n/a, recall is 0.
  assert.deepEqual(prf({ tp: 0, fp: 0, fn: 2 }), { precision: null, recall: 0, f1: 0, support: 2 });
  // Predicted something spurious, gold had nothing: precision 0, recall n/a.
  assert.deepEqual(prf({ tp: 0, fp: 2, fn: 0 }), { precision: 0, recall: null, f1: 0, support: 0 });
});

test("aggregateCounts sums field counts and exact matches", () => {
  const p = gold();
  p.roles[1].end = { year: 2020, month: 8 };
  const a = scoreProfile(gold(), gold());
  const b = scoreProfile(p, gold());
  const total = aggregateCounts([a, b]);
  assert.deepEqual(counts(total, "roles.end"), [1, 1, 1]);
  assert.deepEqual(counts(total, "roles.title"), [4, 0, 0]);
  assert.deepEqual(total.exact.contact, { hit: 2, total: 2 });
  assert.deepEqual(total.exact.roles, { hit: 3, total: 4 });
  assert.deepEqual(aggregateCounts([]).exact, { contact: { hit: 0, total: 0 }, roles: { hit: 0, total: 0 } });
});
