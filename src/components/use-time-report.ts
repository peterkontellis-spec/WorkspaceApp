'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkSync, type WorkSync, type WorkSyncState } from '@/lib/work-sync.mjs';
import type { TimeEntry, TimeReport } from '@/lib/time';
import { useWork } from './work-provider';

export function useTimeReport(query: string, actorId: string) {
  const work = useWork();
  const refreshWork = work.refresh;
  const [report, setReport] = useState<TimeReport | null>(null);
  const [readError, setReadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<WorkSyncState>('connecting');
  const sync = useRef<WorkSync | null>(null);
  const writing = useRef(false);
  const generation = useRef(0);
  const writeRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const version = ++generation.current;
    const coordinator = createWorkSync<TimeReport>({
      read: async (signal) => {
        const response = await fetch(`/api/time?${query}`, {
          cache: 'no-store',
          signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        });
        const value = await response.json();
        if (
          response.status === 401 ||
          response.status === 403 ||
          (response.ok && value.actor?.id !== actorId)
        ) {
          throw Object.assign(new Error('Your access changed. Sign in again to load time entries.'), {
            expired: true,
          });
        }
        if (!response.ok) throw new Error(value.error || 'Time entries could not be loaded. Try Refresh.');
        return value;
      },
      onData: (value) => {
        if (generation.current === version) {
          setReport(value);
          setReadError('');
        }
      },
      onError: (failure) => {
        if (generation.current === version) {
          if ((failure as { expired?: boolean })?.expired) setReport(null);
          setReadError(failure instanceof Error ? failure.message : 'Time entries could not be loaded.');
        }
      },
      onState: setState,
    });
    sync.current = coordinator;
    const availability = () =>
      coordinator.setAvailable(document.visibilityState !== 'hidden', navigator.onLine);
    const reconnect = () => {
      availability();
      coordinator.reconnect();
    };
    availability();
    coordinator.start();
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', availability);
    window.addEventListener('focus', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    return () => {
      generation.current++;
      writeRequest.current?.abort();
      coordinator.dispose();
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', availability);
      window.removeEventListener('focus', reconnect);
      document.removeEventListener('visibilitychange', reconnect);
    };
  }, [query, actorId]);
  const refresh = useCallback(() => sync.current?.refresh(), []);
  const mutate = useCallback(
    async (payload: object): Promise<TimeEntry | null> => {
      if (writing.current || state === 'expired') return null;
      writing.current = true;
      setPending(true);
      setError('');
      setNotice('');
      const version = generation.current;
      const coordinator = sync.current;
      coordinator?.suspend();
      const controller = new AbortController();
      writeRequest.current = controller;
      try {
        const response = await fetch('/api/time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        const value = await response.json();
        if (generation.current !== version) return null;
        if (response.status === 401 || response.status === 403) {
          setReport(null);
          coordinator?.expire();
        }
        if (!response.ok) throw new Error(value.error || 'Time could not be saved. Your input is kept here.');
        setNotice('Time saved.');
        coordinator?.resume();
        await Promise.all([coordinator?.refresh(), refreshWork()]);
        return generation.current === version ? value.entry : null;
      } catch (failure) {
        if (generation.current === version && !controller.signal.aborted)
          setError(
            failure instanceof Error && !['TypeError', 'TimeoutError'].includes(failure.name)
              ? failure.message
              : 'Save could not be confirmed. Your input is kept. Reconnect and check the list before retrying.',
          );
        return null;
      } finally {
        coordinator?.resume();
        writing.current = false;
        if (generation.current === version) setPending(false);
      }
    },
    [state, refreshWork],
  );
  return { report, error: error || readError, notice, pending, state, refresh, mutate };
}
