# Pending acceptance checks

Updated 2026-10-06. These items are open; implementation, automated tests and server checks do not mark them passed. Phone preview is deferred at the user's request. No hotspot listener was started.

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
- [ ] Confirm the final stellar change displays no more than two solar flares and pause still works.

## Physical phone — deferred

- [ ] Establish a private, temporary phone-preview connection. Current authenticated app requires HTTPS away from loopback; do not weaken that rule to recreate the old M1 HTTP sample preview.
- [ ] Repeat core view/task/filter/month journeys in iPhone Firefox, with real touch and software keyboard.
- [ ] Check mobile navigation remains reachable, typing does not obscure active controls, and calendar/task overlays close as expected.
- [ ] Assess visible flare smoothness and responsiveness on the phone; no measured GPU/battery claim yet.
- [ ] Stop temporary access after testing.

## Motion and fallback — unverified device paths

- [ ] Exercise actual OS reduced-motion preference.
- [ ] Confirm graceful rendering when WebGL is unavailable or its context is lost.

## Why browser acceptance is pending

The supported browser tool refused preview access because its admin-enforced policy could not be verified. It did not report an application crash. No bypass or alternate browser automation was used. Retry through the supported tool when available; record actual results in STATUS.md.

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
