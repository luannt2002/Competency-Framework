'use client';

/**
 * ErrorBoundary — class-component boundary that catches render-time errors in
 * its subtree and renders a friendly retry surface.
 *
 *   <ErrorBoundary>
 *     <SomeChildThatMightThrow />
 *   </ErrorBoundary>
 *
 * "Retry" re-mounts the children by bumping an internal key — this is the
 * cheapest way to give the child a fresh render after a transient failure
 * (most commonly: a stale query, a flaky fetch, a missing field on a typed
 * response). For RSC errors we re-export a sibling helper, <RetryUI />,
 * that the Next.js `error.tsx` files use directly with their `reset` prop.
 *
 * Design intent: keep the look consistent with /app/(app)/error.tsx so the
 * fallback feels like part of the product, not a generic exception page.
 */
import * as React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom render — receives the captured error + reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Called whenever an error is captured (logging hook). */
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Bumped on retry so children re-mount fresh. */
  iteration: number;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null, iteration: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    // Surface in dev console + any external observer. We avoid swallowing.
    console.error('[ErrorBoundary]', error);
    this.props.onError?.(error);
  }

  private reset = (): void => {
    this.setState((s) => ({ error: null, iteration: s.iteration + 1 }));
  };

  override render(): React.ReactNode {
    const { error, iteration } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return <RetryUI error={error} reset={this.reset} />;
    }
    // Bumping the key on retry remounts the subtree — cheapest reliable reset.
    return <React.Fragment key={iteration}>{this.props.children}</React.Fragment>;
  }
}

export interface RetryUIProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Optional override for the heading. */
  title?: string;
  /** Optional override for the body copy. */
  description?: string;
}

/**
 * Standalone retry UI — usable by Next.js `error.tsx` boundaries that already
 * receive `error` + `reset` props from the framework.
 */
export function RetryUI({
  error,
  reset,
  title = 'Có lỗi xảy ra',
  description,
}: RetryUIProps) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div className="surface p-8 max-w-md text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {description || error.message || 'Đã xảy ra lỗi không mong muốn.'}
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
              ref: {error.digest}
            </p>
          )}
        </div>
        <Button onClick={reset} className="mt-2">
          <RefreshCcw className="size-4" />
          Thử lại
        </Button>
      </div>
    </div>
  );
}
