'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { flushSync } from 'react-dom';
import type { SignedInAccount } from '@/server/auth';
import { useWorkspace } from './demo-provider';
import { useWork } from './work-provider';
import { Button } from './ui';

export function SessionBoundary({ account, children }: { account: SignedInAccount | null; children: ReactNode }) {
  const { resetDemo } = useWorkspace();
  const { clearDrafts, syncState } = useWork();
  const pathname = usePathname();
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);
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
          flushSync(() => { resetDemo(); clearDrafts(); });
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
  }, [account, pathname, resetDemo, clearDrafts, retry]);
  return <>{unavailable && syncState !== 'offline' && syncState !== 'expired' ? <div className="session-connection-notice" role="alert"><p>Connection unavailable. Your unsaved input remains in this tab. Close any open panel to retry; saved changes will appear after reconnecting.</p><Button onClick={() => setRetry(value=>value+1)}>Retry connection</Button></div> : null}{children}</>;
}

export function SignOutButton() {
  const { resetDemo } = useWorkspace();
  const { clearDrafts } = useWork();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error();
      flushSync(() => { resetDemo(); clearDrafts(); });
      window.location.replace('/sign-in');
    } catch { setError('Could not sign out. Check your connection and try again.'); setPending(false); }
  }
  return <><Button onClick={signOut} disabled={pending}>{pending ? 'Signing out…' : 'Sign out'}</Button>{error ? <p role="alert" className="auth-error">{error}</p> : null}</>;
}
