# Delivery milestones

Derived from PLANNING.md on 2026-09-25. These are delivery checks, not evidence that features already exist. Keep all confirmed features in scope while completing smaller tasks within each milestone.

Use [SESSION_CHECKLIST.md](SESSION_CHECKLIST.md) for the 35 smaller increments and session routines. The acceptance criteria here remain the stage completion requirements; STATUS.md remains the authoritative progress record.

| ID | Deliverable | Depends on |
| --- | --- | --- |
| M1 | Design prototype | Visual direction or permission to use provisional styling |
| M2 | Persistent working foundation | M1 structure and validated implementation choices |
| M3 | Team workflow | M2 |
| M4 | Advanced behavior and collaborative Docs | M2; relevant M3 integration |
| M5 | Verified NAS rollout | M2–M4; infrastructure and backup decisions |

## M1 — Design prototype

Deliver app shell, personal Home/My Day, grouped board, task detail panel, and Docs screen with realistic sample data. Make core navigation and prototype interactions work. Label sample-only behavior and distinguish planned features from implemented features.

Acceptance:
- User can navigate between Home, Boards, and Docs; open/close a task and exercise the prototype's demonstrated task interactions.
- Board stays visible behind the desktop detail panel; narrow screens remain usable.
- Visible focus, keyboard operation, readable status labels, and legible layout are checked.
- Save indicators do not imply durable server persistence when only sample/local state exists.
- Provide a preview or other reviewable artifact and actual verification results.

First task: establish a provisional screen/interaction specification from the plan and user design direction, then implement the prototype when requested. Check maintained dependency choices when implementation starts; do not install the entire proposed backend merely to demonstrate screens.

M1.1 specification: [DESIGN_SPEC.md](DESIGN_SPEC.md). User direction is dark with subtle accents, equal desktop/phone focus, and larger controls. This planning output does not satisfy the runnable prototype acceptance checks above.

**Accepted 2026-10-06 as a sample-data prototype.** Evidence and explicit limitations are in STATUS.md. No durable storage or production/security readiness is implied; separate UI critique recommendations remain a refinement backlog.

## M2 — Persistent foundation

Deliver accounts, invitations, workspace roles, boards/groups/tasks/subtasks/custom fields/multiple assignees, task notes/checklists, search/filtering, and attachments.

Acceptance:
- Owner/editor/viewer permissions are enforced server-side, including direct requests, search results, and file access; expired invitations fail.
- Task and board changes survive refresh and service restart; field inputs are validated.
- Concurrent changes cannot silently overwrite each other.
- Attachments use authorized downloads and bounded uploads with safe storage identifiers.
- Account recovery and session handling are documented and checked using the selected authentication implementation.

**M2 accepted locally 2026-10-06.** See [FOUNDATION_REVIEW.md](FOUNDATION_REVIEW.md) and STATUS.md for the connected journey, complete test run, role matrix and limits. Publication/NAS readiness remains M5.

## M3 — Team workflow

Deliver Table/Kanban/Calendar views, live updates, activity, in-app notifications, personal and team dashboards, My Day, manual time entries/timers, and task/board templates.

Acceptance:
- All views reflect the same stored task records; filters and assignments respect access rules.
- Four accounts can collaborate; reconnect restores authoritative state.
- Timers survive refresh/restart; totals include manual entries accurately.
- Templates produce independent new tasks/boards, with defined handling of dates and assignees.
- Notification and activity behavior is verified for the implemented actions.

**M3 local implementation and four-account integration verified 2026-10-07.** See STATUS.md and PENDING_CHECKS.md for the 58-pass full browser run, template persistence/retry checks and remaining physical/browser-host acceptance. This is not unconditional full-device, NAS or publication sign-off. The initial stop before M4 was superseded by the user’s continuation; M4.1 is locally verified.

## M4 — Advanced behavior and Docs

Deliver dependencies, recurring tasks, constrained automation rules, and collaborative Docs linked to projects/tasks.

M4.1 dependencies are locally verified (2026-10-08): advisory warnings, atomic edits, cycle rejection, roles, archive and template integration. M4.2 jobs/reminders are locally verified (2026-10-09): default and optional reminders, durable retries/deduplication, restart/crash recovery, Athens DST and current-recipient/access checks. See [JOBS.md](JOBS.md) and STATUS.md. M4.3 and later increments remain open; durable Docs is held until NAS configuration is settled.

Acceptance:
- Cyclic dependencies are rejected; recurrence behaves correctly across relevant timezone and daylight-saving boundaries.
- Job retries do not duplicate intended effects; automation loops are bounded.
- Two users can edit a document concurrently, reconnect, and recover durably saved content after a restart.
- Saved appears only after durable persistence; recovery snapshots are available under the chosen retention policy.
- Document access is checked on connections and reads; links do not duplicate authoritative document content.

## M5 — NAS rollout

Deliver production containers/configuration, HTTPS app access through the chosen route, persistent storage, backups, and operating instructions.

Acceptance:
- Four-user testing covers permissions, concurrent board edits, Docs, attachments, timers, and background jobs.
- Measure memory with representative workloads against the approximate 4 GB budget and existing NAS workloads; record any shortfall before release.
- Restore the database and attachments from a real backup into a safe test location and verify usability.
- The database and NAS administration interface are not exposed through the app deployment.
- Before publication/external release, complete the required Cloudflare `security-audit` review for the release candidate/configuration, resolve release blockers and record fix/retest evidence. Revalidate changes before later publication; pending validation is not a pass.
- Remove the preview-only `test@test.com` login entirely before publication/external release, including credential/session/recovery/invitation access. Verify absence and rejected sign-in; preserve legitimate shared work/history. Never deploy its seed or password.
- Document restart/update/recovery procedures and remaining limitations. User authorizes external access before enabling it.

## Per-task record

Use STATUS.md to record the active task's objective, deliverable, owner/edit scope if delegated, acceptance checks, result, and next action. Do not create a separate tracking document for every small task.
