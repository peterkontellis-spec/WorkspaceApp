import { requireAccount } from '@/server/auth';
import { notFound } from 'next/navigation';
import { NotificationsPage } from '@/components/work-updates';
import { SavedFilesPage } from '@/components/saved-files';
import { SavedWorkPage } from '@/components/saved-work-page';
import { WorkspacePage } from '@/components/workspace-pages';
import { boards, documents } from '@/lib/demo';

export default async function Page({ params }: { params: Promise<{ segments: string[] }> }) {
  const account = await requireAccount();
  const { segments } = await params;
  const [section, id] = segments;
  if (account && section === 'notifications' && segments.length === 1) return <NotificationsPage/>;
  if (account && section === 'files' && segments.length === 1) return <SavedFilesPage/>;
  if (account && (section === 'home' || section === 'boards') && (segments.length === 1 || (section === 'boards' && segments.length === 2 && /^[0-9a-f-]{36}$/i.test(id)))) return <SavedWorkPage section={section} boardId={id} />;
  if (account && section === 'boards') notFound();
  const validRoot = segments.length === 1 && ['home', 'boards', 'docs'].includes(section);
  const validBoard = segments.length === 2 && section === 'boards' && boards.some((board) => board.id === id);
  const validDoc = segments.length === 2 && section === 'docs' && documents.some((doc) => doc.id === id);
  if (!validRoot && !validBoard && !validDoc) notFound();
  return <WorkspacePage section={section as 'home' | 'boards' | 'docs'} id={id} />;
}
