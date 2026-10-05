'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, FileText, Layers3, LayoutGrid, LayoutTemplate, CalendarDays } from 'lucide-react';
import { boards, documents, tasks, boardFor, DEMO_DATE } from '@/lib/demo';
import { AvatarStack, Panel, TaskRow } from '@/components/ui';
import { useDemo } from '@/components/workspace-shell';

function ProjectCard({ board }: { board: (typeof boards)[number] }) {
  const projectTasks = tasks.filter((task) => task.boardId === board.id);
  const completed = projectTasks.filter((task) => task.status === 'Done').length;
  return <Link href={`/boards/${board.id}`} className={`project-card project-card--${board.color}`}>
    <div className="project-card__top"><span className={`project-icon project-icon--${board.color}`}>{board.icon === 'layout' ? <LayoutTemplate size={23} aria-hidden="true" /> : <Layers3 size={23} aria-hidden="true" />}</span><ArrowUpRight size={20} aria-hidden="true" /></div>
    <h3>{board.name}</h3><p>{board.description}</p>
    <div className="project-card__progress" aria-label={`${completed} of ${projectTasks.length} sample tasks completed`}><span style={{ width: `${completed / projectTasks.length * 100}%` }} /></div>
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
  const today = tasks.filter((task) => task.assigneeIds.includes(member.id) && task.dueDate === DEMO_DATE && task.status !== 'Done');
  return <>
    <PageHeading eyebrow="FRIDAY, 25 SEPTEMBER · DEMO" title={`Welcome back, ${member.name.split(' ')[0]}.`} description="Pick up a project. Make a little progress."><Link className="button button--secondary" href="/boards">Browse boards<ArrowUpRight size={18} aria-hidden="true" /></Link></PageHeading>
    <div className="section-heading"><h2>Your projects</h2><span className="section-count">{boards.length} shared boards</span></div>
    <div className="project-grid">{boards.map((board) => <ProjectCard key={board.id} board={board} />)}</div>
    <Panel className="today-panel">
      <div className="panel-heading"><div className="panel-title"><span className="quiet-icon"><CalendarDays size={19} aria-hidden="true" /></span><h2>A look at today</h2><span className="count-badge">{today.length}</span></div><span className="subtle-label">Sample tasks</span></div>
      {today.length ? <ul className="task-list">{today.map((task) => <TaskRow key={task.id} task={task} />)}</ul> : <div className="inline-empty"><h3>A little breathing room.</h3><p>No sample tasks are due today for {member.name.split(' ')[0]}.</p><Link href="/boards" className="text-link">Explore the shared boards<ArrowRight size={16} aria-hidden="true" /></Link></div>}
      <div className="panel-footnote">A read-only glimpse. My Day and task interactions are next.</div>
    </Panel>
    <div className="section-heading docs-section-heading"><h2>Shared thinking</h2><Link className="text-link" href="/docs">All docs<ArrowRight size={16} aria-hidden="true" /></Link></div>
    <div className="document-shortcuts">{documents.slice(0,2).map((doc) => <Link href={`/docs/${doc.id}`} key={doc.id} className="document-shortcut"><span className="document-icon"><FileText size={21} aria-hidden="true" /></span><span><strong>{doc.title}</strong><span>{boardFor(doc.boardId)?.name}</span></span><ArrowUpRight size={18} aria-hidden="true" /></Link>)}</div>
  </>;
}

function BoardsPage({ id }: { id?: string }) {
  if (!id) return <>
    <PageHeading eyebrow="TOGETHER, IN ONE PLACE" title="Boards" description="A clear home for each project." />
    <div className="section-heading"><h2>All projects</h2><span className="section-count">{boards.length} boards</span></div>
    <div className="project-grid">{boards.map((board) => <ProjectCard key={board.id} board={board} />)}</div>
    <StageNote>Open a board to explore its sample tasks. Adding and editing boards comes in the next increments.</StageNote>
  </>;
  const board = boardFor(id)!;
  const boardTasks = tasks.filter((task) => task.boardId === id);
  return <>
    <Link className="back-link" href="/boards"><ArrowLeft size={18} aria-hidden="true" />All boards</Link>
    <PageHeading eyebrow="SHARED BOARD" title={board.name} description={board.description}><AvatarStack ids={board.memberIds} /></PageHeading>
    <div className="board-view-label"><span><LayoutGrid size={18} aria-hidden="true" />Task preview</span><span className="subtle-label">Read only</span></div>
    <Panel><div className="panel-heading"><h2>Sample tasks</h2><span className="count-badge">{boardTasks.length}</span></div><ul className="task-list">{boardTasks.map((task) => <TaskRow key={task.id} task={task} />)}</ul></Panel>
    <StageNote>The grouped table, custom columns, and task editing will be built in the board increment.</StageNote>
  </>;
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
  if (section === 'boards') return <BoardsPage id={id} />;
  if (section === 'docs') return <DocsPage id={id} />;
  return <HomePage />;
}
