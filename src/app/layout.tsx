import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workspace — your shared workspace',
  description: 'A local prototype for projects, tasks, and shared documents.',
  referrer: 'no-referrer',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#111419', colorScheme: 'dark' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
