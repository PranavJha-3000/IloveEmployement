---
phase: 05-document-intelligence
plan: 15
subsystem: verification
tags: [gates, bundle, docs, human-verify]
requires: [05-09, 05-10, 05-11, 05-12, 05-13, 05-14]
provides:
  - bundle-after.txt
  - platform.md and README.md updated for Phase 5
affects: [06-observability]
key-files:
  modified:
    - platform.md
    - README.md
    - .planning/phases/05-document-intelligence/bundle-after.txt
    - components/vault/VersionDiff.tsx
decisions:
  - "Human checkpoint approved by the user after the /vault walkthrough"
  - "Orchestrator browser pre-check (no model calls) found the diff did not move focus to its header on open; fixed in 749503e"
metrics:
  completed: 2026-11-02
---

# Phase 5 Plan 15: Gates, bundle, docs and human verification Summary

Every gate passes, the shared bundle is unchanged, the docs describe Phase 5, and the user approved the /vault flow.

## Gates

| Gate | Result |
|---|---|
| `npm test` | 495 pass, 0 fail |
| `npm run typecheck` | clean |
| `npm run build` | exit 0 |
| `npm run eval:retrieval -- --ci` | pass |
| `npm run eval:profile -- --ci` | pass, macro-F1 0.880 over 13 resumes |
| `npm run eval -- --dry --no-dotenv` | 28 cases, fingerprint `1ht349n` |
| `npm run eval -- --agent --dry --no-dotenv` | 4 cases, `e6b03r` |

## Bundle

| Line | Baseline | After |
|---|---|---|
| First Load JS shared by all | 103 kB | 103 kB (+0, budget +3) |
| `/tools/[slug]` | 157 kB | 175 kB |
| `/vault` | 143 kB | 194 kB |
| `/apply` | 164 kB | 184 kB |

The tool and apply growth is most likely the skill taxonomy imported by scoring; lazy-loading it is a follow-up.

## Orchestrator browser pre-check (no model calls)

Pasted a fictional resume on /vault: extraction filled contact, both roles (current role "Present"), and skills with "JavaScript from JS"; focus moved to "Review your profile". Confirm profile saved 10 chunks and created a "Base resume" version. With a tailored version present, "Compare with base" opened a word-level diff. No horizontal scroll at 375px. Fixed: focus now moves to the diff header (749503e).

## Human verification

Resume signal: **approved** by the user.
