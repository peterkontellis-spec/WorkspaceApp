// A process-local runner; durable ownership and deduplication live in jobs-core.
// No task contents, connection strings or raw database errors enter these logs.
const stateKey = Symbol.for('workspace.jobs.runtime');
const intervalMs = 30_000;
const staleMs = 120_000;

export function jobsEnabled(env = process.env) {
  return env.WORKSPACE_JOBS_ENABLED === '1' && env.WORKSPACE_MODE !== 'prototype';
}

export function createJobsLoop({
  run,
  close = async () => {},
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
  log = (code) => console.error(code),
}) {
  const state = { startedAt: now(), lastSuccess: null, failed: false, stopped: false };
  let timer, flight;
  async function tick() {
    if (state.stopped) return;
    try {
      await run();
      state.lastSuccess = now();
      if (state.failed) log('workspace_jobs_recovered');
      state.failed = false;
    } catch {
      state.failed = true;
      log('workspace_jobs_tick_failed');
    } finally {
      if (!state.stopped) {
        timer = schedule(() => {
          flight = tick();
        }, intervalMs);
        timer?.unref?.();
      }
    }
  }
  flight = tick();
  return {
    state,
    status() {
      if (state.stopped || state.failed || now() - (state.lastSuccess ?? state.startedAt) > staleMs)
        return 'unavailable';
      return state.lastSuccess === null ? 'starting' : 'ready';
    },
    async stop() {
      state.stopped = true;
      cancel(timer);
      await flight;
      await close();
    },
    interrupted() {
      state.failed = true;
      log('workspace_jobs_connection_interrupted');
    },
  };
}

export async function startJobs() {
  if (!jobsEnabled() || globalThis[stateKey]) return;
  const runtime = { controller: null, failed: false };
  globalThis[stateKey] = runtime;
  try {
    if (!process.env.DATABASE_URL) throw new Error('Missing jobs database configuration.');
    const [{ default: pg }, { runJobs }] = await Promise.all([import('pg'), import('./jobs-core.mjs')]);
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
      lock_timeout: 3000,
      application_name: 'workspace-jobs',
    });
    runtime.controller = createJobsLoop({
      run: async () => {
        const result = await runJobs(pool);
        if (
          result.delivered ||
          result.retried ||
          result.failed ||
          result.recurrenceCreated ||
          result.recurrenceRetried ||
          result.recurrenceFailed
        )
          console.info('workspace_jobs_batch', {
            delivered: result.delivered,
            retried: result.retried,
            failed: result.failed,
            recurrenceCreated: result.recurrenceCreated,
            recurrenceRetried: result.recurrenceRetried,
            recurrenceFailed: result.recurrenceFailed,
          });
        // Exhausted work remains an operational failure until an operator fixes it.
        const failed = await pool.query(
          "SELECT 1 FROM task_reminder_job WHERE state='failed' UNION ALL SELECT 1 FROM task_recurrence WHERE attempts>=5 LIMIT 1",
        );
        if (failed.rowCount) throw new Error('Exhausted background jobs.');
      },
      close: () => pool.end(),
    });
    pool.on('error', () => runtime.controller.interrupted());
    for (const signal of ['SIGTERM', 'SIGINT'])
      process.once(signal, () => {
        void runtime.controller.stop();
      });
  } catch {
    runtime.failed = true;
    console.error('workspace_jobs_start_failed');
  }
}

export function jobsStatus() {
  if (!jobsEnabled()) return 'disabled';
  const runtime = globalThis[stateKey];
  if (!runtime || runtime.failed || !runtime.controller) return 'unavailable';
  return runtime.controller.status();
}
