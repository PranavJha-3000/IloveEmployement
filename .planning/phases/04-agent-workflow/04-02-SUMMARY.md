---
phase: 04-agent-workflow
plan: 02
subsystem: agent
tags: [agent, vault, indexeddb, persistence]
requires: [04-01]
provides:
  - lib/agent/record.ts (createRunRecord, isAgentRunRecord, toStorable, normalizeForResume, jobLabel, runBadge)
  - lib/vault/store.ts v3 (agentRuns store, upgradeVaultDb, saveAgentRun, loadAgentRun, listAgentRuns, deleteAgentRun, buildVaultExport, parseVaultImport)
affects: [04-03]
key-files:
  created:
    - lib/agent/record.ts
    - tests/agent-store.test.ts
  modified:
    - lib/vault/store.ts
decisions:
  - "toStorable is a whitelist rebuild (record and step level), so a smuggled config/apiKey is never stored or exported"
  - "upgradeVaultDb only creates missing stores; no deleteObjectStore; no Phase 5 versions store"
  - "importVault now returns {chunks, agentRuns}; VaultManager's { chunks: n } destructuring still compiles"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 02: Agent run persistence Summary

IndexedDB bumped v2 to v3 with an `agentRuns` store; run records have a key-free whitelist storage shape, resume normalization, and travel with vault export, import and clear.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Record helpers | 424838b | Hand-written guard, no zod; 6 tests |
| 2 DB v3 + export/import | ee42d76 | Fake-DB upgrade tests (v2->v3, fresh, idempotent), round-trip, old export, invalid runs |

## Deviations from Plan

None. Invalid/foreign runs on import are dropped by `isAgentRunRecord`, then rebuilt with `toStorable`.

## Verification

- `npm test`: 262 tests, 262 pass, 0 fail
- `npm run typecheck`: exit 0
- Greps: `DB_VERSION = 3` x1, `"agentRuns"` x1, `deleteObjectStore` 0, `resumeVersions` 0, no zod import in store.ts or record.ts.
- No model calls, no eval run.

## Known Stubs

None.

## Self-Check: PASSED
