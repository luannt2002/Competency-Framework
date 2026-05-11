'use client';

/**
 * Workspace-scoped error boundary.
 *
 * Catches errors under /w/[slug]/* — e.g. missing workspace, RLS denials, query
 * failures inside dashboard/skills/learn/daily routes. Stays scoped so the
 * sidebar + topbar remain rendered.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[workspace error boundary]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <div className="surface p-8 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Couldn&apos;t load this workspace section</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || 'A query or render error occurred. You can retry, or jump back to your profile.'}
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" asChild>
            <Link href="/profile">
              <ArrowLeft className="size-4" />
              My workspaces
            </Link>
          </Button>
          <Button onClick={reset}>
            <RefreshCcw className="size-4" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
