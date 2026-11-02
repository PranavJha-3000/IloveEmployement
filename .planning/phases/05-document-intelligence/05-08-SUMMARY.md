---
phase: 05-document-intelligence
plan: 08
subsystem: profile
tags: [extractor, regex, deterministic, confidence, DOC-01, DOC-02]
requires: [05-01, 05-03, 05-06]
provides:
  - lib/profile/patterns.ts (findEmails, findPhones, findUrls, parseYearMonth, parseDateRange, MAX_LINE)
  - lib/profile/extract.ts (extractProfile, safeExtractProfile, EXTRACTOR_VERSION "det-1", MAX_EXTRACT_CHARS)
  - lib/vault/chunker.ts exports sectionKind, BULLET, looksLikeRoleHeader (export keyword only)
affects: [05-09, 05-10]
key-files:
  created:
    - lib/profile/patterns.ts
    - lib/profile/extract.ts
    - tests/profile-extract.test.ts
  modified:
    - lib/vault/chunker.ts
decisions:
  - "Section grouping and the wrapped-bullet rule are replicated from chunkResume rather than refactoring it, so chunker behaviour is untouched"
  - "Title versus company in a role header is decided by a title-keyword rule on the first two header parts; ties default to 'Title, Company' order"
  - "Skills: a token containing '/' is kept whole when the taxonomy knows it (CI/CD, TCP/IP), otherwise split on '/'"
metrics:
  tasks: 2
  files: 4
  completed: 2026-11-01
---

# Phase 5 Plan 08: Deterministic profile extractor Summary

An offline, never-throwing extractor that turns resume text into a schema-validated StructuredProfile with code-computed per-field confidence, reusing the chunker's section and role detection plus bounded regexes for contact details and dates.

## What was built

- `patterns.ts`: line-by-line matching with each line sliced to 1,000 characters; bounded quantifiers only. Emails (lowercased, unique), phones (7 to 15 digits, bare year spans like 2019-2021 rejected), URLs (scheme, www, or domain with a path; email domains are not read as links), `parseYearMonth` (month names, `MM/YYYY`, `YYYY-MM`, `YYYY.MM`, bare year, 1950 to 2100) and `parseDateRange` (separators dash, en/em dash, to/until; Present/Current/Now/Today/Ongoing).
- `extract.ts`: contact (name, email, phone, location, links from the header block), roles with dates and bullets (including three header layouts plus two-line headers), education (degree and institution keyword tables), skills (label stripping, multi-delimiter split, taxonomy normalization), projects (name, joined description, link, skills mentioned). Output is clipped to schema limits, parsed with `StructuredProfileSchema`, and gets `computeConfidence(profile, raw)`. `sourceHash = contentHash(raw)`. Input over 50,000 characters is truncated with the plan's warning.
- `safeExtractProfile` returns null on throw, non-string, under 200 characters, or when no name, role or skill is found.
- `chunker.ts`: only `export` added to three declarations (diff is 3 lines, all `export`).

## Verification

- `npm test`: 454 pass, 0 fail (23 in `tests/profile-extract.test.ts`). `npm run typecheck`: clean.
- `npm run eval:retrieval -- --ci`: baseline gate passed, metrics unchanged (keyword recall@3 0.445, mrr 0.267).
- Grep gates: no `evals/` reference and no `fetch(` in the extractor files; `EXTRACTOR_VERSION = "det-1"` present once.
- Adversarial 50,000-character inputs return in under 200 ms from every parser; extractor on three adversarial shapes completes well under 2 s.
- The measurement set (evals/profile, retrieval resumes dataset, gold tests) was not opened, imported or run; all fixtures are inline and fictional (plus the engine test RESUME copy the plan allows).

## Deviations from Plan

**1. TDD RED commits not separate.** As in Plans 02 and 03, a test file importing absent modules breaks `npm test` compilation, so each task is one commit with tests and implementation (RED was observed locally as a compile failure).

**2. Small additions beyond the plan's keyword tables (Rule 2, accuracy).** Extra title words (Founder, President, Executive, Supervisor, Programmer, Representative, Technician, Strategist, Advisor, Trainee), present words (Ongoing), and a company-suffix merge (Inc., LLC, Ltd) so "Acme, Inc." is not split into company and location. Projects without bullets start a new project at each short, name-like line.

## Known Stubs

None.

## Self-Check: PASSED
