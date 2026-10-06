import { requireAccount } from '@/server/auth';
import { WorkspaceShell } from '@/components/workspace-shell';
import { WorkspaceProvider } from '@/components/demo-provider';
import { NavigationMemoryProvider } from '@/components/task-navigation';
import { SessionBoundary } from '@/components/session-boundary';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();
  return <WorkspaceProvider><SessionBoundary account={account}><NavigationMemoryProvider><WorkspaceShell account={account}>{children}</WorkspaceShell></NavigationMemoryProvider></SessionBoundary></WorkspaceProvider>;
}
