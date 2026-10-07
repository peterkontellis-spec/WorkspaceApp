import Link from 'next/link';
import { requireAccount } from '@/server/auth';
import { notFound } from 'next/navigation';
import { NotificationsPage } from '@/components/work-updates';
import { SavedFilesPage } from '@/components/saved-files';
import { SavedOverviewPage } from '@/components/saved-dashboard';
import { SavedWorkPage } from '@/components/saved-work-page';
import { WorkspacePage } from '@/components/workspace-pages';
import { boards, documents } from '@/lib/demo';

export default async function Page({ params }: { params: Promise<{ segments: string[] }> }) {
  const account = await requireAccount();
  const { segments } = await params;
  const [section, id] = segments;
  if (account && section === 'notifications' && segments.length === 1) return <NotificationsPage />;
  if (account && section === 'overview' && segments.length === 1) return <SavedOverviewPage />;
  if (account && section === 'files' && segments.length === 1) return <SavedFilesPage />;
  if (
    account &&
    (section === 'home' || section === 'boards') &&
    (segments.length === 1 || (section === 'boards' && segments.length === 2 && /^[0-9a-f-]{36}$/i.test(id)))
  )
    return <SavedWorkPage section={section} boardId={id} />;
  if (account && section === 'boards') notFound();
  const validRoot = segments.length === 1 && ['home', 'boards', 'docs'].includes(section);
  const validBoard = segments.length === 2 && section === 'boards' && boards.some((board) => board.id === id);
  const validDoc = segments.length === 2 && section === 'docs' && documents.some((doc) => doc.id === id);
  if (!validRoot && !validBoard && !validDoc) notFound();
  if (account && section === 'docs')
    return (
      <section className="empty-page">
        <h1>{id ? documents.find((doc) => doc.id === id)?.title : 'Docs'}</h1>
        <p>
          Document storage is not connected yet. Saved writing will be added after the NAS setup is settled.
        </p>
        <p>This area is a draft of the planned Docs feature. Task notes already save in your workspace.</p>
        <Link className="text-link" href="/boards">
          Back to boards
        </Link>
      </section>
    );
  return <WorkspacePage section={section as 'home' | 'boards' | 'docs'} id={id} />;
}
