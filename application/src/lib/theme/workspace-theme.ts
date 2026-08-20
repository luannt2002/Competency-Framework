/**
 * Workspace appearance theming.
 *
 * Owners can pick an emoji icon + an accent color from a curated palette
 * (whitelisted server-side — no free-form CSS injection). The accent is
 * applied per-workspace by overriding the brand CSS variables in the
 * workspace layout, so every workspace in the multi-tenant app can look
 * distinct without touching global styles.
 */

export type AccentOption = {
  /** Hex value stored in workspaces.color */
  hex: string;
  /** Vietnamese display name */
  label: string;
};

/** Curated accent palette (AA-friendly on both light & dark bases). */
export const ACCENT_PALETTE: AccentOption[] = [
  { hex: '#1e40af', label: 'Xanh Innocom' },
  { hex: '#0891b2', label: 'Xanh cyan' },
  { hex: '#059669', label: 'Xanh lá' },
  { hex: '#7c3aed', label: 'Tím' },
  { hex: '#c026d3', label: 'Hồng đậm' },
  { hex: '#db2777', label: 'Hồng' },
  { hex: '#dc2626', label: 'Đỏ' },
  { hex: '#ea580c', label: 'Cam' },
  { hex: '#ca8a04', label: 'Vàng đậm' },
  { hex: '#0f766e', label: 'Teal' },
];

/** Curated emoji list for the workspace icon picker. */
export const EMOJI_PALETTE = [
  '📚', '☁️', '🚀', '🛠️', '🧪', '🎯', '🏆', '🔥',
  '🌱', '⚡', '🧠', '💻', '🔧', '📐', '🎨', '🧭',
  '🛡️', '📦', '🐋', '🦀',
] as const;

export function isAccentAllowed(hex: string): boolean {
  return ACCENT_PALETTE.some((a) => a.hex.toLowerCase() === hex.toLowerCase());
}

export function isEmojiAllowed(icon: string): boolean {
  return (EMOJI_PALETTE as readonly string[]).includes(icon);
}

/** hex (#rrggbb) → "h s% l%" for shadcn HSL CSS variables. */
export function hexToHsl(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '221 83% 35%'; // fall back to brand blue
  const n = m[1]!;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Inline <style> that re-points the brand variables at the workspace accent.
 * Lightened/darkened variants keep gradients + focus rings readable.
 */
export function workspaceAccentStyle(hex: string | null | undefined): string {
  if (!hex || !isAccentAllowed(hex)) return '';
  const hsl = hexToHsl(hex);
  const [h = '221', s = '83%', l = '35%'] = hsl.split(' ');
  const light = `${h} ${s} ${Math.min(Number(l.replace('%', '')) + 18, 92)}%`;
  return `:root {
  --primary: ${hsl};
  --ring: ${hsl};
  --brand-blue: ${hex};
  --brand-blue-light: hsl(${light});
}
.dark {
  --primary: hsl(${light});
  --ring: hsl(${light});
  --brand-blue: hsl(${light});
  --brand-blue-light: hsl(${light});
}`;
}
