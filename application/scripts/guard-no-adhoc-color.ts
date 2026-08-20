/**
 * guard-no-adhoc-color.ts
 *
 * Keeps the styling system from drifting back apart.
 *
 * THE PROBLEM THIS PREVENTS
 * ------------------------
 * The project declares a brand palette (`--brand-blue` #1e40af / `--brand-red`
 * #dc2626, surfaced as the shadcn `primary` token) and a 5-hue categorical
 * palette (`--rm-cyan/purple/yellow/green/pink`, used for rotating phase
 * colors on the roadmap). Both are single-source-of-truth CSS variables.
 *
 * In practice components ignored them and reached for raw Tailwind palette
 * classes instead — `text-cyan-500`, `bg-violet-500/10`, `ring-sky-500/20` —
 * plus 77 hardcoded `#hex` / `rgb()` literals. The result was three competing
 * colour systems: the brand tokens, the roadmap hues, and an ad-hoc
 * cyan/violet/pink palette scattered across 36 files. Dark mode and theming
 * only covered the first two, so the third drifted visually and could not be
 * re-themed per workspace at all.
 *
 * WHAT IS ALLOWED
 * ---------------
 *  - Semantic tokens: primary, secondary, muted, accent, destructive,
 *    background, foreground, card, popover, border, input, ring.
 *  - Categorical hues: `hue-1` … `hue-5` (the roadmap palette, exposed as
 *    real Tailwind colours so opacity modifiers work).
 *  - State colours that carry meaning independent of branding: emerald/green
 *    (success), amber/yellow (warning), red/rose (danger). These stay because
 *    recolouring "done" to brand-blue would destroy the signal.
 *  - Neutrals: slate / gray / zinc / neutral / stone / white / black.
 *
 * WHAT IS BLOCKED
 * ---------------
 *  - Brand-adjacent hues picked ad hoc: cyan, sky, violet, purple, fuchsia,
 *    pink, indigo, teal. Use `primary` (interactive/brand) or `hue-N`
 *    (categorical) instead.
 *  - Raw `#rrggbb` / `rgb()` / `rgba()` / `hsl()` literals in JSX.
 *
 * Scope: `src/components/**` and `src/app/**` — the same surface the sibling
 * guards cover. `src/styles/globals.css` is exempt by design: that file is
 * where the literals are *supposed* to live.
 *
 * Escape hatch: a file whose first non-empty line is
 *   // guard-no-adhoc-color: allow
 * is skipped, for genuinely one-off surfaces (OG image rendering, printable
 * certificates) where a token cannot reach.
 *
 * Exit code: 0 clean, 1 on any offence.
 */

import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [join(ROOT, 'src', 'components'), join(ROOT, 'src', 'app')];
const SCAN_EXTENSIONS = ['.tsx', '.ts'];

const ALLOW_MARKER = 'guard-no-adhoc-color: allow';

/** Hues that must go through `primary` or `hue-N` instead. */
const BANNED_HUES = [
  'cyan',
  'sky',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'indigo',
  'teal',
] as const;

/** Tailwind utility prefixes that take a colour. */
const COLOR_PREFIXES = [
  'text',
  'bg',
  'border',
  'ring',
  'shadow',
  'from',
  'via',
  'to',
  'fill',
  'stroke',
  'decoration',
  'outline',
  'divide',
  'accent',
  'caret',
] as const;

const BANNED_CLASS_RE = new RegExp(
  String.raw`\b(?:${COLOR_PREFIXES.join('|')})-(?:${BANNED_HUES.join('|')})-\d{2,3}\b`,
  'g',
);

/**
 * Colour literals. `hsl(var(--x))` is fine — that IS the token system — so the
 * pattern only fires on hsl() with a numeric first argument.
 */
const HEX_RE = /#[0-9a-fA-F]{6}\b/g;
const HSL_RE = /\bhsla?\(\s*\d/g;

/**
 * `rgb()` / `rgba()` with a numeric first channel.
 *
 * Neutral values — where R, G and B are equal — are deliberately allowed: a
 * scrim like `rgba(0,0,0,0.06)` or a white veil is a transparency decision,
 * not a palette one. Forcing those through a colour token would invent a
 * dependency that does not exist and makes overlays harder to reason about.
 * Anything with a colour cast still has to come from a token.
 */
const RGB_RE = /\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;

function isNeutralRgb(m: RegExpMatchArray): boolean {
  const [, r, g, b] = m;
  return r === g && g === b;
}

type Offence = { file: string; line: number; text: string; found: string; hint: string };

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory absent (e.g. fresh clone without a route group)
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      yield* walk(full);
    } else if (SCAN_EXTENSIONS.some((ext) => e.name.endsWith(ext))) {
      yield full;
    }
  }
}

function isAllowlisted(source: string): boolean {
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    return line.includes(ALLOW_MARKER);
  }
  return false;
}

function scan(file: string, source: string): Offence[] {
  const out: Offence[] = [];
  const lines = source.split('\n');

  lines.forEach((text, i) => {
    // Comments explain the rules; they are not styling.
    const trimmed = text.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;

    for (const m of text.matchAll(BANNED_CLASS_RE)) {
      out.push({
        file,
        line: i + 1,
        text: trimmed,
        found: m[0],
        hint: 'dùng `primary` (thương hiệu/tương tác) hoặc `hue-1..5` (phân loại)',
      });
    }
    for (const re of [HEX_RE, RGB_RE, HSL_RE]) {
      for (const m of text.matchAll(re)) {
        if (re === RGB_RE && isNeutralRgb(m)) continue; // scrim/shadow trung tính
        out.push({
          file,
          line: i + 1,
          text: trimmed,
          found: m[0],
          hint: 'dùng token ngữ nghĩa, hoặc src/lib/constants/palette.ts nếu là chart/canvas',
        });
      }
    }
  });

  return out;
}

async function main() {
  const offences: Offence[] = [];

  for (const root of SCAN_ROOTS) {
    for await (const file of walk(root)) {
      const source = await readFile(file, 'utf8');
      if (isAllowlisted(source)) continue;
      offences.push(...scan(relative(ROOT, file), source));
    }
  }

  if (offences.length === 0) {
    console.log('guard-no-adhoc-color: sạch — không có màu tự chế.');
    return;
  }

  const byFile = new Map<string, Offence[]>();
  for (const o of offences) {
    const list = byFile.get(o.file) ?? [];
    list.push(o);
    byFile.set(o.file, list);
  }

  console.error(
    `guard-no-adhoc-color: ${offences.length} chỗ dùng màu ngoài hệ, trong ${byFile.size} file.\n`,
  );
  for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${file}  (${list.length})`);
    for (const o of list.slice(0, 6)) {
      console.error(`    ${o.line}: ${o.found}  → ${o.hint}`);
    }
    if (list.length > 6) console.error(`    … còn ${list.length - 6} chỗ nữa`);
  }
  console.error(
    '\nMuốn miễn trừ một file thật sự đặc biệt: đặt `// guard-no-adhoc-color: allow` ở dòng đầu.',
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('guard-no-adhoc-color: lỗi khi chạy —', err);
  process.exitCode = 1;
});
