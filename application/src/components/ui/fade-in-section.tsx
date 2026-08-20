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
    // Backstop for restored scroll positions (browser back / reload lands
    // mid-page): anything already at or above the fold is revealed straight
    // away. Without this, an IntersectionObserver never fires for elements
    // that are entirely ABOVE the viewport at mount, leaving them stuck at
    // opacity 0 for the rest of the session.
    if (el.getBoundingClientRect().top < window.innerHeight) {
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
      // threshold 0 + a negative bottom rootMargin: reveal as soon as the
      // section's top edge crosses ~12% up from the viewport bottom.
      //
      // A ratio-based threshold (the previous `0.5`) is unusable here: the
      // ratio is `intersection area / element area`, so any section taller
      // than 2× the viewport can never reach 0.5 and would stay permanently
      // invisible — which is exactly what happened to the long landing
      // sections on a 360px phone.
      { threshold: 0, rootMargin: '0px 0px -12% 0px' },
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
