// Tests of the pure review reducer: confidence, edit/confirm flags, validation timing and re-keying.
import assert from "node:assert";
import { test } from "node:test";
import {
  canConfirm,
  fieldStatus,
  initReview,
  reviewReducer,
  summaryCounts,
  type ReviewAction,
  type ReviewState,
} from "../lib/profile/reviewState";
import {
  emptyProfile,
  fieldPaths,
  MSG_NAME_REQUIRED,
  type ConfirmedProfile,
  type ExtractionResult,
  type StructuredProfile,
} from "../lib/profile/schema";
import { normalizeSkills } from "../lib/skills/normalize";

function profile(): StructuredProfile {
  const p = emptyProfile();
  p.contact = { name: "Ann Lee", email: "ann@example.com", phone: "", location: "Leeds", links: ["github.com/ann"] };
  const role = (title: string, company: string, year: number) => ({
    title,
    company,
    location: "",
    start: { year, month: 1 },
    end: { year: year + 1, month: 1 },
    current: false,
    bullets: [`Did ${title}`],
  });
  p.roles = [role("A", "Alpha", 2018), role("B", "Beta", 2019), role("C", "Gamma", 2020)];
  p.education = [{ degree: "BSc", institution: "State", detail: "", startYear: null, endYear: 2017 }];
  p.skills = normalizeSkills(["JS", "Python"]);
  p.projects = [{ name: "Tool", description: "", link: "", skills: [] }];
  return p;
}

function result(overrides: Record<string, number> = {}): ExtractionResult {
  const p = profile();
  const confidence: Record<string, number> = {};
  for (const path of fieldPaths(p)) confidence[path] = 1;
  confidence["contact.phone"] = 0;
  confidence["contact.email"] = 0.4;
  Object.assign(confidence, overrides);
  return { profile: p, confidence, method: "deterministic", sourceHash: "h", warnings: [] };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

const run = (s: ReviewState, ...actions: ReviewAction[]) => actions.reduce(reviewReducer, s);

test("initial statuses: high, low and empty come from confidence and value", () => {
  const s = initReview({ result: result() });
  assert.equal(fieldStatus(s, "contact.name"), "high");
  assert.equal(fieldStatus(s, "contact.email"), "low");
  assert.equal(fieldStatus(s, "contact.phone"), "empty");
  assert.equal(s.attemptedConfirm, false);
  assert.deepEqual(s.errors, {});
});

test("edit clears low styling, confirm after edit confirms, editing a confirmed field returns to edited", () => {
  let s = initReview({ result: result() });
  s = run(s, { type: "edit", path: "contact.email", value: "ann.lee@example.com" });
  assert.equal(fieldStatus(s, "contact.email"), "edited");
  assert.equal(s.profile.contact.email, "ann.lee@example.com");
  s = run(s, { type: "toggleConfirm", path: "contact.email" });
  assert.equal(fieldStatus(s, "contact.email"), "confirmed");
  s = run(s, { type: "edit", path: "contact.email", value: "ann@example.org" });
  assert.equal(fieldStatus(s, "contact.email"), "edited");
  s = run(s, { type: "toggleConfirm", path: "contact.email" }, { type: "toggleConfirm", path: "contact.email" });
  assert.equal(fieldStatus(s, "contact.email"), "edited");
});

test("validation errors appear only after blur or attemptConfirm", () => {
  let s = initReview({ result: result() });
  s = run(s, { type: "edit", path: "contact.email", value: "not-an-email" });
  assert.equal(fieldStatus(s, "contact.email"), "edited");
  assert.deepEqual(s.errors, {});
  s = run(s, { type: "blur", path: "contact.email" });
  assert.equal(fieldStatus(s, "contact.email"), "invalid");
  // invalid wins even over confirmed
  s = run(s, { type: "toggleConfirm", path: "contact.email" });
  assert.equal(fieldStatus(s, "contact.email"), "invalid");
  // fixing it re-validates immediately
  s = run(s, { type: "edit", path: "contact.email", value: "ann@example.com" });
  assert.notEqual(fieldStatus(s, "contact.email"), "invalid");

  const t = run(initReview({ result: result() }), { type: "edit", path: "contact.phone", value: "123" }, { type: "attemptConfirm" });
  assert.equal(fieldStatus(t, "contact.phone"), "invalid");
  assert.ok(t.attemptedConfirm);
});

test("confirmAllHigh confirms only high fields", () => {
  let s = initReview({ result: result({ "contact.location": 0.5 }) });
  s = run(s, { type: "edit", path: "contact.name", value: "Ann B Lee" }, { type: "edit", path: "contact.phone", value: "x" });
  s = run(s, { type: "blur", path: "contact.phone" }); // invalid phone
  const before = (p: string) => fieldStatus(s, p);
  assert.equal(before("contact.phone"), "invalid");
  assert.equal(before("contact.location"), "low");
  assert.equal(before("contact.name"), "edited");
  const t = run(s, { type: "confirmAllHigh" });
  assert.equal(fieldStatus(t, "contact.phone"), "invalid");
  assert.equal(fieldStatus(t, "contact.location"), "low");
  assert.equal(fieldStatus(t, "contact.email"), "low");
  assert.equal(fieldStatus(t, "contact.name"), "edited");
  assert.equal(fieldStatus(t, "roles.0.title"), "confirmed");
  assert.equal(fieldStatus(t, "skills.0"), "confirmed");
  const empty = run(initReview({ result: result() }), { type: "confirmAllHigh" });
  assert.equal(fieldStatus(empty, "contact.phone"), "empty");
});

test("removing a role re-keys flags, confidence and errors of later roles", () => {
  let s = initReview({ result: result({ "roles.2.company": 0.4 }) });
  s = run(s, { type: "toggleConfirm", path: "roles.2.title" }, { type: "edit", path: "roles.1.title", value: "B2" });
  assert.equal(fieldStatus(s, "roles.2.company"), "low");
  s = run(s, { type: "removeItem", group: "roles", index: 1 });
  assert.equal(s.profile.roles.length, 2);
  assert.equal(s.profile.roles[1].company, "Gamma");
  // old roles.2.* is now roles.1.*
  assert.equal(fieldStatus(s, "roles.1.company"), "low");
  assert.equal(fieldStatus(s, "roles.1.title"), "confirmed");
  assert.equal(s.flags["roles.2.title"], undefined);
  assert.equal(s.confidence["roles.2.company"], undefined);
  // the removed role's edit flag is gone
  assert.equal(fieldStatus(s, "roles.0.title"), "high");
});

test("removing a link and an education item re-keys too", () => {
  let s = initReview({ result: result() });
  s = run(s, { type: "addItem", group: "links" }, { type: "edit", path: "contact.links.1", value: "b.example.net" }, { type: "toggleConfirm", path: "contact.links.1" });
  s = run(s, { type: "removeItem", group: "links", index: 0 });
  assert.deepEqual(s.profile.contact.links, ["b.example.net"]);
  assert.equal(fieldStatus(s, "contact.links.0"), "confirmed");
  s = run(s, { type: "removeItem", group: "education", index: 0 });
  assert.equal(s.profile.education.length, 0);
  assert.equal(Object.keys(s.confidence).some((k) => k.startsWith("education.")), false);
});

test("addItem appends an empty item whose fields are empty", () => {
  let s = initReview({ result: result() });
  s = run(s, { type: "addItem", group: "roles" });
  assert.equal(s.profile.roles.length, 4);
  for (const f of ["title", "company", "start", "end", "bullets"]) assert.equal(fieldStatus(s, `roles.3.${f}`), "empty", f);
  s = run(s, { type: "addItem", group: "education" }, { type: "addItem", group: "projects" });
  assert.equal(fieldStatus(s, "education.1.degree"), "empty");
  assert.equal(fieldStatus(s, "projects.1.name"), "empty");
});

test("attemptConfirm with an empty name sets the name error", () => {
  let s = initReview({ result: result() });
  s = run(s, { type: "edit", path: "contact.name", value: "  " });
  assert.equal(canConfirm(s), false);
  s = run(s, { type: "attemptConfirm" });
  assert.equal(s.errors["contact.name"], MSG_NAME_REQUIRED);
  assert.ok(summaryCounts(s).invalid >= 1);
});

test("saved profiles start fully confirmed", () => {
  const saved: ConfirmedProfile = { profile: profile(), confirmedAt: 1, sourceHash: "h", method: "deterministic" };
  const s = initReview({ saved });
  for (const path of fieldPaths(s.profile)) assert.equal(fieldStatus(s, path), "confirmed", path);
  const c = summaryCounts(s);
  assert.equal(c.confirmed, c.total);
  assert.equal(c.needsLook, 0);
  assert.equal(canConfirm(s), true);
});

test("edit values by path: bullets, dates, current role, years, project skills", () => {
  let s = initReview({ result: result() });
  s = run(s, { type: "edit", path: "roles.0.bullets", value: "  one \n\n two  \n" });
  assert.deepEqual(s.profile.roles[0].bullets, ["one", "two"]);
  s = run(s, { type: "edit", path: "roles.0.start", value: { year: 2015, month: 4 } });
  assert.deepEqual(s.profile.roles[0].start, { year: 2015, month: 4 });
  s = run(s, { type: "edit", path: "roles.0.current", value: true });
  assert.equal(s.profile.roles[0].current, true);
  assert.equal(s.profile.roles[0].end, null);
  assert.equal(fieldStatus(s, "roles.0.end"), "edited");
  s = run(s, { type: "edit", path: "education.0.endYear", value: "2019" });
  assert.equal(s.profile.education[0].endYear, 2019);
  s = run(s, { type: "edit", path: "projects.0.skills", value: ["Go", ""] });
  assert.deepEqual(s.profile.projects[0].skills, ["Go"]);
  const before = s;
  assert.equal(reviewReducer(s, { type: "edit", path: "roles.9.title", value: "x" }), before);
});

test("an end date before the start shows after blur and clears when fixed", () => {
  let s = initReview({ result: result() });
  s = run(s, { type: "edit", path: "roles.0.end", value: { year: 2010, month: 1 } }, { type: "blur", path: "roles.0.end" });
  assert.equal(fieldStatus(s, "roles.0.end"), "invalid");
  s = run(s, { type: "edit", path: "roles.0.end", value: { year: 2020, month: 1 } });
  assert.notEqual(fieldStatus(s, "roles.0.end"), "invalid");
});

test("setSkills keeps flags of kept skills and marks new ones edited", () => {
  let s = initReview({ result: result({ "skills.1": 0.4 }) });
  s = run(s, { type: "toggleConfirm", path: "skills.0" });
  const next = [...normalizeSkills(["Python"]), ...normalizeSkills(["Zymurgy"])];
  s = run(s, { type: "setSkills", skills: next });
  assert.equal(s.profile.skills.length, 2);
  assert.equal(fieldStatus(s, "skills.0"), "low"); // Python kept its low confidence
  assert.equal(fieldStatus(s, "skills.1"), "edited"); // new skill
  assert.equal(s.profile.skills[1].canonicalId, null);
});

test("the reducer never mutates its input", () => {
  const s = deepFreeze(initReview({ result: result() }));
  const actions: ReviewAction[] = [
    { type: "edit", path: "contact.name", value: "Z" },
    { type: "edit", path: "roles.0.bullets", value: "a\nb" },
    { type: "blur", path: "contact.email" },
    { type: "toggleConfirm", path: "contact.location" },
    { type: "confirmAllHigh" },
    { type: "addItem", group: "roles" },
    { type: "addItem", group: "links" },
    { type: "removeItem", group: "roles", index: 0 },
    { type: "removeItem", group: "links", index: 0 },
    { type: "setSkills", skills: normalizeSkills(["Go"]) },
    { type: "attemptConfirm" },
  ];
  for (const a of actions) assert.doesNotThrow(() => reviewReducer(s, a), a.type);
});

test("summaryCounts reflects needs-a-look, confirmed and invalid", () => {
  let s = initReview({ result: result() });
  const c0 = summaryCounts(s);
  assert.equal(c0.needsLook, 2); // email low, phone empty
  assert.equal(c0.confirmed, 0);
  s = run(s, { type: "confirmAllHigh" });
  const c1 = summaryCounts(s);
  assert.equal(c1.confirmed, c1.total - 2);
  assert.equal(c1.needsLook, 2);
});
