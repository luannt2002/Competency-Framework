/**
 * PrintButton — fires `window.print()` so the browser opens its native
 * "Print / Save as PDF" dialog. Used by /w/[slug]/certificate/[memberId].
 *
 * Kept as a tiny client island so the certificate page itself can stay a
 * server component.
 */
'use client';

import { Button } from '@/components/ui/button';

export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <Button
      onClick={() => {
        if (typeof window !== 'undefined') window.print();
      }}
    >
      {children}
    </Button>
  );
}
