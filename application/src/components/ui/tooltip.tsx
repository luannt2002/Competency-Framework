'use client';

/**
 * Tooltip primitives — thin wrapper around @radix-ui/react-tooltip with our
 * paper-coral styling (cream popover, warm border, coral focus ring).
 *
 * Usage:
 *   <Tooltip label="Xoá tài liệu">
 *     <Button variant="ghost"><Trash2 className="size-4" /></Button>
 *   </Tooltip>
 *
 * Or compose manually:
 *   <TooltipProvider>
 *     <TooltipRoot>
 *       <TooltipTrigger asChild>...</TooltipTrigger>
 *       <TooltipContent>Label</TooltipContent>
 *     </TooltipRoot>
 *   </TooltipProvider>
 *
 * The convenience <Tooltip /> wrapper handles the provider + root for the
 * common case of a single trigger. It is a no-op (renders just the child)
 * when `label` is empty/undefined so consumers can pass conditional labels.
 */
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export interface TooltipProps {
  /** Tooltip text. When falsy, the wrapper renders the child unchanged. */
  label?: React.ReactNode;
  /** Side to position the popup. Default: top. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Delay before opening, in ms. Default: 150. */
  delayDuration?: number;
  /** The triggering element. */
  children: React.ReactNode;
}

/**
 * Convenience single-trigger tooltip. Wraps children in Provider/Root/Trigger
 * and renders the label via TooltipContent. Use the lower-level primitives
 * directly for richer cases (multiple triggers sharing a provider, custom
 * positioning, etc.).
 */
export function Tooltip({
  label,
  side = 'top',
  delayDuration = 150,
  children,
}: TooltipProps) {
  if (!label) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={delayDuration} disableHoverableContent>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
