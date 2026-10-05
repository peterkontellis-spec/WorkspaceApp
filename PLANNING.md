# Collaborative workspace — planning baseline

Updated: 2026-09-25. Requirements and architecture baseline; see STATUS.md for implementation progress. The local M1.2 shell is implemented; no NAS deployment exists.

## Purpose and constraints

A personal, Monday-style workspace for up to four collaborators. Run on the user's UGREEN DXP2800, with approximately 4 GB RAM available to this project and about 6 TB storage. Use a subdomain of the user's existing domain. Store application data and documents on the NAS; Google Drive must not be required for collaborative work.

The memory allowance is a design budget, not a measured capacity guarantee. Existing NAS workloads, document sizes, attachment processing, and concurrent activity must be tested. Build production images away from the NAS where practical.

## Decisions from the conversation

Confirmed:
- Project boards, tasks and subtasks, custom columns, groups within boards.
- Table, Kanban, and calendar views of the same tasks.
- My Day, task detail panels with notes/checklists/attachments/activity, search and filters.
- Workspace invitations; owner, editor, and viewer permissions; multiple task assignees.
- Individual password-protected accounts and personal dashboards.
- Notifications, live updates, activity history.
- Recurring tasks, dependencies, simple automations, team dashboards.
- Manual time entries and timers; reusable board/task templates; attachments.
- Lightweight collaborative Docs embedded inside the workspace, with NAS persistence.

Optional, not yet approved: task comments and @mentions; private boards; quick-capture inbox. Mention notifications depend on enabling mentions.

Not included in the current plan: private personal workspaces; full Word/PDF editing; full Google Drive replacement, desktop folder synchronization, or an office suite. Basic previews are proposed, while advanced PDF utilities remain deferred with the office-suite idea.

Design direction selected during M1.1 on 2026-09-25: dark workspace with subtle accents, equal desktop/phone focus, and larger controls. [DESIGN_SPEC.md](DESIGN_SPEC.md) maps screens and interactions; its exact palette, typography, dimensions, and phone navigation pattern remain proposals.

Not decided: exact branding/palette/typography, product name, subdomain, external access route, email/push notifications, offline editing, document export formats, dashboard widget customization, backup destination and retention.

## Proposed product structure

Start with one shared workspace and up to four accounts. Keep workspace membership explicit in the data model so permissions remain coherent if additional workspaces are needed later.

Navigation:
- Home: personal dashboard with My Day, assigned work, upcoming dates, notifications, and recent documents.
- Boards: project list and selected board.
- Overview: shared project progress, overdue work, and workload.
- Docs: shared writing, organized by project and linked to tasks.
- Files: a lightweight library of uploaded attachments, not a full NAS file manager.
- Time: active timer, manual entries, and date/project summaries.
- Settings: profile, members, roles, templates, and automation rules where appropriate.

Notifications and global search remain available from the top bar. Administrative controls are shown according to role.

## Rough UI structure

Desktop shell: persistent left navigation, top bar with comfortably sized controls, main working area, and an optional task detail panel on the right. Keep the main board visible while inspecting a task. Give phones equal design attention: use full-screen task details and a comfortable task-list presentation where a dense table is impractical; keep task creation/editing and document writing available as those features arrive.

Home: greeting and date, today's priorities, overdue and upcoming tasks, recent Docs, and a compact time summary. Personal selection and layout preferences do not make shared tasks private.

Board: title and members; Table / Kanban / Calendar tabs; search, filters, sorting, and Add task controls; grouped rows with inline editable cells. Proposed initial columns: task title, status, assignee, priority, due date, tracked time. Additional fields can be configured per board.

Task panel: title, status and assignments; details/notes; subtasks and checklist; dependencies; attachments and linked Docs; time entries; activity history. Comments remain optional.

Docs: project/document list with an editor in the main area, title, collaborator presence, formatting toolbar, and explicit Saving / Saved / Reconnecting states. Link documents to tasks without duplicating their content.

The user has selected a dark workspace with subtle accents and larger controls on both desktop and phone. Later design prompts can refine the exact styling. Preserve keyboard access, visible focus, comfortable readable density, and text labels alongside status colors.

## Proposed implementation architecture

Use a modular application with one main server, not a separate service for every feature.

| Layer | Proposed choice | Responsibility |
| --- | --- | --- |
| Browser interface and app server | React / Next.js with TypeScript | Screens, authenticated operations, permissions, board data and file access |
| Database | PostgreSQL | Users, boards, tasks, custom field values, time entries, notifications, document state and history |
| Collaborative writing | Tiptap with Yjs / self-hosted Hocuspocus | In-browser editor and concurrent document synchronization |
| Attachment storage | Dedicated NAS folder mounted into the app | Original uploads and bounded generated previews |
| Scheduled work | Small worker using a durable database jobs table | Recurrence, due notifications, automation actions and retries |
| Deployment | Docker Compose | App, database and collaboration services; worker may reuse the app image |
| External access | Existing HTTPS gateway or a tunnel | Route the chosen subdomain to the app and live connections |

M1.2 installs the frontend baseline: Next.js 16.3.6, React 19.3.0, TypeScript, and lucide-react icons, with pnpm and a lockfile. The database, collaborative editor, background jobs, storage services, and deployment remain proposed future components. Validate their maintained versions and extension licensing when implemented. Use self-hosted/open-source document features; cloud conversion, AI, and hosted collaboration are not required.

Reuse the existing access gateway if suitable. The database stays internal. Do not expose the NAS administration interface as part of this deployment. Do not add Redis, a dedicated search cluster, or object-storage infrastructure unless actual requirements justify them.

## Data and behavior

Principal records: User, Session, Workspace, Membership, Invitation, DashboardPreference, Board, BoardGroup, ColumnDefinition, Task, TaskAssignee, TaskFieldValue, Dependency, Attachment, Document, DocumentLink, DocumentSnapshot, TimeEntry, Notification, ActivityEvent, Template, RecurrenceRule, AutomationRule, Job.

Use typed standard task fields for common queries and validated per-board values for custom columns. Table, Kanban, calendar, and dashboards query the same records. Subtasks reference a parent task. Reject cyclic dependencies.

Personal dashboards are filtered views of accessible shared data. Enforce permissions on the server for every operation, file download, search result, notification, and document connection; hiding a UI button is not an access control.

Persist board edits transactionally before confirming them. Use record revisions to detect competing updates rather than silently overwriting them. Broadcast committed changes to connected clients; reconnecting clients re-fetch authoritative state.

Use Yjs collaborative state for Docs and persist it on the NAS-backed database. Treat derived HTML/JSON and downloadable exports as representations, not competing sources of truth. Show Saved only after durable persistence is acknowledged. Store periodic recoverable snapshots with bounded retention. Loss of connection must be visible; offline editing is not promised by this plan.

Attachments use generated storage identifiers, with original names and permissions in the database. Stream uploads/downloads, limit size and preview work, and mount only the application's storage folder. Avoid mounting the full NAS filesystem.

Timers persist start/stop timestamps rather than relying on an open browser. Use a one-active-timer-per-user default, subject to later UX review. Store timestamps consistently and apply each user's timezone for display; recurrence rules retain their intended timezone across daylight-saving changes.

Automation starts with constrained triggers and actions, not arbitrary code: status change or due date triggers; assign, notify, or move to group actions. Use durable jobs, retry limits, deduplication, and loop prevention. Notify inside the app first; email delivery needs a separate provider decision. Invitations can initially use owner-generated, expiring links.

## Operation and validation

Use a maintained authentication library, hashed passwords, secure sessions, expiring invitations, and an account-recovery process. The owner manages membership. Workspace roles do not restrict the NAS administrator's technical access to underlying storage.

Keep persistent database and attachment volumes independent of app containers. Plan database-aware backups plus attachments and configuration, with a recovery copy outside the same storage pool. Test an actual restore before relying on the system. Choose retention with the user before enabling automatic cleanup.

Before calling the release ready, verify four-user collaboration, role enforcement, competing edits, document save/reconnect behavior, timers across refresh/restart, recurrence across timezones, job retries, upload access, and backup restore. Measure peak memory with representative boards and documents; bound caches, logs, snapshots, and background processing to leave headroom.

## Delivery sequence

1. Design prototype: application shell, personal dashboard, board, task panel, and Docs screen using sample data and the user's forthcoming visual direction.
2. Working foundation: accounts, invitations/roles, persistent boards/tasks/custom fields/groups, search, task detail, and attachment handling.
3. Team workflow: other board views, live updates, activity history, notifications, personal/team dashboards, time tracking, and templates.
4. Advanced behavior: dependencies, recurrence, constrained automations, and self-hosted collaborative Docs with save/recovery verification.
5. NAS rollout: production containers, existing subdomain integration, access checks, resource testing, backups, and restore validation.

All confirmed features remain in scope; the sequence is incremental, not a reduction of the agreed feature list. Deployment preparation starts with the architecture, while public access waits for a working, verified build and known network configuration.

## Reference documentation

- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- Tiptap editor: https://tiptap.dev/docs/editor/getting-started/overview
- Self-hosted collaboration: https://tiptap.dev/docs/hocuspocus/getting-started/overview
- UGREEN Docker deployment and compatibility: https://ai.ugreen.com/blogs/knowledge/docker-docker-compose-ugreen-nas
