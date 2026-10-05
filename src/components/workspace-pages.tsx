'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, FileText, Layers3, LayoutTemplate } from 'lucide-react';
import { boards, documents, boardFor, DEMO_DATE } from '@/lib/demo';
import { AvatarStack, Panel, TaskRow } from '@/components/ui';
import { useDemo } from '@/components/workspace-shell';
import { useWorkspace } from './demo-provider';
import { useTaskNavigation } from './task-navigation';
import { TaskPanel } from './task-panel';
import { BoardView } from './board-view';
import { getPersonalBuckets } from '@/lib/demo-state';

function ProjectCard({ board }: { board: (typeof boards)[number] }) {
  const { tasks } = useWorkspace();
  const projectTasks = tasks.filter((task) => task.boardId === board.id);
  const completed = projectTasks.filter((task) => task.status === 'Done').length;
  return <Link href={`/boards/${board.id}`} className={`project-card project-card--${board.color}`}>
    <div className="project-card__top"><span className={`project-icon project-icon--${board.color}`}>{board.icon === 'layout' ? <LayoutTemplate size={23} aria-hidden="true" /> : <Layers3 size={23} aria-hidden="true" />}</span><ArrowUpRight size={20} aria-hidden="true" /></div>
    <h3>{board.name}</h3><p>{board.description}</p>
    <div className="project-card__progress" aria-label={`${completed} of ${projectTasks.length} sample tasks completed`}><span style={{ width: `${projectTasks.length ? completed / projectTasks.length * 100 : 0}%` }} /></div>
    <div className="project-card__bottom"><span>{completed} of {projectTasks.length} completed</span><AvatarStack ids={board.memberIds} /></div>
  </Link>;
}

function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{children}</div>;
}

function StageNote({ children }: { children: React.ReactNode }) {
  return <p className="stage-note"><span className="stage-note__label">Preview</span>{children}</p>;
}

function HomePage() {
  const { member } = useDemo();
  const { tasks, documents: sessionDocuments, emptyDemo, setEmptyDemo } = useWorkspace();
  const { taskHref } = useTaskNavigation();
  const visibleTasks = emptyDemo ? [] : tasks;
  const buckets = getPersonalBuckets(visibleTasks, member.id, DEMO_DATE);
  const assigned = visibleTasks.filter((task) => task.assigneeIds.includes(member.id));
  const sections = [
    { title: 'Overdue', items: buckets.overdue, empty: 'Nothing overdue. You’re up to date.' },
    { title: 'Today', items: buckets.today, empty: 'No tasks due today. Check upcoming work below.' },
    { title: 'Upcoming', items: buckets.upcoming, empty: 'No upcoming deadlines.' },
    { title: 'Without a date', items: buckets.undated, empty: 'All your open tasks have dates.' },
  ];
  return <>
    <PageHeading eyebrow="FRIDAY, 25 SEPTEMBER · DEMO" title={`Welcome back, ${member.name.split(' ')[0]}.`} description="Your work, one day at a time."><Link className="button button--secondary" href="/boards">Browse boards<ArrowUpRight size={18} aria-hidden="true" /></Link></PageHeading>
    <div className="section-heading"><h2>My Day</h2><label className="demo-toggle"><input type="checkbox" checked={emptyDemo} onChange={(event) => setEmptyDemo(event.target.checked)} />Preview new collaborator</label></div>
    <p className="session-note">Sample assignments · 25 September 2026. Edits last until refresh.</p>
    {assigned.length === 0 ? <Panel className="inline-empty"><h3>No tasks assigned yet.</h3><p>{emptyDemo ? 'This previews a new collaborator’s Home without changing your demo tasks.' : 'Your shared boards are ready when you are.'}</p><Link href="/boards" className="text-link">Explore the shared boards<ArrowRight size={16} aria-hidden="true" /></Link></Panel> : <div className="my-day-sections">{sections.map(({title, items, empty}) => <Panel key={title}><div className="panel-heading"><h3>{title}</h3><span className="count-badge">{items.length}</span></div>{items.length ? <ul className="task-list">{items.map((task) => <TaskRow key={task.id} task={task} href={taskHref(task.id)} />)}</ul> : <p className="bucket-empty">{empty}</p>}</Panel>)}</div>}
    <div className="section-heading docs-section-heading"><h2>Recent documents</h2><Link className="text-link" href="/docs">All docs<ArrowRight size={16} aria-hidden="true" /></Link></div>
    <div className="document-shortcuts">{sessionDocuments.slice(0, 2).map((doc) => <Link href={`/docs/${doc.id}`} key={doc.id} className="document-shortcut"><span className="document-icon"><FileText size={21} aria-hidden="true" /></span><span><strong>{doc.title}</strong><span>{boardFor(doc.boardId)?.name}</span></span><ArrowUpRight size={18} aria-hidden="true" /></Link>)}</div>
    <div className="section-heading docs-section-heading"><h2>Shared boards</h2><span className="section-count">{boards.length} projects</span></div>
    <div className="project-grid">{boards.map((board) => <ProjectCard key={board.id} board={board} />)}</div>
  </>;
}

function BoardsPage({ id }: { id?: string }) {
  if (!id) return <>
    <PageHeading eyebrow="TOGETHER, IN ONE PLACE" title="Boards" description="A clear home for each project." />
    <div className="section-heading"><h2>All projects</h2><span className="section-count">{boards.length} boards</span></div>
    <div className="project-grid">{boards.map((board) => <ProjectCard key={board.id} board={board} />)}</div>
    <StageNote>Open a board to add, edit and filter sample tasks. Changes last until refresh.</StageNote>
  </>;
  return <BoardView id={id} />;
}

function DocsPage({ id }: { id?: string }) {
  if (!id) return <>
    <PageHeading eyebrow="ROOM FOR YOUR IDEAS" title="Docs" description="Briefs, notes, and shared starting points." />
    <Panel className="docs-list"><div className="panel-heading"><h2>All documents</h2><span className="section-count">{documents.length} sample docs</span></div>{documents.map((doc) => <Link key={doc.id} className="document-row" href={`/docs/${doc.id}`}><span className="document-icon"><FileText size={22} aria-hidden="true" /></span><span className="document-row__title"><strong>{doc.title}</strong><span>{boardFor(doc.boardId)?.name}</span></span><span className="document-row__date">{doc.updated}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>)}</Panel>
    <StageNote>This is the document navigation. Writing and the task-to-document workflow follow in the Docs increment.</StageNote>
  </>;
  const doc = documents.find((document) => document.id === id)!;
  return <>
    <Link className="back-link" href="/docs"><ArrowLeft size={18} aria-hidden="true" />All docs</Link>
    <PageHeading eyebrow={boardFor(doc.boardId)?.name.toUpperCase() ?? 'SHARED DOCUMENT'} title={doc.title} description={doc.description} />
    <Panel className="document-placeholder"><span className="document-placeholder__icon"><FileText size={29} aria-hidden="true" /></span><h2>Your writing space goes here.</h2><p>The document editor is planned for the next Docs increment. This sample page establishes where it lives in the workspace.</p><Link href="/docs" className="button button--secondary">Back to documents<ArrowRight size={17} aria-hidden="true" /></Link></Panel>
  </>;
}

export function WorkspacePage({ section, id }: { section: 'home' | 'boards' | 'docs'; id?: string }) {
  const { taskId } = useTaskNavigation();
  return <div className={taskId && section !== 'docs' ? 'page-with-task' : undefined}>
    {section === 'boards' ? <BoardsPage id={id} /> : section === 'docs' ? <DocsPage id={id} /> : <HomePage />}
    {section !== 'docs' && <TaskPanel key={taskId} />}
  </div>;
}
