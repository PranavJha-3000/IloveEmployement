---
phase: 05-document-intelligence
plan: 05
subsystem: vault
tags: [indexeddb, resume-versions, schema-upgrade, DOC-04, DOC-01]
requires: [05-03]
provides:
  - lib/vault/schema.ts (DB_NAME, DB_VERSION=4, STORES, SchemaHost, upgradeVaultSchema)
  - lib/vault/versions.ts (ResumeVersion, ResumeVersionSchema, newVersionId, versionLabel, sanitizeImportedVersions, MAX_VERSIONS, MAX_VERSION_TEXT)
  - lib/vault/store.ts (loadResumeVersions, saveResumeVersion, deleteResumeVersion, loadStructuredProfile, saveStructuredProfile, v4 export/import/clear)
  - lib/vault/useVault.ts (versions, structuredProfile)
affects: [05-08, 05-12, 05-13]
key-files:
  created: [lib/vault/schema.ts, lib/vault/versions.ts, tests/vault-schema.test.ts, tests/vault-versions.test.ts]
  modified: [lib/vault/store.ts, lib/vault/useVault.ts, tests/agent-store.test.ts]
decisions:
  - "Phase 4's names win: upgradeVaultDb and VaultUpgradeTarget stay exported from store.ts as aliases of upgradeVaultSchema and SchemaHost; buildVaultExport and parseVaultImport were extended, not replaced"
  - "Export format string stays iloveemployement-vault@1; the new keys are optional so older exports import with versions 0"
  - "Phase 4's onblocked, onabort, onversionchange handling in openDb is untouched"
metrics:
  tasks: 2
  completed: 2026-11-01
---

# Phase 5 Plan 05: Resume versions store and structured profile persistence Summary

IndexedDB moves from v3 to v4 by adding a `resumeVersions` store through one idempotent upgrade function; the confirmed structured profile lives in `meta` under `structuredProfile`; export, import and clear carry both, with zod validation on import.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Upgrade function and version model | 45a098d | schema.ts, versions.ts, 12 tests (fresh, v2, v3, idempotent, schema rejects, sanitizer, labels) |
| 2 Store, export/import/clear, useVault | f203100 | pure `buildVaultExport` / `parseVaultImport` extended and tested; useVault returns versions and structuredProfile |

## Deviations from Plan

**1. [Phase 4 alignment] Extended Phase 4's helpers instead of the plan's names.** Phase 4 had already extracted `upgradeVaultDb` in store.ts and used `buildVaultExport` / `parseVaultImport`. The plan's `upgradeVaultSchema` is the real implementation in schema.ts; `upgradeVaultDb` is kept as an alias so Phase 4's tests and callers compile unchanged. `importVault` returns Phase 4's `{ chunks, agentRuns, keptNewer }` plus `{ versions, versionsDropped }`.

**2. [Rule 1 - test update] Phase 4 upgrade tests in `tests/agent-store.test.ts`** asserted exactly 4 stores / `["create:agentRuns"]`; updated to 5 stores and `["create:agentRuns", "create:resumeVersions"]` (the v4 store is now created on the same path).

**3. No real-IndexedDB upgrade test.** `fake-indexeddb` is not a dependency (Phase 4 did not add it) and package.json is unchanged. The v2 to v4 and v3 to v4 paths are tested with the hand-written fake host, including data preservation (chunks, meta, vectors, agentRuns records).

**4. Grep nuance.** `grep -c sanitizeImportedVersions lib/vault/store.ts` is 2 (import line plus the one call); there is one call site.

## Verification

- `npm test`: 396 tests, 396 pass, 0 fail
- `npm run typecheck`: clean
- `createObjectStore` count in store.ts: 0; package.json unchanged
- No model calls; no eval run (no engine or case files touched)

## Known Stubs

None.

## Self-Check: PASSED
