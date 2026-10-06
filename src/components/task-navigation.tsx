'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { updateTaskQuery } from '@/lib/navigation';

const NavigationMemory = createContext<Map<string, number> | null>(null);
export function NavigationMemoryProvider({ children }: { children: ReactNode }) {
  const positions = useRef(new Map<string, number>());
  return <NavigationMemory.Provider value={positions.current}>{children}</NavigationMemory.Provider>;
}

export { safeReturnPath } from '@/lib/navigation';

export function useTaskNavigation(restoreScroll = false) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const positions = useContext(NavigationMemory);
  const currentHref = pathname + (params.size ? `?${params.toString()}` : '');
  const taskId = params.get('task');
  const previousTask = useRef<string | null>(null);
  useEffect(() => {
    if (!restoreScroll) return;
    const closedTask = previousTask.current;
    previousTask.current = taskId;
    if (taskId || !closedTask) return;
    const frame = requestAnimationFrame(() => {
      const trigger = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-task-id]')).find((el) => el.dataset.taskId === closedTask && el.getClientRects().length > 0);
      (trigger ?? document.getElementById('main-content'))?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [taskId, restoreScroll]);
  useEffect(() => {
    if (!restoreScroll) return;
    const top = positions?.get(currentHref);
    if (top === undefined) return;
    // History can revisit this origin more than once (Back → Forward → Back to task).
    // Keep it until a fresh task-opening click records the user's current position.
    const frame = requestAnimationFrame(() => { window.scrollTo({ top, behavior: 'instant' }); });
    return () => cancelAnimationFrame(frame);
  }, [currentHref, positions, restoreScroll]);
  function taskHref(id: string) { return updateTaskQuery(pathname, params.toString(), id); }
  function closeTask() { router.replace(updateTaskQuery(pathname, params.toString(), null), { scroll: false }); }
  function rememberOrigin(id?: string) { positions?.set(id ? taskHref(id) : currentHref, window.scrollY); }
  return { taskId, taskHref, closeTask, currentHref, rememberOrigin };
}
