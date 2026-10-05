import type { Metadata, Viewport } from 'next';
import { WorkspaceShell } from '@/components/workspace-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workspace — your shared workspace',
  description: 'A local prototype for projects, tasks, and shared documents.',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#111419', colorScheme: 'dark' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><WorkspaceShell>{children}</WorkspaceShell></body></html>;
}
