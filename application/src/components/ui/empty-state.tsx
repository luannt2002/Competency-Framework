import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * EmptyState — reusable, centered empty-state card.
 *
 * Composes a tinted icon halo, title, optional description, and an optional
 * action node (usually a <Button> or <Button asChild><Link>).
 *
 * @example
 *   <EmptyState
 *     icon={Grid3x3}
 *     title="No skills yet"
 *     description="Re-fork the framework to repopulate this matrix."
 *     action={<Button asChild><Link href="/onboarding">Re-fork framework</Link></Button>}
 *   />
 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Lucide icon component (e.g. `Grid3x3`). */
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional CTA — typically a <Button>. */
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
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
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </div>
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
