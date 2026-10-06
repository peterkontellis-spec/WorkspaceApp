'use client';
import Link from 'next/link';
import { useWork } from './work-provider';
import { Button } from './ui';
import './work-sync-status.css';

export function WorkSyncStatus() {
  const { enabled, syncState, unavailable, loading, pending, refresh } = useWork();
  const interrupted = syncState === 'offline' || (syncState === 'connecting' && unavailable);
  if (!enabled || (!interrupted && syncState !== 'expired')) return null;
  return (
    <div className="work-sync-status" role="status">
      {syncState === 'expired' ? (
        <>
          <p>Your session ended. Sign in to load your workspace again.</p>
          <Link className="text-link" href="/sign-in">
            Sign in
          </Link>
        </>
      ) : (
        <>
          <p>
            Updates paused. Displayed tasks may be out of date; your unsaved input is still in this tab. We’ll
            retry automatically.
          </p>
          <Button disabled={loading || pending} onClick={() => void refresh()}>
            {loading ? 'Checking…' : 'Retry updates'}
          </Button>
        </>
      )}
    </div>
  );
}
