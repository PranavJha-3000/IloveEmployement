# Phase 5 review fixes (2026-11-02)

| Finding | Fix |
|---|---|
| CR-01 | `applyWrites`/`confirmWrites`/`commitConfirmedProfile` in `lib/vault/store.ts`: confirm runs as one multi-store IndexedDB transaction; truthful error copy; base version id derived from the text (no duplicates on retry). `tests/vault-confirm-writes.test.ts` covers rollback on a mid-transaction failure. |
| CR-02 | `mergeExtractions` keeps refined contact values, roles, education and projects only when grounded, item by item; ungrounded details inside kept items are dropped. Regression test copies the review probe. |
| CR-03 | Scoring uses `skillsMentioned(text, { strict: true })`: longest match, overlap suppression, ambiguous aliases (Next, Node, Express, Spring, Keynote, Word, CV, PR, AP) ignored, hyphen compounds of case-sensitive forms rejected. All nine probe phrases are negative tests; JS, k8s and ReactJS still match. |
| WR-03 | Email, phone and link grounding compare exactly against the pattern finders. |
| WR-11 | Export/Clear enabled when versions or a structured profile exist. |
| WR-12 | Quick profile saves both records in one transaction with error handling and `maxLength`; clearing a field clears it in both. |
| IN-03 | Fixed by the text-derived base version id. |
| IN-06 | `matchedFrom` capped in the refine paths. |

Deferred, not blocking: WR-01, 02, 04–10 and IN-01, 02, 04, 05, 07–09 (UI limits, import newer-wins, prompt-fence escape, refine edit preservation, eval cache key, hand-written skills gold, delete focus, diff memory cap).

Gates after the fixes: 509 tests pass, typecheck clean, retrieval and profile baselines pass, LLM case fingerprint 1ht349n unchanged.
