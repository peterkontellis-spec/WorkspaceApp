import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkSync } from '../src/lib/work-sync.mjs';

const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness() {
  let now = 0, sequence = 0;
  const timers = new Map(), reads = [], received = [], errors = [], states = [];
  const sync = createWorkSync({
    read(signal) { return new Promise((resolve, reject) => reads.push({ signal, resolve, reject })); },
    onData(data, explicit) { received.push({ data, explicit }); },
    onError(error, explicit) { errors.push({ error, explicit }); },
    onState(state) { states.push(state); },
    setTimer(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimer(id) { timers.delete(id); },
  });
  async function advance(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
    await tick();
  }
  return { sync, reads, received, errors, states, timers, advance, nextDelay: () => Math.min(...[...timers.values()].map(t => t.at - now)) };
}

test('polls after completion at five seconds, with one request at a time', async () => {
  const h = harness(); h.sync.start(); await tick();
  assert.equal(h.reads.length, 1);
  await h.advance(60_000); assert.equal(h.reads.length, 1);
  h.reads[0].resolve({ revision: 1 }); await tick();
  assert.deepEqual(h.received, [{ data: { revision: 1 }, explicit: false }]);
  await h.advance(4_999); assert.equal(h.reads.length, 1);
  await h.advance(1); assert.equal(h.reads.length, 2);
  h.sync.dispose();
});

test('transient errors use bounded exponential backoff and recover', async () => {
  const h = harness(); h.sync.start(); await tick();
  for (const delay of [10_000, 20_000, 30_000, 30_000]) {
    h.reads.at(-1).reject(new Error('disconnected')); await tick();
    assert.equal(h.nextDelay(), delay); assert.equal(h.states.at(-1), 'offline');
    await h.advance(delay);
  }
  h.reads.at(-1).resolve('fresh'); await tick();
  assert.equal(h.states.at(-1), 'current'); assert.equal(h.nextDelay(), 5_000);
  assert.ok(h.errors.every(error => error.explicit === false)); h.sync.dispose();
});

test('hidden/offline cancel reads and resume immediately without accepting stale replies', async () => {
  const h = harness(); h.sync.start(); await tick();
  h.sync.setAvailable(false, true); assert.equal(h.reads[0].signal.aborted, true);
  h.reads[0].resolve('obsolete'); await tick();
  assert.deepEqual(h.received, []); assert.equal(h.timers.size, 0);
  await h.advance(60_000); assert.equal(h.reads.length, 1);
  h.sync.setAvailable(true, false); assert.equal(h.states.at(-1), 'offline');
  h.sync.setAvailable(true, true); await tick(); assert.equal(h.reads.length, 2);
  h.reads[1].resolve('reconnected'); await tick(); assert.equal(h.received[0].data, 'reconnected');
  h.sync.dispose();
});

test('explicit refresh cancels obsolete reads and waits for their settlement', async () => {
  const h = harness(); h.sync.start(); await tick();
  const refresh = h.sync.refresh(); await tick();
  assert.equal(h.reads[0].signal.aborted, true); assert.equal(h.reads.length, 1);
  h.reads[0].resolve('old'); await tick(); assert.equal(h.reads.length, 2);
  assert.deepEqual(h.received, []);
  h.reads[1].resolve('manual'); await tick();
  assert.equal(await refresh, true); assert.deepEqual(h.received, [{ data: 'manual', explicit: true }]);
  h.sync.dispose();
});

test('save suspension invalidates old reads; resumption only fetches after the save', async () => {
  const h = harness(); h.sync.start(); await tick(); h.sync.suspend();
  h.reads[0].resolve('before save'); await tick();
  await h.advance(30_000); assert.equal(h.reads.length, 1); assert.equal(await h.sync.refresh(), false);
  assert.deepEqual(h.received, []);
  h.sync.resume(); await h.advance(5_000); assert.equal(h.reads.length, 2);
  h.reads[1].resolve('after save'); await tick(); assert.equal(h.received[0].data, 'after save');
  h.sync.dispose();
});

test('reconnect resets backoff and coalesces rapid focus/reconnect requests', async () => {
  const h = harness(); h.sync.start(); await tick(); h.reads[0].reject(new Error('network')); await tick();
  h.sync.reconnect(); await tick(); assert.equal(h.reads.length, 2);
  h.sync.reconnect(); h.sync.reconnect(); await tick(); assert.equal(h.reads.length, 2);
  h.reads[1].resolve('stale'); await tick(); assert.equal(h.reads.length, 3);
  h.reads[2].resolve('latest'); await tick(); assert.deepEqual(h.received, [{ data: 'latest', explicit: false }]);
  assert.equal(h.nextDelay(), 5_000); h.sync.dispose();
});

test('expired session stops retrying, including focus, refresh and save resumption', async () => {
  const h = harness(); h.sync.start(); await tick();
  h.reads[0].reject(Object.assign(new Error('revoked'), { expired: true })); await tick();
  assert.equal(h.states.at(-1), 'expired'); assert.equal(h.errors.length, 1);
  h.sync.reconnect(); h.sync.setAvailable(false, false); h.sync.setAvailable(true, true); h.sync.resume();
  assert.equal(await h.sync.refresh(), false); await h.advance(60_000);
  assert.equal(h.reads.length, 1); assert.equal(h.timers.size, 0); h.sync.dispose();
});

test('unmount cancels pending explicit refresh and ignores abort-ignoring responses', async () => {
  const h = harness(); h.sync.start(); await tick(); const refresh = h.sync.refresh();
  h.sync.dispose(); assert.equal(await refresh, false);
  h.reads[0].resolve('late'); await tick();
  assert.equal(h.reads[0].signal.aborted, true); assert.deepEqual(h.received, []); assert.equal(h.timers.size, 0);
});

test('an initially hidden or offline page fetches only when it becomes available', async () => {
  const h = harness(); h.sync.setAvailable(false, false); h.sync.start(); await tick();
  assert.equal(h.reads.length, 0); assert.equal(h.states.at(-1), 'offline');
  h.sync.setAvailable(true, true); await tick(); assert.equal(h.reads.length, 1); h.sync.dispose();
});
