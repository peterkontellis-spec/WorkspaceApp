# Pending acceptance checks

Updated 2026-10-07. These items are open; implementation, automated tests and server checks do not mark them passed. Phone preview is deferred at the user's request. No hotspot listener was started.

## M3.1 — saved board views

- [ ] Desktop: Table → Kanban → Calendar shows the same task IDs once, with correct status/date mapping and labelled subtasks.
- [ ] Open a card, change status, Save task, and confirm its new Kanban column and Table status.
- [ ] Change/clear a due date, Save task, and confirm the selected calendar day or undated list, including moving between months.
- [ ] Search and combine status/assignee/priority/date filters; switch views, refresh and use Back/Forward without losing filter/month context.
- [ ] Inspect empty columns, no search results, no dated tasks, undated tasks and dates outside the current month.
- [ ] Previous/next/current month work, including year boundaries; selected month survives task open/close.
- [ ] Owner/editor can create a task in the chosen group from Kanban/Calendar; viewer sees read-only details and no write controls.
- [ ] Keyboard links, focus outlines, task-dialog Escape/focus return and month controls remain usable.
- [ ] Desktop and narrow layouts have no page overflow/clipped task controls; narrow calendar uses an agenda and Kanban stacks.
- [ ] Check captured browser console/runtime errors in the changed journey.
- [ ] Confirm the final stellar change displays two recurring flares with random additional third/fourth flares (never more than four), successive births appear around different parts of the limb over 45–60 seconds without jumping while visible, and pause still works.

## Physical phone — deferred

- [ ] Establish a private, temporary phone-preview connection. Current authenticated app requires HTTPS away from loopback; do not weaken that rule to recreate the old M1 HTTP sample preview.
- [ ] Repeat core view/task/filter/month journeys in iPhone Firefox, with real touch and software keyboard.
- [ ] Check mobile navigation remains reachable, typing does not obscure active controls, and calendar/task overlays close as expected.
- [ ] Assess visible flare smoothness and responsiveness on the phone; no measured GPU/battery claim yet.
- [ ] Stop temporary access after testing.

## Motion and fallback — unverified device paths

- [ ] Exercise actual OS reduced-motion preference.
- [ ] Confirm graceful rendering when WebGL is unavailable or its context is lost.

## Earlier browser access blockage

Earlier supported browser attempts failed administrator-policy verification. Access was restored during the 2026-10-07 light-tint adjustment, without a bypass. Home light mode, star tint changes, narrow layout and reload were checked; the broader checks listed here have not yet been rerun. See STATUS.md for exact evidence.

The user explicitly instructed continuation into M3.2 while phone checks wait. Earlier M3.1 gates remain open and must be resolved before Stage 3 sign-off. See SESSION_CHECKLIST.md for M3.2's separate acceptance requirements.

## M3.2 — automatic updates and reconnecting

- [ ] Use four signed-in browser sessions: one saved task change appears in the others without manual refresh, within the polling interval plus network time.
- [ ] Disconnect/reconnect one client while other clients save; restored client receives the latest authorized state without duplicate tasks.
- [ ] Verify the stale-data notice, Retry updates action and recovery state on desktop/narrow layouts.
- [ ] Confirm an open unsaved task/form survives background updates and temporary disconnection, with its original revision retained.
- [ ] Change the same task elsewhere: newer-version notice appears; reload requires deliberate discard for a dirty draft; stale Save is rejected and edits retained.
- [ ] Hide/show/focus tabs: background polling pauses and resumes without overlapping or repeated requests.
- [ ] During a slow refresh, save a newer change; the delayed read must not roll the UI back.
- [ ] Expire/revoke an account or switch identity: cached saved records and drafts are removed, and old credentials cannot reload.
- [ ] Inspect changed UI focus, narrow layout and browser console/runtime errors.

## M3.3 — activity and in-app notifications

- [ ] In isolated owner/editor/viewer sessions, assign a task to someone else: recipient bell increments, actor gets no self notification, and notification links to the correct saved task.
- [ ] Change status/date/notes/checklist; inspect correct actor, time and useful summary in task Activity. Saved notes must not be copied into history text.
- [ ] Remove an assignee: only eligible affected recipients receive an update. Verify no history/notification for no-op or failed/conflicting saves, and no duplicate after retry.
- [ ] Mark read, refresh/reopen and verify it stays read; mark unread and verify the bell catches up on the next normal poll. Another user's read state must not change.
- [ ] Viewer can read history and manage personal notification read state while task editing remains unavailable.
- [ ] Check Latest/Older cursor pages, Refresh, empty activity/notification states, long task/member names and stale/error recovery without dropped or duplicate rows.
- [ ] Simulate expired/revoked sessions and connection failures: cached lists clear on access loss; transient errors offer recovery; leaving a page aborts pending requests without stale replies.
- [ ] Desktop and narrow: bell, list, task links, read-state buttons and Activity panel remain readable/reachable; keyboard focus and task close/return work; check captured runtime/console errors.

No M3.3 browser checks passed this session: the supported tool again refused policy verification before opening the Notifications page. Physical phone checks remain deferred.

## Appearance integration — browser acceptance pending

- [ ] Switch dark → light → dark using the header and Account controls; check pressed state and accessible names.
- [ ] Reload and navigate through Home, Boards/Table/Kanban/Calendar, Docs, Files, Notifications, Team and account forms; confirm saved appearance and no theme flash/hydration errors.
- [ ] Toggle star tint off/on, move through preview phases and neutral mode; confirm only sidebar/header tint changes and statuses remain legible.
- [ ] Desktop/narrow and 200% zoom: header actions, account dialog, forms and task metadata stay readable and reachable without overflow.
- [ ] Keyboard focus, Escape/focus return, reduced motion and contrast in both themes; inspect runtime/console errors.
- [ ] Verify preference persistence when storage is available and usable switching when storage is blocked.

The 2026-10-07 build and 21 HTTP checks passed; supported browser creation was denied at administrator-policy verification. No visual sign-off inferred.
