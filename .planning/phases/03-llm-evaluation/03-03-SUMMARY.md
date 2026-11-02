---
phase: 03-llm-evaluation
plan: 03
subsystem: evals
tags: [evals, rubric, pricing, pre-registration]
requires: []
provides:
  - "Pre-registered judge rubric and metric definitions (RUBRIC.md)"
  - "rubric.ts: dimension ids, scale, loader, rubricHash"
  - "prices.ts: sourced, dated Gemini price table and null-safe estimateCostUsd"
affects: [03-08]
tech-stack:
  added: []
  patterns: ["commit definitions before measuring", "unknown cost is null, never 0"]
key-files:
  created: [evals/llm/RUBRIC.md, evals/llm/rubric.ts, evals/llm/prices.ts, tests/llm-rubric-prices.test.ts]
  modified: []
key-decisions:
  - "Prices are the Standard-tier values shown on the official page on 2026-11-01; dated promo prices use the one in effect that day, later price noted in each row"
  - "lookupPrice prefers exact match, then longest matching prefix (so flash-lite does not fall into flash)"
requirements-completed: []
duration: ~15min
completed: 2026-11-01
---

# Phase 3 Plan 03: Rubric and price table Summary

Committed the judge rubric with exact metric formulas and a sourced, dated price table before any real-model or judged run. No model calls were made.

## Tasks

1. Rubric and metric definitions: commit 6a1267b (evals/llm/RUBRIC.md, evals/llm/rubric.ts)
2. Price table, estimator and tests: commit 45d409e (evals/llm/prices.ts, tests/llm-rubric-prices.test.ts)

## Price source

Fetched https://ai.google.dev/gemini-api/docs/pricing on 2026-11-01 (curl, HTML converted to text). Rows added: gemini-3.8-flash, 3.6-flash, 3.5-flash-lite, 3.1-flash-lite, 3-flash-preview, 3.1-pro-preview, 2.5-pro, 2.5-flash, 2.5-flash-lite. Notes on what the page said:
- 3.8-flash and 3.6-flash: $0.75 in / $3.75 out through 2026-12-31, then $1.50 / $7.50 from 2027-01-01. The table holds the current price; the step-up is in each row's notes.
- gemini-3.1-pro-preview: free tier "Not available"; $2.00/$12.00, or $4.00/$18.00 for prompts over 200k tokens.
- gemini-4-argon is on the page but not on the free tier; not added.
- Some rows list a separate audio input price; the table uses the text price.
- Plan 08 should add a row if its chosen model id is not covered. The project's own lib/providers.ts still lists older ids (gemini-2.0-flash, 1.5) that are not on the page, so they have no row and report unknown cost.

## Deviations from Plan

The plan said to use WebFetch; that tool was not available, so the page was fetched with curl and read as text. The prices are still taken from the page itself, not from memory.

## Verification

- `node --test .test-build/tests/llm-rubric-prices.test.js`: 6 pass, 0 fail
- `npm test`: 144 tests, 144 pass, 0 fail
- RUBRIC.md acceptance greps return the expected counts; 9 `retrieved:` rows in prices.ts

## Known Stubs

None.

## Self-Check: PASSED

Files exist (RUBRIC.md, rubric.ts, prices.ts, llm-rubric-prices.test.ts); commits 6a1267b and 45d409e exist. The user's uncommitted edits were not staged or touched.
