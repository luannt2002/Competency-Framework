'use client';

/**
 * TopProgressBar — slim coral bar at the top of the viewport that animates
 * during route transitions.
 *
 * Implementation notes:
 *  - Next 15's App Router doesn't expose `router.events`, so we intercept the
 *    user-side actions that *cause* a transition: clicks on internal links
 *    and form submissions to internal URLs. That covers ~all navigation
 *    initiated from rendered UI.
 *  - The bar fills to ~80% on start (trickling), then snaps to 100% + fades
 *    out when the new route paints (we watch for the next paint via a
 *    pathname-change effect to detect completion). If the user cancels the
 *    nav (Cmd-click, target=_blank, modifier keys, downloads, etc.), we
 *    suppress the start.
 *  - Honours `prefers-reduced-motion`: the bar still shows but skips the
 *    trickle animation, jumping straight to ~80% and then 100%.
 *
 * The bar is intentionally lightweight (no external dep) so it adds <2KB to
 * the layout bundle.
 */
import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const COLOR = '#cc785c'; // matches --primary
const HEIGHT_PX = 2;
const TRICKLE_TARGET = 0.85; // stop creeping at 85% until route resolves
const FADE_OUT_MS = 250;

function isInternalNav(target: EventTarget | null): { internal: boolean; href: string | null } {
  if (!(target instanceof HTMLElement)) return { internal: false, href: null };
  const anchor = target.closest('a');
  if (!anchor) return { internal: false, href: null };
  const href = anchor.getAttribute('href');
  if (!href) return { internal: false, href: null };
  // External / scheme / hash / new-tab navigations don't trigger a router
  // transition — leave the bar alone.
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#') ||
    anchor.getAttribute('target') === '_blank' ||
    anchor.hasAttribute('download')
  ) {
    return { internal: false, href: null };
  }
  return { internal: true, href };
}

export function TopProgressBar() {
  // useSearchParams() forces a Suspense boundary in Next 15 — wrap the inner
  // component so the layout doesn't get bailed out of static rendering.
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  );
}

function TopProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const trickleRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTrickle = React.useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
  }, []);

  const start = React.useCallback(() => {
    if (fadeRef.current) {
      clearTimeout(fadeRef.current);
      fadeRef.current = null;
    }
    setVisible(true);
    setProgress(0.08);
    stopTrickle();
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Jump straight to the trickle ceiling without animating the climb.
      setProgress(TRICKLE_TARGET);
      return;
    }
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= TRICKLE_TARGET) return p;
        // Decelerating easing — bigger jumps early, tiny crawl near the end.
        const gap = TRICKLE_TARGET - p;
        return p + Math.max(0.005, gap * 0.07);
      });
    }, 200);
  }, [stopTrickle]);

  const finish = React.useCallback(() => {
    stopTrickle();
    setProgress(1);
    fadeRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, FADE_OUT_MS);
  }, [stopTrickle]);

  // Detect "navigation initiated" — any plain click on an internal <a> or a
  // submit on a form whose action is internal.
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Respect modifier-key user intent (open-in-new-tab etc).
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      const info = isInternalNav(e.target);
      if (!info.internal || !info.href) return;
      // Don't trigger on same-page anchors.
      if (info.href === pathname) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const action = form.getAttribute('action');
      // If no action, the form likely fires a server action — still counts as
      // a transition that will refresh the route.
      if (action && (action.startsWith('http') || action.startsWith('//'))) return;
      start();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [pathname, start]);

  // Detect "navigation finished" — Next replays this effect when pathname OR
  // search params change after the new route renders.
  React.useEffect(() => {
    if (!visible) return;
    finish();
    // We only want to react to a *change* in the route key, not to `visible`
    // toggling, so depend on the route signal only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Clean up timers on unmount.
  React.useEffect(
    () => () => {
      stopTrickle();
      if (fadeRef.current) clearTimeout(fadeRef.current);
    },
    [stopTrickle],
  );

  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: HEIGHT_PX,
        width: `${Math.round(progress * 100)}%`,
        background: COLOR,
        boxShadow: `0 0 8px ${COLOR}, 0 0 4px ${COLOR}`,
        transition: `width 200ms ease-out, opacity ${FADE_OUT_MS}ms ease-out`,
        opacity: progress >= 1 ? 0 : 1,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
}
