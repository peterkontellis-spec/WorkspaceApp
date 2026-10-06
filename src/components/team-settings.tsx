'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import { useWorkspace } from './demo-provider';
import { Button, Dialog } from './ui';
import './auth.css';
import './team.css';

type Role = 'owner' | 'editor' | 'viewer';
type Person = { id: string; name: string; email: string; role: Role };
type Invitation = { id: string; email: string; role: Role; expiresAt: string };
type Team = { members: Person[]; invitations: Invitation[]; canManage: boolean; actorId: string };
type Change = { action: 'remove' | 'role' | 'revoke'; id: string; label: string; role?: Role };
const roleNames: Record<Role, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' };

export function TeamSettings() {
  const { resetDemo } = useWorkspace();
  const [team, setTeam] = useState<Team | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [change, setChange] = useState<Change | null>(null);
  const [link, setLink] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError('');
      try {
        const response = await fetch('/api/team', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session ended. Sign in again to view the team.' : 'Could not load the team. Check your connection and retry.');
        setTeam(await response.json());
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load the team. Retry shortly.'); }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  async function save(payload: object) {
    if (busy.current) return false;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session ended. Sign in again to continue.' : result.error || 'Could not save this change. Retry shortly.');
      setTeam(result);
      if (result.reauthenticate) { flushSync(() => resetDemo()); window.location.replace('/sign-in'); return true; }
      setLink('');
      if (result.link) { setLink(result.link); setCopied(false); }
      setNotice(result.link ? 'Invitation created. Share the link directly with the invited person.' : 'Team access updated.');
      setChange(null); setAttempt(value => value + 1);
      return true;
    } catch (e) { setChange(null); setError(e instanceof Error ? e.message : 'Could not save. Check your connection and retry.'); return false; }
    finally { busy.current = false; setPending(false); }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (await save({ action: 'invite', email: String(data.get('email')).trim(), role: data.get('role') })) form.reset();
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { linkRef.current?.focus(); linkRef.current?.select(); setNotice('Select and copy the invitation link below.'); }
  }
  return <section className="team-page" aria-busy={pending}>
    <h1>Team access</h1>
    <p className="auth-copy">Manage the real people who can enter your staff workspace.</p>
    <p className="team-scope">Accounts and membership are saved. Boards, tasks and Docs still use temporary sample data.</p>
    {error ? <div className="team-feedback"><p ref={errorRef} tabIndex={-1} className="auth-error" role="alert">{error}</p><div className="team-actions"><Button onClick={() => setAttempt(value => value + 1)} disabled={pending}>Retry</Button><Link href="/sign-in" className="auth-link">Sign in</Link></div></div> : null}
    <p className="team-notice" role="status">{notice}</p>
    {!team && !error ? <p role="status">Loading team…</p> : null}
    {team ? <>
      <section className="team-section" aria-labelledby="members-heading">
        <h2 id="members-heading">Members <span className="team-count">{team.members.length} of 4</span></h2>
        <ul className="team-list">{team.members.map(person => <li key={person.id}>
          <div className="team-person"><strong>{person.name}{person.id === team.actorId ? ' (you)' : ''}</strong><span>{person.email}</span></div>
          {team.canManage ? <div className="team-actions"><label className="team-role"><span className="sr-only">Role for {person.name}</span><select value={person.role} disabled={pending} onChange={event => setChange({ action: 'role', id: person.id, label: person.name, role: event.target.value as Role })}>{Object.entries(roleNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><Button variant="ghost" disabled={pending} aria-label={`Remove ${person.name}`} onClick={() => setChange({ action: 'remove', id: person.id, label: person.name })}>Remove</Button></div> : <span className="team-role-name">{roleNames[person.role]}</span>}
        </li>)}</ul>
      </section>
      <section className="team-section" aria-labelledby="role-heading"><h2 id="role-heading">What roles allow</h2><p className="auth-copy">Owners manage membership. Owners and editors can edit shared work when real task saving is connected; viewers can read it. Sample editing does not demonstrate these task permissions.</p><p className="auth-copy">Staff access does not grant access to private admin material or customer folders. The workspace must keep at least one owner.</p></section>
      {team.canManage ? <>
        <section className="team-section" aria-labelledby="invite-heading"><h2 id="invite-heading">Invite a teammate</h2><p className="auth-copy">Each link is for one email address and expires after 24 hours. No email is sent. Pending invitations reserve a place in the four-person team.</p>
          <form className="team-invite-form" onSubmit={invite}>
            <div className="auth-field"><label htmlFor="invite-email">Their email</label><input id="invite-email" name="email" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} required readOnly={pending} /></div>
            <label className="auth-field team-role" htmlFor="invite-role"><span>Role</span><select id="invite-role" name="role" defaultValue="editor" disabled={pending}><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="owner">Owner — can manage access</option></select></label>
            <Button variant="primary" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Create invitation'}</Button>
          </form>
          {link ? <div className="team-share"><label className="auth-field" htmlFor="invitation-link">Invitation link<input ref={linkRef} id="invitation-link" value={link} readOnly spellCheck={false} onFocus={event => event.target.select()} /></label><Button onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</Button><p className="auth-hint">Copy it now; the full link is only shown here once. Share it only with the invited person. For another device, a configured secure address is needed; this preview is Mac-only.</p></div> : null}
        </section>
        <section className="team-section" aria-labelledby="pending-heading"><h2 id="pending-heading">Pending invitations</h2>{team.invitations.length ? <ul className="team-list">{team.invitations.map(invitation => <li key={invitation.id}><div className="team-person"><strong>{invitation.email}</strong><span>{roleNames[invitation.role]} · Expires {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(invitation.expiresAt))}</span></div><Button variant="ghost" disabled={pending} aria-label={`Cancel invitation for ${invitation.email}`} onClick={() => setChange({ action: 'revoke', id: invitation.id, label: invitation.email })}>Cancel invitation</Button></li>)}</ul> : <p className="auth-copy">No pending invitations.</p>}</section>
      </> : <p className="team-scope">Ask an owner to invite people or change access.</p>}
    </> : null}
    <Dialog open={Boolean(change)} onClose={() => { if (!pending) setChange(null); }} title={change?.action === 'role' ? 'Change role?' : change?.action === 'revoke' ? 'Cancel invitation?' : 'Remove workspace access?'}>
      <p className="dialog-intro">{change?.action === 'role' ? `${change.label} will have the ${roleNames[change.role!]?.toLowerCase()} role. Their active sessions will end so their new permissions take effect.` : change?.action === 'revoke' ? `The invitation for ${change.label} will stop working. You can create another invitation later.` : `${change?.label} will be signed out and lose workspace access. Their account and existing work are kept; task assignments are removed.`}</p>
      <div className="team-actions"><Button disabled={pending} onClick={() => setChange(null)}>Keep unchanged</Button><Button variant="primary" disabled={pending} onClick={() => { if (change) void save({ action: change.action, id: change.id, ...(change.role ? { role: change.role } : {}) }); }}>{pending ? 'Saving…' : change?.action === 'role' ? 'Change role' : change?.action === 'revoke' ? 'Cancel invitation' : 'Remove access'}</Button></div>
    </Dialog>
  </section>;
}
