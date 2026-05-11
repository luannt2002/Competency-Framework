'use client';

/**
 * Global authenticated app error boundary.
 *
 * Renders when any RSC under /(app)/ throws and the workspace-scoped
 * error.tsx doesn't catch first. Provides a graceful card + retry.
 */
import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the browser console — surfaces in dev/prod and Sentry breadcrumbs.
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="surface p-8 max-w-md text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred while loading this page.'}
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
              ref: {error.digest}
            </p>
          )}
        </div>
        <Button onClick={reset} className="mt-2">
          <RefreshCcw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
