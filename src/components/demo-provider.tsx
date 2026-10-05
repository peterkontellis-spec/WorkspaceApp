'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDemoTask, createDemoState, patchDemoDocument, patchDemoTask, type DemoDocument, type DemoTask } from '@/lib/demo-state';

type WorkspaceContextValue = {
  drafts: Record<string, string>;
  setDraft: (key: string, value: string | null) => void;
  tasks: DemoTask[];
  documents: DemoDocument[];
  updateTask: (id: string, patch: Partial<DemoTask>) => string | null;
  addTask: (boardId: string, group: DemoTask['group'], title: string) => string | null;
  updateDocument: (id: string, patch: Partial<DemoDocument>) => void;
  resetDemo: () => void;
  emptyDemo: boolean;
  setEmptyDemo: (value: boolean) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createDemoState);
  // Event handlers need the latest accepted state and synchronous validation errors,
  // including when multiple edits happen before React's next render.
  const stateRef = useRef(state);
  const initialState = useRef(state);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const setDraft = useCallback((key: string, value: string | null) => {
    setDrafts((current) => { const next = { ...current }; if (value === null) delete next[key]; else next[key] = value; return next; });
  }, []);
  const hasSessionChanges = state !== initialState.current || Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!hasSessionChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasSessionChanges]);
  const [emptyDemo, setEmptyDemo] = useState(false);

  const updateTask = useCallback((id: string, patch: Partial<DemoTask>) => {
    const result = patchDemoTask(stateRef.current, id, patch);
    if (!result.error) {
      stateRef.current = result.state;
      setState(result.state);
    }
    return result.error;
  }, []);

  const addTask = useCallback((boardId: string, group: DemoTask['group'], title: string) => {
    const result = addDemoTask(stateRef.current, boardId, group, title);
    if (!result.error) {
      stateRef.current = result.state;
      setState(result.state);
    }
    return result.error;
  }, []);

  const updateDocument = useCallback((id: string, patch: Partial<DemoDocument>) => {
    const next = patchDemoDocument(stateRef.current, id, patch);
    stateRef.current = next;
    setState(next);
  }, []);

  const resetDemo = useCallback(() => {
    const next = createDemoState();
    stateRef.current = next;
    setState(next);
    initialState.current = next;
    setDrafts({});
    setEmptyDemo(false);
  }, []);

  const value = useMemo(() => ({ ...state, drafts, setDraft, updateTask, addTask, updateDocument, resetDemo, emptyDemo, setEmptyDemo }), [state, drafts, setDraft, updateTask, addTask, updateDocument, resetDemo, emptyDemo]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return context;
}
