'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const NavigationMemory = createContext<Map<string, number> | null>(null);
export function NavigationMemoryProvider({ children }: { children: ReactNode }) {
  const positions = useRef(new Map<string, number>());
  return <NavigationMemory.Provider value={positions.current}>{children}</NavigationMemory.Provider>;
}

export function safeReturnPath(value: string | null): string | null {
  if (!value) return null;
  const [path] = value.split('?');
  return /^\/(home|boards(?:\/[a-z0-9-]+)?)$/.test(path) ? value : null;
}

export function useTaskNavigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const positions = useContext(NavigationMemory);
  const currentHref = pathname + (params.size ? `?${params.toString()}` : '');
  const taskId = params.get('task');
  useEffect(() => {
    const top = positions?.get(currentHref);
    if (top === undefined) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }));
    positions?.delete(currentHref);
    return () => cancelAnimationFrame(frame);
  }, [currentHref, positions]);
  function taskHref(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set('task', id);
    return `${pathname}?${next}`;
  }
  function closeTask() {
    const next = new URLSearchParams(params.toString());
    next.delete('task');
    router.replace(pathname + (next.size ? `?${next}` : ''), { scroll: false });
    requestAnimationFrame(() => {
      const trigger = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-task-id]')).find((el) => el.dataset.taskId === taskId);
      trigger?.focus({ preventScroll: true });
    });
  }
  function rememberOrigin() { positions?.set(currentHref, window.scrollY); }
  return { taskId, taskHref, closeTask, currentHref, rememberOrigin };
}
