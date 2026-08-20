/**
 * JS-land twin of the CSS colour scales.
 *
 * WHY A SECOND COPY EXISTS
 * ------------------------
 * Everything that renders through the DOM should use the Tailwind tokens
 * (`primary`, `hue-1` … `hue-5`) which read CSS variables and therefore follow
 * light/dark automatically. But three kinds of consumer cannot:
 *
 *   - **Recharts / inline SVG `<stop>`** — take colour *strings*, not classes.
 *   - **canvas-confetti** — draws on a canvas, outside CSS entirely.
 *   - **Tailwind arbitrary values** — `border-l-[#hex]` is a literal by design.
 *
 * Those used to inline their own hexes, which is how the codebase ended up
 * with `#22D3EE`/`#8B5CF6` (a dead cyan→violet accent), `#ff6b6b` (a coral from
 * an even older palette) and `#cc785c` on the loading bar — the last one
 * carrying a comment claiming it "matches --primary" when `--primary` had long
 * since become brand blue. Three palettes, none of them themeable.
 *
 * This module is the one place those literals may live. Values are the light
 * theme's; dark-mode-sensitive surfaces should still use the CSS tokens.
 *
 * Keep in sync with `src/styles/globals.css`:
 *   --brand-blue / --brand-red   →  BRAND
 *   --hue-1 … --hue-5            →  HUE
 *
 * `src/lib/constants/` is outside the scan roots of guard-no-adhoc-color and
 * guard-no-hardcode by design — this is the sanctioned home for UI literals.
 */

/** Brand pair. Mirrors `--brand-blue` / `--brand-red`. */
export const BRAND = {
  blue: '#1e40af',
  blueLight: '#3b82f6',
  red: '#dc2626',
  redLight: '#ef4444',
} as const;

/**
 * Categorical scale — the JS mirror of `--hue-1` … `--hue-5`.
 * Use for "these series/categories must read as different", never for brand.
 */
export const HUE = {
  1: '#06b6d4', // cyan
  2: '#9333ea', // purple
  3: '#ca8a04', // yellow
  4: '#10b981', // green
  5: '#ec4899', // pink
} as const;

/** Neutral used when a category has no colour assigned yet (slate-600). */
export const NEUTRAL_FALLBACK = '#475569';

/**
 * Chart roles. Recharts needs strings, so these are the named slots every
 * chart pulls from instead of picking a hex per file.
 */
export const CHART = {
  /** Primary series — the "you" line. */
  primary: BRAND.blue,
  /** Secondary series — the comparison/target line. */
  secondary: HUE[2],
  /** Gap / deficit / danger series. */
  gap: BRAND.red,
  /** Axis labels + gridlines. */
  axis: NEUTRAL_FALLBACK,
} as const;

/** Gradient stops for decorative progress indicators (rings, bars). */
export const BRAND_GRADIENT = {
  from: BRAND.blue,
  to: BRAND.red,
} as const;

/**
 * Celebration colours for canvas-confetti. Deliberately the full categorical
 * scale plus brand — a single-hue burst reads as an error state, not a reward.
 */
export const CONFETTI_PALETTE = [BRAND.blue, HUE[1], HUE[2], HUE[5]] as const;

/**
 * Roster heat scale. The completion heatmap tints one accent by alpha rather
 * than hopping hues, so a dense grid still reads as one quantity. Expressed as
 * an RGB triplet because the caller interpolates alpha per cell.
 *
 * Was `rgba(255, 122, 89, …)` inline — a coral that matched no token.
 */
export const HEATMAP_RGB = '30, 64, 175'; // BRAND.blue in r,g,b
