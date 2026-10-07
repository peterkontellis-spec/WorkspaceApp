# Local recovery checks

These commands create fictional local fixtures inside this project's ignored `.local` directory. They do not target the saved preview database, real attachments, NAS or external services. Existing installed tools are sufficient; no paid service or dependency download is involved. Keep fixture artifacts private because they contain generated test credentials and sessions.

## App process recovery

After building the app with `pnpm check`, run:

```sh
pnpm test:e2e --restart-check
```

The runner owns its fresh app/database/browser processes. It checks one timer in two tabs, closes the browser, abruptly kills only its app child, waits through downtime, starts a new app and browser, and verifies the original session/timer/start time. Stopping records exactly one entry with timestamp-derived totals. A second app restart must retain that completed entry unchanged.

Final run `.local/e2e/run-asMzWs`: four assertion groups passed, exit 0. Its `restart-evidence.json` records distinct app PIDs, elapsed seconds and results. The initial `.local/e2e/run-1SWYfG` also passed and includes a reviewed running-timer screenshot. All owned services stopped. This does not simulate OS power failure, a torn disk write or a NAS reboot.

## Cold physical database and file recovery

Run with the project's Node runtime:

```sh
node --test tests/database/restore.test.mjs
```

This case is also included in `pnpm test:db`. It creates its own fictional PostgreSQL cluster, shared workspace, separate outsider workspace, owner/editor/viewer accounts, tasks, timer/correction audit, a running timer and a synthetic attachment. It closes fixture connections and stops PostgreSQL cleanly before copying the database files, attachments and required authentication configuration into a backup and then a separate restore directory. The recovered cluster starts on a different loopback port.

Run `.local/tests/restore-ujjtCn`: one test passed, exit 0, 14.2 seconds, PostgreSQL 18.4. All 24 public-table fingerprints matched before recovery writes. Existing sessions and fresh login worked, role/own-time/cross-workspace restrictions held, downloaded attachment bytes matched exactly, and an authorized correction added the expected audit record. Source and backup copies remain retained under the ignored run directory; both disposable clusters stopped.

`pg_dump` and `pg_restore` are absent from the installed bundle. This is a real physical restore, not a logical dump/restore or SQL serialization substitute. It requires a clean shutdown and stopped writers, the same PostgreSQL major version and compatible platform/binaries. Database, files and required authentication configuration must come from one coordinated backup. This check does not select a production backup method or retention policy.

## Still required for release

- Choose and configure the NAS backup destination, schedule, retention and an offsite recovery copy.
- Validate encryption and access to production backup/configuration secrets.
- Repeat restore on the actual deployment platform, including durable Docs once implemented.
- Validate failure monitoring, operational diagnostics and the final publication security gate.

The local rehearsal establishes a working recovery mechanism. It does not complete M5.6 or prove a configured production backup job exists.
