import { requireAccount } from '@/server/auth';
import { WorkspaceShell } from '@/components/workspace-shell';
import { WorkspaceProvider } from '@/components/demo-provider';
import { NavigationMemoryProvider } from '@/components/task-navigation';
import { WorkProvider } from '@/components/work-provider';
import { SessionBoundary } from '@/components/session-boundary';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();
  return <WorkspaceProvider><WorkProvider key={account?.id ?? "prototype"} enabled={Boolean(account)} expectedAccountId={account?.id}><SessionBoundary account={account}><NavigationMemoryProvider><WorkspaceShell account={account}>{children}</WorkspaceShell></NavigationMemoryProvider></SessionBoundary></WorkProvider></WorkspaceProvider>;
}
