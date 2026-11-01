---
phase: 05-document-intelligence
plan: 06
subsystem: evals
tags: [eval, dataset, metrics, gold-labels, DOC-03]
requires: [05-03]
provides:
  - evals/profile/dataset/{types,gold,render,synthetic-gold,load}.ts (13 labelled resumes)
  - evals/profile/metrics.ts (scoreProfile, aggregateCounts, FIELD_KEYS, prf, FieldCounts)
affects: [05-08, 05-09]
key-files:
  created:
    - evals/profile/dataset/types.ts
    - evals/profile/dataset/gold.ts
    - evals/profile/dataset/render.ts
    - evals/profile/dataset/synthetic-gold.ts
    - evals/profile/dataset/load.ts
    - evals/profile/metrics.ts
    - tests/profile-dataset.test.ts
    - tests/profile-metrics.test.ts
  modified: []
decisions:
  - "Gold was authored first as StructuredProfile objects; resume texts are rendered from it, so labels hold by construction. lib/profile/extract.ts does not exist and was not consulted"
  - "10 render styles, one per authored person; 4 headings the chunker does not match (Where I've Worked, Learning, Toolkit, Career, Things I've Built) and 2 education-first styles"
  - "A year-only date style can only be paired with gold whose months are null; a test enforces it, so the gold never claims a month the text does not show"
  - "prf support is tp + fn (the gold count); precision/recall/f1 are null when their denominator is empty"
metrics:
  tasks: 2
  completed: 2026-11-01
---

# Phase 5 Plan 06: Gold dataset and extraction metrics Summary

Ten fictional people authored as gold profiles and rendered into resume text in ten distinct formats, hand-written gold for the three Phase 1 retrieval resumes, and a pure field-level precision/recall module, all written before any extractor exists.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Gold profiles, renderer, synthetic gold | f0d2d56 | 13 resumes (10 rendered, 3 synthetic); 9 dataset tests |
| 2 Field-level metrics | 0e05359 | 12 hand-computed tests |

## What the dataset covers

- Domains: software (3), data (2), design, product, operations, business, marketing. Seniority: 3 junior, 4 mid, 3 senior.
- Formats: 6 date styles, 5 bullet styles (including numbered), 4 role header layouts, 3 contact layouts (including 8-space two-column noise), 4 skills layouts (comma, labelled groups, bullets, tab columns), bare and https links, upper-case and mixed headings, with and without a summary, skills-first and education-first orders.
- Special cases: one career changer with a 20-month gap (teacher to logistics), current roles, one profile with no education, 7 profiles with at least one skill outside the taxonomy, aliases printed as written (k8s, Postgres, JS, ReactJS, HTML5, CSS3).
- Tests prove gold by construction: every name, email, phone, location, link, role title/company, bullet, degree, institution, project name, skill as written, year and formatted month is found verbatim in its own text. This check also applies to the three hand-transcribed synthetic gold profiles.

## Deviations from Plan

**1. Ten styles rather than eight.** The plan requires at least 8; ten were needed to cover every date, bullet, header, contact and skills value across the rendered set with each value used at least twice where the enum allows.

**2. TDD RED not committed separately** (same reason as Plan 03: a test importing absent modules breaks `npm test` compilation, and every commit must compile). Tests and implementation are committed together per task.

**3. Synthetic gold leaves `projects.description` empty** and records no links, because the resumes state neither; project bullets are not mapped to a description to avoid inventing a label.

## Verification

- `npm test`: 417 tests, 417 pass, 0 fail
- `npm run typecheck`: clean; `npx tsc -p tsconfig.eval.json --noEmit`: clean
- `npm run eval:retrieval -- --ci`: baseline gate passed; `git diff -- evals/retrieval` empty
- `npm run eval -- --dry`: 28 cases, fingerprint `1ht349n` (unchanged)
- `lib/profile/extract.ts` does not exist
- Dataset fingerprint (informational): `1soomxp`
- No model calls

## Known Stubs

None.

## Self-Check: PASSED
