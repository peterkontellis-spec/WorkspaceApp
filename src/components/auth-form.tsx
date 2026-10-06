'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import { Button } from './ui';
import './auth.css';

type AuthFormProps = { mode: 'sign-in' | 'reset-password'; token?: string };

export function AuthForm({ mode, token }: AuthFormProps) {
  const reset = mode === 'reset-password';
  const id = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [complete, setComplete] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);
  const missingToken = reset && !token;

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (complete) successRef.current?.focus();
  }, [complete]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || missingToken) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    setError('');
    if (reset && password !== data.get('confirmPassword')) {
      setMismatch(true);
      confirmRef.current?.focus();
      return;
    }
    setMismatch(false);
    submittingRef.current = true;
    setPending(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(reset ? '/api/auth/reset-password' : '/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify(
          reset
            ? { token, newPassword: password }
            : { email: String(data.get('email') ?? '').trim(), password, rememberMe: false },
        ),
      });
      if (!response.ok) {
        if (response.status === 429) {
          setError('Too many attempts. Wait a few minutes, then try again.');
        } else if (response.status >= 500) {
          setError('Account services are temporarily unavailable. Please try again shortly.');
        } else if (reset) {
          setError('This reset link could not be used. Ask your workspace operator for a new link.');
        } else {
          setError('Could not sign in. Check your email and password, or get help with access.');
        }
        return;
      }
      form.reset();
      setVisible(false);
      if (reset) {
        setComplete(true);
      } else {
        window.location.replace('/home');
      }
    } catch {
      setError('Could not reach the workspace. Check your connection and try again.');
    } finally {
      window.clearTimeout(timeout);
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Workspace</div>
        {complete ? (
          <div className="auth-result">
            <h1 ref={successRef} tabIndex={-1} className="auth-heading">
              Password updated
            </h1>
            <p className="auth-copy">Sign in with your new password to return to the workspace.</p>
            <Link href="/sign-in" className="button button--primary auth-submit">
              Sign in
            </Link>
          </div>
        ) : missingToken ? (
          <div className="auth-result">
            <h1 className="auth-heading">Get a new reset link</h1>
            <p className="auth-copy">
              This link is incomplete. Ask your workspace operator for a new password reset link.
            </p>
            <Link href="/recover" className="button button--primary auth-submit">
              Get help with access
            </Link>
            <Link href="/sign-in" className="auth-link">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-heading">{reset ? 'Set a new password' : 'Sign in'}</h1>
            <p className="auth-copy">
              {reset
                ? 'Choose a password you do not use elsewhere.'
                : 'Use your workspace account to continue.'}
            </p>
            <noscript>
              <p role="alert">
                JavaScript is required to use account services. Enable it and reload this page.
              </p>
            </noscript>
            <form method="post" className="auth-form" onSubmit={submit} aria-busy={pending}>
              {!reset ? (
                <div className="auth-field">
                  <label htmlFor={`${id}-email`}>Email</label>
                  <input
                    id={`${id}-email`}
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                    required
                    readOnly={pending}
                  />
                </div>
              ) : null}
              <div className="auth-field">
                <label htmlFor={`${id}-password`}>{reset ? 'New password' : 'Password'}</label>
                <div className="auth-password">
                  <input
                    id={`${id}-password`}
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete={reset ? 'new-password' : 'current-password'}
                    minLength={reset ? 12 : undefined}
                    maxLength={128}
                    required
                    readOnly={pending}
                    aria-describedby={reset ? `${id}-password-hint` : undefined}
                    onInput={() => setMismatch(false)}
                  />
                  <Button
                    variant="ghost"
                    className="auth-visibility"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    aria-controls={`${id}-password${reset ? ` ${id}-confirm` : ''}`}
                    onClick={() => setVisible((value) => !value)}
                  >
                    {visible ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {reset ? (
                  <p id={`${id}-password-hint`} className="auth-hint">
                    Use 12–128 characters. A few unrelated words work well.
                  </p>
                ) : null}
              </div>
              {reset ? (
                <div className="auth-field">
                  <label htmlFor={`${id}-confirm`}>Confirm new password</label>
                  <input
                    ref={confirmRef}
                    id={`${id}-confirm`}
                    name="confirmPassword"
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    readOnly={pending}
                    aria-invalid={mismatch || undefined}
                    aria-describedby={mismatch ? `${id}-mismatch` : undefined}
                    onInput={() => setMismatch(false)}
                  />
                  {mismatch ? (
                    <p id={`${id}-mismatch`} className="auth-error" role="alert">
                      Passwords do not match. Enter the same password in both fields.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {error ? (
                <p ref={errorRef} tabIndex={-1} className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" variant="primary" className="auth-submit" disabled={pending || !ready}>
                {pending ? <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" /> : null}
                {pending
                  ? reset
                    ? 'Updating password…'
                    : 'Signing in…'
                  : reset
                    ? 'Update password'
                    : 'Sign in'}
              </Button>
              <span className="sr-only" role="status">
                {pending ? (reset ? 'Updating password' : 'Signing in') : ''}
              </span>
            </form>
            <Link href="/recover" className="auth-link">
              {reset ? 'Need a new reset link?' : 'Forgot your password?'}
            </Link>
            {reset ? (
              <Link href="/sign-in" className="auth-link">
                Back to sign in
              </Link>
            ) : null}
          </>
        )}
        <p className="auth-preview-note">
          Accounts, boards and tasks are saved. Docs remain a sample; their edits reset after refresh.
        </p>
      </div>
    </main>
  );
}
