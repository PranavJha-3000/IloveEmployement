---
phase: 03-llm-evaluation
plan: 08
status: partial-quota-stop
requirements-not-marked: [LEVAL-01, LEVAL-02, LEVAL-03, LEVAL-04, LEVAL-06]
---

# Phase 3 Plan 08: Real-model run Summary

**Preflight (Task 1) done; the real run stopped on a daily quota 429 after 13 of 28 cases on the first generator, so evals/LLM.md and the labelling sheet were NOT produced. The run resumes from cache on a later quota day.**

## Task 1: Preflight (complete, nothing to commit)

- cases.ts, RUBRIC.md, prices.ts committed and clean (`git status --porcelain` empty).
- Live model list (`--list-models`): newest GA Flash is `gemini-3.8-flash`; the newest GA Flash-Lite is `gemini-3.5-flash-lite` (no 3.8 Lite exists in the list). Preview/experimental ids were excluded.
- Generators chosen: `google:gemini-3.8-flash`, `google:gemini-3.5-flash-lite`.
- Judge: newest GA Pro is `gemini-2.5-pro`, but the probe failed ("no longer available to new users"). `gemini-3.1-pro-preview` is a preview and was not used. Fallback per plan: judge = `google:gemini-3.8-flash`. The report limitations must state self-preference (the judge also generated one column).
- Probe: gemini-3.8-flash ok (reported gemini-3.8-flash); gemini-3.5-flash-lite ok (reported gemini-3.5-flash-lite).
- Prices: both chosen models already had rows (retrieved 2026-11-01), so prices.ts was unchanged and no price commit was needed.
- Estimate printed: `Total: 122-130 requests (worst case with JSON fallbacks: +72)`.
- Rate-limits page (https://ai.google.dev/gemini-api/docs/rate-limits, fetched 2026-11-01) does not publish per-model free-tier RPM/RPD numbers; it defers to the AI Studio limits page. I therefore kept the harness default `--rpm 5` (conservative, under the 8 cap).

## Task 2: Run (stopped on quota)

- Command: `npm run eval -- --models google:gemini-3.8-flash,google:gemini-3.5-flash-lite --judge google:gemini-3.8-flash --rpm 5`, exit code 2.
- Outcome: 13 of 28 cases attempted on gemini-3.8-flash (2 pass, 11 error), then `quota google:gemini-3.8-flash (HTTP 429)`, "Daily quota exhausted". gemini-3.5-flash-lite: 0 of 28 cases. Judge calls: 1 output judged.
- The 11 errors were client timeouts ("The operation was aborted due to timeout", with 503 retries), not rubric failures; gemini-3.8-flash latency with thinking was about 50 s for a successful case. A later run may need a longer per-call timeout; this was not changed here.
- Per the instructions, I did not retry. Finished calls are in the (gitignored) cache; rerunning the same command on a later quota day resumes from it.
- Partial preview only, local and gitignored: evals/results/LLM.preview.md. Its numbers cover 13 cases of one model only (gemini-3.8-flash: 2/13 pass, 11 errors) and must not be quoted as results.
- evals/LLM.md: not generated. Labelling sheet (items.json, key.json, sheet.html): not generated.
- Leak scan of everything under evals/results (including cache): `leak check: clean` (checked against the env key value and the AIza pattern, no value printed).

## Deviations

None to code. The plan's must-haves (full 28-case, two-model report committed; labelling sheet) are unmet due to the quota stop.

## Commits

Only this SUMMARY.md. No task commits.

## Self-Check: PASSED (no files claimed beyond this SUMMARY)
