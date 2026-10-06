'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { WorkSnapshot } from '@/lib/work';
import { createWorkSync, type WorkSync, type WorkSyncState } from '@/lib/work-sync.mjs';

type WorkContext = {
  enabled: boolean;
  clearDrafts: () => void;
  drafts: Record<string, unknown>;
  setDraft: (key: string, value: unknown | null) => void;
  data: WorkSnapshot | null;
  loading: boolean;
  unavailable: boolean;
  pending: boolean;
  error: string;
  notice: string;
  conflict: boolean;
  syncState: WorkSyncState;
  lastSyncedAt: number | null;
  clearError: () => void;
  refresh: () => Promise<boolean>;
  save: (payload: object) => Promise<boolean>;
};
const Context = createContext<WorkContext | null>(null);
const sessionEnded = () =>
  Object.assign(new Error('Your session ended or changed. Sign in again.'), { expired: true });
const isExpired = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'expired' in error && error.expired);
export function WorkProvider({
  enabled,
  expectedAccountId,
  children,
}: {
  enabled: boolean;
  expectedAccountId?: string;
  children: ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const clearDrafts = useCallback(() => setDrafts({}), []);
  const setDraft = useCallback(
    (key: string, value: unknown | null) =>
      setDrafts((current) => {
        const next = { ...current };
        if (value === null) delete next[key];
        else next[key] = value;
        return next;
      }),
    [],
  );
  useEffect(() => {
    if (!Object.keys(drafts).length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drafts]);
  const [data, setData] = useState<WorkSnapshot | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const [syncState, setSyncState] = useState<WorkSyncState>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const busy = useRef(false);
  const sync = useRef<WorkSync | null>(null);
  const expired = useRef(false);
  const fingerprint = useRef('');
  const saveController = useRef<AbortController | null>(null);
  const clearError = useCallback(() => {
    setError('');
    setConflict(false);
    setNotice('');
  }, []);
  const acceptSnapshot = useCallback((snapshot: WorkSnapshot) => {
    const next = JSON.stringify(snapshot);
    if (next !== fingerprint.current) {
      fingerprint.current = next;
      setData(snapshot);
    }
    setLastSyncedAt(Date.now());
    setUnavailable(false);
    setLoading(false);
  }, []);
  const expire = useCallback(() => {
    expired.current = true;
    sync.current?.expire();
    saveController.current?.abort();
    fingerprint.current = '';
    setData(null);
    setDrafts({});
    setLoading(false);
    setUnavailable(true);
    setNotice('');
    setConflict(false);
    setLastSyncedAt(null);
    setError('Your session ended or changed. Sign in again.');
  }, []);
  useEffect(() => {
    if (!enabled) return;
    expired.current = false;
    const coordinator = createWorkSync<WorkSnapshot>({
      read: async (signal) => {
        const response = await fetch('/api/work', {
          cache: 'no-store',
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        });
        if (response.status === 401 || response.status === 403) throw sessionEnded();
        if (!response.ok) throw new Error('Could not load saved work. Check your connection and retry.');
        const snapshot: WorkSnapshot = await response.json();
        if (snapshot.actor?.id !== expectedAccountId) throw sessionEnded();
        return snapshot;
      },
      onData: (snapshot, explicit) => {
        acceptSnapshot(snapshot);
        if (explicit) {
          setError('');
          setConflict(false);
        }
      },
      onError: (failure, explicit) => {
        if (isExpired(failure)) {
          expire();
          return;
        }
        setLoading(false);
        setUnavailable(true);
        if (explicit)
          setError(failure instanceof Error ? failure.message : 'Could not load saved work. Retry shortly.');
      },
      onState: (state) => {
        setSyncState(state);
        if (state === 'offline') {
          setLoading(false);
          setUnavailable(true);
        }
      },
    });
    sync.current = coordinator;
    const availability = () =>
      coordinator.setAvailable(document.visibilityState !== 'hidden', navigator.onLine);
    const focus = () => {
      if (document.visibilityState !== 'hidden' && navigator.onLine) coordinator.reconnect();
    };
    availability();
    coordinator.start();
    document.addEventListener('visibilitychange', availability);
    window.addEventListener('online', availability);
    window.addEventListener('offline', availability);
    window.addEventListener('focus', focus);
    return () => {
      coordinator.dispose();
      saveController.current?.abort();
      sync.current = null;
      document.removeEventListener('visibilitychange', availability);
      window.removeEventListener('online', availability);
      window.removeEventListener('offline', availability);
      window.removeEventListener('focus', focus);
    };
  }, [enabled, expectedAccountId, acceptSnapshot, expire]);
  const refresh = useCallback(async () => {
    if (!enabled || busy.current || expired.current || !sync.current) return false;
    setLoading(true);
    setError('');
    const success = await sync.current.refresh();
    setLoading(false);
    return success;
  }, [enabled]);
  const save = useCallback(
    async (payload: object) => {
      if (busy.current || !enabled || expired.current) return false;
      const coordinator = sync.current;
      coordinator?.suspend();
      busy.current = true;
      setLoading(false);
      setPending(true);
      setError('');
      setConflict(false);
      setNotice('');
      const controller = new AbortController();
      saveController.current = controller;
      try {
        const response = await fetch('/api/work', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        });
        if (response.status === 401) throw sessionEnded();
        const result = await response.json();
        if (controller.signal.aborted || expired.current) return false;
        if (!response.ok) {
          setConflict(response.status === 409 && Boolean(result.conflict));
          throw new Error(
            response.status === 403
              ? 'Your role cannot save this change. Ask an owner for editing access.'
              : result.error || 'Could not save. Your draft is still here; try again.',
          );
        }
        if (result.actor?.id !== expectedAccountId) throw sessionEnded();
        acceptSnapshot(result);
        setSyncState('current');
        setNotice('Saved to workspace.');
        return true;
      } catch (e) {
        if (isExpired(e)) expire();
        else if (!controller.signal.aborted && !expired.current)
          setError(
            e instanceof Error && !(e instanceof DOMException) && !(e instanceof TypeError)
              ? e.message
              : 'Could not confirm the save. Your draft is still here. Reconnect and reload saved work before retrying; the request may have reached the server.',
          );
        return false;
      } finally {
        busy.current = false;
        setPending(false);
        saveController.current = null;
        if (!expired.current) coordinator?.resume();
      }
    },
    [enabled, expectedAccountId, acceptSnapshot, expire],
  );
  const value = useMemo(
    () => ({
      enabled,
      clearDrafts,
      drafts,
      setDraft,
      data,
      loading,
      unavailable,
      pending,
      error,
      notice,
      conflict,
      syncState,
      lastSyncedAt,
      clearError,
      refresh,
      save,
    }),
    [
      enabled,
      clearDrafts,
      drafts,
      setDraft,
      data,
      loading,
      unavailable,
      pending,
      error,
      notice,
      conflict,
      syncState,
      lastSyncedAt,
      clearError,
      refresh,
      save,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWork() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkProvider required.');
  return value;
}
