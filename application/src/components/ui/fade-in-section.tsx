'use client';

/**
 * FadeInSection — scroll-triggered fade-up reveal.
 *
 * Wraps children in a `<section>` that starts invisible + offset and animates
 * into view once 50% of its area enters the viewport. Uses IntersectionObserver
 * so it is cheap; observer disconnects after the first reveal (no re-trigger).
 *
 * Optional `delay` (ms) staggers cascading siblings.
 *
 * @example
 *   <FadeInSection delay={150}>
 *     <Hero />
 *   </FadeInSection>
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

interface FadeInSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Delay (ms) before the transition begins after element becomes visible. */
  delay?: number;
  /** Element tag to render — defaults to `<section>`. */
  as?: 'section' | 'div' | 'article' | 'header' | 'footer';
}

export function FadeInSection({
  children,
  className,
  delay = 0,
  as = 'section',
  ...rest
}: FadeInSectionProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respect the user's reduced-motion preference — render visible
    // immediately, skip the observer entirely. We check this at effect time
    // rather than during render so SSR output stays animation-eligible (the
    // CSS `motion-reduce:transition-none` still kills the visual transition
    // on the very first paint).
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true);
      return;
    }
    // SSR-safe: window/IntersectionObserver only exists in browser.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: visible && delay > 0 ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
