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
