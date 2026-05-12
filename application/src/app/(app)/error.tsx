'use client';

/**
 * Global authenticated app error boundary.
 *
 * Renders when any RSC under /(app)/ throws and the workspace-scoped
 * error.tsx doesn't catch first. Delegates to the shared <RetryUI/>
 * so the look is identical to the in-tree <ErrorBoundary/>.
 */
import { useEffect } from 'react';
import { RetryUI } from '@/components/ui/error-boundary';

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
    <RetryUI
      error={error}
      reset={reset}
      title="Có lỗi xảy ra"
      description={
        error.message || 'Đã xảy ra lỗi không mong muốn khi tải trang này.'
      }
    />
  );
}
