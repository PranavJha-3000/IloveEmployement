---
phase: 05-document-intelligence
plan: 10
subsystem: profile
tags: [llm-refinement, preset, pipeline, merge, DOC-01]
requires: [05-04, 05-08]
provides:
  - lib/presets/profile.ts (hidden preset profile-extract, output kind "profile")
  - REPORT_SCHEMAS.profile and FINALIZERS.profile (code-computed confidence)
  - lib/profile/refine.ts (ModelProfileSchema, fromModelProfile, refinedResult, mergeExtractions)
  - lib/profile/client.ts (refineProfile, REFINE_MAX_CHARS 11000)
affects: [05-11, 05-12]
key-files:
  created: [lib/presets/profile.ts, lib/profile/refine.ts, lib/profile/client.ts, tests/profile-refine.test.ts]
  modified: [lib/presets/types.ts, lib/presets/index.ts, lib/engine/reports.ts, components/engine/ReportView.tsx]
decisions:
  - "The model-facing schema lives in lib/profile/refine.ts (ModelProfileSchema) and reports.ts references it, keeping reports.ts isomorphic with no new cycle"
  - "Refined links and skills are merged only when their code-computed confidence clears the threshold, so invented values never enter the merge"
metrics:
  tasks: 2
  completed: 2026-11-01
---

# Phase 5 Plan 10: LLM refinement pass Summary

An optional refinement runs as a hidden `profile-extract` preset through the existing `runPreset` pipeline (access tier, injection gate, fenced untrusted text, grounding), with confidence computed by code and a merge that cannot let an invented value displace a grounded deterministic one.

## What was built

- `profile` report kind; preset appended at the end of `PRESETS` (existing order and lookups unchanged); the only field `resumeText` is required, untrusted, max 11,000 chars; `usesVault: false`, no kb tags; excluded from `PUBLIC_PRESETS`.
- Model schema has no confidence key. An extra model-supplied `"confidence": 1` key is stripped by the schema; `FINALIZERS.profile` computes confidence with `computeConfidence(profile, ctx.inputs.resumeText)`. `generatedText("profile", o)` joins every string value so the invented-figure check flags unsupported numbers (test: "Grew revenue 400%" is reported in `meta.grounding`).
- `fromModelProfile`: dates via `parseYearMonth` ("2023-03" to 2023/3, "2021" to 2021/null, "" and "sometime" to null), skills via `normalizeSkills`, everything clipped to schema limits.
- `mergeExtractions`: contact scalars by confidence (refined, then deterministic, then any non-empty); links union deduplicated and capped at 10; roles, education and projects switch to refined only when it has at least as many grounded entries; skills normalized across both; confidence recomputed from the source text.
- `refineProfile`: rejects over-long text before fetching, forwards the AbortSignal, throws the server message on non-ok, re-validates the profile and recomputes confidence locally.

## Phase 3 protection

- Case fingerprint before: `1ht349n`; after Task 1 and after Task 2: `1ht349n` (28 cases), checked with `npm run eval -- --dry --no-dotenv`.
- `git diff --stat -- lib/engine/run.ts lib/engine/context.ts lib/kb evals/cases.ts evals/llm` is empty.
- No real model call; all pipeline tests use `MockLanguageModelV1`.

## Verification

- `npm test`: 472 pass, 0 fail (10 new in `tests/profile-refine.test.ts`). `npm run typecheck`: clean. Eval build `tsc -p tsconfig.eval.json --noEmit`: clean.
- `npm run eval:retrieval -- --ci` and `npm run eval:profile -- --ci` pass.

## Deviations from Plan

**1. [Rule 2 - safety] Refined links and skills are merged only when grounded.** The plan says union / normalize over both; taking ungrounded refined links and skills would contradict the plan's own truth that an invented refinement never lowers the deterministic result, so they are filtered by confidence.

**2. TDD RED commits not separate** (same reason as earlier plans: absent modules break test compilation).

## Known Stubs

None.

## Self-Check: PASSED
