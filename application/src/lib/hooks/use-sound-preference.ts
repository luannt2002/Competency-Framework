'use client';

/**
 * useSoundPreference — opt-in sound preference persisted in localStorage.
 *
 * Default is OFF so the app stays silent until the user explicitly opts in.
 * Components that play audio (e.g. confetti ding on lesson completion)
 * should consult this hook and skip playback when the preference is false.
 *
 * SSR-safe: reads `localStorage` inside a `useEffect`, so the first render
 * always returns `false` and any persisted preference is applied after
 * hydration. This means audio never fires during the first paint.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'sound-enabled';

export function useSoundPreference(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'true') setEnabledState(true);
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  return [enabled, setEnabled];
}
