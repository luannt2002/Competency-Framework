'use client';

/**
 * PageTransition — wraps authed page content in a subtle fade/slide motion.
 *
 * Mounted once per route inside the `(app)/layout.tsx` shell so every
 * navigated page re-mounts the inner `<motion.div>` and triggers the
 * intro animation. The keyframes are short on purpose (250ms in, 150ms
 * out) to feel responsive rather than decorative.
 *
 * Respects `prefers-reduced-motion`: when the user has reduced motion
 * enabled, both `initial` and `animate` are disabled so we render the
 * static layout immediately with no transition.
 */
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <motion.div key={pathname} initial={false} animate={false}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
