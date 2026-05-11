import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { QueryProvider } from '@/components/layout/query-provider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Competency Framework',
  description: 'Fork a competency framework. Learn the gaps. Master the level.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>{children}</QueryProvider>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              classNames: {
                toast: 'bg-card border-border text-foreground',
                title: 'font-medium',
                description: 'text-muted-foreground text-xs',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
