'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { flushSync } from 'react-dom';
import type { SignedInAccount } from '@/server/auth';
import { useWorkspace } from './demo-provider';
import { Button } from './ui';

export function SessionBoundary({ account, children }: { account: SignedInAccount | null; children: ReactNode }) {
  const { resetDemo } = useWorkspace();
  const pathname = usePathname();
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    let checking = false;
    let activity = false;
    const markActivity = () => { activity = true; };
    const verify = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const response = await fetch('/api/account', { method: activity ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        activity = false;
        if (response.status === 401 || (response.ok && (await response.json()).account.id !== account.id)) {
          flushSync(() => resetDemo());
          window.location.replace('/sign-in');
        } else setUnavailable(!response.ok);
      } catch { if (!controller.signal.aborted) setUnavailable(true); }
      finally { checking = false; }
    };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); else void verify(); };
    void verify();
    const interval = window.setInterval(verify, 60_000);
    document.addEventListener('pointerdown', markActivity, { passive: true });
    document.addEventListener('keydown', markActivity);
    window.addEventListener('focus', verify);
    window.addEventListener('pageshow', restored);
    document.addEventListener('visibilitychange', verify);
    return () => { controller.abort(); document.removeEventListener('pointerdown', markActivity); document.removeEventListener('keydown', markActivity); window.clearInterval(interval); window.removeEventListener('focus', verify); window.removeEventListener('pageshow', restored); document.removeEventListener('visibilitychange', verify); };
  }, [account, pathname, resetDemo]);
  if (unavailable) return <main className="auth-page"><div className="auth-card"><h1>Connection unavailable</h1><p className="auth-copy" role="alert">We cannot verify your session right now. Your sample edits remain in this tab. Reconnecting will restore the view.</p><Button onClick={() => window.location.reload()}>Reload and clear sample edits</Button></div></main>;
  return children;
}

export function SignOutButton() {
  const { resetDemo } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error();
      flushSync(() => resetDemo());
      window.location.replace('/sign-in');
    } catch { setError('Could not sign out. Check your connection and try again.'); setPending(false); }
  }
  return <><Button onClick={signOut} disabled={pending}>{pending ? 'Signing out…' : 'Sign out'}</Button>{error ? <p role="alert" className="auth-error">{error}</p> : null}</>;
}
