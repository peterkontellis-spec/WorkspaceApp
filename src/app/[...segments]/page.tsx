import { notFound } from 'next/navigation';
import { WorkspacePage } from '@/components/workspace-pages';
import { boards, documents } from '@/lib/demo';

export default async function Page({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const [section, id] = segments;
  const validRoot = segments.length === 1 && ['home', 'boards', 'docs'].includes(section);
  const validBoard = segments.length === 2 && section === 'boards' && boards.some((board) => board.id === id);
  const validDoc = segments.length === 2 && section === 'docs' && documents.some((doc) => doc.id === id);
  if (!validRoot && !validBoard && !validDoc) notFound();
  return <WorkspacePage section={section as 'home' | 'boards' | 'docs'} id={id} />;
}
