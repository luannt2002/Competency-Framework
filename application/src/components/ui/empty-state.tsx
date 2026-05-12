import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * EmptyState — reusable, centered empty-state card.
 *
 * Composes a tinted icon halo OR an illustration slot, plus title, optional
 * description, and an optional action node (usually a <Button> or
 * <Button asChild><Link>).
 *
 * Pass `illustration` to use a custom SVG (see `empty-state-illustrations.tsx`)
 * — it takes precedence over `icon`. Pass `icon` for the legacy round halo.
 *
 * @example
 *   <EmptyState
 *     illustration={<NoWorkspacesIllustration />}
 *     title="No workspaces yet"
 *     description="Fork a framework to start tracking skills."
 *     action={<Button asChild><Link href="/onboarding">Get started</Link></Button>}
 *   />
 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Lucide icon component (e.g. `Grid3x3`). Ignored if `illustration` is set. */
  icon?: LucideIcon;
  /** Custom illustration node (e.g. an inline SVG). Takes precedence over `icon`. */
  illustration?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional CTA — typically a <Button>. */
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'surface flex flex-col items-center justify-center gap-3 p-10 text-center',
        className,
      )}
      {...rest}
    >
      {illustration ? (
        // Illustration wins over the icon halo when both are provided. We
        // wrap so consumers can pass a className-less SVG and still get
        // consistent vertical rhythm.
        <div className="mb-1">{illustration}</div>
      ) : (
        Icon && (
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
            <Icon className="size-6" aria-hidden="true" />
          </div>
        )
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
