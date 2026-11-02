---
phase: 02-reranking
verified: 2026-11-01T00:00:00Z
status: passed
score: 3/3 success criteria verified (SC1 interpreted per recorded REJECT decision)
overrides_applied: 0
gaps: []
---

# Phase 2: Reranking Verification Report

**Phase Goal:** A cross-encoder reranker is either adopted with a measured win or rejected with recorded numbers, never shipped on faith
**Status:** passed
**Re-verification:** No, initial verification

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An on-device Transformers.js cross-encoder can rerank the hybrid top-N; model loads only on opt-in (first-load JS unchanged) | VERIFIED (see reasoning) | `lib/retrieval/rerank.ts` (injected-scorer core, `RERANK_TOP_N=20`), `evals/retrieval/reranker.ts` (Xenova/ms-marco-MiniLM-L-6-v2 q8 loads in Node, 110 ms), `evals/retrieval/strategies.ts` hybrid+rerank. No file in `app/` or `components/` references rerank. `lib/vault/embeddings.ts` and `lib/vault/retrieve.ts` have no rerank import, so app first-load JS is unchanged. |
| 2 | `evals/RETRIEVAL.md` has hybrid+rerank row beside hybrid with ndcg@8 delta and added latency | VERIFIED | RETRIEVAL.md: hybrid+rerank (top 20) ndcg@8 0.561 vs hybrid 0.580. The Decision section gives delta -0.0191 with CI [-0.0519, 0.0138]. Added latency p50 168.45 ms, p95 275.18 ms (lines 150-165). Report is from sha 5e46b43, after the CR-01 fix. |
| 3 | Decision and numbers recorded in repo and PROJECT.md Key Decisions; app behaviour matches | VERIFIED | `evals/retrieval/DECISION.md` (pre-registered rule, Outcome: RERANK_ADOPTED none, APP_BASE_MODE hybrid). PROJECT.md line 70 records "Rejected" with the same numbers (168.5 ms). The app is unchanged and ships no reranker, which matches the decision. |

**Score:** 3/3

## Reasoning on RERANK-01 / SC1 (explicit)

RERANK-01 ("can rerank the hybrid top-N, lazy-loaded only on opt-in") and SC1 describe the capability and the opt-in loading constraint. The phase goal and RERANK-03 make shipping conditional: "enabled in the app only if it improves the primary metric". The pre-registered rule (DECISION.md R1) failed all three conditions for both candidates: (a) ndcg@8 below the best existing 0.593, (b) CI of delta includes or is below 0, (c) added p50 above 150 ms. The outcome was REJECT.

SC1 is conditional in intent. Its "loads only after opt-in, first-load JS unchanged" clause is trivially and strictly satisfied when no reranker code is in the app bundle: there is nothing to load. The capability ("can rerank the hybrid top-N") is demonstrably implemented and exercised in the eval harness (`lib/retrieval/rerank.ts` is a pure, environment-agnostic core; the Node cross-encoder in `evals/retrieval/reranker.ts` feeds it; `tests/retrieval-rerank.test.ts` covers promotion within topN, selection rules and whole-resume bypass). Requiring an app opt-in path for a rejected feature would contradict RERANK-03 and "never shipped on faith". I judge RERANK-01 and SC1 satisfied by the harness implementation plus the recorded rejection. I note one caveat: strictly read, the browser (WASM) opt-in path was never built. That is deliberate and consistent with the decision. It is not a gap. REQUIREMENTS.md still shows these as unchecked/Pending, which is bookkeeping for the orchestrator to update.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Test suite | `npm test` | 122 tests, 122 pass, 0 fail | PASS |
| CI keyword gate | `npm run eval:retrieval -- --ci` | "Baseline gate passed (epsilon 0.005)"; keyword ndcg@8 0.349 | PASS |
| CR-01 fix present | `git show 5e46b43` | logits-dims log guarded by a `loggedDims` flag, so it runs once, outside repeat timing | PASS |
| Regeneration after fix | `git show --stat 1e7c833` | RETRIEVAL.md, DECISION.md, PROJECT.md updated; RETRIEVAL.md sha is 5e46b43; DECISION.md latencies 168.45/162.30 match RETRIEVAL.md | PASS |

I did not re-download models or regenerate RETRIEVAL.md, as instructed. The recorded numbers are internally consistent across RETRIEVAL.md, DECISION.md and PROJECT.md. The decision is robust to latency. Even if latency were zero, criteria (a) and (b) fail on quality.

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| RERANK-01 | SATISFIED (see reasoning) | Reranker implemented and runnable in the harness; no app path by design, per REJECT. |
| RERANK-02 | SATISFIED | Evaluated through the harness versus hybrid with paired bootstrap CI and added latency (RETRIEVAL.md). |
| RERANK-03 | SATISFIED | Not enabled, because it does not improve ndcg@8. Decision and numbers are in DECISION.md, RETRIEVAL.md and PROJECT.md. |

No orphaned requirements. REQUIREMENTS.md checkboxes and traceability table still read Pending and should be flipped.

## Review Findings (02-REVIEW.md)

- **CR-01** (log inside timed region): FIXED in 5e46b43; artifacts regenerated in 1e7c833. Confirmed. The outcome is unchanged (REJECT), and the post-fix p50 stays above 150 ms.
- **WR-01** hardcoded topN/candidate lists in four places: quality follow-up. No effect on the recorded result.
- **WR-02** `addedLatency` pairs by index without query-id check: quality follow-up. Same ordered dataset is used and the numbers are consistent.
- **WR-03** embeddings+rerank ignores base strategy for whole-resume limits: quality follow-up. Edge case outside the eval limit of 8.
- **WR-04** Phase 1 baseline can be lowered without `--allow-regression` on dataset change: quality follow-up, belongs to the Phase 1 CI gate, not Phase 2 goal.
- **WR-05** paraphrase gate scope can never fire: quality follow-up; the CI gate still works for keyword scopes (verified passing).
- **WR-06** NaN in `decide()` overall metric fails open: quality follow-up (hardening). Measured values are all finite, and the verified outcome is correct. Worth fixing before any future reuse of `decide()`.

None of these block the phase goal. They are follow-ups, not gaps. The Info items IN-01..IN-07 are likewise non-blocking.

## Anti-Patterns

No TBD/FIXME/XXX debt markers checked as blockers in the phase's core files beyond what the review lists. No stub or orphaned artifacts: `lib/retrieval/rerank.ts` is intentionally eval-only (IN-04, new lib exports unused by the app), consistent with the REJECT.

## Human Verification Required

None. The decision is mechanical and reproducible from recorded numbers.

## Gaps Summary

No gaps. The phase goal is achieved through the rejection branch ("rejected with recorded numbers"). The app is unchanged, which matches the recorded decision.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
