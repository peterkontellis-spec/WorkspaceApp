import { requireAccount } from '@/server/auth';
import { TeamSettings } from '@/components/team-settings';
export default async function TeamPage() {
  const account = await requireAccount();
  if (!account)
    return (
      <section>
        <h1>Team access</h1>
        <p className="auth-copy">
          Team accounts are unavailable in sample-only mode. Start the accounts preview to manage real
          members.
        </p>
      </section>
    );
  return <TeamSettings />;
}
