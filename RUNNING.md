# Run the workspace app locally

## Current scope

Accounts mode now provides real sign-in, staff roles and saved boards/tasks, custom columns, notes and checklists through M2.5, plus M2.6 saved-task search/filters and M2.7 task attachments/Files. Use explicit Save for persistent changes. See [SAVED_WORK.md](SAVED_WORK.md) for behavior, draft recovery and limits. Docs remain a sample.

Docs use a small Markdown subset with formatting controls and a safe preview. This is not a full word processor or collaborative editor. Doc sample edits reset on refresh/tab closure, and unload warnings are not dependable (physical iPhone refresh was silent). Saved task attachments are available in accounts mode; see [FILES.md](FILES.md).

See [DATABASE.md](DATABASE.md) for PostgreSQL startup and checks, and [AUTHENTICATION.md](AUTHENTICATION.md) for account setup/recovery. No NAS deployment exists. Explicit prototype mode retains the original M1 sample UI, illustrative roles and 25 September 2026 demo date; its edits are temporary. It is separate from the accounts preview.

M1 was signed off as a sample-data prototype on 2026-10-06, including the replacement in-page calendar and phone/keyboard/zoom checks. Earlier browser-policy failures are historical; see STATUS.md for the recorded limits and current M2 progress. Build/model/HTTP checks do not substitute for browser verification.

## October 6 verification update

Calendar selection/Save/Cancel, keyboard month/year movement, task Clear/Escape, mobile preview/nested links/empty state, Assistant placeholder, account switching, filter/collapse history and in-page reset Cancel/Escape/confirm have direct browser evidence. See STATUS.md for exact widths and gaps; broad checklist boxes remain open where only part passed.

The current accounts preview uses a separate production build snapshot. After database/auth setup, run from this project folder:

```sh
pnpm build
pnpm preview
```

`pnpm preview` copies the completed standalone build, static scripts and public assets to ignored `.local/preview-releases/`, reads the local database/auth configuration, and sets ATTACHMENT_ROOT to the persistent private `.local/attachments` folder, and starts a detached Mac-only server at `127.0.0.1:3100`. Future builds do not change the running snapshot. Activate a new build with `pnpm preview` when users have saved their work, then refresh their tabs. Do not run builds and preview activation concurrently.

The launcher uses macOS `lsof` to verify the previous process's project directory and port ownership before stopping it. It refuses to stop another service and confirms the replacement process owns the port and passes readiness before recording it. Current state: `.local/preview-server.pid`, `.local/preview-release.txt`; log: `.local/preview-server.log`. Verify process identity before manual stopping. Old snapshots remain ignored local files; this helper is not NAS service management or a backup system. Do not use the older `.local/restart-preview.py` helper or serve directly from `.next` while building.

Accounts-mode boards/tasks, custom values, notes and checklists are saved; Docs remain a sample. A persistent preview owner account now exists. Preserve its boards and user edits; never reuse destructive/disposable-account cleanup routines on it. Keep credentials out of Git and project documents.

## Open the current preview

While the local preview server is running, open:

[Workspace preview](http://127.0.0.1:3100/home)

The server binds to this Mac's loopback interface. This link is for this Mac; it is not an externally hosted address or a phone-accessible NAS deployment.

## Development and explicit sample mode

Requirements: Node.js 20.9 or later (tested here with the bundled Node 24.19.0) and pnpm 11.25.0. The project lockfile records the installed dependency versions.

From a terminal:

```sh
cd /Users/peterkontellis/.codex/.chatgpt-projects/g-p-6a0f76716e988191962260a53dc7ed97/workspace-app
pnpm install --workspace-root --frozen-lockfile
pnpm dev:prototype
```

Installation is only necessary when dependencies are missing or changed. The development command serves port 3100 on `127.0.0.1`. Keep the terminal running; Ctrl+C stops the preview. If this project's server is already running, reuse it rather than starting another copy. A port collision should be resolved explicitly, not by silently choosing an unrelated service.

### This Mac's bundled runtime

Node is bundled with Codex but was not on the terminal's default PATH during setup. If `node` cannot be found here, run this before the commands above:

```sh
export PATH="/Users/peterkontellis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/peterkontellis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
```

This line is specific to this Mac. Other computers should use their normal Node and pnpm installations.

## Check the project

```sh
pnpm typecheck
pnpm build
```

Both commands passed during M1.6 refinement checks. A native framework standalone build is configured to prepare for eventual self-hosting. NAS packaging, static-asset copying, service configuration, backups, and deployment are still M5 work; `.next/standalone` by itself is not a complete deployed product.

### Repeatable self-check commands

Run `pnpm check` for TypeScript, behavioural model/Markdown/navigation tests, and the production build. With this project's server running at `127.0.0.1:3100`, run `pnpm check:smoke` in another terminal. In explicit prototype mode the smoke script runs 16 checks covering the Home redirect, sample pages, task/filter/return query routes, prototype disclosure, filtered row count, task/editor markup and four HTTP 404 responses. Accounts mode adds signed-out rejection, team, invalid-invitation and Files checks (20 total) and needs an ignored disposable credentials file; see AUTHENTICATION.md. Recovery-link rendering and clicks remain browser checks. The script exits nonzero on failure and uses no additional dependencies.

These HTTP checks do not execute client JavaScript, click controls, inspect layout, or replace the browser checklist below. Do not use them as a workaround for a denied browser check. Extend the checks as routes and behavior evolve.

Every task/session follows the required self-check loop in AGENTS.md: implement, inspect, run/test, review with design/UI skills, fix, confirm, reassess the next action, and record evidence. No daily or unattended automation is configured.

Next.js automatic agent-instruction generation is disabled in next.config.ts so development does not append generated guidance to the existing project AGENTS.md.

## Reusable browser regression checklist

M1 was signed off on 2026-10-06 using the cumulative evidence in STATUS.md, physical iPhone Firefox checks, desktop keyboard checks and user-confirmed 200% zoom. These unchecked boxes are a reusable regression checklist, not outstanding M1 gates. Repeat only the checks affected by a change; do not infer every combination/browser was tested.

- [ ] Visit Home, Boards, and Docs; verify the current section, direct refresh, and browser Back/Forward.
- [ ] Open both sample boards and each sample document, then return to their lists.
- [ ] Search with the Go to control and Cmd/Ctrl+K; check matches, no matches, clearing the query, and destination navigation.
- [ ] Switch sample accounts; verify the heading/sample task list changes, navigation retains the selection, and refresh resets it.
- [ ] Open account/navigation dialogs, then press Cmd/Ctrl+K: search should remain open after the previous dialog closes.
- [ ] Use Tab/Shift+Tab, Enter, and Escape; verify visible focus, dialog focus containment, and focus return.
- [ ] Inspect 360 px, 390 px, medium desktop, and wide desktop; verify legible content, larger controls, no page-wide overflow, and no content hidden by bottom navigation.
- [ ] Verify future sections are labelled Later and tasks/editor do not suggest real saving or authentication.
- [ ] Check unknown board/document URLs show the not-found page with a route back Home.

### Additional M1.3–M1.5 browser checks

- [ ] Switch sample accounts and verify overdue/today/upcoming/undated buckets and new-collaborator preview. Preview must not delete shared data.
- [ ] Add, rename and date a task; reject blank titles, cancel edits with Escape, assign multiple members, change priority/status and verify Home reflects changes. Status must not silently move groups.
- [ ] Apply combined board filters, clear them, collapse a group and use Back/Forward; visible controls must match the URL. Confirm no-match and empty-group states.
- [ ] Open a task from Home and a filtered board. Change it so it disappears from the originating list; Close/Escape must restore focus to a visible trigger or main content.
- [ ] Edit notes, checklist and subtasks. Leave unfinished board/task input, navigate away and return; drafts must remain. Close the task without losing edits.
- [ ] Open a linked Doc, write/format/preview text and insert a valid link. Reject unsafe links; raw HTML must display as text. Clear all text and verify the empty preview.
- [ ] Return to the task and close it; preserve originating filters, collapsed groups and scroll. Edit Weekly notes and confirm it appears among Home's recent Docs.
- [ ] Test formatting by mouse and keyboard, focus/selection restoration, refresh/close warning and Reset demo confirmation/cancellation.
- [ ] Inspect task panel, board controls and editor at 360/390 px, medium and wide desktop. Desktop must keep board context visible; phone controls/keyboard must not hide active input.

Physical iPhone Firefox typing/Preview, keyboard hiding/restoring bottom navigation, task/date/Doc return and refresh were user-tested. Refresh silently reset sample edits; never depend on an unload warning. The temporary hotspot preview is stopped. STATUS.md is authoritative for actual evidence and remaining limitations.

### Earlier handoff note — superseded by current STATUS.md sign-off

Explicit approval for browser access to `http://127.0.0.1:3100` restored supported tool access. The local standalone preview is running in its own process session, with logs at `.git/preview-server.log`; this is not an autostart service. A clean refresh passed, but a dirty-document refresh retained text without exposing an inspectable warning, so refresh/close warning behavior remains inconclusive. See the pre-M2 open register in STATUS.md before treating any broad box above as passed.

### M1.6 confirmation priorities

- [ ] Open the in-page calendar in a board date edit and task panel. Select a date by mouse and arrow keys; check month/year boundaries, Clear date, Escape, focus return and board Save/Cancel. No native calendar popup should appear.
- [ ] At 360/390px, scroll down while writing, switch to Preview, confirm text is visible and controls stay reachable, then return to Write. Test with a real phone keyboard separately.
- [ ] Insert a link into bold/italic text and confirm it is clickable in Preview; confirm unsafe links/raw HTML stay inert.
- [ ] Check Assistant · Later in desktop navigation and the mobile menu; it must remain visibly unavailable.

## Source guide

| Location | Responsibility |
| --- | --- |
| `src/app/layout.tsx` | Shared document metadata; protected shell is in `(workspace)/layout.tsx` |
| `src/app/(workspace)/[...segments]/page.tsx` | Validate and serve sample section/detail routes |
| `src/components/workspace-shell.tsx` | Navigation, page picker, sample account, and mobile menu |
| `src/components/workspace-pages.tsx` | Personal Home, board list and page composition |
| `src/components/board-view.tsx` | Grouped board editing and URL filters |
| `src/components/task-panel.tsx`, `task-details-form.tsx` | Task details, session drafts and linked Docs |
| `src/components/docs-view.tsx`, `src/lib/markdown.ts` | Session-only Markdown editor and safe preview |
| `src/components/demo-provider.tsx`, `src/lib/demo-state.ts` | Shared demo state and validated model operations |
| `src/components/task-navigation.tsx`, `src/lib/navigation.ts` | Task URLs, return paths, focus/scroll context |
| `src/components/ui.tsx` | Buttons, fields, panels, task rows, status labels, avatars, and dialogs |
| `src/lib/demo.ts` | Four fictional members, two boards, three Docs, and twelve linked sample tasks |
| `src/app/globals.css` | Shared dark theme, larger controls, and responsive layouts |

Keep one set of sample records shared across screens. Prototype edits do not establish durable or multi-user functionality.
