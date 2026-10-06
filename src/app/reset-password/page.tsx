import { AuthForm } from '@/components/auth-form';
export const dynamic = 'force-dynamic';
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthForm
      mode="reset-password"
      token={typeof token === 'string' && token.length <= 256 ? token : undefined}
    />
  );
}
