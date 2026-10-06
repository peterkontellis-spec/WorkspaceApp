'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from './ui';
import './auth.css';

type Invitation = { email: string; role: string; workspaceName: string; existingAccount: boolean };
export function InvitationForm({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [complete, setComplete] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const busy = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (complete) successRef.current?.focus();
  }, [complete]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (!token) throw new Error('This invitation link is incomplete. Ask the owner for a new link.');
        const response = await fetch(`/api/invitations?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        if (!response.ok)
          throw new Error(
            response.status >= 500
              ? 'Invitations are temporarily unavailable. Try again shortly.'
              : 'This invitation is expired, cancelled or already used. Ask the owner for a new link.',
          );
        setInvitation(await response.json());
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Could not load this invitation. Retry shortly.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [token, attempt]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !invitation) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    setError('');
    if (!invitation.existingAccount && password !== data.get('confirmPassword')) {
      setMismatch(true);
      confirmRef.current?.focus();
      return;
    }
    setMismatch(false);
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          ...(!invitation.existingAccount ? { name: String(data.get('name') ?? '').trim() } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Too many attempts. Wait a few minutes and try again.'
            : result.error || 'Could not join. Check your details or ask the owner for a new invitation.',
        );
      form.reset();
      setVisible(false);
      setComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join. Check your connection and try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">Workspace</p>
        {complete ? (
          <div className="auth-result">
            <h1 ref={successRef} tabIndex={-1} className="auth-heading">
              You’re on the team
            </h1>
            <p className="auth-copy">
              Your membership is saved. Sign in with {invitation?.email} to open the workspace.
            </p>
            <Link href="/sign-in" className="button button--primary auth-submit">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <h1>Join the workspace</h1>
            {loading ? (
              <p className="auth-copy" role="status">
                Checking invitation…
              </p>
            ) : null}
            {invitation ? (
              <>
                <p className="auth-copy">
                  You’re invited to {invitation.workspaceName} as{' '}
                  {invitation.role === 'owner'
                    ? 'an owner'
                    : invitation.role === 'editor'
                      ? 'an editor'
                      : 'a viewer'}
                  .
                </p>
                <p className="auth-copy">
                  <strong>{invitation.email}</strong>
                </p>
                <p className="auth-copy">
                  {invitation.existingAccount
                    ? 'Use your existing password to restore access. Your account password will stay the same.'
                    : 'Create your account to accept this invitation. The link can only be used once.'}
                </p>
                <noscript>
                  <p role="alert">
                    JavaScript is required to use account services. Enable it and reload this page.
                  </p>
                </noscript>
                <form method="post" className="auth-form" onSubmit={submit} aria-busy={pending}>
                  <input type="hidden" name="email" value={invitation.email} autoComplete="username" />
                  {!invitation.existingAccount ? (
                    <div className="auth-field">
                      <label htmlFor="join-name">Your name</label>
                      <input
                        id="join-name"
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={120}
                        readOnly={pending}
                      />
                    </div>
                  ) : null}
                  <div className="auth-field">
                    <label htmlFor="join-password">
                      {invitation.existingAccount ? 'Current password' : 'Password'}
                    </label>
                    <div className="auth-password">
                      <input
                        id="join-password"
                        name="password"
                        type={visible ? 'text' : 'password'}
                        autoComplete={invitation.existingAccount ? 'current-password' : 'new-password'}
                        minLength={invitation.existingAccount ? undefined : 12}
                        maxLength={128}
                        required
                        readOnly={pending}
                        aria-describedby={!invitation.existingAccount ? 'join-password-hint' : undefined}
                        onInput={() => setMismatch(false)}
                      />
                      <Button
                        variant="ghost"
                        className="auth-visibility"
                        aria-label={visible ? 'Hide password' : 'Show password'}
                        aria-pressed={visible}
                        onClick={() => setVisible((value) => !value)}
                      >
                        {visible ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {!invitation.existingAccount ? (
                      <p id="join-password-hint" className="auth-hint">
                        Use 12–128 characters. A few unrelated words work well.
                      </p>
                    ) : null}
                  </div>
                  {!invitation.existingAccount ? (
                    <div className="auth-field">
                      <label htmlFor="join-confirm">Confirm password</label>
                      <input
                        ref={confirmRef}
                        id="join-confirm"
                        name="confirmPassword"
                        type={visible ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={128}
                        required
                        readOnly={pending}
                        aria-invalid={mismatch || undefined}
                        aria-describedby={mismatch ? 'join-mismatch' : undefined}
                        onInput={() => setMismatch(false)}
                      />
                      {mismatch ? (
                        <p id="join-mismatch" className="auth-error" role="alert">
                          Passwords do not match. Enter the same password in both fields.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {error ? (
                    <p ref={errorRef} className="auth-error" role="alert" tabIndex={-1}>
                      {error}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    variant="primary"
                    className="auth-submit"
                    disabled={pending || !ready}
                  >
                    {pending ? 'Joining…' : 'Join workspace'}
                  </Button>
                </form>
                {invitation.existingAccount ? (
                  <Link href="/recover" className="auth-link">
                    Forgot your password?
                  </Link>
                ) : null}
              </>
            ) : !loading && error ? (
              <>
                <p ref={errorRef} className="auth-error auth-copy" role="alert" tabIndex={-1}>
                  {error}
                </p>
                <Button onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
              </>
            ) : null}
            <Link href="/sign-in" className="auth-link">
              Back to sign in
            </Link>
          </>
        )}
        <p className="auth-preview-note">
          Staff access is separate from private admin material and customer folders. Boards and tasks are
          saved. Docs remain a sample.
        </p>
      </div>
    </main>
  );
}
