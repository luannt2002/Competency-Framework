import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Skeleton — animated shimmer placeholder.
 *
 * Pure Tailwind: `animate-pulse` + a subtle gradient that hints at content shape.
 * Use as a low-level primitive; compose higher-level skeleton components from these.
 *
 * @example
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton variant="circle" className="size-10" />
 */
const skeletonVariants = cva(
  'animate-pulse bg-gradient-to-br from-secondary via-secondary/60 to-secondary/80',
  {
    variants: {
      variant: {
        default: 'rounded-md',
        rounded: 'rounded-lg',
        circle: 'rounded-full',
        pill: 'rounded-full',
        card: 'rounded-2xl',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      role="status"
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Skeleton, skeletonVariants };
