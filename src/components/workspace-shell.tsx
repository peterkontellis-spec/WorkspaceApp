'use client';

import Link from 'next/link';
import type { SignedInAccount } from '@/server/auth';
import { StellarProvider, StellarControl, StellarOrb } from './stellar-identity';
import { ThemeToggle, AppearanceSettings } from './theme-provider';
import { NotificationsLink } from './work-updates';
import { WorkSyncStatus } from './work-sync-status';
import { useWork } from './work-provider';
import { filterWorkTasks, readWorkFilters } from '@/lib/work-filters.mjs';
import { localToday } from '@/lib/work';
import { SignOutButton } from './session-boundary';
import './auth.css';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock3,
  Bot,
  FileText,
  Folder,
  House,
  LayoutGrid,
  Search,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import { boards, documents, members, type Member } from '@/lib/demo';
import { Avatar, AvatarStack, Button, Dialog, Field } from '@/components/ui';
import { useWorkspace } from './demo-provider';
import { isSoftwareKeyboardOpen } from '@/lib/keyboard-visibility';

const DemoContext = createContext<{ member: Member }>({ member: members[0] });
export const useDemo = () => useContext(DemoContext);

const navigation = [
  { label: 'Home', href: '/home', icon: House },
  { label: 'Boards', href: '/boards', icon: LayoutGrid },
  { label: 'Overview', icon: ChartNoAxesCombined, later: 'Shared progress comes later.' },
  { label: 'Docs', href: '/docs', icon: FileText },
  { label: 'Files', icon: Folder, later: 'Attachment storage comes later.' },
  { label: 'Time', icon: Clock3, later: 'Time tracking comes later.' },
  {
    label: 'Assistant',
    icon: Bot,
    later: 'Local chat and file help, with optional Astra handoff, are planned.',
  },
] as const;

function Navigation({ close, mobile = false }: { close?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const { enabled } = useWork();
  return (
    <nav aria-label={mobile ? 'Mobile workspace navigation' : 'Workspace navigation'} className="side-nav">
      {navigation.map((item) => {
        const Icon = item.icon;
        if ((item.label === 'Files' || item.label === 'Overview') && enabled)
          return (
            <Link
              key={item.label}
              href={item.label === 'Files' ? '/files' : '/overview'}
              onClick={close}
              className={`nav-item ${pathname === (item.label === 'Files' ? '/files' : '/overview') ? 'nav-item--active' : ''}`}
              aria-current={
                pathname === (item.label === 'Files' ? '/files' : '/overview') ? 'page' : undefined
              }
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        if ('href' in item)
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={close}
              className={`nav-item ${pathname.startsWith(item.href) ? 'nav-item--active' : ''}`}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        if (item.label === 'Assistant')
          return (
            <button
              key={item.label}
              type="button"
              className="nav-item nav-item--later nav-assistant"
              aria-disabled="true"
              aria-label="Assistant — Later"
              title={item.later}
            >
              <Icon size={20} aria-hidden="true" />
              <span>Assistant</span>
              <span className="later-label">Later</span>
            </button>
          );
        return (
          <div
            key={item.label}
            className="nav-item nav-item--later"
            aria-label={`${item.label}. ${item.later}`}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
            <span className="later-label">Later</span>
          </div>
        );
      })}
    </nav>
  );
}

export function WorkspaceShell({
  children,
  account,
}: {
  children: ReactNode;
  account: SignedInAccount | null;
}) {
  const { resetDemo } = useWorkspace();
  const { data: savedWork } = useWork();
  const pathname = usePathname();
  const [member, setMember] = useState(members[0]);
  const [overlay, setOverlay] = useState<'navigation' | 'search' | 'account' | 'reset' | null>(null);
  const [query, setQuery] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const section = pathname.split('/')[1];
  const currentLabel =
    section === 'notifications' && account
      ? 'Notifications'
      : section === 'files' && account
        ? 'Files'
        : section === 'team'
          ? 'Team access'
          : section === 'overview'
            ? 'Overview'
            : (navigation.find((item) => 'href' in item && item.href === `/${section}`)?.label ??
              'Workspace');
  const close = () => setOverlay(null);
  const closeOverlay = (name: 'navigation' | 'search' | 'account' | 'reset') => {
    setOverlay((current) => (current === name ? null : current));
  };

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      const active = document.activeElement;
      const editing =
        active instanceof HTMLTextAreaElement
          ? !active.readOnly
          : active instanceof HTMLInputElement
            ? !active.readOnly &&
              ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(active.type)
            : active instanceof HTMLElement && active.isContentEditable;
      setKeyboardOpen(
        isSoftwareKeyboardOpen({
          narrow: window.matchMedia('(max-width: 960px)').matches,
          editing,
          layoutHeight: Math.max(window.innerHeight, document.documentElement.clientHeight),
          visibleHeight: viewport.height,
          scale: viewport.scale,
        }),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        setOverlay((current) => (current === 'search' ? null : 'search'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const taskMatches =
    account && query.trim()
      ? filterWorkTasks(
          savedWork?.tasks ?? [],
          readWorkFilters(new URLSearchParams({ q: query })),
          localToday(),
        )
      : [];
  const taskSearchHref = `/boards?${new URLSearchParams({ view: 'tasks', ...(query.trim() ? { q: query.slice(0, 200) } : {}) })}`;
  const searchItems = [
    { name: 'Home', detail: 'Your personal workspace', href: '/home', kind: 'Page' },
    { name: 'Boards', detail: 'Your team’s projects', href: '/boards', kind: 'Page' },
    {
      name: 'Docs',
      detail: account ? 'Planned · storage not connected' : 'Sample writing',
      href: '/docs',
      kind: 'Page',
    },
    ...(account
      ? [
          { name: 'Notifications', detail: 'Your task updates', href: '/notifications', kind: 'Page' },
          { name: 'Files', detail: 'Saved task attachments', href: '/files', kind: 'Page' },
          { name: 'Team access', detail: 'Real members and invitations', href: '/team', kind: 'Page' },
        ]
      : []),
    ...(account ? (savedWork?.boards ?? []) : boards).map((board) => ({
      name: board.name,
      detail: board.description,
      href: `/boards/${board.id}`,
      kind: 'Board',
    })),
    ...(account ? [] : documents).map((doc) => ({
      name: doc.title,
      detail: 'Sample document · not saved',
      href: `/docs/${doc.id}`,
      kind: 'Doc',
    })),
  ]
    .filter((item) => `${item.name} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()))
    .concat(
      taskMatches.slice(0, 8).map((task) => ({
        name: task.title,
        detail: savedWork?.boards.find((board) => board.id === task.boardId)?.name ?? 'Saved task',
        href: `${taskSearchHref}&task=${encodeURIComponent(task.id)}`,
        kind: 'Task',
      })),
    );

  return (
    <StellarProvider key={account?.id ?? member.id}>
      <DemoContext.Provider value={{ member }}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <div className="workspace-shell">
          <aside className="sidebar">
            <StellarControl name={account?.name ?? member.name} />
            <p className="nav-heading">WORKSPACE</p>
            <Navigation />
            <div className="sidebar__bottom">
              <div className="team-summary">
                {account ? (
                  <span>
                    Your team
                    <span>
                      {savedWork ? `${savedWork.members.length} workspace members` : 'Staff workspace'}
                    </span>
                  </span>
                ) : (
                  <>
                    <AvatarStack ids={members.map((person) => person.id)} />
                    <span>
                      Your team<span>4 sample collaborators</span>
                    </span>
                  </>
                )}
              </div>
              {account ? (
                <Link
                  href="/team"
                  onClick={close}
                  className={`nav-item ${section === 'team' ? 'nav-item--active' : ''}`}
                  aria-current={section === 'team' ? 'page' : undefined}
                >
                  <Users size={20} aria-hidden="true" />
                  <span>Team access</span>
                </Link>
              ) : null}
              <div className="nav-item nav-item--later">
                <Settings2 size={20} aria-hidden="true" />
                <span>Settings</span>
                <span className="later-label">Later</span>
              </div>
              <div className="prototype-mark">
                <span aria-hidden="true" />
                {account ? 'Local workspace' : 'Prototype · sample data'}
              </div>
            </div>
          </aside>

          <div className="workspace-body">
            <header className="topbar">
              <div className="topbar__location">
                <Button
                  variant="ghost"
                  className="icon-button mobile-menu-trigger"
                  aria-label="Open navigation"
                  onClick={() => setOverlay('navigation')}
                >
                  <StellarOrb compact />
                </Button>
                <span className="breadcrumb-root">Workspace</span>
                <span className="breadcrumb-divider" aria-hidden="true">
                  /
                </span>
                <span className="current-page">{currentLabel}</span>
              </div>
              <div className="topbar__actions">
                <Button
                  variant="ghost"
                  className="search-trigger"
                  aria-label="Find a page, board, task, or document"
                  onClick={() => {
                    setQuery('');
                    setOverlay('search');
                  }}
                >
                  <Search size={19} aria-hidden="true" />
                  <span>Go to…</span>
                  <kbd>⌘ K</kbd>
                </Button>
                <ThemeToggle />
                {account ? <NotificationsLink /> : null}
                <span className="topbar__separator" />
                <Button
                  variant="ghost"
                  className="account-trigger"
                  aria-label={
                    account
                      ? `Account: ${account.name}`
                      : `Sample account: ${member.name}. Switch sample account`
                  }
                  onClick={() => setOverlay('account')}
                >
                  <Avatar
                    member={
                      account
                        ? {
                            ...member,
                            name: account.name,
                            initials: account.name
                              .split(/\s+/)
                              .map((word) => word[0])
                              .slice(0, 2)
                              .join(''),
                          }
                        : member
                    }
                  />
                  <ChevronDown size={15} aria-hidden="true" />
                </Button>
              </div>
            </header>
            <WorkSyncStatus />
            <main id="main-content" tabIndex={-1} className="main-content">
              {children}
            </main>
            <footer className="workspace-footer">
              {account && section !== 'docs' ? (
                <span>
                  {section === 'team' ? 'Real accounts · saved membership' : 'Saved work · local database'}
                </span>
              ) : (
                <>
                  <span>{account ? 'Docs draft · storage not connected' : 'Prototype · sample data'}</span>
                  {!account && <span>Demo date: 25 September 2026</span>}
                </>
              )}
            </footer>
          </div>

          <nav className="bottom-nav" hidden={keyboardOpen} aria-label="Primary mobile navigation">
            {navigation
              .filter((item) => 'href' in item)
              .map((item) => {
                if (!('href' in item)) return null;
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={active ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
                  >
                    <Icon size={21} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </nav>
        </div>

        <Dialog
          open={overlay === 'navigation'}
          onClose={() => closeOverlay('navigation')}
          title="Workspace navigation"
          className="navigation-dialog"
        >
          <StellarControl name={account?.name ?? member.name} />
          <Navigation mobile close={close} />
          {account ? (
            <Link
              href="/team"
              onClick={close}
              className={`nav-item ${section === 'team' ? 'nav-item--active' : ''}`}
              aria-current={section === 'team' ? 'page' : undefined}
            >
              <Users size={20} aria-hidden="true" />
              <span>Team access</span>
            </Link>
          ) : null}
          <div className="nav-item nav-item--later">
            <Settings2 size={20} aria-hidden="true" />
            <span>Settings</span>
            <span className="later-label">Later</span>
          </div>
          <p className="dialog-note">Sections marked Later aren’t available in this prototype.</p>
        </Dialog>

        <Dialog
          open={overlay === 'search'}
          onClose={() => closeOverlay('search')}
          title="Go to…"
          className="search-dialog"
        >
          <div className="search-field">
            <Search size={20} aria-hidden="true" />
            <Field
              label="Find a page, board, task, or document"
              placeholder="Find a page, board, task, or document"
              name="workspace-search"
              maxLength={200}
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <Button
                variant="ghost"
                className="icon-button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X size={17} aria-hidden="true" />
              </Button>
            )}
          </div>
          <div role="status" className="sr-only">
            {searchItems.length} results shown
            {taskMatches.length > 8
              ? `; ${taskMatches.length} task matches available through Find tasks with filters`
              : ''}
          </div>
          <ul className="search-results">
            {searchItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={close}>
                  <span className="search-result__icon">
                    {item.kind === 'Doc' ? (
                      <FileText size={19} aria-hidden="true" />
                    ) : (
                      <LayoutGrid size={19} aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <span className="search-result__detail">{item.detail}</span>
                  </span>
                  <span className="search-result__kind">{item.kind}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {searchItems.length === 0 && (
            <div className="search-empty">
              <p>No matches found.</p>
              <Button onClick={() => setQuery('')}>Clear search</Button>
            </div>
          )}
          {account ? (
            <Link className="auth-link" href={taskSearchHref} onClick={close}>
              Find tasks with filters
              {taskMatches.length > 8 ? ` · See all ${taskMatches.length} matches` : ''}
            </Link>
          ) : null}
          <p className="dialog-note">
            {account
              ? 'Search includes saved task titles and notes. Docs storage is not connected yet.'
              : 'Search covers sample pages, boards, and document titles. Task search comes later.'}
          </p>
        </Dialog>

        <Dialog
          open={overlay === 'account'}
          onClose={() => closeOverlay('account')}
          title={account ? 'Your account' : 'Sample accounts'}
        >
          <AppearanceSettings />
          {account ? (
            <div className="account-identity">
              <strong>{account.name}</strong>
              <p>{account.email}</p>
              <p>{account.role} · staff workspace</p>
              <Link href="/team" className="auth-link" onClick={close}>
                Team access
              </Link>
              <SignOutButton />
              <p className="dialog-note">Signing out clears this tab’s unsaved input and sample edits.</p>
            </div>
          ) : null}
          {!account ? (
            <>
              <p className="dialog-intro">Preview sample work as someone on the fictional team.</p>
              <div className="account-options">
                {members.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={`account-option ${person.id === member.id ? 'account-option--selected' : ''}`}
                    aria-pressed={person.id === member.id}
                    onClick={() => {
                      setMember(person);
                      close();
                    }}
                  >
                    <Avatar member={person} />
                    <span>
                      <strong>{person.name}</strong>
                      <span>{person.role} · sample account</span>
                    </span>
                    {person.id === member.id ? (
                      <Check size={19} aria-hidden="true" />
                    ) : (
                      <ChevronsUpDown size={17} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
              <p className="dialog-note">
                {account
                  ? 'These sample views do not change your signed-in account or permissions. Sample edits reset on refresh.'
                  : 'Sample-only mode: no sign-in. Accounts and edits reset on refresh.'}
              </p>
              <Button onClick={() => setOverlay('reset')}>Reset demo</Button>
            </>
          ) : (
            <p className="dialog-note">
              Boards and tasks use your real role. Docs storage is not connected yet.
            </p>
          )}
        </Dialog>
        <Dialog open={overlay === 'reset'} onClose={() => closeOverlay('reset')} title="Reset demo?">
          <p className="dialog-intro">
            Reset all sample tasks, documents and unfinished input? This clears this session’s edits and
            restores the original sample data.
          </p>
          <div className="reset-actions">
            <Button onClick={() => setOverlay('account')}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo();
                setMember(members[0]);
                close();
              }}
            >
              Reset sample data
            </Button>
          </div>
        </Dialog>
      </DemoContext.Provider>
    </StellarProvider>
  );
}
