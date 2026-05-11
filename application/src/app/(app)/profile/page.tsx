/**
 * Profile page — current user's info + list of owned workspaces.
 * M5 will add: avatar upload, total XP, streak heatmap, badges grid.
 */
import { requireUser } from '@/lib/auth/supabase-server';
import { listMyWorkspaces } from '@/lib/workspace';
import Link from 'next/link';
import { User as UserIcon, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function ProfilePage() {
  const user = await requireUser();
  const workspaces = await listMyWorkspaces();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-4">
        <div className="size-16 rounded-full accent-gradient flex items-center justify-center text-white text-2xl font-bold">
          {user.email?.charAt(0).toUpperCase() ?? 'U'}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.email}</h1>
          <p className="text-sm text-muted-foreground">User ID: <code>{user.id.slice(0, 8)}…</code></p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>My Workspaces ({workspaces.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspaces.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No workspaces yet.{' '}
              <Link href="/onboarding" className="underline">Fork a framework</Link>.
            </div>
          ) : (
            workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/w/${w.slug}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary"
              >
                <div className="size-8 rounded-lg accent-gradient flex items-center justify-center text-white font-bold text-sm">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{w.name}</div>
                  <div className="text-xs text-muted-foreground">/{w.slug}</div>
                </div>
              </Link>
            ))
          )}

          <Button asChild variant="outline" className="w-full mt-3">
            <Link href="/onboarding">
              <Plus className="size-4" />
              New workspace
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
