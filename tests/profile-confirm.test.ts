// Offline tests of the confirm planner.
import assert from "node:assert";
import { test } from "node:test";
import { baseVersionFrom, planConfirm } from "../lib/profile/confirm";
import { emptyProfile } from "../lib/profile/schema";
import { ResumeVersionSchema } from "../lib/vault/versions";
import { contentHash } from "../lib/retrieval/fusion";

const existing = { name: "Old", headline: "Backend engineer", location: "Pune", targetRole: "Senior Engineer", links: "" };
const profile = () => {
  const p = emptyProfile();
  p.contact.name = "Asha Rao";
  p.contact.location = "Bengaluru";
  p.contact.links = ["https://github.com/asha"];
  return p;
};
const TEXT = "Asha Rao\n- Built the refunds API\n* Cut latency 30%  ";

test("planConfirm with resume text replaces chunks and builds a base version", () => {
  const plan = planConfirm({ profile: profile(), method: "deterministic", resumeText: TEXT, existingVaultProfile: existing, now: 1000 });
  assert.equal(plan.replaceChunks, true);
  assert.ok(plan.baseVersion);
  assert.equal(plan.baseVersion.kind, "base");
  assert.equal(plan.baseVersion.label, "Base resume");
  assert.equal(plan.baseVersion.origin, "profile-confirm");
  assert.equal(plan.baseVersion.text, "Asha Rao\n• Built the refunds API\n• Cut latency 30%");
  assert.equal(plan.confirmed.sourceHash, contentHash(TEXT));
  assert.equal(plan.vaultProfile.headline, "Backend engineer");
  assert.equal(plan.vaultProfile.targetRole, "Senior Engineer");
  assert.equal(plan.vaultProfile.name, "Asha Rao");
  assert.equal(plan.vaultProfile.location, "Bengaluru");
  assert.equal(plan.vaultProfile.links, "https://github.com/asha");
});

test("planConfirm without resume text saves no chunks and no version", () => {
  const plan = planConfirm({ profile: profile(), method: "refined", resumeText: null, existingVaultProfile: existing, now: 5 });
  assert.equal(plan.replaceChunks, false);
  assert.equal(plan.baseVersion, null);
  assert.equal(plan.confirmed.method, "refined");
});

test("planConfirm throws for a profile that fails the schema", () => {
  const bad = profile();
  bad.contact.email = "e".repeat(300);
  assert.throws(() => planConfirm({ profile: bad, method: "deterministic", resumeText: TEXT, existingVaultProfile: existing, now: 1 }));
});

test("baseVersionFrom passes the version schema and caps oversized text", () => {
  assert.ok(ResumeVersionSchema.safeParse(baseVersionFrom(TEXT, 1)).success);
  const huge = Array.from({ length: 6000 }, (_, i) => `line number ${i} of the resume`).join("\n");
  assert.ok(ResumeVersionSchema.safeParse(baseVersionFrom(huge, 1)).success);
});
