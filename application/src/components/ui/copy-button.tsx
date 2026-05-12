'use client';

/**
 * CopyButton — icon-only "copy to clipboard" affordance.
 *
 *   <CopyButton value={user.id} label="Copy user ID" />
 *
 * Renders a `Copy` icon by default; flips to a `Check` icon for 1.5s after a
 * successful copy. The whole thing is wrapped in a tooltip so sighted users
 * get a "Copy" / "Đã copy" hint and keyboard users get an aria-label.
 *
 * Falls back gracefully when navigator.clipboard isn't available (older
 * browsers, http://localhost-without-secure-context, etc.) — uses a one-off
 * `<textarea>+execCommand('copy')` shim. If even that fails, the visual
 * doesn't flip and a Sonner error toast surfaces the problem.
 */
import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const COPIED_HOLD_MS = 1500;

export interface CopyButtonProps {
  /** Text payload to drop on the clipboard. */
  value: string;
  /** Accessible label / idle tooltip text. Defaults to `Copy`. */
  label?: string;
  /** Tooltip text when the copy succeeded. Defaults to `Đã copy`. */
  copiedLabel?: string;
  /** Visual size. `sm` = 24px, `md` = 32px. Defaults to `md`. */
  size?: 'sm' | 'md';
  /** Extra classes for the button shell. */
  className?: string;
}

async function copyToClipboard(value: string): Promise<boolean> {
  // Preferred: secure-context clipboard API.
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to legacy shim.
    }
  }
  // Legacy shim — works on insecure contexts and a few odd browsers.
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Đã copy',
  size = 'md',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const onClick = async () => {
    const ok = await copyToClipboard(value);
    if (!ok) {
      toast.error('Không copy được', { description: 'Trình duyệt từ chối clipboard.' });
      return;
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), COPIED_HOLD_MS);
  };

  const sizeCls =
    size === 'sm' ? 'size-6 [&_svg]:size-3' : 'size-8 [&_svg]:size-3.5';

  return (
    <Tooltip label={copied ? copiedLabel : label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={copied ? copiedLabel : label}
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
          sizeCls,
          className,
        )}
      >
        {copied ? (
          <Check className="text-emerald-500" aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
      </button>
    </Tooltip>
  );
}
