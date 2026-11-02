---
phase: 03-llm-evaluation
plan: 06
subsystem: evals
tags: [evals, agreement, kappa, bootstrap, labelling, zod, cli]
requires: ["03-04", "03-05"]
provides:
  - "agreement.ts: cohenKappa, weightedKappa, rawAgreement, withinOneAgreement, bootstrapStat, computeAgreement, AgreementBlock"
  - "labels.ts: selectLabelItems, buildLabelItems, humanRubric, renderLabelSheet, handLabelsSchema, parseHandLabels"
  - "run.ts: writeLabelSheet, applyAgreement, --labels-sheet and --agreement flags"
  - "report.ts: filled 'Judge agreement with human labels' section"
affects: [03-07, 03-09]
tech-stack:
  added: []
  patterns: ["seeded mulberry32 reused from evals/retrieval/stats", "cluster bootstrap over outputs for unit-level citation kappa", "textContent-only DOM plus JSON data element with < escaped"]
key-files:
  created: [evals/llm/agreement.ts, evals/llm/labels.ts, tests/llm-agreement.test.ts, tests/llm-labels.test.ts]
  modified: [evals/llm/run.ts, evals/llm/report.ts]
key-decisions:
  - "Both subcommands run before .env loading and never construct a model"
  - "The sheet embeds only the Dimensions, Claims and Citation units sections of RUBRIC.md, with the word judge replaced, so it says nothing about the automated rater"
  - "applyAgreement also refuses labels whose rubric hash differs from the saved run's, not just from the current RUBRIC.md"
requirements-completed: []
duration: ~50min
completed: 2026-11-01
---

# Phase 3 Plan 06: Agreement statistics and blind labelling Summary

The tooling for LEVAL-05 is in place: agreement statistics with seeded bootstrap intervals, a blind offline labelling sheet, zod-validated hand labels, and two offline subcommands. No real-model calls were made, `.env` was never read, and no labels exist anywhere in the repo (all label fixtures are synthetic and live only in tests, written to temp directories). `evals/llm/labels/` was not created.

## Tasks

1. Agreement statistics with seeded bootstrap: commit cea883e
2. Blind labelling sheet, item selection, hand-label parsing: commit 99fd764
3. `--labels-sheet`, `--agreement`, report section: commit 09384c7

## Behaviour notes

- Kappa and weighted kappa return null when expected agreement is 1; the report prints "n/a (no variance)". Raw agreement still returns 1 in that case.
- Verified on known values: 2x2 (20/5/10/15) gives 0.40; near-miss example gives 7/8 weighted vs 2/3 unweighted; reversed ratings give -1.
- `bootstrapStat` skips resamples whose statistic is null, reports the skipped count, and uses the Phase 2 percentile convention over the usable resamples. Citation support resamples outputs and pools their units.
- Judge fabricationPresent = at least one claim with status unsupported. Citation support is strict (`supports` vs anything else) over units both raters labelled.
- Selection: eligibility is "ok and judge result is ok"; no score, claim or verdict is read (test: two outcome sets differing only in scores select identically). Every engine gets up to 3 items first, the rest is filled round-robin across engines; models alternate inside each engine; items are returned in hash order so L01.. carry no engine or model pattern.
- Sheet: radios 1-4 for three dimensions, yes/no for fabrication, supports/partial/does_not_support per unit, notes, labeller, localStorage autosave, a download button that refuses until every field is filled. The embedded script passes `node --check`. Tests grep for innerHTML, external URLs, linked scripts/styles, and a hostile `</script>` string round-trips only through the escaped JSON element.
- `parseHandLabels` lists missing items, unknown or duplicate items, bad field values (with paths), missing unit verdicts and a rubric hash mismatch.

## Deviations from Plan

**1. [Rule 3 - design] Sheet output comes from the transcript, not the finalised data**
- The saved run does not store the finalised `data` the judge saw, so items show the final generation draft from the call transcript (pretty-printed JSON, truncated to 12000 chars). Citation units come from that same raw draft, so unit indices line up with the judge's verdicts.

**2. [Rule 3 - design] Rubric on the sheet is trimmed**
- RUBRIC.md mentions the judge throughout, which would break the blindness requirement. `humanRubric` keeps Dimensions, Claims and Citation units and replaces "judge" with "labeller". The hash in hand-labels.json is still the hash of the full RUBRIC.md.

**3. [Test scoping] Blindness grep skips one preset**
- The roast preset's own task text uses the verb "judge" and is shown verbatim to the labeller. The blindness test leaves cases whose task text contains that word out of its fixture and says so in a comment; all other checks (scores, reasons, model ids, "google:") cover every case.

**4. [Rule 2 - correctness] Extra rubric check**
- `--agreement` rejects labels whose rubric hash differs from the saved run's hash (judge and human must have used the same rubric).

Otherwise executed as written.

## Verification

- `npm test`: 230 tests, 230 pass, 0 fail (7 agreement and 12 labels tests added; plan 05 left 211)
- `npm run typecheck`: clean
- Greps: `from "../retrieval/stats"` 1; exported cohenKappa/weightedKappa/bootstrapStat/computeAgreement 4; `innerHTML` 0 in labels.ts; `textContent` 7; `application/json` 2; `labels-sheet|--agreement` in run.ts 4; `n/a (no variance)` in report.ts 1

## Known Stubs

None. The report still says "Pending" until hand-labels.json exists; that is intended and is resolved by Plan 09.

## Self-Check: PASSED

All four created files exist; commits cea883e, 99fd764 and 09384c7 exist. The user's uncommitted edits were not staged or touched.
