import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { QueryProvider } from '@/components/layout/query-provider';
import '@/styles/globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

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
      className={`${GeistSans.variable} ${GeistMono.variable} ${outfit.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <QueryProvider>{children}</QueryProvider>
          <Toaster
            position="bottom-right"
            theme="light"
            richColors
            closeButton
            duration={3000}
            toastOptions={{
              classNames: {
                toast: 'bg-card border border-border text-foreground shadow-lg',
                title: 'font-medium',
                description: 'text-muted-foreground text-xs',
                success:
                  'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
                error:
                  'bg-destructive/10 border-destructive/30 text-destructive',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
