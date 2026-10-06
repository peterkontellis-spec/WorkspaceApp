# Acceptance coverage and remaining environment checks

Updated 2026-10-07 after the user asked the assistant to attempt all remaining checks. The reproducible local browser matrix is complete for the scenarios below. No failed app scenario is left open. Physical/device and browser-host limitations are explicitly separate; this is not NAS or publication acceptance.

## Verified local coverage

| Area | Executed evidence |
| --- | --- |
| M3.1 views and filters | Same task across Table/Kanban/Calendar; status/date save, leap day/date clearing; five combined filters with decoy records; Back/Forward, December–January navigation and selected-month retention; empty/no-results/long-label layouts; owner/editor task creation from Kanban and Calendar. |
| M3.2 updates and access | Four separate signed-in contexts converge through polling; offline/reconnect retains dirty drafts; real stale save rejection; delayed pre-save response cannot roll back a newer save; owner Team role change revokes the editor session; controlled account-cookie switch clears the old draft and loads the new role; real idle expiry clears protected UI. |
| M3.3 notifications/activity | Recipient/private read state, reload/deep links and automatic Home bell arrival; all changed-field summaries, no leaked note text, no-op/conflict/unassignment duplicate prevention; Older/Latest/Refresh under new arrivals; notification/activity-specific connection recovery and revoked/idle-expired clearing; long actor/task names at 390px. |
| Archive and files | Task subtree/Undo/permanent restore, prior archives preserved, owner-only boards, read-only retained drafts and original-revision rejection; parent-before-child error; real browser upload/download with byte comparison through task and board archive/restore; old notification links and active Files exclusions. |
| Appearance | Light/dark across Home, Boards/Table/Kanban/Calendar, Docs, Files, Notifications, Team, task/account panels and signed-out forms; preference persistence and blocked-storage behavior; desktop/narrow overflow, pinned actions, keyboard/Escape/focus. Rendered solid-background text samples passed; gradients/disabled/hidden text are excluded from this sampler, not certified. Existing tint calculations remain complementary evidence, not a full WCAG audit. |
| Motion/fallback | Real WebGL drawing and six captures over 45 seconds, reviewed changing flare locations; pause/resume and emulated reduced-motion stop drawing; actual WEBGL_lose_context fallback and simulated missing-WebGL navigation passed. Main CUA live screenshots also showed changed flare positions without runtime warnings. No hardware/GPU/battery performance claim. |
| Reflow/touch | 720×450 CSS viewport tests the reflow corresponding to a 1440×900 display at 200%; task actions remain reachable. Chromium mobile/touch emulation saves task notes and dismisses the date popup. These are simulations, not physical iPhone/software-keyboard or native browser-zoom evidence. |

The suite now contains 40 scenarios. Combined run `.local/e2e/run-n6ouhy`: **38 passed, 1 capability skip**, exit 0. A subsequent CSS-only placeholder fix and new contrast test passed five relevant final-build scenarios in `.local/e2e/run-ziThWp`: **5 passed**, exit 0. Thus 39 distinct scenarios have passing evidence; one real-visibility scenario remains unverified. This is not a claim that all 40 executed in one run. Both owned app/database environments stopped.

The placeholder review found and fixed default-grey search text on the dark surface. Final rendered contrast: **7.01:1 dark**, **6.77:1 light**. TypeScript, 42 behavior tests, production build, formatting and 21 refreshed-preview HTTP checks pass. The existing 75-test database result remains current: this turn changed no backend/schema code.

## Checks this environment cannot establish

- [ ] **Real background-tab lifecycle:** Chromium headless tabs and supported in-app tabs both continued to report `document.visibilityState === 'visible'` after another tab took focus. The browser test attaches that observation and skips explicitly. Underlying hidden/visible/backoff behavior passes deterministic tests, but actual browser lifecycle timing needs a browser host that exposes real visibility changes.
- [ ] **Native browser zoom:** the supported in-app zoom shortcut had no effect (viewport and device-pixel ratio unchanged). Equivalent reflow passed; genuine 200% browser chrome zoom remains unverified.
- [ ] **Physical iPhone Firefox / software keyboard:** real touch, keyboard-induced visual viewport changes, safe areas, pinch zoom and responsiveness. Emulated touch/viewport checks passed; no private HTTPS phone connection has been configured or exposed.
- [ ] **Actual OS/device behavior:** OS reduced-motion setting propagation, physical GPU smoothness, battery impact and four-device load. Browser reduced-motion emulation and renderer/fallback behavior passed.

These environment checks are retained for device acceptance/M3.7; they do not imply a known failing app behavior. M3.1–M3.3 local core journeys have evidence, while unconditional full-device/Stage 3 sign-off remains separate. Next feature when authorized: M3.4 dashboards.

## Later release gates

Docs remains a non-editable storage-pending placeholder in accounts mode; durable saving/recovery/collaboration await NAS configuration and M4. NAS performance, deployment, diagnostic logging, actual database+attachment backup restoration and the required Cloudflare pre-publication security audit remain later release work. No public access, paid CI, credit/reset use or NAS changes occurred.
