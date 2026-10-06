# Workspace app — session checklist

**A reading guide and delivery checklist for each working session.**  
Planning baseline: 25 September 2026 · Five stages · 35 small increments

> **Start here:** Read [STATUS.md](STATUS.md). **M1.1–M1.6 / Stage 1 are accepted as a sample-data prototype; M2.1 and M2.2 are complete (2026-10-06). M2.3–M2.8 are accepted; Stage 2 is complete locally. Focused UI review comes before M3.1.** Use [RUNNING.md](RUNNING.md) to preview and verify. Local Git checkpoints preserve each increment and are now uploaded to GitHub with milestone tags. No completion box below should be ticked until its required checks actually pass.

## Before every session — two-minute check

These boxes are a reusable routine, not project completion marks. Reset them for each session.

- [ ] Read the current state, latest checks, and next action in [STATUS.md](STATUS.md).
- [ ] Find the next unfinished increment below and read its **Deliverable** and **Done when**.
- [ ] Choose one main outcome for this session; split a large increment if needed.
- [ ] Define its acceptance checks and follow the required self-check loop in AGENTS.md after each meaningful implementation batch and before closing. This runs per task/session; there is no daily automation.
- [ ] Bring any feedback, design references, or decisions needed for that increment.
- [ ] Tell the assistant what to continue and any changed priorities or constraints.
- [ ] At the end, review the actual result and record where to resume.

**Suggested opening message:**

> Continue the workspace app using AGENTS.md and STATUS.md. Work on increment [ID] in SESSION_CHECKLIST.md. My intended outcome today is [outcome]. Use my latest design direction and confirmed scope. Verify the result, mark only completed checklist items, and update STATUS.md with the next action.

You do not need to finish one increment per session. Some will take several sessions; small related increments can be combined. This is a sequence of deliverables, not a schedule or cost estimate.

## Project at a glance

| Stage | Increments | What you will have afterward |
| --- | --- | --- |
| [1. Design prototype](#stage-1--design-prototype) | M1.1–M1.6 | A navigable sample-data prototype to review |
| [2. Working foundation](#stage-2--working-foundation) | M2.1–M2.8 | Accounts and real, saved boards/tasks/files |
| [3. Team workflow](#stage-3--team-workflow) | M3.1–M3.7 | Shared views, dashboards, live updates, time tracking, and templates |
| [4. Advanced features and Docs](#stage-4--advanced-features-and-docs) | M4.1–M4.7 | Dependencies, recurrence, automations, and collaborative writing |
| [5. NAS rollout](#stage-5--nas-rollout) | M5.1–M5.7 | A tested deployment with access, backups, and recovery instructions |

**Keep these constraints visible:** four people maximum for the initial use case; UGREEN DXP2800; approximately 4 GB available RAM; about 6 TB storage; existing-domain subdomain; application data and Docs on the NAS; no required Google Drive. Memory suitability remains to be measured.

**Not approved:** task comments/@mentions, private boards, and quick-capture inbox.  
**Sidelined:** private personal workspaces, full Word/PDF editing, a full Drive replacement, and desktop folder synchronization.

## How to use the delivery boxes

- Check an item only when its output exists and its stated check has been performed.
- Record evidence and any partial work in STATUS.md. Untested items stay unchecked.
- A sample-data interaction completes a prototype item, not the later persistent feature.
- Each stage has a final completion box. Use [MILESTONES.md](MILESTONES.md) for the complete acceptance criteria.
- Architecture choices remain proposals until validated during implementation. Keep changes in [DECISIONS.md](DECISIONS.md).

---

**Current M1 acceptance (2026-10-06):** physical iPhone task/date/Docs and keyboard checks passed by user report; desktop keyboard checks and user-observed 200% zoom completed. Phone refresh silently resets sample data: this is a recorded prototype limitation, not a dependable warning. See STATUS.md for evidence and the separate UI refinement backlog. Earlier dated progress notes below are historical, not current blockers. The temporary hotspot preview is stopped.

## Stage 1 — Design prototype

**Purpose:** settle the screens and everyday workflow before building the complete backend.  
**Bring:** any further design prompts or references. The user has selected dark surfaces, subtle accents, equal desktop/phone focus, and larger controls.  
**Depends on:** design direction for the prototype (now captured in M1.1). No NAS or domain setup is needed yet.

### M1.1 — Design direction and screen map

**Deliverable:** a small screen map and a provisional design specification.

- [x] Capture the user's visual direction, information density, and desktop/mobile priorities; label provisional choices.
- [x] Map Home, Boards, Overview, Docs, Files, Time, and Settings, identifying which screens this first prototype demonstrates.
- [x] Define the main journey: sign-in concept → Home → board → task details → linked document.

**Done when:** the intended screens and navigation are understandable, and unresolved styling choices are written down.

**Completed 2026-09-25:** [DESIGN_SPEC.md](DESIGN_SPEC.md) contains the screen map, prototype boundaries, journeys/return paths, responsive layouts, sample-data rules, and open visual details. All later implementation boxes remain open.

### M1.2 — App shell and navigation

**Deliverable:** a local, runnable frame for the app.

- [x] Establish the minimal prototype project and consistent sample data after checking dependency choices.
- [x] Build the sidebar, top bar, account area, and navigation between demonstrated screens.
- [x] Define reusable buttons, fields, task rows, status labels, and panels with keyboard focus.

**Done when:** the prototype opens locally and navigation works; unfinished areas are clearly identified.

**Progress 2026-09-25:** shell, routes, sample-account/page pickers, and reusable UI components are implemented. Production build, TypeScript, sample-record consistency, and an initial HTTP response check passed. The remaining two boxes await browser interaction/keyboard/layout verification: the browser tool could not verify its admin-enforced security policy. See [RUNNING.md](RUNNING.md) for exact checks; no later feature or stage gate is complete.

**Update 2026-10-05:** local preview restarted; `pnpm check` passed and new HTTP smoke checks passed 13/13. The per-task/session self-check loop is implemented. Browser access remains blocked by policy verification, so M1.2's remaining boxes stay open. See STATUS.md for evidence and review follow-ups.

### M1.3 — Personal Home and My Day

**Deliverable:** the dashboard a collaborator sees on arrival.

- [x] Show sample assigned work, today's tasks, overdue/upcoming work, and recent documents.
- [x] Make task and document links open the relevant prototype views.
- [x] Show an understandable empty state for a new collaborator.

**Done when:** you can see what needs attention and open it without searching through boards. Data is clearly illustrative.

**Implementation 2026-10-05:** M1.3 code and minimal task panel delivered; model/build/HTTP checks pass. Browser acceptance remains pending; see STATUS.md.

### M1.4 — Grouped task board

**Deliverable:** a usable sample board with editable task rows.

- [x] Show groups, tasks, assignees, status, priority, and dates with a route for adding custom columns later.
- [x] Demonstrate adding/editing a sample task and filtering or searching the sample board.
- [x] Represent Table/Kanban/Calendar navigation without implying that unfinished views work.

**Done when:** the demonstrated controls work and the board remains readable with realistic sample content.

**Implementation 2026-10-05:** M1.4 grouped editing/filtering delivered; model/build/HTTP checks pass. Browser acceptance remains pending; see STATUS.md.

### M1.5 — Task panel and Docs screen

**Deliverable:** the two main detail views connected to the board.

- [x] Open/close task details alongside the desktop board, with notes, subtasks/checklist, files, and future feature locations.
- [x] Build the Docs list/editor layout and a sample task-to-document link.
- [x] Label sample edits, collaboration indicators, and saving behavior accurately.

**Done when:** you can move from a task into its document and back; no sample state is presented as durable server storage.

**Implementation 2026-10-05:** M1.5 connected task/Docs prototype delivered. Final build, 15 behavioural tests and 16 HTTP checks pass; browser acceptance remains pending. Source-review fixes preserve drafts, recent-document ordering and focus fallback. See STATUS.md.

**Post-sign-off refinement, 2026-10-06:** assignee dropdowns, enlarged Add task/title targets and outside-tap dismissal implemented and tested on desktop and emulated 360/390px layouts. Draft/focus retention, multi-selection, keyboard behavior and menu bounds passed. See STATUS.md for checks and physical-device limits. M2 has not started.

### M1.6 — Prototype review and refinements

**Deliverable:** a reviewable prototype and a short remaining-issues list.

- [x] Inspect desktop and narrow layouts; check keyboard operation, focus, readable labels, and panel behavior.
- [x] Walk through the main journey, capture user feedback, and fix issues chosen for this stage.
- [x] Record the preview location, checks, design decisions, and remaining prototype limitations.

**Progress 2026-10-05:** direct desktop/narrow browser checks completed part of the acceptance matrix. Calendar crash reproduced twice and replacement implemented; mobile preview access refined, nested Markdown links fixed, Assistant · Later added. Final browser confirmation is blocked again by policy verification. STATUS.md contains the failure register and remaining checks; this increment and Stage 1 stay open.

**Update 2026-10-06:** calendar, mobile preview, nested links and Assistant checks now have browser evidence. Reset confirmation was moved in-page and Cancel/Escape/reset verified. Build, 20 tests and 16 HTTP checks pass. Policy failure returned before all remaining checks; broad review boxes remain open. See STATUS.md.

**Sign-off pass 2026-10-06:** additional testing found and fixed scroll loss after Back/Forward through a linked Doc; both narrow board and desktop Home regressions now pass. Phone testing with the user is pending hotspot confirmation. See the newest STATUS.md section before proceeding to M2; Stage 1 remains open.

**Done when:** the next session can start backend work from a coherent, reviewable screen structure.

- [x] **Stage 1 complete:** all M1 acceptance checks in MILESTONES.md have evidence.

---

**Current reconciliation 2026-10-06:** M1 was signed off as a sample-data prototype; see STATUS.md for evidence and limitations. M2.1–M2.2 are verified; see current STATUS.md for M2.3 acceptance. Earlier progress notes are historical.

## Stage 2 — Working foundation

**Purpose:** replace sample-only behavior with accounts and persistent records.  
**Bring:** any changes from reviewing the prototype.  
**Depends on:** M1 structure and validation of the proposed technical choices.

### M2.1 — Application and data foundation

**Deliverable:** the app connected to a development database.

- [x] Finalize the initial framework/database/authentication choices and record why they fit the constraints.
- [x] Define users, workspace membership, boards, groups, tasks, custom fields, and attachment relationships.
- [x] Set up schema changes, development data, configuration, and a documented local startup procedure.

**Done when:** a development record can be saved, read after a restart, and changed through a repeatable schema update.

**Verified 2026-10-06:** real PostgreSQL restart/additive-migration checks, 11 database tests, 23 existing tests, production build and 16 HTTP checks passed. See STATUS.md and DATABASE.md. UI remains sample-only; authentication is M2.2.

### M2.2 — Accounts and sessions

**Deliverable:** real password-based sign-in.

- [x] Add account setup, sign-in, sign-out, protected screens, and secure session handling using a maintained authentication implementation.
- [x] Define and implement account recovery suitable for the chosen setup; do not assume an email provider is connected.
- [x] Check invalid credentials, signed-out access, session expiry/revocation, and recovery.

**Done when:** valid users can return to their account, and unauthenticated requests cannot access workspace data.

**Verified 2026-10-06:** 19 real database tests, 23 existing tests, production build and 17 authenticated/signed-out HTTP checks passed. Desktop/narrow login/logout/recovery checked; user submitted the test reset successfully. See STATUS.md and AUTHENTICATION.md. UI edits remain sample-only.

### M2.3 — Invitations and roles

**Deliverable:** a shared workspace with owner, editor, and viewer access.

- [x] Implement expiring invitations and membership management; owner-generated invitation links are the initial proposal.
- [x] Define permitted actions for each role and enforce them on the server.
- [x] Check expired/reused invitations, direct unauthorized requests, and access after a membership change.

**Done when:** the right people can join and role restrictions work beyond the visible interface.

**Progress 2026-10-06:** backend permission/invitation tests pass (30 database groups across final targeted/regression runs), 23 unit tests, build and 19 HTTP checks pass. Desktop/narrow invitation creation/cancellation checked. User confirmed join/login; viewer read-only roster, owner role/removal, last-owner rejection and empty console checks passed. Disposable QA accounts cleaned up. M2.3 accepted; see STATUS.md and MEMBERSHIP.md.

### M2.4 — Persistent boards, groups, and tasks

**Deliverable:** real project boards and task editing.

- [x] Save boards, groups, tasks, ordering, and standard task fields.
- [x] Support multiple assignees and subtasks using real workspace members.
- [x] Validate inputs and detect conflicting edits rather than silently overwriting another user's changes.

**Done when:** edits survive refresh/restart, and competing updates produce a defined result.

### M2.5 — Custom columns and task details

**Deliverable:** configurable boards and useful task interiors.

- [x] Add initial custom field types: text, status, number/cost, date, and links; define behavior when a column changes.
- [x] Save task notes and checklist items, including completion state.
- [x] Connect the task panel to stored records and show validation/save failures clearly.

**Done when:** different boards can use different validated fields and task details remain intact after reopening.

**Accepted 2026-10-06:** all field types, stored notes/checklists, original task/schema conflict protection, viewer restrictions, persistence and desktop/narrow browser checks passed. See STATUS.md for evidence and limits.

### M2.6 — Search and filters

**Deliverable:** dependable ways to find work.

- [x] Add board and workspace task search plus status, assignee, priority, and date filters.
- [x] Apply access rules to results and maintain a clear route from a result to its task.
- [x] Check combined filters, no-result states, and changes that move a task out of the current result set.

**Done when:** a collaborator can locate known tasks and cannot discover inaccessible data through search.

**Accepted 2026-10-06:** board/workspace search, combined filters, access boundaries, no-match/edit transitions, URL navigation and desktop/narrow browser checks passed; see STATUS.md.

### M2.7 — Attachments and Files

**Deliverable:** an attachment library backed by a dedicated storage folder.

- [x] Implement bounded uploads, file metadata, generated storage identifiers, and task links.
- [x] Add authorized downloads and a lightweight Files view; scope any previews separately.
- [x] Check invalid/oversized uploads, interrupted transfers, direct file access, and persistence after restart.

**Done when:** files remain available to permitted users without granting access to unrelated NAS folders.

**Accepted 2026-10-06:** bounded private storage, role-safe upload/download, invalid/interrupted transfers, restart persistence and desktop/narrow browser checks passed. See FILES.md and STATUS.md for limits and evidence.

### M2.8 — Foundation verification

**Deliverable:** a connected app ready for team workflow features.

- [x] Complete an end-to-end journey: invite → sign in → create board/task → assign → attach file → find task.
- [x] Review server permissions across edits, search, and files using the relevant roles.
- [x] Record persistence/concurrent-edit checks and remaining issues; remove sample-only assumptions from completed features.

**Done when:** the core journey uses real accounts and durable records with documented results.

- [x] **Stage 2 complete:** all M2 acceptance checks in MILESTONES.md have evidence.

**Accepted 2026-10-06:** full 58-test database suite, 29 behavioral tests, build, 20 HTTP checks and connected browser journey passed. See FOUNDATION_REVIEW.md and STATUS.md.

---

## Stage 3 — Team workflow

**Purpose:** make the saved core comfortable for daily collaboration.  
**Bring:** feedback on how the four collaborators organize work.  
**Depends on:** the persistent foundation in M2.

### M3.1 — Table, Kanban, and Calendar

**Deliverable:** three views of the same tasks.

- [ ] Connect all views to shared records and define status/date mapping.
- [ ] Support useful view-specific changes, such as moving a card or changing a task date.
- [ ] Check filters, undated tasks, permissions, and consistency after switching views.

**Done when:** a task changed in one view appears correctly in the others without duplication.

### M3.2 — Live updates and reconnecting

**Deliverable:** shared boards that update during team use.

- [ ] Send committed changes to authorized connected users.
- [ ] Show connection problems and refresh authoritative state after reconnecting.
- [ ] Exercise simultaneous edits and reconnect behavior with four accounts.

**Done when:** teammates see saved changes without refreshing, and missed updates are recovered.

### M3.3 — Activity and notifications

**Deliverable:** a clear record of changes and an in-app notification center.

- [ ] Record useful activity with actor and time, such as assignment and status changes.
- [ ] Add assignment/update notifications, read/unread state, and links to the affected task.
- [ ] Verify recipients, permissions, and duplicate prevention; connect due-date reminders after M4.2.

**Done when:** users receive relevant in-app updates and can understand who changed a task. Email, push, and mentions remain separate decisions.

### M3.4 — Personal and team dashboards

**Deliverable:** working Home/My Day and shared Overview screens.

- [ ] Connect personal tasks, due/overdue work, notifications, and relevant recent items to the signed-in account.
- [ ] Add shared progress, overdue work, and workload summaries.
- [ ] Check calculations, empty states, user timezone boundaries, and access rules with different accounts.

**Done when:** dashboard figures match the underlying boards. Personalized views do not make shared tasks private.

### M3.5 — Timers and manual time entries

**Deliverable:** dependable task time tracking.

- [ ] Implement start/stop, manual entries/corrections, and summaries by task/project/date.
- [ ] Define active-timer behavior across tabs and devices; one active timer per user is the current proposal.
- [ ] Verify totals, permissions, and recovery after refreshing or restarting the service.

**Done when:** elapsed time is based on stored timestamps and totals remain correct when a browser closes.

### M3.6 — Reusable templates

**Deliverable:** reusable task/checklist and board structures.

- [ ] Save and reuse task and board templates, including relevant groups and custom columns.
- [ ] Define how dates, assignees, attachments, and document links are handled when creating from a template.
- [ ] Verify new tasks/boards can change independently of the template and original records.

**Done when:** a repeat project can be created predictably without unintended shared edits.

### M3.7 — Four-person workflow review

**Deliverable:** an integrated daily workflow with recorded checks.

- [ ] Run assignment → live update → notification → task completion → dashboard update across accounts.
- [ ] Check all views, time summaries, and a template-created project together.
- [ ] Review desktop/narrow layouts and resolve issues that prevent everyday use.

**Done when:** core teamwork works with four accounts and known limitations are documented.

- [ ] **Stage 3 complete:** all M3 acceptance checks in MILESTONES.md have evidence.

---

## Stage 4 — Advanced features and Docs

**Purpose:** add dependable scheduling, automation, and shared writing.  
**Bring:** a few real examples of recurring tasks and useful automation rules.  
**Depends on:** M2 and relevant M3 features; Docs saving relies on accounts and permissions.

### M4.1 — Task dependencies

**Deliverable:** clear relationships between tasks that depend on each other.

- [ ] Add/remove dependencies and show what is waiting on what.
- [ ] Define whether dependency status is advisory or prevents completion before implementing that behavior.
- [ ] Reject cycles and test completing, reopening, or removing a prerequisite.

**Done when:** dependency state is understandable and cannot enter an impossible circular chain.

### M4.2 — Reliable background jobs and reminders

**Deliverable:** the scheduling foundation used by later features.

- [ ] Persist jobs, define retries, and prevent duplicate effects when a job is retried.
- [ ] Add in-app deadline reminders and rules for overdue/missed jobs after a restart.
- [ ] Verify timezone handling, restart recovery, and duplicate-notification prevention.

**Done when:** scheduled work survives service interruptions and produces the intended effect once.

### M4.3 — Recurring tasks

**Deliverable:** daily/weekly/monthly task repetition with defined behavior.

- [ ] Define date-based versus completion-based repetition and choose the first supported patterns.
- [ ] Preserve the intended task fields and decide how missed occurrences are handled.
- [ ] Check month-end dates, relevant daylight-saving transitions, timezone changes, and retries.

**Done when:** the supported rules produce the expected tasks without accidental duplicates.

### M4.4 — Simple automations

**Deliverable:** a small rule builder with predictable actions.

- [ ] Add initial triggers/actions, such as status change → assign, notify, or move to group.
- [ ] Enforce permissions, bound rule loops, and make failures visible.
- [ ] Verify retries, multiple matching rules, and a representative user workflow.

**Done when:** supported automations behave consistently and can be disabled or corrected.

### M4.5 — Docs creation, access, and durable saving

**Deliverable:** real workspace documents using the embedded editor.

- [ ] Implement document creation, organization, formatting, and links to projects/tasks.
- [ ] Persist authoritative document state locally and enforce access on reading, editing, and connection setup.
- [ ] Show Saving/Saved/error states correctly and verify saved content survives a restart.

**Done when:** a document can be reopened intact from a task without a Google Drive dependency. Word/PDF import/editing remains outside this increment.

### M4.6 — Collaborative writing and recovery

**Deliverable:** safe shared drafting inside the workspace.

- [ ] Add simultaneous editing, collaborator presence, and reconnection handling using self-hosted components.
- [ ] Implement recoverable snapshots and agree retention before automatic cleanup is enabled.
- [ ] Test two users typing together, interrupted connections, service restart, snapshot recovery, and loss of access.

**Done when:** collaborators retain durably saved work and a past snapshot can actually be recovered. Test all four users together during M5.5.

### M4.7 — Advanced-feature integration review

**Deliverable:** the full agreed feature set connected for release preparation.

- [ ] Run a representative journey combining a recurring task, dependency, automation, notification, and linked Doc.
- [ ] Check that dashboards, activity, access rules, and live views stay consistent.
- [ ] Review background workload and unresolved failures before NAS packaging.

**Done when:** M4 behavior works with the existing team workflow and documented checks support rollout preparation.

- [ ] **Stage 4 complete:** all M4 acceptance checks in MILESTONES.md have evidence.

---

## Stage 5 — NAS rollout

**Purpose:** turn the working app into a maintainable service on your DXP2800.  
**Bring when needed:** NAS/network details, chosen subdomain, access route, and backup destination. Keep passwords and secrets out of project documents.  
**Depends on:** the working M2–M4 features. Packaging and infrastructure planning can be prepared earlier.

### M5.1 — Deployment and storage plan

**Deliverable:** the exact configuration plan for this NAS.

- [ ] Confirm available RAM, existing NAS workloads, Docker environment, and application storage locations.
- [ ] Choose the subdomain and HTTPS gateway/tunnel route using the existing ecosystem where suitable.
- [ ] Record the required settings, persistent folders, and private service connections without exposing secrets.

**Done when:** installation prerequisites are known and the app's scope of access is clear.

### M5.2 — Production packaging

**Deliverable:** repeatable production containers and configuration.

- [ ] Package the app, database, collaboration service, and worker with persistent volumes and restart behavior.
- [ ] Add configuration examples, startup checks, schema-update steps, and bounded logs/background work.
- [ ] Verify a clean installation in a safe local or test environment; build away from the NAS where practical.

**Done when:** the production setup can be reproduced from documented files.

### M5.3 — NAS installation and local verification

**Deliverable:** an internally accessible installation on the NAS.

- [ ] Confirm authorization for the concrete NAS installation, then deploy into its designated folders.
- [ ] Check sign-in, task/document saving, attachments, and background jobs over the local network.
- [ ] Restart the services and verify the database, files, and document content survive.

**Done when:** the production installation works locally without depending on the development machine.

### M5.4 — Subdomain and remote access

**Deliverable:** the intended HTTPS entry point for collaborators.

- [ ] Before any publication/external release, run Cloudflare `security-audit` against the release candidate and deployment configuration; record coverage, resolve release blockers, retest fixes and revalidate subsequent changes. Incomplete verification remains pending. Repeat this gate for later changed releases.
- [ ] Prepare the concrete domain/routing configuration and confirm authorization before enabling external access.
- [ ] Configure the chosen route and verify login, live connections, Docs, and file transfers from outside the local network.
- [ ] Confirm the app deployment does not expose its database or the NAS administration interface.

**Done when:** a collaborator can use the chosen address with the same access restrictions as local use.

### M5.5 — Four-user performance and access checks

**Deliverable:** measured evidence that this NAS handles the intended use.

- [ ] Exercise four accounts across board edits, collaborative Docs, uploads, timers, and background jobs.
- [ ] Measure peak memory and responsiveness alongside existing NAS workloads against the approximate 4 GB project budget.
- [ ] Recheck role boundaries and recovery from interruptions; record and resolve capacity problems before relying on the release.

**Done when:** representative work is usable and the measured limits are documented. Storage capacity alone is not a performance result.

### M5.6 — Backups and real recovery

**Deliverable:** a working backup and restore procedure.

- [ ] Choose destination, schedule, and retention, including a recovery copy outside the same NAS storage pool.
- [ ] Back up the database, attachments, and required configuration with a consistent recovery plan.
- [ ] Restore into a separate safe test location and verify sign-in, tasks, documents, and files.

**Done when:** a real recovery has succeeded; a successful backup job alone does not complete this increment.

### M5.7 — Operating guide and first release

**Deliverable:** a usable release with concise maintenance instructions.

- [ ] Document invite/member management, restart, update, rollback/recovery, and troubleshooting procedures.
- [ ] Run the final user journey with representative data and resolve release-blocking issues.
- [ ] Record the deployed version, checks, known limitations, and the next improvement in STATUS.md.

**Done when:** you can use and maintain the app, and all stage acceptance checks have evidence.

- [ ] **Stage 5 complete:** all M5 acceptance checks in MILESTONES.md have evidence.

---

## Decisions to bring only when they matter

| Decision | Needed around | Current position |
| --- | --- | --- |
| Visual direction and layout preferences | M1.1 | Captured: dark, subtle accents, equal desktop/phone focus, larger controls; exact styling remains provisional |
| Final product name | M1 design work or later | Open; a temporary name is sufficient to start |
| Authentication/recovery approach | M2.2 | Choose a maintained implementation; email service is not assumed |
| Timer/template behavior | M3.5–M3.6 | Proposals in PLANNING.md; settle during implementation |
| Recurrence/dependency/automation examples | M4.1–M4.4 | User examples will help select useful initial rules |
| Document snapshot retention | M4.6 | Choose before automatic deletion/cleanup |
| Subdomain, gateway/tunnel, NAS access | M5.1 | Existing ecosystem details not yet supplied |
| Backup destination, schedule, retention | M5.6 | Open; a real restore is required |
| Comments, mentions, private boards, inbox | Only if requested | Optional; not part of the committed build |
| Email/push, offline editing, exports, custom dashboard widgets | Only if requested | Open; do not assume these are required to finish the current plan |

## End every session — leave a clear handoff

These boxes are a reusable routine. Completion of a session does not imply completion of a milestone.

- [ ] Review the actual preview, file, or working behavior delivered.
- [ ] Run relevant build, HTTP and behavioral checks; for UI work, exercise the changed journey on desktop/narrow layouts and complete the Impeccable and Web Design Guidelines reviews.
- [ ] Fix verified in-scope failures and confirm the affected checks. Record blocked browser/skill checks as pending; do not mark the feature complete.
- [ ] Tick only finished delivery items above; leave partial/untested items open.
- [ ] Update STATUS.md with the increment ID, output paths, checks run/results, and any remaining issue.
- [ ] Add material scope/architecture decisions to DECISIONS.md and keep related project records consistent.
- [ ] Reassess priorities and dependencies using the check results; write one concrete next action, including any user input needed for it.

**Suggested closing message:**

> Update the workspace-app checklist and STATUS.md with what was actually completed and verified today. Record material decisions, keep unfinished items open, and give me the exact next increment and first action for the next session.

## Where to read more

| File | Purpose |
| --- | --- |
| [STATUS.md](STATUS.md) | Authoritative current progress, evidence, and next action |
| [BRIEF.md](BRIEF.md) | Goal, confirmed scope, and constraints |
| [PLANNING.md](PLANNING.md) | Detailed requirements and proposed architecture |
| [DESIGN_SPEC.md](DESIGN_SPEC.md) | M1.1 screen map, user design direction, and prototype interactions |
| [MILESTONES.md](MILESTONES.md) | Stage-level acceptance criteria |
| [DECISIONS.md](DECISIONS.md) | Confirmed choices, proposals, and reasons |
| [README.md](README.md) | Project workflow and useful starting prompts |
| [HANDOFF.md](HANDOFF.md) | Continuing in another chat |

## Stellar prototype review — 2026-10-06

- [x] Implement approved star appearance and clearly labelled temporary controls.
- [x] Run typecheck, behavioral tests, production build and HTTP smoke; inspect desktop/narrow UI and affected keyboard/navigation journey.
- [x] Apply scoped design/interface/React review; record actual evidence and limitations in STATUS.md.
- [ ] Review appearance with the user and define real task/goal scoring before connecting data.

- [x] Solar flare refinement: local-colour emission, desktop/mobile and pause checks, build/tests/smoke and scoped design review recorded in STATUS.md (2026-10-06).
