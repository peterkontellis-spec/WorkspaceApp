# Workspace app — project brief

Updated: 2026-09-25

## Goal

Build a personal Monday-style collaborative workspace for up to four people, hosted on the user's UGREEN DXP2800 NAS and accessible through a subdomain of the user's existing domain. Store application data, attachments, and collaborative documents on the NAS without requiring Google Drive.

## Confirmed scope

- Individual password-protected accounts, invitations, owner/editor/viewer roles, personal dashboards, and multiple task assignees.
- Boards, grouped tasks, subtasks, custom columns, Table/Kanban/Calendar views, My Day, search and filters.
- Task details with notes, checklists, attachments, and activity; live updates and notifications.
- Manual time entries, timers, reusable task/board templates, and team dashboards.
- Dependencies, recurring tasks, and constrained automations.
- Lightweight collaborative Docs with durable saving and recovery behavior.
- User-selected design direction: dark workspace with subtle accents, equal desktop/phone focus, and larger controls. Exact palette, typography, and layout dimensions remain proposals.

The full requirements and architecture proposals are in [PLANNING.md](PLANNING.md). [MILESTONES.md](MILESTONES.md) translates them into incremental delivery and checks.

## Constraints

- Approximately 4 GB RAM available to this project; this is a design budget to validate, not a measured guarantee. About 6 TB storage is available.
- Prefer a modular app and a small number of services. Build production images away from the NAS where practical.
- Persist app data independently of containers; verify backup restoration before relying on the release.
- Keep the database internal; use an appropriate HTTPS gateway or tunnel for the app.

## Current delivery target

M1.1–M1.6 / Stage 1 were accepted on 2026-10-06 as a connected sample-data prototype. Desktop/narrow browser journeys, physical iPhone Firefox task/date/Docs and software-keyboard checks, desktop keyboard checks, and user-confirmed 200% zoom have evidence in STATUS.md. Latest implementation checks passed: TypeScript, 23 tests, production build and 16 HTTP checks. Phone refresh silently resets sample edits; unload warnings are not dependable. UI critique findings remain a refinement backlog, not a claim of production readiness. M2.1 is now complete: the local PostgreSQL foundation passed restart, migration, conflict and isolation checks. The UI still uses sample data. M2.2 accounts/sessions is also complete: sign-in, protected routes, expiry/revocation and operator-issued recovery passed automated and browser checks. [AUTHENTICATION.md](AUTHENTICATION.md) explains first-owner setup. M2.3 invitations/roles is implemented with passing backend checks; final user-assisted invitation and membership browser checks remain open (STATUS.md). M2.4 persistent boards/tasks follows acceptance; [DATABASE.md](DATABASE.md) records the M2 outline.

## Scope boundaries and open decisions

Optional and not approved: comments/@mentions, private boards, quick-capture inbox.

Excluded from the current plan: private personal workspaces, an office suite, full Word/PDF editing, a full Drive replacement, and desktop folder synchronization.

Open: product name and exact branding/palette/typography, exact subdomain/access route, external email/push notifications, offline editing, exports, dashboard customization, backup destination/retention, deadline, and monetary budget. Resolve each when it affects the next task; do not block unrelated work.

## Working arrangement

This folder is the active local project location. Keep one coordinating chat and one authoritative working copy. The coordinating assistant manages specialist assignments and shared records. The workflow setup is complete and the first application shell is implemented. See STATUS.md for actual check results and RUNNING.md for local startup.
