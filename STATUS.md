# Current status

Updated: 2026-10-05 (local preview started; self-check workflow implemented and exercised)

## Handoff snapshot

The earlier checkpoint is condensed in [HANDOFF_REPORT.md](HANDOFF_REPORT.md). Dated archives in `../output/workspace-app-handoff-2026-10-05/` were verified against their checksums and matched the working files before this session. They are historical snapshots and do not include the new self-check workflow/scripts. This STATUS.md and the working directory contain the latest state.

## State

Project workflow and M1.1 are complete. The M1.2 local application shell is implemented with dark/subtle styling, larger controls, responsive navigation, and fictional sample data. Build and source checks pass; browser visual/interaction verification remains pending. There is no database, real authentication, durable app data, or NAS deployment.

| Milestone | State | Evidence |
| --- | --- | --- |
| Workflow setup | Complete | AGENTS.md, BRIEF.md, MILESTONES.md, STATUS.md, DECISIONS.md, HANDOFF.md, README.md |
| Session roadmap | Complete | SESSION_CHECKLIST.md: 35 increments, session routines, completion criteria, and decision timing |
| M1 — Design prototype | M1.1 complete; M1.2 implemented, browser checks pending | src/, package.json, pnpm-lock.yaml, RUNNING.md; only scaffold/data box additionally checked |
| M2 — Persistent foundation | Not started | — |
| M3 — Team workflow | Not started | — |
| M4 — Advanced behavior and Docs | Not started | — |
| M5 — NAS rollout | Not started | — |

## Next action

Finish M1.2 browser checks in RUNNING.md when browser security-policy verification is available. Inspect desktop and phone layouts, navigation/direct refresh/history, dialogs, search, sample account switching, and keyboard focus. Do not bypass the browser restriction or claim these checks passed. Once verified, mark the remaining M1.2 boxes and begin M1.3 — Personal Home and My Day.

## Latest session — preview and required self-check loop

- User selected checks **after each task/session only**, with no daily automation. AGENTS.md now requires implement → inspect → run/test → design/UI review → fix → confirm → reassess next action before closure. SESSION_CHECKLIST.md and RUNNING.md carry the same gates.
- Added `pnpm check` (typecheck plus production build) and `pnpm check:smoke` (`scripts/smoke-check.mjs`, no new dependencies). The HTTP script checks the root redirect, eight sample pages with headings/disclosures, and four HTTP 404 responses. It does not execute client interactions or prove error-page recovery links work.
- Passed on October 5: `pnpm check`; `pnpm check:smoke` — **13 passed, 0 failed** against the development server. The initial smoke run exposed an incorrect test assumption about error-boundary HTML; assertions now cover HTTP status while recovery-link rendering/clicks remain browser acceptance. A read-only specialist reviewed the workflow/script; the earlier independent text/href assertions were removed.
- Preview running at **http://127.0.0.1:3100/home** when checked. Sandbox port binding and loopback HTTP access required approved escalation. Server lifetime is session-dependent; use RUNNING.md to restart if needed. No external exposure or NAS deployment.
- Browser attempt on October 5: creating a visible in-app preview was refused because the admin-enforced security policy could not be verified. No screenshot or browser interaction was obtained. No alternate browser or indirect rendering workaround was used. The user can open the preview link directly on this Mac.
- Design/UI review evidence: read Impeccable and Web Design Guidelines instructions; loaded Impeccable context for the current shell; detector over `src/components` and `src/app/globals.css` returned `[]`. Reviewed source against current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) and DESIGN_SPEC.md. Existing labels, focus styles, 44–48 px controls, dark color scheme and mobile safe-area rules are present. This is a static review only, not a completed visual/accessibility audit.
- Follow-ups for the browser review: `src/components/workspace-shell.tsx:116` uses unconditional search autofocus, which needs phone/keyboard assessment; `src/app/globals.css:167` lacks modal overscroll containment, so check background scroll chaining. The known overlay-switch regression and unknown-route recovery links still need live interaction checks. Preserve the selected design; no UI redesign was performed.
- Reassessed next action: resolve supported browser access and finish the M1.2 checklist before expanding features. When starting M1.3, resolve its task-opening dependency on the M1.5 panel, preferably with a minimal panel first. M1.2 remains incomplete; the self-check tooling/instructions are delivered.

## Current task

- Objective: implement the M1.2 local shell and navigation using the selected design direction.
- Delivered: Next.js/React/TypeScript scaffold, dark responsive shell, desktop sidebar, phone menu/bottom navigation, Home/Boards/Docs routes, read-only sample board/task content, Docs placeholders, page/project/document search, sample-account switcher, favicon, and shared button/field/panel/task-row/status/dialog primitives.
- Data: four fictional members, two boards, three documents, twelve tasks; fixed demo date; account selection in memory only.
- Owner: coordinating assistant; read-only specialist verified current official setup guidance and reviewed source. A dialog-switch race found during review was fixed with overlay-specific close handling; runtime regression check is still pending.
- Earlier checks (September 25): dependency installation, typecheck/build, fixture ID/association/date checks, and initial HTTP response passed. Fresh October 5 build/HTTP results and preview state are recorded above.
- Browser limitation: refusal due to unavailable admin-policy verification persisted on October 5. No screenshots or browser interaction checks succeeded. No indirect workaround was used.
- Not yet checked: rendered desktop/phone layouts, overflow, actual focus/keyboard/dialog behavior, navigation/history/refresh, runtime search/account switching, unknown-route UI, or phone software keyboard. Build success is not evidence these pass.
- Scope boundary: M1.3–M1.5 remain open; read-only fixture content is shell scaffolding, not completion of detailed dashboard, board editing, task panels, or document writing. All M2–M5 features remain unimplemented.

## Decisions needed soon

- Additional visual feedback can refine the shell once browser inspection is available; selected dark/subtle direction and equal desktop/phone emphasis remain the baseline.
- Any deadline or budget that changes delivery priorities.

Infrastructure, subdomain, and backup details become necessary for their corresponding implementation tasks, not for the first sample-data prototype.

## Continuity

This is the current authoritative status record. At the next meaningful milestone, replace stale state and include actual artifact paths and check results. The coordinating assistant owns updates; specialists return proposed changes. Use HANDOFF.md when switching chats.
