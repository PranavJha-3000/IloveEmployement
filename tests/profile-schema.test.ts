// Structured profile contract: schema, validation, grounding-based confidence
// and VaultProfile sync. No model calls. Run with `npm test`.
import assert from "node:assert";
import { test } from "node:test";
import {
  ConfirmedProfileSchema,
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
