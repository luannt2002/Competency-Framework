import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.md', '.env', '.example']);

const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; message: string }> = [
  {
    regex: /NEXT_PUBLIC_USE_MOCK\s*=\s*true/g,
    message: 'Mock mode must never be enabled in env files.',
  },
  {
    regex: /from\s+['"]@\/lib\/mock-data\/devops['"]/g,
    message: 'Direct mock data import is not allowed.',
  },
  {
    regex: /import\s+\*\s+as\s+mock\s+from\s+['"]@\/lib\/mock-data\/devops['"]/g,
    message: 'Mock namespace import is not allowed.',
  },
];

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
]);

function hasAllowedExtension(path: string): boolean {
  for (const ext of ALLOWED_EXT) {
    if (path.endsWith(ext)) return true;
  }
  return false;
}

async function walk(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, out);
      continue;
    }
    if (hasAllowedExtension(fullPath)) out.push(fullPath);
  }
}

async function main() {
  const files: string[] = [];
  await walk(ROOT, files);

  const violations: string[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.regex.test(content)) {
        violations.push(`${filePath}: ${rule.message}`);
      }
      rule.regex.lastIndex = 0;
    }
  }

  if (violations.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\n[guard-no-mock] Forbidden patterns found:\n');
    for (const v of violations) {
      // eslint-disable-next-line no-console
      console.error(`- ${v}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('[guard-no-mock] OK: no forbidden mock/hardcoded runtime flags found.');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[guard-no-mock] Unexpected error:', error);
  process.exit(1);
});
