// Structured profile contract: schema, validation, grounding-based confidence
// and VaultProfile sync. No model calls. Run with `npm test`.
import assert from "node:assert";
import { test } from "node:test";
import { CONFIDENCE, computeConfidence, dateGrounded, groundingText, isGrounded, needsLookCount } from "../lib/profile/confidence";
import {
  ConfirmedProfileSchema,
  LOW_CONFIDENCE_THRESHOLD,
  MSG_DATE_ORDER,
  MSG_EMAIL,
  MSG_NAME_REQUIRED,
  MSG_PHONE,
  StructuredProfileSchema,
  emptyProfile,
  fieldPaths,
  validateProfile,
  type StructuredProfile,
} from "../lib/profile/schema";
import { applyQuickProfile, toVaultProfile } from "../lib/profile/sync";

const NOW = new Date("2026-06-15T00:00:00Z");

function sample(): StructuredProfile {
  return {
    contact: { name: "Jane Doe", email: "jane@example.com", phone: "+91 98765 43210", location: "Pune", links: ["github.com/janedoe"] },
    roles: [
      {
        title: "Senior Software Engineer",
        company: "Zeta Payments",
        location: "Pune",
        start: { year: 2023, month: 3 },
        end: null,
        current: true,
        bullets: ["Cut checkout API p99 latency from 900ms to 280ms"],
      },
      {
        title: "Software Engineer",
        company: "Acme Fintech",
        location: "",
        start: { year: 2021, month: 6 },
        end: { year: 2023, month: 2 },
        current: false,
        bullets: ["Built a reconciliation service"],
      },
    ],
    education: [{ degree: "B.Tech Computer Science", institution: "COEP", detail: "", startYear: 2017, endYear: 2021 }],
    skills: [{ name: "Go", canonicalId: "go", matchedFrom: ["Go"] }],
    projects: [{ name: "Ledger", description: "A toy ledger", link: "", skills: ["Go"] }],
  };
}

test("StructuredProfileSchema round-trips a valid profile", () => {
  const p = sample();
  assert.deepStrictEqual(StructuredProfileSchema.parse(p), p);
  assert.deepStrictEqual(StructuredProfileSchema.parse(emptyProfile()), emptyProfile());
  assert.deepStrictEqual(Object.keys(StructuredProfileSchema.shape), ["contact", "roles", "education", "skills", "projects"]);
});

test("model-supplied confidence keys are stripped everywhere", () => {
  const dirty = JSON.parse(JSON.stringify(sample()));
  dirty.confidence = 0.99;
  dirty.roles[0].confidence = 0.99;
  dirty.contact.confidence = { name: 1 };
  dirty.skills[0].confidence = 1;
  const parsed = StructuredProfileSchema.parse(dirty);
  assert.ok(!JSON.stringify(parsed).includes("confidence"));
});

test("length and count caps are enforced", () => {
  const tooLong = (n: number) => "x".repeat(n);
  const bad = (mut: (p: StructuredProfile) => void) => {
    const p = sample();
    mut(p);
    return StructuredProfileSchema.safeParse(p).success;
  };
  assert.strictEqual(bad((p) => (p.contact.name = tooLong(201))), false);
  assert.strictEqual(bad((p) => (p.contact.name = tooLong(200))), true);
  assert.strictEqual(bad((p) => (p.contact.email = tooLong(255))), false);
  assert.strictEqual(bad((p) => (p.contact.phone = tooLong(41))), false);
  assert.strictEqual(bad((p) => (p.roles[0].bullets = Array(41).fill("a"))), false);
  assert.strictEqual(bad((p) => (p.roles[0].bullets = [tooLong(601)])), false);
  assert.strictEqual(bad((p) => (p.contact.links = Array(11).fill("a.com"))), false);
  assert.strictEqual(bad((p) => (p.contact.links = [tooLong(301)])), false);
  assert.strictEqual(bad((p) => (p.roles = Array(31).fill(sample().roles[0]))), false);
  assert.strictEqual(bad((p) => (p.education = Array(31).fill(sample().education[0]))), false);
  assert.strictEqual(bad((p) => (p.projects = Array(31).fill(sample().projects[0]))), false);
  assert.strictEqual(bad((p) => (p.skills = Array(151).fill(sample().skills[0]))), false);
  assert.strictEqual(bad((p) => (p.education[0].institution = tooLong(201))), false);
});

test("fieldPaths lists every leaf in order", () => {
  const paths = fieldPaths(sample());
  assert.deepStrictEqual(paths, [
    "contact.name",
    "contact.email",
    "contact.phone",
    "contact.location",
    "contact.links.0",
    "roles.0.title",
    "roles.0.company",
    "roles.0.location",
    "roles.0.start",
    "roles.0.end",
    "roles.0.bullets",
    "roles.1.title",
    "roles.1.company",
    "roles.1.location",
    "roles.1.start",
    "roles.1.end",
    "roles.1.bullets",
    "education.0.degree",
    "education.0.institution",
    "education.0.startYear",
    "education.0.endYear",
    "education.0.detail",
    "skills.0",
    "projects.0.name",
    "projects.0.description",
    "projects.0.link",
  ]);
});

test("validateProfile: valid profile has no errors", () => {
  assert.deepStrictEqual(validateProfile(sample(), NOW), {});
});

test("validateProfile: exact UI copy", () => {
  const p = sample();
  p.contact.name = "  ";
  assert.deepStrictEqual(validateProfile(p, NOW), { "contact.name": "Add your name to confirm." });
  assert.strictEqual(MSG_NAME_REQUIRED, "Add your name to confirm.");
  assert.strictEqual(MSG_EMAIL, "Enter an email like name@example.com.");
  assert.strictEqual(MSG_DATE_ORDER, "End date is before the start date.");
  assert.strictEqual(MSG_PHONE, "Enter a phone number with at least 7 digits.");
});

test("validateProfile: email", () => {
  for (const bad of ["bob@", "bob", "@x.com", "bob@x", "bo b@x.com", "bob@x..com", "bob@-x.com", "bob@x.c"]) {
    const p = sample();
    p.contact.email = bad;
    assert.strictEqual(validateProfile(p, NOW)["contact.email"], MSG_EMAIL, bad);
  }
  for (const ok of ["a@b.co", "first.last+tag@sub.example.com", ""]) {
    const p = sample();
    p.contact.email = ok;
    assert.strictEqual(validateProfile(p, NOW)["contact.email"], undefined, ok);
  }
});

test("validateProfile: phone needs 7 digits", () => {
  const p = sample();
  p.contact.phone = "12-34";
  assert.strictEqual(validateProfile(p, NOW)["contact.phone"], MSG_PHONE);
  p.contact.phone = "(555) 0142 77";
  assert.strictEqual(validateProfile(p, NOW)["contact.phone"], undefined);
  p.contact.phone = "";
  assert.strictEqual(validateProfile(p, NOW)["contact.phone"], undefined);
});

test("validateProfile: date order and years", () => {
  const p = sample();
  p.roles[1].start = { year: 2024, month: 5 };
  p.roles[1].end = { year: 2023, month: 1 };
  assert.deepStrictEqual(validateProfile(p, NOW), { "roles.1.end": "End date is before the start date." });

  // A current role ignores its end date.
  p.roles[1].current = true;
  assert.deepStrictEqual(validateProfile(p, NOW), {});

  // Same year with an unknown month is not an error.
  p.roles[1].current = false;
  p.roles[1].start = { year: 2023, month: null };
  p.roles[1].end = { year: 2023, month: 1 };
  assert.deepStrictEqual(validateProfile(p, NOW), {});

  const y = sample();
  y.roles[0].start = { year: 1949, month: 1 };
  assert.strictEqual(validateProfile(y, NOW)["roles.0.start"], "Enter a year between 1950 and 2027.");
  y.roles[0].start = { year: 2028, month: 1 };
  assert.strictEqual(validateProfile(y, NOW)["roles.0.start"], "Enter a year between 1950 and 2027.");
  y.roles[0].start = { year: 2027, month: 1 };
  assert.strictEqual(validateProfile(y, NOW)["roles.0.start"], undefined);
});

test("validateProfile: education years", () => {
  const p = sample();
  p.education[0].startYear = 2021;
  p.education[0].endYear = 2017;
  assert.strictEqual(validateProfile(p, NOW)["education.0.endYear"], MSG_DATE_ORDER);
  p.education[0].endYear = 3000;
  assert.strictEqual(validateProfile(p, NOW)["education.0.endYear"], "Enter a year between 1950 and 2027.");
});

test("ConfirmedProfileSchema requires the provenance fields", () => {
  const ok = ConfirmedProfileSchema.safeParse({ profile: sample(), confirmedAt: 1, sourceHash: "abc", method: "deterministic" });
  assert.strictEqual(ok.success, true);
  assert.strictEqual(ConfirmedProfileSchema.safeParse({ profile: sample(), confirmedAt: 1, sourceHash: "abc", method: "guess" }).success, false);
});

// ─── Confidence and sync ─────────────────────────────────────────────────────

const RESUME = `Jane Doe
jane@example.com | +91 98765 43210 | Pune
github.com/janedoe

EXPERIENCE
Senior Software Engineer, Zeta-Payments | Mar 2023 – Present
• Cut checkout API p99 latency from 900ms to 280ms
Software Engineer, Acme Fintech | Jun 2021 – Feb 2023
• Built a reconciliation service

EDUCATION
B.Tech Computer Science, COEP, 2017 - 2021

SKILLS
Go, PostgreSQL`;

test("groundingText and isGrounded", () => {
  assert.strictEqual(groundingText("Senior  Engineer, Zeta-Payments"), " senior engineer zeta payments ");
  const src = groundingText(RESUME);
  assert.strictEqual(isGrounded("Zeta Payments", src), true);
  assert.strictEqual(isGrounded("ZETA-PAYMENTS", src), true);
  assert.strictEqual(isGrounded("Zeta Pay", src), false);
  assert.strictEqual(isGrounded("", src), false);
  assert.strictEqual(isGrounded("C++", groundingText("I write C++ daily")), true);
});

test("dateGrounded", () => {
  const lines = RESUME.split("\n");
  assert.strictEqual(dateGrounded({ year: 2023, month: 3 }, lines), true);
  assert.strictEqual(dateGrounded({ year: 2023, month: null }, lines), true);
  assert.strictEqual(dateGrounded({ year: 2023, month: 9 }, lines), false);
  assert.strictEqual(dateGrounded({ year: 2019, month: null }, lines), false);
  assert.strictEqual(dateGrounded({ year: 2023, month: 3 }, ["Started 03/2023"]), true);
  assert.strictEqual(dateGrounded({ year: 2023, month: 3 }, ["Started 2023-03"]), true);
  assert.strictEqual(dateGrounded({ year: 2023, month: 3 }, ["Started 2023.03"]), true);
  assert.strictEqual(dateGrounded({ year: 2023, month: 3 }, ["Started March 2023"]), true);
  assert.strictEqual(dateGrounded({ year: 2023, month: 3 }, ["Marketing 2023"]), false);
  assert.strictEqual(dateGrounded({ year: 2023, month: 3 }, ["Started 12023"]), false);
});

test("computeConfidence: grounded, ungrounded, invalid and missing", () => {
  const p = sample();
  const conf = computeConfidence(p, RESUME);
  assert.deepStrictEqual(Object.keys(conf), fieldPaths(p));
  assert.strictEqual(conf["contact.name"], 1);
  assert.strictEqual(conf["contact.email"], 1);
  assert.strictEqual(conf["contact.phone"], 1);
  assert.strictEqual(conf["contact.links.0"], 1);
  assert.strictEqual(conf["roles.0.company"], 1);
  assert.strictEqual(conf["roles.0.start"], 1);
  assert.strictEqual(conf["roles.0.end"], 1, "end of a current role needs nothing to verify");
  assert.strictEqual(conf["roles.0.bullets"], 1);
  assert.strictEqual(conf["roles.1.location"], 0, "empty -> missing");
  assert.strictEqual(conf["education.0.endYear"], 1);
  assert.strictEqual(conf["skills.0"], 1);
  assert.strictEqual(conf["projects.0.name"], CONFIDENCE.ungrounded, "project not in the resume text");

  const invented = sample();
  invented.roles[0].company = "Globex Corporation";
  assert.strictEqual(computeConfidence(invented, RESUME)["roles.0.company"], CONFIDENCE.ungrounded);

  const badOrder = sample();
  badOrder.roles[1].start = { year: 2023, month: 2 };
  badOrder.roles[1].end = { year: 2021, month: 6 };
  const c = computeConfidence(badOrder, RESUME);
  assert.strictEqual(c["roles.1.end"], CONFIDENCE.invalid);

  const oneBad = sample();
  oneBad.roles[0].bullets = ["Cut checkout API p99 latency from 900ms to 280ms", "Won the Nobel prize"];
  assert.strictEqual(computeConfidence(oneBad, RESUME)["roles.0.bullets"], CONFIDENCE.ungrounded);

  const skill = sample();
  skill.skills = [{ name: "Go", canonicalId: "go", matchedFrom: ["Golang", "Go"] }, { name: "Rust", canonicalId: "rust", matchedFrom: ["Rust"] }];
  const sc = computeConfidence(skill, RESUME);
  assert.strictEqual(sc["skills.0"], 1);
  assert.strictEqual(sc["skills.1"], CONFIDENCE.ungrounded);
});

test("computeConfidence: links ignore protocol and trailing slash; a fabricated email is ungrounded", () => {
  const p = sample();
  p.contact.links = ["https://github.com/janedoe/"];
  p.contact.email = "someone@else.org";
  const c = computeConfidence(p, RESUME);
  assert.strictEqual(c["contact.links.0"], 1);
  assert.strictEqual(c["contact.email"], CONFIDENCE.ungrounded);
});

test("computeConfidence cannot take a caller-supplied confidence and handles huge input", () => {
  assert.strictEqual(computeConfidence.length, 2);
  const t0 = Date.now();
  computeConfidence(sample(), "Jane Doe ".repeat(20000));
  assert.ok(Date.now() - t0 < 2000);
});

test("needsLookCount counts fields below the threshold", () => {
  assert.strictEqual(needsLookCount({ a: 1, b: 0.79, c: 0.8, d: 0 }), 2);
  assert.strictEqual(LOW_CONFIDENCE_THRESHOLD, 0.8);
});

test("toVaultProfile keeps headline and targetRole", () => {
  const existing = { name: "Old", headline: "Backend engineer", location: "Delhi", targetRole: "Staff Engineer", links: "x.com/old" };
  const v = toVaultProfile(sample(), existing);
  assert.deepStrictEqual(v, { name: "Jane Doe", headline: "Backend engineer", location: "Pune", targetRole: "Staff Engineer", links: "github.com/janedoe" });
  const blank = sample();
  blank.contact = { ...blank.contact, name: "", links: [] };
  assert.strictEqual(toVaultProfile(blank, existing).name, "Old");
  assert.strictEqual(toVaultProfile(blank, existing).links, "x.com/old");
  const two = sample();
  two.contact.links = ["a.com", "b.com"];
  assert.strictEqual(toVaultProfile(two, existing).links, "a.com, b.com");
});

test("applyQuickProfile writes contact fields only", () => {
  const p = sample();
  const quick = { name: "J. Doe", headline: "ignored", location: "Mumbai", targetRole: "ignored", links: "github.com/jd, https://jd.dev  github.com/jd" };
  const out = applyQuickProfile(p, quick);
  assert.strictEqual(out.contact.name, "J. Doe");
  assert.strictEqual(out.contact.location, "Mumbai");
  assert.deepStrictEqual(out.contact.links, ["github.com/jd", "https://jd.dev"]);
  assert.deepStrictEqual(out.roles, p.roles);
  assert.deepStrictEqual(out.skills, p.skills);
  assert.strictEqual(p.contact.name, "Jane Doe", "input not mutated");
  assert.strictEqual(applyQuickProfile(p, { ...quick, name: "", links: "" }).contact.name, "Jane Doe");
  assert.deepStrictEqual(applyQuickProfile(p, { ...quick, links: "" }).contact.links, p.contact.links);
});
