---
phase: 04-agent-workflow
plan: 08
subsystem: ui
tags: [agent, discovery, vault, navigation]
requires: [04-02, 04-07]
provides:
  - APPLY_TOOL and APPLY_ICON (outside TOOLS)
  - Featured "Apply to this job" card (tag "Agent workflow") first in the home grid
  - Header "Apply to a job" link (desktop and mobile)
  - components/agent/ApplicationsList.tsx ("Applications in progress" vault section)
affects: [04-10, phase-05]
key-files:
  created:
    - components/agent/ApplicationsList.tsx
  modified:
    - lib/toolIcons.ts
    - lib/tools.ts
    - components/tools/ToolCard.tsx
    - components/tools/ToolGrid.tsx
    - components/layout/Header.tsx
    - app/apply/page.tsx
    - components/vault/VaultManager.tsx
decisions:
  - "APPLY_TOOL is not in TOOLS, so search, header menus, All tools and /tools/[slug] static params are unchanged (still 3 + 43 paths)"
  - "The featured card is hidden while searching; it shows for the All and Find jobs (target) tabs"
  - "ApplicationsList sits directly after SemanticIndex; Phase 5 Resume versions goes directly below it"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 08: Discovery and vault section Summary

The workflow is reachable from the home grid and the header, and saved applications can be resumed or deleted from /vault in the agreed position.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 APPLY_TOOL, icon, featured card, Header link, page icon | 1961c8b | ToolCard gained an optional `tag` prop that overrides the category label |
| 2 Applications in progress section | ff4f07e | Rows: job label, badge with icon, relative last activity, Resume application (link to `/apply?run=<encoded id>`), Delete application with inline confirmation |

## Verification

- `npm run typecheck` clean. `npm test`: 304 pass, 0 fail.
- `npm run build` exits 0. /tools/[slug] is unchanged at 6.48 kB / 157 kB with the same 46 paths. Shared First Load JS stays 103 kB. / is 4.88 kB / 138 kB (baseline 4.83 / 137). /vault is 6.32 kB / 143 kB (was 5.19 / 141 before this plan; ApplicationsList). /apply 13.6 kB / 164 kB.
- Section order by grep line: SemanticIndex (253), ApplicationsList (256), "Add a story, win or note" (260).
- `window.confirm` count in ApplicationsList is 0; "Keep application" appears once and receives focus when the confirmation opens. Esc closes the confirmation and returns focus to the Delete button.

## Deviations from Plan

None in scope. Small additions: the import message only mentions applications when m > 0; the clear-vault confirm now says "including your saved applications" (clearVault already clears agentRuns).

## Known Stubs

None.

## Not verified

No browser run (preview servers out of scope); visual review is left to the 04-10 checkpoint.

## Self-Check: PASSED
