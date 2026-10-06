import { InvitationForm } from '@/components/invitation-form';
export const dynamic = 'force-dynamic';
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const query = await searchParams;
  const token = typeof query.token === 'string' && query.token.length <= 256 ? query.token : '';
  return <InvitationForm key={token} token={token} />;
}
