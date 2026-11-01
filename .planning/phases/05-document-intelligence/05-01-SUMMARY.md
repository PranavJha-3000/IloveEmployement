---
phase: 05-document-intelligence
plan: 01
subsystem: skills
tags: [taxonomy, normalization, skills, DOC-02]
requires: []
provides:
  - lib/skills/taxonomy.ts (SKILL_TAXONOMY, SkillEntry, SkillCategory, TAXONOMY_VERSION "skills-1")
  - lib/skills/normalize.ts (skillKey, canonicalizeSkill, normalizeSkills, surfaceForms, skillsMentioned, suggestSkills, NormalizedSkill)
  - bundle-baseline.txt
affects: [05-02, 05-03, 05-04]
key-files:
  created:
    - lib/skills/taxonomy.ts
    - lib/skills/normalize.ts
    - tests/skills.test.ts
    - .planning/phases/05-document-intelligence/bundle-baseline.txt
  modified: []
decisions:
  - "Short all-caps forms (up to 3 chars, or 2 when it is the entry name) are matched case-sensitively in skillsMentioned, so 'PR', 'CV', 'AP' are not read as skills in lowercase prose"
  - "Single-letter case-sensitive forms (R, C) are rejected next to '&' or '/' (R&D, A/B)"
metrics:
  tasks: 2
  files: 4
  completed: 2026-11-01
---

# Phase 5 Plan 01: Skill taxonomy and normalizer Summary

A hand-curated 388-entry skill taxonomy across all 16 categories, plus a deterministic alias index and text scanner that resolves JS/ECMAScript to JavaScript and ReactJS/React.js to React while keeping unknown skills exactly as written.

## What was built

- `lib/skills/taxonomy.ts`: 388 entries, provenance header (hand-curated, no external taxonomy vendored), `TAXONOMY_VERSION = "skills-1"`.
- `lib/skills/normalize.ts`: alias index built at module load; a duplicate `skillKey` across two entries throws naming both ids. `skillsMentioned` uses literal escaped patterns with a single flat separator class (no nested quantifiers), longest form first with overlap discarding, 50,000 character cap. Imports nothing from vault, kb or engine.
- `tests/skills.test.ts`: 11 tests covering every behaviour in the plan, plus an adversarial 50k-character timing test and a check that the skills used by the synthetic eval resumes and cases are known.

## Bundle baseline (Task 1)

No fresh build was taken. `next.config.ts` has no `distDir` override, so any `next build` would overwrite `.next`, which the running dev server uses. Per instruction, the numbers were copied from `04-BASELINE.md` "After Phase 4": First Load JS shared by all 103 kB, `/vault` 143 kB, `/tools/[slug]` 157 kB, `/` 138 kB, `/apply` 164 kB, recorded with git sha f333c58. The Phase 5 allowance for the shared line is +3 kB.

## Gates

- `npm test`: 332 pass, 0 fail. `npm run typecheck`: clean.
- `npm run eval -- --dry --no-dotenv`: 28 cases, fingerprint 1ht349n (unchanged).
- `npm run eval:retrieval -- --ci`: baseline gate passed. No retrieval or BM25 code touched.

## Deviations from Plan

**1. [Rule 3 - Blocking] Bundle baseline not built.** The plan said run `npm run build`; this was disallowed while the dev server is on `.next` and no separate dist dir is configurable without editing `next.config.ts` (outside this plan's files). Baseline taken from the Phase 4 record instead (see above).

**2. [Rule 1 - Bug] Alias collision** `PowerPoint` appeared in both `microsoft-office` and `powerpoint`; removed it from `microsoft-office` (caught by the module-load check).

**3. Noisy generic aliases pruned** (for example "Operations", "Discovery", "Audit", "Collections") so free-text scanning does not report ordinary words as skills.

## Known Stubs

None.

## Self-Check: PASSED
