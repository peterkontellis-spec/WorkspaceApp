# Saved attachments — M2.7

Owners and editors upload from a saved task’s Attachments section. All current staff workspace members, including viewers, can list and download its attachments. Files navigation and Go to show a workspace library with links back to tasks. Customer/private-admin storage is not part of this shared staff feature.

## Accepted files and behavior

- PDF, PNG, JPEG (`.jpg`/`.jpeg`), and UTF-8 `.txt`, `.md`, `.csv`; nonempty, up to **25 MiB (26,214,400 bytes)** each.
- Filenames are limited to 255 characters/UTF-8 bytes and reject path separators, control/bidirectional characters and unsafe names. Storage names are generated UUIDs, not user filenames.
- The server checks image/PDF signatures and end markers, or strict incremental UTF-8 and text controls. This is not full format parsing or malware scanning. The app neither renders nor executes uploaded content.
- Upload saves independently from task edits. Save or cancel a dirty task draft first. Leaving an open transfer aborts it; browser unload warnings remain unreliable on phones.
- After an uncertain response or cancellation, Refresh files before retrying and inspect whether the file already arrived. Uploads have no automatic retry or idempotency guarantee.
- Downloads require a current authenticated membership and use attachment/octet-stream, no-store, nosniff and restrictive response headers. No public storage URL exists.
- No delete/move/rename UI, inline previews, extraction, Office/archive uploads or general NAS folder access is included.

## Local storage and deployment configuration

`ATTACHMENT_ROOT` must be an absolute canonical directory path, private to the app's OS user. Configure it outside `public`, `.next` and build snapshots. `pnpm preview` sets it to this project's ignored `.local/attachments`; replacement preview builds reuse that folder. For local database development from the project root:

```sh
ATTACHMENT_ROOT="$PWD/.local/attachments" pnpm dev:db
```

Storage is created with directory mode 0700 and files with mode 0600. The service rejects symlinked/unsafe roots and unsafe file descriptors; uploads use exclusive temporary files, generated identifiers and file/directory synchronization. Runtime filesystem paths are excluded from build tracing. Do not place this directory in a web server's public root or configure a broad NAS share. NAS volumes, service identity and release configuration remain M5 work.

At most two uploads run per server process, with immediate rejection instead of a waiting queue. Reads have a 15-second idle limit and a 120-second total upload-read deadline; downloads have a 120-second lifetime. Data streams in bounded chunks without buffering whole files or holding a database connection throughout upload. Identity, membership, role and task access are rechecked under the workspace lock before metadata is committed. Existing schema migration 001's attachment table is used; no migration or dependency was added.

Ordinary failed/interrupted uploads clean temporary files. A process crash or uncertain database commit can leave an inaccessible orphan blob. If commit success is uncertain, bytes are deliberately retained rather than risking a saved record pointing to a deleted file. Orphan cleanup tooling is not implemented. Future cleanup must compare stable database metadata with storage and preserve in-progress/uncertain files. Database and attachment-directory backups/restores must be coordinated; Git checkpoints do not back up either.

## API and checks

- `GET /api/files` or `GET /api/files?taskId=<uuid>` lists authorized metadata.
- `POST /api/files?taskId=<uuid>` accepts a raw body, `Content-Type: application/octet-stream`, URL-encoded `X-Upload-Name`, and the configured same Origin.
- `GET /api/files/<uuid>` streams an authorized download.

`tests/database/files.test.mjs` uses an isolated loopback PostgreSQL cluster. Run with the configured Node runtime:

```sh
node --test --test-concurrency=1 tests/database/files.test.mjs
```

STATUS.md records actual server, browser, restart and design checks. Focused source review here does not replace the required Cloudflare pre-publication audit or establish NAS performance.

## Archived work

Task/board archive preserves attachment bytes and metadata. Current authorized members can still list/download attachments through historical task details, while the general active Files library excludes them. Archived tasks reject new uploads. Upload completion rechecks that both task and board remain active and that the task revision still matches the upload's opening revision; an intervening change rejects the upload safely and requests a retry. Archive/restore is not attachment deletion, backup or a purge policy.
