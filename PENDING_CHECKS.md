# Acceptance coverage and remaining environment checks

Updated 2026-10-08 after M4.1 dependencies and the requested filter/navigation refinements. The reproducible local browser matrix is complete for the scenarios below. No failed app scenario is left open. Physical/device and browser-host limitations are explicitly separate; this is not NAS or publication acceptance.

## M4.1 and preview refinements — 2026-10-08

Final full browser run: **69 passed / 1 genuine background-visibility capability skip / 0 failed**, exit 0, 7.0 minutes, `.local/e2e/run-yK5Tu9`. Includes all seven dependency cases, popup filtering/dismissal, all section breadcrumb routes, 320/390/1440px layout, and deterministic queued native-close-event regression. The real spontaneous popup-close race found during verification is fixed; interrupted sleep/network runs were not counted as passes. Typecheck/build, 49 behavior tests and 113 database cases passed. STATUS.md records preview/migration and earlier failed-run evidence.

M4.1 is complete locally; M4.2 jobs/reminders is next. The physical/host/device gates below remain open and also apply to the new popup/mobile header. The preview-only `test@test.com` owner login must be removed entirely before publication; AGENTS.md and SESSION_CHECKLIST.md define verification. Durable Docs remains held for NAS configuration.

## M3.6/M3.7 final local review — 2026-10-07

- **Final full browser run:** 58 passed / 1 genuine background-visibility capability skip / 0 failed, exit 0, 6.6 minutes, `.local/e2e/run-Tz3919`. This supersedes the historical 50-pass M3.5 run below.
- **Templates:** board/task UI capture/application, reset rules, independent copies, custom-column mapping, roles, reversible archive/restore, lost committed response retry, offline draft retention, explicit stale-source/template reload with unchanged retry identity, keyboard focus, long content and 1400/390px light/dark layouts passed. Template snapshots and operation identities also survived an actual isolated DB restart.
- **Integrated four-account workflow:** template project → assignment → other-account polling → recipient notification → editor time/checklist/task completion → updated dashboard → matching Table/Kanban/Calendar records → shared, own-edit-only time totals passed.
- **Checks:** final typecheck/build/49 behavior tests, formatting, 26 preview HTTP checks; 102 full DB checks plus the extended 12-case template file passed (103 distinct DB cases). Fresh cold-recovery evidence `.local/tests/restore-0NGqI0/evidence.json` includes the new tables empty; populated template persistence is separately proven by restart, not a populated restore claim.
- **Review and preservation:** approved visual identity retained; bounded Impeccable/interface/React review and actual screenshots/keyboard checks completed. Migration009 preserved all checked existing work/time rows; private preview updated. No remaining observed app failure. M3.6/M3.7 local boxes are complete; full-device Stage 3 acceptance is still pending below. The later user continuation starts M4; see the newer M4.1 record above.

## Latest checks closed — 2026-10-07

- **Full current browser suite:** 50 passed / 1 actual-visibility capability skip / 0 failed, exit 0, `.local/e2e/run-GuQgZN`, 6.3 minutes. No app source changes were required.
- **Whole app-server restart with a running timer:** the browser closes, the isolated app is abruptly terminated/restarted, and a new browser resumes the same timer/session. Stop saves exactly one correctly totalled entry; a second app restart preserves it. `pnpm test:e2e --restart-check` passed, final `.local/e2e/run-asMzWs`. This now has direct browser and new-process evidence in addition to prior DB restart coverage.
- **Local database/attachment recovery:** focused cold physical restore passed, `.local/tests/restore-ujjtCn/evidence.json`. All 24 public-table fingerprints, accounts/roles/time audit, exact synthetic file bytes and authorization checks matched. Separate restored cluster; source/backup retained; owned services stopped. See RECOVERY_CHECKS.md for the downtime/same-major/platform limits. NAS, offsite, encryption and retention are still open.

The detailed M3.4/M3.5 delivery-run paragraphs below are historical evidence. The full run above supersedes the previous targeted-only browser coverage limitation.

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

The M3.4 suite contained 45 scenarios. M3.4 full run `.local/e2e/run-WXexp5`: **43 passed, one test-assumption failure, one visibility capability skip**, exit 1. The theme test was corrected to explicitly select both themes; final-build focused run `.local/e2e/run-hTWxQW`: **1 passed**, exit 0. Thus **44 distinct scenarios pass**, including all five dashboards cases. This is combined evidence, not a claim that the initial full command passed. Both owned app/database environments stopped.

M3.4 adds verified exact personal/team/board/workload totals, shared assignees/subtasks/archive rules, record links, private notification count and recent tasks, account polling/viewer access, offline/reconnect, inactive-assignee repair, empty/long layouts in both themes and emulated local-midnight rollover. TypeScript, **49 behavior tests**, production build, formatting, **76 database checks** and **22 preview HTTP checks** passed. Overview is included in the existing rendered-contrast/route matrix.

## M3.5 local coverage

Six new time scenarios cover stored timer start/stop/reload/global indicator, shared own-only editing and viewer access, manual corrections/void/restore, exact filtered totals, a committed response lost in transit with idempotent retry, malformed date recovery, stale corrections retaining input, and keyboard/long-content layout at 1440/390px in both themes. The route/contrast matrix includes Time; all seven existing workspace regression cases also passed. Final captures were visually reviewed.

Initial run `.local/e2e/run-RDNIOJ`: 11 passed / 3 test-setup failures. `.local/e2e/run-gk2E2Y`: uncertain-save and invalid-date/stale-correction cases passed, layout still failed the default-theme assumption. Final layout run `.local/e2e/run-8ytRYD`: 1 passed, exit 0. All 14 selected scenarios have passing evidence; the initial command is not reported as successful. At M3.5 delivery, the suite contained 51 cases, with 50 distinct cases covered by cumulative passing evidence and the previously disclosed real-visibility capability gap. This was a targeted regression run, not a fresh full-suite run.

Current M3.5 checks also passed TypeScript, 49 behavior tests, production build, formatting, 90 database tests (including actual DB restart and access-disable race), and 24 preview HTTP checks. Existing preview record fingerprints were unchanged by additive migration008.

## Checks this environment cannot establish

- [ ] **Real background-tab lifecycle:** Chromium headless tabs and supported in-app tabs both continued to report `document.visibilityState === 'visible'` after another tab took focus. The browser test attaches that observation and skips explicitly. Underlying hidden/visible/backoff behavior passes deterministic tests, but actual browser lifecycle timing needs a browser host that exposes real visibility changes. The full-suite skip and a fresh two-tab in-app retry both reconfirmed this limitation.
- [ ] **Native browser zoom:** the supported in-app zoom shortcut had no effect (viewport and device-pixel ratio unchanged). Equivalent reflow passed; genuine 200% browser chrome zoom remains unverified. Retried 2026-10-07: width1280/height720/DPR2/scale1 stayed unchanged after the shortcut; the only connected browser is the in-app host.
- [ ] **Physical iPhone Firefox / software keyboard:** real touch, keyboard-induced visual viewport changes, safe areas, pinch zoom and responsiveness. Emulated touch/viewport checks passed; no private HTTPS phone connection has been configured or exposed.
- [ ] **Actual OS/device behavior:** OS reduced-motion setting propagation, physical GPU smoothness, battery impact and four-device load. Browser reduced-motion emulation and renderer/fallback behavior passed.

These environment checks are retained for device acceptance/M3.7; they do not imply a known failing app behavior. M3.1–M3.7 local core journeys have evidence, while unconditional full-device/Stage 3 sign-off remains separate. Next device action: arrange the remaining physical checks. M4.1 was subsequently authorized and locally verified; M4.2 is next.

## Later release gates

Docs remains a non-editable storage-pending placeholder in accounts mode; durable saving/recovery/collaboration await NAS configuration and M4. NAS performance, deployment, operational diagnostic logging, the deployed backup/restore procedure and the required Cloudflare pre-publication security audit remain later release work. Local cold recovery now passes; deployed backup destination/schedule/retention, offsite recovery, encryption and NAS-specific restoration are not established. Logging is limited to connection errors/readiness today; broader operational diagnostics need implementation. Publication security sign-off requires the concrete release/deployment configuration. No public access, paid CI, credit/reset use or NAS changes occurred.
