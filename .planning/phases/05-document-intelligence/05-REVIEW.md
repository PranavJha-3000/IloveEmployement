---
phase: 05-document-intelligence
reviewed: 2026-11-02T00:00:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - lib/profile/extract.ts
  - lib/profile/patterns.ts
  - lib/profile/confidence.ts
  - lib/profile/schema.ts
  - lib/profile/sync.ts
  - lib/profile/confirm.ts
  - lib/profile/refine.ts
  - lib/profile/reviewState.ts
  - lib/profile/client.ts
  - lib/skills/taxonomy.ts
  - lib/skills/normalize.ts
  - lib/engine/scoring.ts
  - lib/engine/reports.ts
  - lib/engine/resumeText.ts
  - lib/diff.ts
  - lib/vault/schema.ts
  - lib/vault/versions.ts
  - lib/vault/store.ts
  - lib/vault/useVault.ts
  - lib/vault/versionList.ts
  - lib/vault/tailoredVersion.ts
  - lib/vault/chunker.ts
  - lib/presets/profile.ts
  - lib/presets/types.ts
  - lib/presets/index.ts
  - lib/pipeline.ts
  - lib/providers.ts
  - components/vault/ResumeImport.tsx
  - components/vault/ProfileReview.tsx
  - components/vault/ReviewField.tsx
  - components/vault/SkillEditor.tsx
  - components/vault/ResumeVersions.tsx
  - components/vault/VersionRow.tsx
  - components/vault/VersionDiff.tsx
  - components/vault/VaultManager.tsx
  - components/engine/ReportView.tsx
  - components/engine/PresetRunner.tsx
  - components/agent/ApplyWorkflow.tsx
  - evals/profile/metrics.ts
  - evals/profile/baseline.ts
  - evals/profile/run.ts
  - evals/profile/llm.ts
  - evals/profile/report.ts
  - evals/profile/dataset/gold.ts
  - evals/profile/dataset/load.ts
  - evals/profile/dataset/render.ts
  - evals/profile/dataset/synthetic-gold.ts
  - next.config.ts
  - app/robots.ts
  - app/sitemap.ts
  - app/api/run/[preset]/route.ts
  - .github/workflows/ci.yml
findings:
  critical: 3
  warning: 12
  info: 9
  total: 24
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-02
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

I reviewed the Phase 5 source changes in `f333c58..HEAD`: the profile extractor, refinement, review and confirm path, the skills taxonomy and scoring change, resume versions (schema v4, import, diff, UI), the /apply version hook, the profile eval, and the production hardening.

Several areas held up under probing:
- **v4 migration:** create-only and idempotent. Nothing is lost going from v2 or v3.
- **XSS:** no HTML injection points (`dangerouslySetInnerHTML`, raw `href`) carry model or resume data. The only `href` built from version data (`VersionRow`) is re-checked to allow only http/https.
- **ReDoS:** none. I timed every pattern in `patterns.ts` plus `skillsMentioned` against 50 lines of 1,000 adversarial characters each (digit runs, dot chains, `@` runs, month and date repeats). Nothing took more than 50 ms.
- **Baseline gate:** fails closed when the baseline is missing, unparseable, invalid, a metric disappears, or the fingerprint does not match.
- **Gold data:** nothing in `lib/` imports from `evals/`, so the gold data cannot leak into the extractor.

Three problems block shipping, and each was confirmed by running the code with jiti:
1. **Confirm profile is not atomic.** It runs five or six separate IndexedDB transactions, so a failure part-way through deletes the old resume chunks, or leaves chunks without a version or the other way round. The user is then told "Nothing was lost".
2. **Ungrounded refined values reach the profile.** The merge lets an invented email, an invented phone and a whole invented role through.
3. **Aliases create false positives in fit, gap, ATS and tailor checks.** Ordinary words and acronyms ("Go-to-market", "Spring 2021", "American Express", "Keynote", "CV", "PR", "AP", "Word") now count as Go, Spring Boot, Express.js, PowerPoint, Computer vision, Public relations, Accounts payable and Microsoft Office. A MISSING requirement is then upgraded to PARTIAL.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Confirm profile is not atomic; a partial failure loses the old resume chunks or leaves chunks and version out of sync, and the error claims nothing was lost

**File:** `components/vault/ResumeImport.tsx:177-194` (also `components/vault/VaultManager.tsx:71-86`, `lib/vault/store.ts:58-68, 90-99`)
**Issue:** `confirmProfile` runs these as separate transactions, each through its own `openDb()`:
1. `deleteChunksFromSource("resume")` (two transactions: chunks, then vectors)
2. `saveChunks`
3. `saveStructuredProfile`
4. `saveProfile`
5. `saveResumeVersion`

Any rejection between steps leaves partial state:
- **Steps 2–5 fail** (for example `saveChunks` hits QuotaExceededError, which aborts the transaction): the user's previous resume chunks and their vectors are already gone, and nothing new is saved. This is data loss.
- **Step 5 fails:** chunks and profile are saved without a base version. This is exactly the chunks-without-version state the plan's threat model rules out.
- **Step 3 or 4 fails:** new chunks are saved but the structured profile is stale.

The catch block then shows "We couldn't save your profile. **Nothing was lost**; try Confirm profile again", which is false in all of these cases. A retry also builds a new `newVersionId()`. So if only `onChanged` threw (it is inside the same `try`), the retry writes a duplicate base version. No test covers how the plan is executed; `tests/profile-confirm.test.ts` only tests the pure planner.

**Fix:** Run the whole plan in one multi-store transaction, so IndexedDB commits or rolls back all of it:
```ts
// store.ts
export async function commitConfirmPlan(plan: ConfirmPlan, newChunks: VaultChunk[] | null): Promise<void> {
  const confirmed = ConfirmedProfileSchema.parse(plan.confirmed);
  const version = plan.baseVersion ? ResumeVersionSchema.parse(plan.baseVersion) : null;
  const db = await openDb();
  const existing = newChunks ? await loadChunks() : [];
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([CHUNKS, VECTORS, META, RESUME_VERSIONS], "readwrite");
    if (newChunks) {
      for (const c of existing) if (c.source === "resume") { t.objectStore(CHUNKS).delete(c.id); t.objectStore(VECTORS).delete(c.id); }
      for (const c of newChunks) t.objectStore(CHUNKS).put(c);
    }
    t.objectStore(META).put(confirmed, STRUCTURED_PROFILE_KEY);
    t.objectStore(META).put(plan.vaultProfile, "profile");
    if (version) t.objectStore(RESUME_VERSIONS).put(version);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("Transaction aborted"));
  });
}
```
Also:
- Move `onChanged` out of the `try` that reports a save failure.
- Build the version id once per review session (or derive it from `sourceHash`), so a retry overwrites instead of duplicating.
- Add a test with a fake store that fails part-way through and check that nothing was written.

### CR-02: The refine merge lets ungrounded (invented) refined values into the profile: email, phone and whole roles, education and projects

**File:** `lib/profile/refine.ts:283-288, 304-317`
**Issue:** The doc comment says "an invented (ungrounded) refined value therefore never displaces a grounded deterministic one", and the phase contract is that refined values only merge when grounded. The code does not do that:
- **Contact scalars (line 287):** when neither side clears the threshold, `merged.contact[k] = rc[k] || dc[k]` takes the *refined ungrounded* value first. If the quick read found no email, any email the model invents is merged.
- **Roles, education and projects (310-314):** `pick` replaces the *whole list* as soon as `rn > 0 && rn >= dn`. Every refined item comes along, even ones whose title and company are ungrounded, along with their ungrounded dates and bullets. The grounded count only decides which list wins; it does not filter what is in it.

Probe (resume with one role at Acme; model output adds a second role and a different email):
```
email: jane@attacker.example 0.4
phone: +1 555 0100
roles: [ 'Software Engineer @ Acme [...]', 'Principal Architect @ Google ["Led 400 engineers"]' ]
```
Model output can be steered by a prompt injection inside the resume (see WR-05). `canConfirm` (`reviewState.ts:313`) only needs a name and no invalid fields; the user never has to look at low-confidence fields. So fabricated roles and contact details can be confirmed into the vault and the base profile, and every later tool run then uses them. The "Check this" badge is the only safeguard.

**Fix:** Merge item by item and keep only grounded refined items:
```ts
for (const k of CONTACT_SCALARS) {
  const path = `contact.${k}`;
  if (rc[k] && ok(refined, path)) merged.contact[k] = rc[k];
  else merged.contact[k] = dc[k];            // never fall back to an ungrounded refined value
}
const keepGrounded = <T,>(section: "roles" | "education" | "projects", keys: string[], list: T[]) =>
  list.filter((_, i) => keys.every((k) => ok(refined, `${section}.${i}.${k}`)));
const pick = <T,>(section: "roles" | "education" | "projects", keys: string[], d: T[], r: T[]) => {
  const rg = keepGrounded(section, keys, r);
  return rg.length > 0 && rg.length >= groundedCount(det, section, keys) ? rg : d;
};
```
Inside a kept refined role, fall back to the deterministic dates and bullets wherever the refined field is ungrounded. Add a regression test that copies the probe above.

### CR-03: Taxonomy aliases make ordinary words and acronyms count as skills in fit, gap, ATS and tailor checks

**File:** `lib/engine/scoring.ts:77-80, 89-94, 157-171, 177-188` and `lib/skills/taxonomy.ts` (for example lines 49, 81, 113, 114, 121, 198, 397, 396, 415, 430)
**Issue:** `skillFormFound` only checks capitalisation for forms in `entry.caseSensitive`, and `caseSensitiveFormPresent` accepts a hyphen right after the form. Short all-caps aliases (`CV`, `PR`, `AP`, `ML`, `QA`, `UI`, `UX`, `HR`) are matched case-insensitively in `scoring.ts`. `normalize.ts` treats them as case-sensitive (`isCaseSensitiveForm`), but `scoring.ts` never calls it. Scoring also never applies the longest-match overlap rule that `skillsMentioned` relies on ("Go-to-market is not Go").

Confirmed with `keywordCoverage`, `applySkillEvidence` (MISSING requirement) and `skillInText`:

| JD term | Resume text | ATS found | Fit result |
|---|---|---|---|
| Golang | "Led the Go-to-market launch" | true ("Go") | PARTIAL |
| Next.js | "Next, I rebuilt the onboarding flow." | true | PARTIAL |
| Spring Boot | "Spring 2021 intern at Acme." | true | PARTIAL |
| Express.js | "Partnered with American Express" | true | PARTIAL |
| PowerPoint | "Keynote speaker at a regional conference." | true | PARTIAL |
| Computer vision | "CV\nJane Doe" (the resume heading) | true | PARTIAL |
| Public relations | "Opened a PR to fix the build." | true | PARTIAL |
| Accounts payable | "Worked on AP style guides." | true | PARTIAL |
| Microsoft Office | "Word of mouth campaign" | true | PARTIAL |

Effects:
- **Fit and gap:** `applySkillEvidence` corrects the model's MISSING to PARTIAL, which raises `scoreRequirements`. The UI then says "Found in your resume as CV".
- **Tailor:** `skillInText` (`reports.ts:364`) now accepts a fabricated skill whenever an alias appears anywhere in `sourceText`, and that text includes the job description itself.
- **Pre-existing, related:** the original term is still matched case-insensitively (`isOriginal` branch), so the JD term "Go"/"Rust"/"Excel"/"Spark" matches "I go", "rust-proof", "excel at", "spark interest". The new canonical-correction path now builds on that unsafe matching.

**Fix:**
- Make `scoring.ts` use the same matcher as `skillsMentioned` (longest-first, overlap-suppressed, `isCaseSensitiveForm`) instead of its own `containsTerm` and `caseSensitiveFormPresent`. Then check whether the matched entry id is among the requirement's entries.
- Exclude a trailing `-` in the case-sensitive lookahead: `(?![A-Za-z0-9+#-])`.
- Move ambiguous acronyms (`CV`, `PR`, `AP`, `ML`, `QA`, `UI`, `UX`, `HR`) into `caseSensitive`. Drop aliases that are common English words or brand names (`Keynote`, `Word`, `Express`, `Next`, `Node`, `Spring`) from the evidence correction, or require a technology context token next to them.
- Add the table above as negative tests in `tests/skills-scoring.test.ts`.

## Warnings

### WR-01: Review inputs have no schema limits, so Confirm fails with a misleading generic error

**File:** `components/vault/ProfileReview.tsx:192-202, 233-241, 308-326, 531-538`; `components/vault/SkillEditor.tsx:70-78, 10-25`; `lib/profile/confirm.ts:354`
**Issue:** Nothing in the UI enforces the schema limits:
- Text inputs and textareas have no `maxLength` (title/company 200, bullet 600, detail 600, description 1000, link 300).
- "Add" has no item caps (roles 30, links 10, projects 30, education 30, skills 150).
- `mergeSkills` keeps adding to `matchedFrom` without limit (max 20).

`planConfirm` calls `StructuredProfileSchema.parse`, which throws a ZodError. That surfaces as "We couldn't save your profile. Nothing was lost; try again", with no field highlighted, and retrying can never succeed. `validateProfile` (which drives `canConfirm`) does not check lengths or counts.

**Fix:**
- Add `maxLength` to every control, matching the schema.
- Disable the Add buttons at the caps.
- Cap `matchedFrom` in `mergeSkills`.
- Add length and count checks to `validateProfile` so they show up as field errors and block `canConfirm`.

### WR-02: The project "Skills used" input swallows commas, so users cannot type a second skill

**File:** `components/vault/ProfileReview.tsx:536-537`, `lib/profile/reviewState.ts:202`
**Issue:** The input is controlled by `pr.skills.join(", ")`. On change, the value is `split(",")` and then `filter(Boolean)`. Typing "React," produces `["React", ""]`, the empty entry is dropped, and the field re-renders as "React": the comma disappears. Users can only add more skills by pasting. Leading spaces (" Node") are also stored untrimmed.
**Fix:** Keep local text state, as `BulletsInput` does. Split, trim and filter on blur or on save, not on every keystroke.

### WR-03: Grounding checks for phone, email and links are substring checks and accept invented values

**File:** `lib/profile/confidence.ts:71, 76, 88, 92`
**Issue:**
- **Phone:** grounded when its digits appear anywhere in the *concatenation of every digit in the resume*. The probe phone "2019 2021 2022" against "Acme 2019 - 2021\nBeta 2022" scored 1.
- **Email:** checked with `lower.includes(email)`. "n@acme.co" is grounded by "jon@acme.com" (probe scored 1).
- **Links:** "github.com/a" is grounded by "github.com/abc".

These scores decide what the refine merge accepts (CR-02) and which fields get the "Check this" badge, so a truncated or invented value can come out high-confidence.

**Fix:**
- Phone: compare against the digit strings of `findPhones(src)`.
- Email: compare against `findEmails(src)`.
- Links: compare against `findUrls(src)` after `linkKey` normalisation, using exact equality.

### WR-04: Import rolls back newer local versions and the structured profile, and the 200-version cap drops backups silently

**File:** `lib/vault/store.ts:307-308`, `lib/vault/versions.ts:94-98`, `components/vault/VaultManager.tsx:121`
**Issue:**
- `importVault` overwrites any local version with the same id unconditionally. Agent versions have stable ids (`agent-<runId>`), so restoring an older backup replaces a newer tailored resume.
- The imported `structuredProfile` replaces the local one even when the local `confirmedAt` is newer.
- Agent runs, by contrast, use `shouldImportRun` precisely so that "a backup never rolls back newer work".
- Local storage has no version cap (`saveResumeVersion` never enforces `MAX_VERSIONS`), but import keeps only the newest 200 and reports the rest as "invalid versions were skipped". That is misleading, and an export/import round trip of more than 200 versions loses data.

**Fix:**
- Apply the same newer-wins rule (`createdAt` for versions, `confirmedAt` for the profile).
- Enforce `MAX_VERSIONS` on save as well, with eviction or a warning.
- Report over-cap drops separately from invalid ones.

### WR-05: The prompt fence can be escaped, and injection findings from the refine call are discarded

**File:** `lib/engine/context.ts:59`, `lib/engine/injection.ts:16-45`, `lib/profile/client.ts:435-449`, `components/vault/ResumeImport.tsx:144`
**Issue:**
- The resume is fenced as `<untrusted_document ...>` + content + `</untrusted_document>`, but `screenUntrusted` does not neutralise a literal `</untrusted_document>` (or `<context ...>`) inside the text. A resume can close the fence and add instructions that read as trusted context. This affects every untrusted field, but Phase 5 adds a pass whose output is written into the user's profile (combined with CR-02, that means fabricated roles and contacts).
- `refineProfile` returns `meta`, but `doRefine` throws it away, so `meta.injection` and `meta.grounding` findings are never shown to the user.

**Fix:** Escape the fence tags inside untrusted content before assembly, for example `content.replace(/<\/?(untrusted_document|context)\b/gi, (m) => m.replace("<", "&lt;"))`, and add a matching pattern to the injection gate. When `meta.injection` is not empty, show a warning in `ResumeImport`, or fall back to the deterministic result.

### WR-06: Stopping or failing a refine still throws away the user's edits

**File:** `components/vault/ResumeImport.tsx:134-156, 347-366`
**Issue:**
- `ProfileReview` only renders while `phase === "ready"`. Starting a refine moves to `"refining"`, which unmounts the review and loses its reducer state (edits and confirmations).
- When the user clicks "Stop reading" or the refine fails, `finally` bumps `reviewKey` and shows `base`, the *pre-edit* extraction.
- The inline prompt warns that a successful refine replaces edits, but a stopped or failed refine also discards them.

**Fix:** Lift the review state (or a snapshot of it) into `ResumeImport` before refining and restore it on abort or failure. Alternatively, keep `ProfileReview` mounted (hidden or `inert`) while refining.

### WR-07: LLM eval results are cached without the dataset fingerprint or extractor version, so stale metrics get labelled as current

**File:** `evals/profile/llm.ts:87-96, 127-136`, `evals/profile/run.ts:115-131`, `evals/llm/cache.ts:59, 93-95`
**Issue:**
- `case.json` is keyed only by `HARNESS_VERSION/caseId/modelKey`. A stored record holds `refined` and `llmOnly` counts that were computed against the gold labels and `extractProfile` *as they were at that time*.
- After the gold data, `render.ts`, the extractor or `mergeExtractions` changes, `--llm` reuses those counts. `run.ts` then writes them to `profile-llm-latest.json` stamped with the *current* fingerprint and extractor version. `loadMeasuredLlm` trusts that stamp, so `PROFILE.md` reports stale numbers as measured.
- Cases where `runPreset` returned `!ok` are skipped and left out of the aggregates. This is survivorship bias; the totals carry it, but precision and recall do not.

**Fix:**
- Include the dataset fingerprint, `EXTRACTOR_VERSION`, `TAXONOMY_VERSION` and a merge version in the case record. Treat a mismatch as not cached, or store the raw model profile and re-score it on every run.
- Count failed cases as all false negatives, or report the metrics as partial.

### WR-08: The skills metric is circular, so normalisation errors cannot show up

**File:** `evals/profile/dataset/gold.ts:43-51`, `evals/profile/metrics.ts:50-53, 229`
**Issue:** The gold skills are built with `normalizeSkills` (the code under test), and `normSkill` uses `canonicalizeSkill` on both prediction and gold. If the taxonomy maps a term to the wrong entry (or merges two distinct skills), gold and prediction move together, so `skills.canonical` cannot catch it. That weakens the honesty claim in `evals/PROFILE.md`.
**Fix:** Write gold skills as literal canonical names or ids by hand (for example `{ name: "Go", canonicalId: "go" }`), and compare raw ids without re-canonicalising the gold.

### WR-09: Deleting a version has no error handling and drops focus; the Save-as-version form also drops focus

**File:** `components/vault/ResumeVersions.tsx:181-186, 335`; `components/engine/ReportView.tsx:414-416, 471-473`
**Issue:**
- `remove()` has no `try/catch`, and `onDelete={() => void remove(v.id)}` throws away any rejection. A failed delete gives an unhandled rejection and no message.
- After a successful delete the row disappears with focus inside it, so focus falls back to `<body>`.
- In `SaveVersionForm`, both Save and Cancel unmount the form while focus is on its buttons, and focus is not moved to the restored "Save as version" button or to the status message.

**Fix:**
- Wrap the delete in `try/catch` and show an error.
- After a delete, move focus to the next row's "View text" button, or to the section heading.
- In `SaveVersionForm`, keep a ref to the trigger button and focus it (or the status message) after the form closes.

### WR-10: Myers diff memory grows quadratically, so a large or imported version can crash the tab

**File:** `lib/diff.ts:20-25`, `components/vault/VersionDiff.tsx:250, 279-293`
**Issue:** `trace.push(v.slice(...))` stores one snapshot per edit distance `d`, using O(D²) memory in total. `MAX_VERSION_TEXT` is 40,000 characters, which allows about 20,000 short lines per side. Two different texts of that size give D ≈ 40,000, roughly 1.6e9 Int32 values (about 6 GB). The `BIG_LINES` threshold only postpones the work by one animation frame; it still runs on the main thread. Imported versions are attacker-controlled, so a crafted backup can freeze or crash the vault page whenever someone compares it.
**Fix:** Cap the work: if `n + m` or the running `d` passes a limit (for example 5,000), fall back to a simple prefix/suffix plus whole-block diff, or show "too different to compare". Alternatively, run the diff in a Web Worker with a timeout.

### WR-11: Export and Clear are disabled when the vault has no chunks, even if versions or a profile exist

**File:** `components/vault/VaultManager.tsx:272, 278`
**Issue:** Both buttons are `disabled={!chunks.length}`. A user who removed all their chunks but still has resume versions, a structured profile or applications cannot back them up or clear them.
**Fix:** Enable the buttons when any of `chunks`, `versions` or `structuredProfile` (or the agent runs) is present.

### WR-12: Saving the quick profile can leave it out of sync with the structured profile, with an unhandled rejection

**File:** `components/vault/VaultManager.tsx:193-199`
**Issue:**
- The async `onClick` has no `try/catch`.
- `saveProfile(draftProfile)` succeeds first. `saveStructuredProfile` then throws if the quick name or location is longer than 200 characters (the quick inputs have no `maxLength`), leaving the two profiles different.
- The rejection is unhandled and no error is shown.
- Clearing a field in the quick profile never clears it in the structured profile (`applyQuickProfile` keeps the old value), so the two drift apart silently.

**Fix:** Validate first, write both records in one transaction, catch errors and show them with `setError`, and add `maxLength={200}` to the quick-profile inputs.

## Info

### IN-01: Dates written without a space ("Jan2020") are accepted by the range pattern but dropped by the parser

**File:** `lib/profile/patterns.ts:279` vs `294`
**Issue:** `DATE_SRC` allows `\s{0,3}` between the month and the year, but `parseYearMonth` requires `\s{1,3}`. `parseDateRange("Jan2020 - Mar2021")` returns `null` (confirmed), so the role loses its dates.
**Fix:** Use `\s{0,3}` in `parseYearMonth`.

### IN-02: The first "Previous change" goes to the second-to-last change instead of the last

**File:** `components/vault/VersionDiff.tsx:306`
**Issue:** With `cursor = -1`, `(cursor - 1 + n) % n` gives `n - 2`.
**Fix:** `const next = cursor < 0 ? (step === 1 ? 0 : n - 1) : (cursor + step + n) % n;`

### IN-03: Re-confirming creates duplicate base versions, and "Save as version" duplicates when repeated

**File:** `lib/profile/confirm.ts:341-351, 364`, `lib/vault/tailoredVersion.ts:203-205`
**Issue:** Every confirm with resume text creates a new `newVersionId()` base version, even when `sourceHash` has not changed. Saving the same tailored result twice also creates two versions.
**Fix:** Skip the new version when the newest base has the same normalised text or hash. In the form, keep the saved id and offer "Update version".

### IN-04: The /apply version hook ignores stopped or stale responses, never retries, and misses edits

**File:** `components/agent/ApplyWorkflow.tsx:123-144, 307`
**Issue:** The hook is safe against the loop: it is not awaited, it writes a different store, and its id is fixed so repeats overwrite. But:
- It runs before the `!rebased.current` check, so a tailor step that finished after the user pressed Stop is still saved as a version.
- A failed save is only logged and never retried.
- Edits made to the tailored resume in `ArtifactEditor` never update the version.

**Fix:** Save from `rebased.record`'s copy of the step, and skip when `rec.status === "stopped"` if that is the intended behaviour. Also save the version when an artifact edit is saved.

### IN-05: Imported version ids are used as raw DOM ids

**File:** `components/vault/VersionRow.tsx:47-48`
**Issue:** `ResumeVersionSchema.id` accepts any string up to 80 characters. An imported id with spaces breaks `aria-controls` and `htmlFor`.
**Fix:** Restrict ids to `/^[A-Za-z0-9_-]+$/` in the schema, or pass ids through `fieldDomId`-style sanitising.

### IN-06: `matchedFrom` is not capped in the refine paths

**File:** `lib/profile/refine.ts:235, 323`
**Issue:** `normalizeSkills` can return more than 20 `matchedFrom` entries (for example the model returning many casings of "JavaScript"). `StructuredProfileSchema.parse` then throws (confirmed with 25 variants), and the whole refine fails with a generic error.
**Fix:** Slice to 20 and clip each entry to 200 characters, as `extract.ts:361` already does.

### IN-07: The eval merge uses server-computed confidence, while the app recomputes it on the client

**File:** `evals/profile/llm.ts:133-136`, `lib/engine/reports.ts:461`, `lib/profile/client.ts:444`
**Issue:** The eval feeds `data.confidence` into the merge, and that confidence was computed on the gated, 11,000-character text. The app recomputes confidence on the original text. The docs say the eval runs "exactly as the app does", but the merge inputs can differ.
**Fix:** In the eval, recompute with `computeConfidence(data.profile, item.text)` before merging.

### IN-08: Hard-coded site URL and a long `maxDuration`

**File:** `app/robots.ts:3`, `app/sitemap.ts:4`, `app/api/run/[preset]/route.ts:14`
**Issue:**
- `SITE` is hard-coded, so preview and custom-domain deployments publish the wrong sitemap.
- `maxDuration = 180` needs a hosting plan or runtime that allows more than 60 seconds.

**Fix:** Read the site URL from `NEXT_PUBLIC_SITE_URL` with this as the fallback, and document the plan requirement.

### IN-09: The import schema does not bound education years

**File:** `lib/profile/schema.ts:51-52`
**Issue:** `EducationSchema.startYear` and `endYear` accept any integer, so imported or stored profiles can hold years like -5 or 99999. Only the review UI's `validateProfile` checks the range.
**Fix:** Add `.min(1950).max(2100)` to match `YearMonthSchema`.

---

_Reviewed: 2026-11-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
