import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobsLoop, jobsEnabled } from '../src/server/jobs-runtime.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('jobs runtime requires explicit enablement and is always off for prototype mode', () => {
  assert.equal(jobsEnabled({}), false);
  assert.equal(jobsEnabled({ WORKSPACE_JOBS_ENABLED: 'true' }), false);
  assert.equal(jobsEnabled({ WORKSPACE_JOBS_ENABLED: '1' }), true);
  assert.equal(jobsEnabled({ WORKSPACE_JOBS_ENABLED: '1', WORKSPACE_MODE: 'prototype' }), false);
});

test('jobs runtime never overlaps ticks and stops before closing its pool', async () => {
  let release,
    scheduled,
    calls = 0,
    closed = false,
    cancelled = false;
  const loop = createJobsLoop({
    run: () => {
      calls++;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    schedule: (callback, delay) => {
      assert.equal(delay, 30_000);
      scheduled = callback;
      return 1;
    },
    cancel: () => {
      cancelled = true;
    },
    close: async () => {
      closed = true;
    },
  });
  assert.equal(loop.status(), 'starting');
  assert.equal(scheduled, undefined);
  assert.equal(calls, 1);
  release();
  await flush();
  assert.equal(loop.status(), 'ready');
  scheduled();
  assert.equal(calls, 2);
  const stopped = loop.stop();
  assert.equal(closed, false);
  release();
  await stopped;
  assert.equal(cancelled, true);
  assert.equal(closed, true);
  assert.equal(loop.status(), 'unavailable');
  scheduled();
  assert.equal(calls, 2);
});

test('jobs runtime marks failures and stale ticks unavailable then recovers without leaking errors', async () => {
  let now = 0,
    scheduled,
    fail = true;
  const messages = [];
  const loop = createJobsLoop({
    run: async () => {
      if (fail) throw new Error('secret database/task details');
    },
    now: () => now,
    schedule: (callback) => {
      scheduled = callback;
      return 1;
    },
    cancel: () => {},
    log: (code) => messages.push(code),
  });
  await flush();
  assert.equal(loop.status(), 'unavailable');
  fail = false;
  scheduled();
  await flush();
  assert.equal(loop.status(), 'ready');
  now = 120_001;
  assert.equal(loop.status(), 'unavailable');
  scheduled();
  await flush();
  assert.equal(loop.status(), 'ready');
  loop.interrupted();
  assert.equal(loop.status(), 'unavailable');
  scheduled();
  await flush();
  assert.equal(loop.status(), 'ready');
  assert.deepEqual(messages, [
    'workspace_jobs_tick_failed',
    'workspace_jobs_recovered',
    'workspace_jobs_connection_interrupted',
    'workspace_jobs_recovered',
  ]);
  await loop.stop();
});
