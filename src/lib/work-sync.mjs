/** One read at a time; invalidation prevents even an abort-ignoring response from winning. */
export function createWorkSync({ read, onData, onError, onState, interval = 5_000, maxDelay = 30_000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let alive = true, started = false, visible = true, online = true, suspended = false, expired = false;
  let generation = 0, failures = 0, timer = null, active = null, queued = null;
  const available = () => alive && started && visible && online && !suspended && !expired;
  function stopTimer() { if (timer !== null) clearTimer(timer); timer = null; }
  function invalidate() { generation++; stopTimer(); active?.controller.abort(); }
  function settleQueue(value) { queued?.resolvers.forEach(resolve => resolve(value)); queued = null; }
  function schedule(delay) { stopTimer(); if (available()) timer = setTimer(() => { timer = null; void request(false); }, delay); }
  function pump() {
    if (active || !queued || !available()) return;
    const job = queued; queued = null;
    const controller = new AbortController(), token = generation;
    active = { controller };
    Promise.resolve().then(() => read(controller.signal)).then(data => {
      if (token !== generation || !available()) return false;
      failures = 0; onData(data, job.explicit); onState('current'); return true;
    }, error => {
      if (token !== generation || !available()) return false;
      if (error?.expired) { expired = true; stopTimer(); onState('expired'); settleQueue(false); }
      else { failures++; onState('offline'); }
      onError(error, job.explicit); return false;
    }).then(success => job.resolvers.forEach(resolve => resolve(Boolean(success)))).finally(() => {
      active = null;
      if (queued) pump();
      else schedule(Math.min(maxDelay, interval * 2 ** Math.min(failures, 10)));
    });
  }
  function request(explicit) {
    if (!available()) return Promise.resolve(false);
    stopTimer();
    return new Promise(resolve => {
      if (queued) { queued.explicit ||= explicit; queued.resolvers.push(resolve); }
      else queued = { explicit, resolvers: [resolve] };
      pump();
    });
  }
  return {
    start() { if (started || !alive) return; started = true; if (!online) onState('offline'); else if (visible) { onState('connecting'); void request(false); } },
    refresh() { if (!available()) return Promise.resolve(false); invalidate(); settleQueue(false); onState('connecting'); return request(true); },
    reconnect() { if (!available()) return; failures = 0; invalidate(); settleQueue(false); onState('connecting'); void request(false); },
    setAvailable(nextVisible, nextOnline) {
      const changed = visible !== nextVisible || online !== nextOnline;
      visible = nextVisible; online = nextOnline;
      if (!changed || !alive || expired) return;
      if (!available()) { invalidate(); settleQueue(false); if (!online) onState('offline'); }
      else { failures = 0; onState('connecting'); void request(false); }
    },
    suspend() { suspended = true; invalidate(); settleQueue(false); },
    resume() { suspended = false; schedule(interval); },
    expire() { expired = true; invalidate(); settleQueue(false); onState('expired'); },
    dispose() { alive = false; invalidate(); settleQueue(false); },
  };
}
