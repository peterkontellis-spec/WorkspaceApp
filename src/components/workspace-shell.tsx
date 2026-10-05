'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChartNoAxesCombined, Check, ChevronDown, ChevronsUpDown, Clock3, Bot, FileText, Folder, House, LayoutGrid, Menu, Search, Settings2, X } from 'lucide-react';
import { boards, documents, members, type Member } from '@/lib/demo';
import { Avatar, AvatarStack, Button, Dialog, Field } from '@/components/ui';
import { useWorkspace } from './demo-provider';

const DemoContext = createContext<{ member: Member }>({ member: members[0] });
export const useDemo = () => useContext(DemoContext);

const navigation = [
  { label: 'Home', href: '/home', icon: House },
  { label: 'Boards', href: '/boards', icon: LayoutGrid },
  { label: 'Overview', icon: ChartNoAxesCombined, later: 'Shared progress comes later.' },
  { label: 'Docs', href: '/docs', icon: FileText },
  { label: 'Files', icon: Folder, later: 'Attachment storage comes later.' },
  { label: 'Time', icon: Clock3, later: 'Time tracking comes later.' },
  { label: 'Assistant', icon: Bot, later: 'Local chat and file help, with optional Astra handoff, are planned.' },
] as const;

function Navigation({ close, mobile = false }: { close?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  return <nav aria-label={mobile ? 'Mobile workspace navigation' : 'Workspace navigation'} className="side-nav">
    {navigation.map((item) => {
      const Icon = item.icon;
      if ('href' in item) return <Link key={item.label} href={item.href} onClick={close} className={`nav-item ${pathname.startsWith(item.href) ? 'nav-item--active' : ''}`} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}><Icon size={20} aria-hidden="true" /><span>{item.label}</span></Link>;
      if (item.label === 'Assistant') return <button key={item.label} type="button" className="nav-item nav-item--later nav-assistant" aria-disabled="true" aria-label="Assistant — Later" title={item.later}><Icon size={20} aria-hidden="true" /><span>Assistant</span><span className="later-label">Later</span></button>;
      return <div key={item.label} className="nav-item nav-item--later" aria-label={`${item.label}. ${item.later}`}><Icon size={20} aria-hidden="true" /><span>{item.label}</span><span className="later-label">Later</span></div>;
    })}
  </nav>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>Workspace<span className="brand__subtitle">A shared space</span></span></div>;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { resetDemo } = useWorkspace();
  const pathname = usePathname();
  const [member, setMember] = useState(members[0]);
  const [overlay, setOverlay] = useState<'navigation' | 'search' | 'account' | 'reset' | null>(null);
  const [query, setQuery] = useState('');
  const section = pathname.split('/')[1];
  const currentLabel = navigation.find((item) => 'href' in item && item.href === `/${section}`)?.label ?? 'Workspace';
  const close = () => setOverlay(null);
  const closeOverlay = (name: 'navigation' | 'search' | 'account' | 'reset') => {
    setOverlay((current) => current === name ? null : current);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        setOverlay((current) => current === 'search' ? null : 'search');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const searchItems = [
    { name: 'Home', detail: 'Your personal workspace', href: '/home', kind: 'Page' },
    { name: 'Boards', detail: 'Your team’s projects', href: '/boards', kind: 'Page' },
    { name: 'Docs', detail: 'Shared writing', href: '/docs', kind: 'Page' },
    ...boards.map((board) => ({ name: board.name, detail: board.description, href: `/boards/${board.id}`, kind: 'Board' })),
    ...documents.map((doc) => ({ name: doc.title, detail: 'Sample document', href: `/docs/${doc.id}`, kind: 'Doc' })),
  ].filter((item) => `${item.name} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <DemoContext.Provider value={{ member }}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="workspace-shell">
      <aside className="sidebar">
        <Brand />
        <p className="nav-heading">WORKSPACE</p>
        <Navigation />
        <div className="sidebar__bottom">
          <div className="team-summary"><AvatarStack ids={members.map((person) => person.id)} /><span>Your team<span>4 sample collaborators</span></span></div>
          <div className="nav-item nav-item--later"><Settings2 size={20} aria-hidden="true" /><span>Settings</span><span className="later-label">Later</span></div>
          <div className="prototype-mark"><span aria-hidden="true" />Prototype · sample data</div>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="topbar">
          <div className="topbar__location">
            <Button variant="ghost" className="icon-button mobile-menu-trigger" aria-label="Open navigation" onClick={() => setOverlay('navigation')}><Menu size={22} aria-hidden="true" /></Button>
            <span className="breadcrumb-root">Workspace</span><span className="breadcrumb-divider" aria-hidden="true">/</span><span className="current-page">{currentLabel}</span>
          </div>
          <div className="topbar__actions">
            <Button variant="ghost" className="search-trigger" aria-label="Find a page, board, or document" onClick={() => { setQuery(''); setOverlay('search'); }}><Search size={19} aria-hidden="true" /><span>Go to…</span><kbd>⌘ K</kbd></Button>
            <span className="topbar__separator" />
            <Button variant="ghost" className="account-trigger" aria-label={`Sample account: ${member.name}. Switch sample account`} onClick={() => setOverlay('account')}><Avatar member={member} /><ChevronDown size={15} aria-hidden="true" /></Button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">{children}</main>
        <footer className="workspace-footer"><span>Prototype · sample data</span><span>Demo date: 25 September 2026</span></footer>
      </div>

      <nav className="bottom-nav" aria-label="Primary mobile navigation">
        {navigation.filter((item) => 'href' in item).map((item) => {
          if (!('href' in item)) return null;
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return <Link key={item.label} href={item.href} aria-current={active ? 'page' : undefined} className={active ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}><Icon size={21} aria-hidden="true" /><span>{item.label}</span></Link>;
        })}
      </nav>
    </div>

    <Dialog open={overlay === 'navigation'} onClose={() => closeOverlay('navigation')} title="Workspace navigation" className="navigation-dialog">
      <Navigation mobile close={close} />
      <div className="nav-item nav-item--later"><Settings2 size={20} aria-hidden="true" /><span>Settings</span><span className="later-label">Later</span></div>
      <p className="dialog-note">Sections marked Later aren’t available in this prototype.</p>
    </Dialog>

    <Dialog open={overlay === 'search'} onClose={() => closeOverlay('search')} title="Go to…" className="search-dialog">
      <div className="search-field"><Search size={20} aria-hidden="true" /><Field label="Find a page, board, or document" placeholder="Find a page, board, or document" name="workspace-search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <Button variant="ghost" className="icon-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={17} aria-hidden="true" /></Button>}</div>
      <div role="status" className="sr-only">{searchItems.length} results</div>
      <ul className="search-results">{searchItems.map((item) => <li key={item.href}><Link href={item.href} onClick={close}><span className="search-result__icon">{item.kind === 'Doc' ? <FileText size={19} aria-hidden="true" /> : <LayoutGrid size={19} aria-hidden="true" />}</span><span><strong>{item.name}</strong><span className="search-result__detail">{item.detail}</span></span><span className="search-result__kind">{item.kind}</span><ArrowUpRight size={16} aria-hidden="true" /></Link></li>)}</ul>
      {searchItems.length === 0 && <div className="search-empty"><p>No matching pages or projects.</p><Button onClick={() => setQuery('')}>Clear search</Button></div>}
      <p className="dialog-note">Search covers sample pages, boards, and document titles. Task search comes later.</p>
    </Dialog>

    <Dialog open={overlay === 'account'} onClose={() => closeOverlay('account')} title="Sample accounts">
      <p className="dialog-intro">Explore the shell as someone else on the sample team.</p>
      <div className="account-options">{members.map((person) => <button key={person.id} type="button" className={`account-option ${person.id === member.id ? 'account-option--selected' : ''}`} aria-pressed={person.id === member.id} onClick={() => { setMember(person); close(); }}><Avatar member={person} /><span><strong>{person.name}</strong><span>{person.role} · sample account</span></span>{person.id === member.id ? <Check size={19} aria-hidden="true" /> : <ChevronsUpDown size={17} aria-hidden="true" />}</button>)}</div>
      <p className="dialog-note">No sign-in or permissions yet. Accounts and edits reset on refresh.</p><Button onClick={() => setOverlay('reset')}>Reset demo</Button>
    </Dialog>
    <Dialog open={overlay === 'reset'} onClose={() => closeOverlay('reset')} title="Reset demo?">
      <p className="dialog-intro">Reset all sample tasks, documents and unfinished input? This clears this session’s edits and restores the original sample data.</p>
      <div className="reset-actions"><Button onClick={() => setOverlay('account')}>Cancel</Button><Button variant="primary" onClick={() => { resetDemo(); setMember(members[0]); close(); }}>Reset sample data</Button></div>
    </Dialog>
  </DemoContext.Provider>;
}
