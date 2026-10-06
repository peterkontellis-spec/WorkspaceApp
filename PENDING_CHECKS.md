# Acceptance coverage and remaining checks

Updated 2026-10-07. Phone testing remains deferred by the user. No hotspot listener or external access is running. Earlier browser-policy failures are historical; supported browser access now works. This register supersedes earlier blanket “no browser checks passed” notes while preserving untested cases.

## Covered by the corrective browser suite

See E2E_TESTING.md and the latest STATUS.md entry for the actual final run result. The committed scenarios exercise:

- Saved task identity across Table/Kanban/Calendar, leap-day selection, status save, search across views/reload and undated placement.
- Four isolated signed-in sessions receiving changes through polling.
- Offline/reconnect notices, preserved dirty drafts, stale-save rejection and deliberate discard/reload.
- Viewer read-only controls and direct mutation rejection; actual idle expiry removing protected UI and an open draft.
- Notification recipients, no self-notification, cross-recipient denial, private read-state persistence, task activity links and automatic Home bell arrival.
- Quick status/date/priority/assignee saves, serialized controls, retained failed selections, original-revision retry rejection and date-popup close/focus return.
- Task subtree archive, Undo, later restoration without reviving earlier archives; owner-only board archive/restore; read-only archived drafts and stale-save protection after restoration; parent-before-child restore errors.
- Desktop 1440×900 and narrow 390×844 task actions, page overflow, title-to-status Tab, Escape/focus return; unexpected console errors/unhandled exceptions fail tests.

Manual supported-browser inspection covered the updated board and task panel at desktop (~1165×814) and 390×844: dark board density, light narrow panel, Save/Cancel while scrolling, quick-date bounds/Close, theme switching, Escape/focus return and captured console. No saved preview records were edited. Temporary viewport override was reset.

## Lower-level coverage and remaining browser depth

The behavior and isolated database suites cover broader validation, dates/month boundaries, filters, permissions, session revocation, polling serialization/backoff, archive provenance, activity/notification transactions, attachment preservation/in-flight rejection and real database restart. These are not physical-device or complete end-to-end UI claims.

- [ ] M3.1: complete combined filter Back/Forward and month-navigation UI matrix; empty/no-results/long-label layouts across all three views; create tasks from Kanban/Calendar as owner/editor; date clearing and selected-month preservation.
- [ ] M3.2: browser visibility/focus polling timing and deliberately delayed reads racing saves; full role-revocation/account-switch UI journey. Unit/database coverage already exists for the underlying boundaries.
- [ ] M3.3: full activity field-summary matrix and notification pagination/Latest/Older, unassignment/no-op/retry UI scenarios; list-specific network/revocation recovery and long names on narrow screens. Database tests cover transactions, recipients, pagination and access checks.
- [ ] Archive: complete attachment download and old notification-link browser journey through task/board archive/restore. Database tests establish retained bytes/authorization; no purge is implemented.
- [ ] Repeat 200% zoom against the updated saved-work panel and quick controls. Earlier M1 zoom approval is not evidence for this changed layout.

M3.1–M3.3 remain implemented with substantial browser coverage, not unconditional stage acceptance. Resolve relevant gaps before Stage 3 sign-off. Confirmed future features remain in scope; use STATUS.md for the next bounded action.

## Physical phone — explicitly deferred

- [ ] Establish a private temporary phone-preview connection. The authenticated app requires HTTPS away from loopback; do not weaken this to recreate the old M1 HTTP sample preview.
- [ ] Repeat task/view/filter/month/archive journeys in iPhone Firefox using real touch and software keyboard.
- [ ] Confirm bottom navigation and pinned task actions respond correctly to the software keyboard; overlays dismiss and active fields stay reachable.
- [ ] Assess star smoothness and responsiveness; no measured GPU/battery claim.
- [ ] Stop temporary access after testing.

## Appearance and device paths

- [ ] Full light/dark route matrix: Home, all board views, Docs, Files, Notifications, Team and account forms, including preference reload and blocked-storage behavior.
- [ ] Full contrast/focus review in both themes and updated 200% zoom. The earlier sampled light-tint contrast calculation and current focused visual checks are narrower evidence.
- [ ] Confirm two recurring flares with random third/fourth additions, changing birth locations and fade continuity over 45–60 seconds; verify pause.
- [ ] Actual OS reduced-motion preference and graceful WebGL-unavailable/context-loss behavior.

Docs is deliberately a non-editable storage-pending placeholder in accounts mode. Durable writing, recovery and collaboration await NAS configuration/later M4 work. Publication still requires the Cloudflare security audit, diagnostic logging and tested database/attachment restoration; none is implied by local UI tests.
