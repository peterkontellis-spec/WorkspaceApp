'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { WorkSnapshot } from '@/lib/work';

type WorkContext = { enabled: boolean; clearDrafts: () => void; drafts: Record<string,unknown>; setDraft: (key:string,value:unknown|null)=>void; data: WorkSnapshot | null; loading: boolean; unavailable: boolean; pending: boolean; error: string; notice: string; conflict: boolean; clearError: () => void; refresh: () => Promise<boolean>; save: (payload: object) => Promise<boolean> };
const Context = createContext<WorkContext | null>(null);
export function WorkProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [drafts,setDrafts] = useState<Record<string,unknown>>({});
  const clearDrafts = useCallback(()=>setDrafts({}),[]);
  const setDraft = useCallback((key:string,value:unknown|null)=>setDrafts(current=>{const next={...current};if(value===null)delete next[key];else next[key]=value;return next;}),[]);
  useEffect(()=>{if(!Object.keys(drafts).length)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[drafts]);
  const [data, setData] = useState<WorkSnapshot | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const clearError = useCallback(() => { setError(''); setConflict(false); setNotice(''); }, []);
  const refresh = useCallback(async () => {
    if (!enabled || busy.current) return false;
    const requestGeneration = ++generation.current;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/work', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session ended. Sign in again.' : 'Could not load saved work. Check your connection and retry.');
      const snapshot = await response.json(); if (requestGeneration !== generation.current) return false;
      setData(snapshot); setUnavailable(false); setConflict(false); return true;
    } catch (e) { if (requestGeneration !== generation.current) return false; setUnavailable(true); setError(e instanceof Error ? e.message : 'Could not load saved work. Retry shortly.'); return false; }
    finally { if (requestGeneration === generation.current) setLoading(false); }
  }, [enabled]);
  useEffect(() => { void refresh(); }, [refresh]);
  const save = useCallback(async (payload: object) => {
    if (busy.current || !enabled) return false;
    generation.current++; busy.current = true; setLoading(false); setPending(true); setError(''); setConflict(false); setNotice('');
    try {
      const response = await fetch('/api/work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) {
        setConflict(response.status === 409 && Boolean(result.conflict));
        throw new Error(response.status === 401 ? 'Your session ended. Sign in again before saving.' : response.status === 403 ? 'Your role cannot save this change. Ask an owner for editing access.' : result.error || 'Could not save. Your draft is still here; try again.');
      }
      setData(result); setUnavailable(false); setNotice('Saved to workspace.'); return true;
    } catch (e) { setError(e instanceof Error && !(e instanceof DOMException) && !(e instanceof TypeError) ? e.message : 'Could not confirm the save. Your draft is still here. Reconnect and reload saved work before retrying; the request may have reached the server.'); return false; }
    finally { busy.current = false; setPending(false); }
  }, [enabled]);
  const value = useMemo(() => ({ enabled, clearDrafts, drafts, setDraft, data, loading, unavailable, pending, error, notice, conflict, clearError, refresh, save }), [enabled,clearDrafts,drafts,setDraft,data,loading,unavailable,pending,error,notice,conflict,clearError,refresh,save]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWork() { const value=useContext(Context); if (!value) throw new Error('WorkProvider required.'); return value; }
