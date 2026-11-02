// Offline tests of the resume version model and import validation.
import assert from "node:assert";
import { test } from "node:test";
import {
  MAX_VERSIONS,
  MAX_VERSION_TEXT,
  newVersionId,
  ResumeVersionSchema,
  sanitizeImportedVersions,
  versionLabel,
  type ResumeVersion,
} from "../lib/vault/versions";

function version(over: Partial<ResumeVersion> = {}): ResumeVersion {
  return { id: "v1", kind: "base", label: "Base resume", text: "Some resume text", createdAt: 1, origin: "profile-confirm", ...over };
}

test("schema accepts a valid base and tailored version", () => {
  assert.ok(ResumeVersionSchema.safeParse(version()).success);
  const tailored = version({ kind: "tailored", origin: "tailor-tool", job: { title: "Dev", company: "Acme", url: "https://acme.example/jobs/1" } });
  assert.ok(ResumeVersionSchema.safeParse(tailored).success);
});

test("schema rejects unsafe or oversized values", () => {
  const bad = (v: unknown) => assert.equal(ResumeVersionSchema.safeParse(v).success, false);
  bad(version({ job: { title: "t", company: "c", url: "javascript:alert(1)" } }));
  bad(version({ job: { title: "t", company: "c", url: "not a url" } }));
  bad(version({ text: "x".repeat(MAX_VERSION_TEXT + 1) }));
  bad(version({ text: "" }));
  bad(version({ label: "l".repeat(201) }));
  bad(version({ kind: "other" as never }));
  bad(version({ id: "i".repeat(81) }));
  bad(version({ createdAt: Number.NaN }));
  assert.ok(ResumeVersionSchema.safeParse(version({ text: "x".repeat(MAX_VERSION_TEXT) })).success);
});

test("sanitizeImportedVersions drops invalid entries and counts them", () => {
  const out = sanitizeImportedVersions([version({ id: "a", createdAt: 1 }), { id: "bad" }, version({ id: "b", createdAt: 2 })]);
  assert.equal(out.versions.length, 2);
  assert.equal(out.dropped, 1);
  assert.deepEqual(out.versions.map((v) => v.id), ["b", "a"]);
});

test("sanitizeImportedVersions keeps the newest MAX_VERSIONS", () => {
  const many = Array.from({ length: MAX_VERSIONS + 5 }, (_, i) => version({ id: `v${i}`, createdAt: i }));
  const out = sanitizeImportedVersions(many);
  assert.equal(out.versions.length, MAX_VERSIONS);
  assert.equal(out.dropped, 5);
  assert.equal(out.versions[0].id, `v${MAX_VERSIONS + 4}`);
});

test("sanitizeImportedVersions tolerates non-arrays", () => {
  for (const raw of [undefined, null, "x", 3, {}]) assert.deepEqual(sanitizeImportedVersions(raw), { versions: [], dropped: 0 });
});

test("versionLabel", () => {
  assert.equal(versionLabel({ kind: "base" }), "Base resume");
  assert.equal(versionLabel({ kind: "tailored", job: { title: "Senior Backend Engineer", company: "Acme" } }), "Tailored: Senior Backend Engineer, Acme");
  assert.equal(versionLabel({ kind: "tailored", job: { title: "Engineer", company: "" } }), "Tailored: Engineer");
  assert.equal(versionLabel({ kind: "tailored" }), "Tailored resume");
});

test("newVersionId is unique, prefixed and within the id cap", () => {
  const a = newVersionId();
  const b = newVersionId("tl");
  assert.notEqual(a, newVersionId());
  assert.ok(a.startsWith("rv-") && b.startsWith("tl-"));
  assert.ok(a.length <= 80);
});

// Export / import payloads (pure helpers in store.ts)
import { buildVaultExport, parseVaultImport } from "../lib/vault/store";
import type { ConfirmedProfile } from "../lib/profile/schema";
import { emptyProfile } from "../lib/profile/schema";

const emptyVaultProfile = { name: "", headline: "", location: "", targetRole: "", links: "" };

test("export then import round-trips versions and the structured profile", () => {
  const sp: ConfirmedProfile = { profile: emptyProfile(), confirmedAt: 5, sourceHash: "abc", method: "deterministic" };
  const v = version({ id: "a" });
  const json = buildVaultExport(
    { profile: emptyVaultProfile, chunks: [], agentRuns: [], structuredProfile: sp, resumeVersions: [v] },
    "2026-01-01T00:00:00.000Z",
  );
  const back = parseVaultImport(json);
  assert.deepEqual(back.versions, [v]);
  assert.deepEqual(back.structuredProfile, sp);
  assert.equal(back.versionsDropped, 0);
});

test("import drops a javascript: URL version and an oversized one and reports 2", () => {
  const good = version({ id: "good" });
  const json = JSON.stringify({
    format: "iloveemployement-vault@1",
    chunks: [],
    resumeVersions: [
      good,
      version({ id: "x1", job: { title: "t", company: "c", url: "javascript:alert(1)" } }),
      { ...version({ id: "x2" }), text: "y".repeat(50000) },
    ],
    structuredProfile: { profile: { nope: true } },
  });
  const out = parseVaultImport(json);
  assert.deepEqual(out.versions, [good]);
  assert.equal(out.versionsDropped, 2);
  assert.equal(out.structuredProfile, null);
});

test("an export from before Phase 5 imports with no versions", () => {
  const out = parseVaultImport(JSON.stringify({ format: "iloveemployement-vault@1", chunks: [] }));
  assert.deepEqual(out.versions, []);
  assert.equal(out.versionsDropped, 0);
  assert.equal(out.structuredProfile, null);
});
