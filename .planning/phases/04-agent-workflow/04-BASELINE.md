# Phase 4 Baseline (before any Phase 4 change)

- Date: 2026-11-01
- Git SHA: 457c00a

## Bundle (npm run build)

First Load JS shared by all: 103 kB

| Route | Size | First Load JS |
|-------|------|---------------|
| / | 4.83 kB | 137 kB |
| /tools/[slug] | 21.6 kB | 154 kB |
| /vault | 7.02 kB | 140 kB |

## Phase 3 eval (npm run eval -- --dry --no-dotenv)

28 cases. Case fingerprint: 1ht349n (matches planner measurement).

## After Phase 4 (plan 04-10 gates)

- Gates: `npm test` 304 pass, 0 fail; `npm run typecheck` clean; `npm run build` exit 0; `npm run eval:retrieval -- --ci` baseline gate passed; both dry evals ran with no model calls.
- First Load JS shared by all: 103 kB (delta +0 kB, limit +3 kB). `/apply` is its own route chunk.

| Route | Size | First Load JS | Baseline |
|-------|------|---------------|----------|
| / | 4.88 kB | 138 kB | 4.83 kB / 137 kB |
| /tools/[slug] | 6.48 kB | 157 kB | 21.6 kB / 154 kB |
| /vault | 6.32 kB | 143 kB | 7.02 kB / 140 kB |
| /apply (new) | 13.6 kB | 164 kB | n/a |

- /tools/[slug] and /vault page chunks shrank but first load grew 3 kB each; the extra comes from lib/vault/store.ts importing lib/agent/record.ts (dependency-free, no zod). Not in the shared bundle.
- Default eval dry run: 28 cases, fingerprint 1ht349n (unchanged).
- Agent eval dry run (`--agent`): 4 cases, fingerprint e6b03r.
- `git status --short` after the evals: clean (no changes in evals/results or evals/LLM.md).
