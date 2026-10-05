# Workspace app — compact handoff report

Historical snapshot: later work on **2026-10-05** implemented M1.2–M1.5 and saved local Git checkpoints. Read STATUS.md for the authoritative current state; the report below describes the earlier archive.

Prepared: **2026-10-05**. Last recorded implementation checks: **2026-09-25**.

This is the portable summary of the project conversation and current files. It does not replace the detailed requirements or indicate that Codex's internal chat context has been compacted.

## Goal and constraints

Build a Monday-style collaborative workspace for up to **four people**, hosted on a **UGREEN DXP2800 NAS**, with about **4 GB RAM** dedicated to the project and **6 TB storage** available. Use a subdomain of the user's existing domain. Keep application data, attachments, and collaborative documents on the NAS; Google Drive must not be required.

The memory allowance is a design target, not a measured capacity guarantee. NAS deployment, domain configuration, and production resource testing have not happened.

## Decisions to preserve

- **Design:** dark workspace, subtle accents, equal desktop and phone emphasis, larger controls. Exact branding, typography, and palette remain provisional.
- **Accounts:** individual password access, invitations, owner/editor/viewer roles, personal dashboards, multiple task assignees.
- **Work management:** boards, groups, tasks/subtasks, custom columns, Table/Kanban/Calendar views, My Day, search/filter, task notes/checklists/attachments/activity.
- **Collaboration and workflow:** live updates, notifications, timers/manual time entries, templates, team dashboards, dependencies, recurrence, constrained automations.
- **Documents:** lightweight collaborative Docs inside the workspace, with durable saving and recovery. The broader office-suite idea was sidelined.

**Optional, not approved:** comments/@mentions, private boards, quick-capture inbox.

**Outside the current plan:** private personal workspaces, full Word/PDF editing, a full Drive replacement, desktop folder synchronization.

**Still open:** product name, exact visual identity, subdomain/access gateway, external email/push, offline editing, export formats, dashboard customization, backup destination/retention, deadline and monetary budget. Resolve these when relevant to implementation.

## Architecture and implementation

The current prototype uses Next.js, React, TypeScript, and plain CSS. Exact versions and startup scripts are in `package.json`; the dependency lockfile is included.

The planned persistent architecture is a modular app with PostgreSQL, NAS-backed attachment storage, and Tiptap/Yjs with self-hosted Hocuspocus for collaborative Docs. Docker Compose is the planned deployment approach. These backend services are **not implemented**. Keep service count small and validate backup restoration and four-user memory usage before release.

## Progress checkpoint

| Work | State |
| --- | --- |
| Planning and session workflow | Complete; five milestones broken into 35 increments |
| M1.1 — design brief | Complete; screen map, desktop/phone layouts, flows and sample-state boundaries recorded |
| M1.2 — application shell | Implemented; browser verification pending, so not complete |
| M1.3 onward | Not complete; next increment is Personal Home and My Day |
| M2–M5 | Persistence, team workflow, advanced Docs and NAS rollout not started |

M1.2 includes desktop sidebar, phone menu/bottom navigation, Home/Boards/Docs routes, search dialog, sample-account switching, reusable controls, and fictional sample content. Fixtures contain four members, two boards, three documents, and twelve tasks. Account selection is in memory and resets on refresh. Board content is read-only; Docs are placeholders. There is no real authentication, permission enforcement, database, durable app data, or document editor.

## Verification and remaining risk

Recorded on September 25: dependency installation, TypeScript check, production build, fixture ID/reference/date checks, and an initial HTTP `/home` response passed. The development server reported ready at `http://127.0.0.1:3100`. Its current running state has not been checked for this handoff.

Browser access was refused because the tool could not verify an admin-enforced security policy. No screenshots or rendered interaction checks succeeded. This was the recorded blocker; whether it persists must be checked in the next session. Do not bypass that restriction.

A dialog-switch race was fixed in source using overlay-specific close handling. The runtime regression check remains pending. Desktop/phone appearance, overflow, navigation/history/direct refresh, search, account switching, focus/Tab/Escape behavior, unknown routes, and the phone software keyboard remain unverified. A successful build does not establish those behaviors.

## Next session checklist

1. Read [AGENTS.md](AGENTS.md), [BRIEF.md](BRIEF.md), and [STATUS.md). Use [SESSION_CHECKLIST.md](SESSION_CHECKLIST.md) before each session.
2. Follow [RUNNING.md](RUNNING.md) to install/start locally if needed. Dependencies and running processes do not transfer with this archive.
3. Retry supported browser access and complete the pending M1.2 desktop, phone, navigation, search, account and keyboard checks. Fix any observed failures.
4. Update status and checklist with actual results. Mark M1.2 complete only after its acceptance checks pass.
5. Then continue M1.3 — Personal Home and My Day. Do not assume permission for NAS deployment or public exposure.

## Files and handoff

Original working folder:

```text
/Users/peterkontellis/.codex/.chatgpt-projects/g-p-6a0f76716e988191962260a53dc7ed97/workspace-app
```

Use [DESIGN_SPEC.md](DESIGN_SPEC.md) for design, [PLANNING.md](PLANNING.md) for requirements/architecture, [DECISIONS.md](DECISIONS.md) for decisions, and [MILESTONES.md](MILESTONES.md) for stage acceptance criteria. [HANDOFF.md](HANDOFF.md) explains continuation and ownership.

The dated Markdown bundle contains all project Markdown documents. The full handoff ZIP also contains the current source, public assets, configuration and dependency lockfile. Dependencies, generated builds, environment files, and production data are excluded. Preserve a durable copy outside the ChatGPT project mirror and keep one authoritative working copy.

### Paste into the next task

> Continue this self-hosted workspace app using the attached full project ZIP or accessible workspace-app folder. Read HANDOFF_REPORT.md, AGENTS.md, BRIEF.md and STATUS.md first. M1.1 is complete; M1.2 is implemented but its browser checks are pending. Use RUNNING.md and SESSION_CHECKLIST.md to finish those checks, fix observed problems, and update the records before advancing to M1.3. Preserve the dark/subtle design, equal phone/desktop emphasis, four-user NAS constraints, and optional-feature boundaries. Report tool limitations accurately and do not bypass browser security restrictions. Do not deploy to the NAS yet. If you cannot edit the authoritative copy, return clearly identified updated files for me to carry back.
