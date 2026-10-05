# Run the workspace prototype

## Current scope

M1.2–M1.5 implement the shell, personal Home/My Day, editable grouped boards, task details and session-only Docs writing/preview. Use the same shared sample records across screens. Task status, priority, assignees and notes apply immediately; board titles/dates use explicit Save/Cancel. Board filters and collapsed groups live in the URL; unfinished task/board input stays in memory through internal navigation.

Docs use a small Markdown subset with formatting controls and a safe preview. This is not a full word processor or collaborative editor. Attachments are sample metadata only. All edits reset on refresh/tab closure, with a beforeunload warning after changes. Reset demo in the account dialog asks for confirmation before clearing session data.

No database, real accounts, permissions, upload/download, durable saving or NAS deployment exists. Sample roles are illustrative. The demo date remains 25 September 2026.

Browser visual/interaction acceptance remains pending because the supported browser tool cannot verify its admin-enforced security policy. Build/model/HTTP tests are not substitutes. See STATUS.md for current results and Git checkpoints.

## Open the current preview

While the local development server is running, open:

[Workspace preview](http://127.0.0.1:3100/home)

The server binds to this Mac's loopback interface. This link is for this Mac; it is not an externally hosted address or a phone-accessible NAS deployment.

## Start it again

Requirements: Node.js 20.9 or later (tested here with the bundled Node 24.19.0) and pnpm 11.25.0. The project lockfile records the installed dependency versions.

From a terminal:

```sh
cd /Users/peterkontellis/.codex/.chatgpt-projects/g-p-6a0f76716e988191962260a53dc7ed97/workspace-app
pnpm install --frozen-lockfile
pnpm dev
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

Both commands passed during M1.2. A native framework standalone build is configured to prepare for eventual self-hosting. NAS packaging, static-asset copying, service configuration, backups, and deployment are still M5 work; `.next/standalone` by itself is not a complete deployed product.

### Repeatable self-check commands

Run `pnpm check` for TypeScript, behavioural model/Markdown/navigation tests, and the production build. With this project's server running at `127.0.0.1:3100`, run `pnpm check:smoke` in another terminal. The smoke script runs 16 checks covering the Home redirect, sample pages, task/filter/return query routes, prototype disclosure, filtered row count, task/editor markup and four HTTP 404 responses. Recovery-link rendering and clicks remain browser checks. The script exits nonzero on failure and uses no additional dependencies.

These HTTP checks do not execute client JavaScript, click controls, inspect layout, or replace the browser checklist below. Do not use them as a workaround for a denied browser check. Extend the checks as routes and behavior evolve.

Every task/session follows the required self-check loop in AGENTS.md: implement, inspect, run/test, review with design/UI skills, fix, confirm, reassess the next action, and record evidence. No daily or unattended automation is configured.

Next.js automatic agent-instruction generation is disabled in next.config.ts so development does not append generated guidance to the existing project AGENTS.md.

## Browser checks to finish M1.2

Run these once browser inspection is available, recording actual results in STATUS.md:

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

No phone hardware or phone software-keyboard behavior has been tested. All these boxes remain pending until supported browser/device testing succeeds.

## Source guide

| Location | Responsibility |
| --- | --- |
| `src/app/layout.tsx` | Shared document metadata and application shell |
| `src/app/[...segments]/page.tsx` | Validate and serve sample section/detail routes |
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
