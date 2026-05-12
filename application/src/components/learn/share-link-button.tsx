'use client';

/**
 * Small client button that copies the current page URL to the clipboard
 * and shows a toast confirmation. Used on the public /share page.
 */
import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';

export function ShareLinkButton({
  label = 'Copy link share',
  /** Relative or absolute URL. If omitted, copies the current page URL. */
  url,
}: {
  label?: string;
  url?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      let finalUrl = '';
      if (typeof window !== 'undefined') {
        if (url) {
          finalUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
        } else {
          finalUrl = window.location.href;
        }
      }
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      toast.success('Đã copy link share', { description: finalUrl });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Không copy được — kiểm tra quyền clipboard.');
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-secondary transition-colors"
    >
      {copied ? (
        <>
          <Check className="size-3.5" /> Đã copy
        </>
      ) : (
        <>
          <Link2 className="size-3.5" /> {label}
        </>
      )}
    </button>
  );
}
