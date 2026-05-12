/**
 * App shell layout — applies to all authenticated routes.
 * Requires user; the /w/[slug] layout adds workspace-scoping inside.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/supabase-server';
import { KeyboardHelp } from '@/components/layout/keyboard-help';
import { PageTransition } from '@/components/layout/page-transition';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  return (
    <>
      <PageTransition>{children}</PageTransition>
      <KeyboardHelp />
    </>
  );
}
