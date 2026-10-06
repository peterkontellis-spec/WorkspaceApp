import type { Metadata, Viewport } from 'next';
import './globals.css';
import './themes.css';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Workspace — your shared workspace',
  description: 'A local prototype for projects, tasks, and shared documents.',
  referrer: 'no-referrer',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#121A25', colorScheme: 'dark light' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const a=JSON.parse(localStorage.getItem('workspace-appearance-v1')||'null');if(a&&(a.mode==='light'||a.mode==='dark')){document.documentElement.dataset.theme=a.mode;document.documentElement.dataset.starTint=a.tint===false?'off':'on';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',a.mode==='light'?'#F4F1E9':'#121A25');}}catch{}`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
