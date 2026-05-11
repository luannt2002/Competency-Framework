/**
 * guard-no-hardcode.ts
 *
 * AST-based guard that detects hardcoded business data in `src/components/`
 * and `src/app/`. Complements `guard-no-mock.ts` (which handles mock imports
 * and `NEXT_PUBLIC_USE_MOCK` flags via simple regex).
 *
 * Detection rules:
 *  1. Hardcoded domain-entity arrays — array literal of object literals whose
 *     keys match a domain entity shape (e.g. `slug` + `name`, often plus
 *     `description` / `level` / `category` / `xp`). These look like seed data
 *     and should live in DB/seed scripts, not in components.
 *  2. Hardcoded XP/streak/hearts numbers — assignments where the LHS name
 *     matches `currentXp`, `xp`, `streak`, `hearts`, `level` etc. and the RHS
 *     is a numeric literal > 1 (so `xp = 0` defaults are allowed).
 *  3. Mock data file imports — any module path containing `mock-data` or
 *     ending in `mock-data` (also caught by guard-no-mock but kept here for
 *     defence-in-depth on .tsx files).
 *  4. `NEXT_PUBLIC_USE_MOCK` identifier references anywhere in src/.
 *
 * Allowlist:
 *  - Files under `src/lib/constants/` (UI tokens, palettes, sizes).
 *  - Test files (`*.test.ts(x)`, `*.spec.ts(x)`).
 *  - Files whose first non-empty line is `// guard-no-hardcode: allow`.
 *  - Storybook stories (`*.stories.tsx`).
 *
 * Scope: scans only `src/components/**` and `src/app/**`. Everything else is
 * out of scope for this guard (server actions, db schemas, gamification rules
 * are expected to contain numeric constants).
 *
 * Exit code: 0 if clean, 1 if any offences. Output uses ANSI colors when
 * stdout is a TTY; otherwise plain text.
 */

import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const SCAN_ROOTS = [
  join(ROOT, 'src', 'components'),
  join(ROOT, 'src', 'app'),
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
]);

/**
 * Path-prefix allowlist (relative to repo root, posix-style). Files matching
 * any of these prefixes are skipped entirely.
 */
const ALLOWED_PATH_PREFIXES = [
  'src/lib/constants/',
];

/**
 * First-line opt-out marker. If a file starts with this comment, skip it.
 */
const FILE_ALLOW_MARKER = '// guard-no-hardcode: allow';

/**
 * Identifiers that, when used as LHS of an assignment/init with a non-zero
 * numeric literal RHS, suggest hardcoded gamification data.
 */
const HARDCODED_NUM_IDENTIFIERS = new Set([
  'currentXp',
  'totalXp',
  'dailyXp',
  'weeklyXp',
  'xp',
  'streak',
  'hearts',
  'currentStreak',
]);

/**
 * Keys that, when present on an inline object literal inside an array, mark
 * the object as a likely domain entity (skill / lesson / role / category).
 * The detection triggers when an object has `slug` AND `name`, OR `name` AND
 * one of (description, level, category, xp).
 */
const DOMAIN_KEY_PRIMARY = new Set(['slug', 'name']);
const DOMAIN_KEY_SECONDARY = new Set([
  'description',
  'level',
  'category',
  'xp',
  'hearts',
  'streak',
  'skillSlug',
  'roleSlug',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Offence = {
  file: string;
  line: number;
  column: number;
  rule: 'domain-array' | 'hardcoded-number' | 'mock-import' | 'mock-flag';
  message: string;
  snippet: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function isTestOrStory(file: string): boolean {
  return (
    /\.(test|spec)\.tsx?$/.test(file) ||
    /\.stories\.tsx?$/.test(file)
  );
}

function isAllowedByPrefix(relPath: string): boolean {
  const posix = toPosix(relPath);
  return ALLOWED_PATH_PREFIXES.some((p) => posix.startsWith(p));
}

function hasAllowMarker(source: string): boolean {
  // First non-empty line.
  for (const line of source.split('\n')) {
    const t = line.trim();
    if (t.length === 0) continue;
    return t === FILE_ALLOW_MARKER;
  }
  return false;
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries: Dirent[];
  try {
    // Cast: @types/node's overload uses a Buffer-flavoured Dirent generic when
    // withFileTypes is true, but the names we read are always strings here.
    entries = (await readdir(dir, { withFileTypes: true })) as unknown as Dirent[];
  } catch {
    return; // missing scan root is fine (e.g. fresh checkout without src/app)
  }
  for (const entry of entries) {
    const name = entry.name;
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (entry.isDirectory()) {
      await walk(full, out);
      continue;
    }
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx === -1) continue;
    const ext = name.slice(dotIdx);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    out.push(full);
  }
}

function getLineCol(sf: ts.SourceFile, pos: number): { line: number; column: number } {
  const lc = sf.getLineAndCharacterOfPosition(pos);
  return { line: lc.line + 1, column: lc.character + 1 };
}

function snippetFor(sf: ts.SourceFile, node: ts.Node): string {
  const text = sf.getFullText();
  const start = node.getStart(sf);
  // Take from start of node up to end of its line, capped at 120 chars.
  const newlineIdx = text.indexOf('\n', start);
  const end = newlineIdx === -1 ? Math.min(text.length, start + 120) : Math.min(newlineIdx, start + 120);
  return text.slice(start, end).trim();
}

// ---------------------------------------------------------------------------
// AST detection
// ---------------------------------------------------------------------------

function objectIsDomainEntity(obj: ts.ObjectLiteralExpression): boolean {
  const keys = new Set<string>();
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) {
      continue;
    }
    const name = prop.name;
    if (!name) continue;
    if (ts.isIdentifier(name)) keys.add(name.text);
    else if (ts.isStringLiteral(name)) keys.add(name.text);
  }

  // slug + name is the canonical domain signature.
  if (keys.has('slug') && keys.has('name')) return true;
  // name + 2+ secondary keys also looks like seed data.
  if (keys.has('name')) {
    let secondaryHits = 0;
    for (const k of keys) {
      if (DOMAIN_KEY_SECONDARY.has(k)) secondaryHits += 1;
    }
    if (secondaryHits >= 2) return true;
  }
  return false;
}

function arrayHasDomainEntity(arr: ts.ArrayLiteralExpression): boolean {
  for (const el of arr.elements) {
    if (ts.isObjectLiteralExpression(el) && objectIsDomainEntity(el)) {
      return true;
    }
  }
  return false;
}

function isInsideTypeContext(node: ts.Node): boolean {
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (
      ts.isTypeAliasDeclaration(cur) ||
      ts.isInterfaceDeclaration(cur) ||
      ts.isTypeLiteralNode(cur) ||
      ts.isTypeReferenceNode(cur)
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function isFunctionParameterDefault(node: ts.Node): boolean {
  // Walk up; if we hit a Parameter before any other binding boundary, it's a default.
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (ts.isParameter(cur)) return true;
    if (
      ts.isVariableDeclaration(cur) ||
      ts.isPropertyAssignment(cur) ||
      ts.isBinaryExpression(cur) ||
      ts.isCallExpression(cur)
    ) {
      return false;
    }
    cur = cur.parent;
  }
  return false;
}

function checkSource(sf: ts.SourceFile, relPath: string): Offence[] {
  const offences: Offence[] = [];

  const visit = (node: ts.Node): void => {
    // Rule 3: mock-data imports.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (/mock-data/.test(spec)) {
        const { line, column } = getLineCol(sf, node.moduleSpecifier.getStart(sf));
        offences.push({
          file: relPath,
          line,
          column,
          rule: 'mock-import',
          message: `Import from mock-data module is forbidden: '${spec}'`,
          snippet: snippetFor(sf, node),
        });
      }
    }

    // Rule 4: NEXT_PUBLIC_USE_MOCK identifier reference.
    if (ts.isIdentifier(node) && node.text === 'NEXT_PUBLIC_USE_MOCK') {
      const { line, column } = getLineCol(sf, node.getStart(sf));
      offences.push({
        file: relPath,
        line,
        column,
        rule: 'mock-flag',
        message: 'Reference to NEXT_PUBLIC_USE_MOCK is forbidden in app/components code.',
        snippet: snippetFor(sf, node),
      });
    }

    // Rule 1: hardcoded domain-entity arrays.
    if (ts.isArrayLiteralExpression(node) && !isInsideTypeContext(node)) {
      if (arrayHasDomainEntity(node)) {
        const { line, column } = getLineCol(sf, node.getStart(sf));
        offences.push({
          file: relPath,
          line,
          column,
          rule: 'domain-array',
          message:
            'Array of domain-shaped objects (slug/name/level/...) detected. ' +
            'Move to DB seed or fetch from server.',
          snippet: snippetFor(sf, node),
        });
      }
    }

    // Rule 2: hardcoded XP/streak/hearts numbers.
    //
    // Match three syntactic positions:
    //   const xp = 1240;          -> VariableDeclaration
    //   { xp: 1240 }              -> PropertyAssignment (object literal value)
    //   obj.xp = 1240;            -> BinaryExpression EqualsToken
    //
    // Skip:
    //   - inside type contexts (type Foo = { xp: 1 } unlikely but safe)
    //   - function parameter defaults (function f(xp = 0) {})
    //   - RHS that is 0 or 1 (treat as sensible defaults / boolean-ish)
    //   - JSX prop attributes where the value is also a literal (e.g.
    //     <X hearts={5} /> — that's a prop pass, not domain data; but we
    //     still flag obvious large numbers).
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      if (HARDCODED_NUM_IDENTIFIERS.has(node.name.text) && node.initializer) {
        const init = node.initializer;
        if (ts.isNumericLiteral(init)) {
          const n = Number(init.text);
          if (n > 1) {
            const { line, column } = getLineCol(sf, node.getStart(sf));
            offences.push({
              file: relPath,
              line,
              column,
              rule: 'hardcoded-number',
              message: `Hardcoded business number: ${node.name.text} = ${n}. Source from DB/API.`,
              snippet: snippetFor(sf, node),
            });
          }
        }
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    ) {
      const keyText = ts.isIdentifier(node.name) ? node.name.text : node.name.text;
      if (
        HARDCODED_NUM_IDENTIFIERS.has(keyText) &&
        ts.isNumericLiteral(node.initializer) &&
        !isInsideTypeContext(node) &&
        !isFunctionParameterDefault(node)
      ) {
        const n = Number(node.initializer.text);
        if (n > 1) {
          const { line, column } = getLineCol(sf, node.getStart(sf));
          offences.push({
            file: relPath,
            line,
            column,
            rule: 'hardcoded-number',
            message: `Hardcoded business number: ${keyText}: ${n}. Source from DB/API.`,
            snippet: snippetFor(sf, node),
          });
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.name) &&
      HARDCODED_NUM_IDENTIFIERS.has(node.left.name.text) &&
      ts.isNumericLiteral(node.right)
    ) {
      const n = Number(node.right.text);
      if (n > 1) {
        const { line, column } = getLineCol(sf, node.getStart(sf));
        offences.push({
          file: relPath,
          line,
          column,
          rule: 'hardcoded-number',
          message: `Hardcoded business number: ${node.left.name.text} = ${n}. Source from DB/API.`,
          snippet: snippetFor(sf, node),
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
  return offences;
}

// ---------------------------------------------------------------------------
// Public API (used by tests)
// ---------------------------------------------------------------------------

export type CheckOptions = {
  fileName?: string;
  relPath?: string;
};

/**
 * Run the guard against an in-memory source string. Useful for unit tests.
 * Returns the list of offences (empty if clean).
 */
export function checkSourceString(source: string, opts: CheckOptions = {}): Offence[] {
  const fileName = opts.fileName ?? 'virtual.tsx';
  const relPath = opts.relPath ?? fileName;
  if (hasAllowMarker(source)) return [];
  if (isTestOrStory(fileName)) return [];
  if (isAllowedByPrefix(relPath)) return [];
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return checkSource(sf, relPath);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const useColor = process.stdout.isTTY === true;
const c = {
  red: (s: string) => (useColor ? `[31m${s}[0m` : s),
  yellow: (s: string) => (useColor ? `[33m${s}[0m` : s),
  green: (s: string) => (useColor ? `[32m${s}[0m` : s),
  cyan: (s: string) => (useColor ? `[36m${s}[0m` : s),
  dim: (s: string) => (useColor ? `[2m${s}[0m` : s),
  bold: (s: string) => (useColor ? `[1m${s}[0m` : s),
};

async function main(): Promise<void> {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    await walk(root, files);
  }

  const allOffences: Offence[] = [];

  await Promise.all(
    files.map(async (file) => {
      const rel = toPosix(relative(ROOT, file));
      if (isTestOrStory(file)) return;
      if (isAllowedByPrefix(rel)) return;
      const source = await readFile(file, 'utf8');
      if (hasAllowMarker(source)) return;
      const sf = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const offences = checkSource(sf, rel);
      allOffences.push(...offences);
    }),
  );

  if (allOffences.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      c.green('[guard-no-hardcode] OK') +
        c.dim(` — scanned ${files.length} files, no hardcoded business data found.`),
    );
    return;
  }

  // Group by file for readable output.
  const byFile = new Map<string, Offence[]>();
  for (const off of allOffences) {
    const arr = byFile.get(off.file) ?? [];
    arr.push(off);
    byFile.set(off.file, arr);
  }

  // eslint-disable-next-line no-console
  console.error(c.bold(c.red(`\n[guard-no-hardcode] ${allOffences.length} offence(s) found:\n`)));

  for (const [file, offs] of byFile) {
    // eslint-disable-next-line no-console
    console.error(c.cyan(file));
    for (const o of offs) {
      // eslint-disable-next-line no-console
      console.error(
        `  ${c.yellow(`${o.line}:${o.column}`)} ${c.bold(`[${o.rule}]`)} ${o.message}`,
      );
      // eslint-disable-next-line no-console
      console.error(`    ${c.dim(o.snippet)}`);
    }
    // eslint-disable-next-line no-console
    console.error('');
  }

  // eslint-disable-next-line no-console
  console.error(
    c.dim(
      'Hint: move domain data to drizzle/seed.ts or a server action. ' +
        'Add `// guard-no-hardcode: allow` on the first line of a file to opt out (rare).',
    ),
  );

  process.exit(1);
}

// Run only when executed directly. `tsx` sets argv[1] to this file's path.
const isMain = (() => {
  try {
    const entry = process.argv[1] ?? '';
    return entry.endsWith('guard-no-hardcode.ts') || entry.endsWith('guard-no-hardcode.js');
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[guard-no-hardcode] Unexpected error:', error);
    process.exit(1);
  });
}
