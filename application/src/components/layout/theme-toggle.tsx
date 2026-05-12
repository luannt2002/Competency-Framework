'use client';

/**
 * ThemeToggle — small button that flips between light and dark themes.
 * Uses next-themes (mounted via ThemeProvider in /app/layout.tsx).
 */
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Theme toggle"
        className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card opacity-60"
      >
        <Sun className="size-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card hover:bg-secondary transition-colors"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
