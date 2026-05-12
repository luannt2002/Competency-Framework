'use client';

/**
 * useDraft — auto-persist a piece of form state to localStorage.
 *
 *   const [value, setValue, clear] = useDraft('journal:abc:new', { title: '', body: '' });
 *
 * Behavior:
 *  - On mount, attempts to hydrate from localStorage[key]. Any JSON parse
 *    failure is swallowed and the `initial` value is kept.
 *  - Every change debounces a write to localStorage (500ms). The most recent
 *    pending write also flushes on unmount so a quick blur+close doesn't lose
 *    the last keystroke.
 *  - `clear()` removes the key and resets to `initial`. Call it on submit
 *    success so a successfully-saved draft doesn't haunt the user later.
 *  - SSR-safe: skips storage I/O when `window` is undefined.
 *
 * The hook intentionally returns a stable `setValue` reference (memoised) so
 * passing it to deps arrays in callers is cheap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 500;

export function useDraft<T>(
  key: string,
  initial: T,
): [T, (v: T) => void, () => void] {
  const [value, setValueState] = useState<T>(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  // Track whether the initial localStorage hydration has finished so we don't
  // overwrite a stored draft with the SSR initial in the very first write.
  const hydratedRef = useRef(false);

  // Hydrate on mount (client only).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as T;
        setValueState(parsed);
      }
    } catch {
      // Corrupt JSON — ignore and keep `initial`.
    } finally {
      hydratedRef.current = true;
    }
    // The key is the identity of the draft; if it changes we re-hydrate.
  }, [key]);

  // Debounced write. We hold a ref to the last requested value so the flush
  // callback always sees the most recent input.
  const scheduleWrite = useCallback(
    (next: T) => {
      if (typeof window === 'undefined') return;
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify(pendingRef.current));
        } catch {
          // Quota / private-mode — non-fatal.
        }
        timerRef.current = null;
        pendingRef.current = null;
      }, DEBOUNCE_MS);
    },
    [key],
  );

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      if (hydratedRef.current) scheduleWrite(next);
    },
    [scheduleWrite],
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    setValueState(initial);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Non-fatal.
    }
    // `initial` is captured at hook-call time; callers passing a stable
    // reference get stable reset behavior. (Recreating `initial` per render
    // would only matter for unusual reset semantics not needed here.)
  }, [key, initial]);

  // Flush any pending write on unmount so a fast close-then-reload doesn't
  // lose the last keystroke.
  useEffect(() => {
    return () => {
      if (timerRef.current && pendingRef.current !== null) {
        try {
          window.localStorage.setItem(key, JSON.stringify(pendingRef.current));
        } catch {
          // Non-fatal.
        }
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key]);

  return [value, setValue, clear];
}
